import { validateReleasePlan } from '../adapter-contract.js';
const shaPattern = /^[0-9a-f]{40}$/i;
const repoPart = /^[A-Za-z0-9_.-]+$/;
function record(value, label) {
    if (!value || typeof value !== 'object' || Array.isArray(value))
        throw new Error(`${label} inválido`);
    return value;
}
function sha(value, label) {
    if (typeof value !== 'string' || !shaPattern.test(value))
        throw new Error(`${label} inválido`);
    return value.toLowerCase();
}
function message(error) { return error instanceof Error ? error.message : String(error); }
function entryResult(entry, status, releaseUrl, reason) {
    return { package: entry.package, tag: entry.tag, status, releaseUrl,
        ...(reason && { reason }) };
}
function result(outcome, entries, publishedSha = '', error) {
    return { outcome, publishedSha, entries, ...(error && { error }) };
}
function notes(plan, entry, additionalNotes = '') {
    return [`${entry.tag} calculada pelo adaptador ${plan.adapter} no commit ${plan.sha}.`, '',
        entry.notes.trim(), ...(plan.adapter === 'changesets' ? ['', 'Lote coordenado:',
            ...plan.entries.map(item => `- ${item.tag} (${item.bump})`)] : []),
        ...(additionalNotes ? ['', additionalNotes] : [])].join('\n');
}
export async function publishReleasePlan(request) {
    if (!repoPart.test(request.owner) || !repoPart.test(request.repo) ||
        typeof request.verify !== 'function' || request.additionalNotes !== undefined &&
        typeof request.additionalNotes !== 'string')
        throw new Error('Contexto de publicação inválido');
    const plan = validateReleasePlan(request.plan);
    const publishedSha = sha(request.publishedSha, 'SHA publicado');
    if (plan.status === 'no-release')
        return result('no-release', []);
    const scope = `repos/${request.owner}/${request.repo}`;
    const entries = plan.entries.map(entry => entryResult(entry, 'pending', null));
    const verifyEvidence = async () => {
        const evidence = await request.verify();
        if (sha(evidence.publishedSha, 'SHA da evidência') !== publishedSha) {
            throw new Error('Evidência de publicação diverge do SHA integrado');
        }
    };
    const readiness = async () => {
        await verifyEvidence();
        const ref = record(await request.read.get(`${scope}/git/ref/heads/${plan.branch}`), 'Ref alvo');
        const branchSha = sha(record(ref.object, 'Objeto da ref alvo').sha, 'SHA da branch alvo');
        if (branchSha !== publishedSha)
            throw new Error('Branch alvo avançou após aprovação');
    };
    const inventory = async (entry) => {
        const tagPath = encodeURIComponent(entry.tag);
        const remoteRef = await request.read.getOptional(`${scope}/git/ref/tags/${tagPath}`);
        let tagSha = null;
        let kindConflict = null;
        if (remoteRef) {
            const object = record(record(remoteRef, 'Tag ref').object, 'Objeto da tag');
            const type = object.type;
            if ((type === 'tag') !== (entry.tagKind === 'annotated')) {
                kindConflict = `Tag ${entry.tag} tem tipo diferente do plano`;
            }
            tagSha = sha(object.sha, 'Tag SHA');
            if (type === 'tag') {
                const annotated = record(await request.read.get(`${scope}/git/tags/${tagSha}`), 'Tag anotada');
                const target = record(annotated.object, 'Target da tag anotada');
                if (target.type !== 'commit')
                    return { tagSha: null, releaseUrl: null,
                        conflict: `Tag ${entry.tag} não aponta para commit` };
                tagSha = sha(target.sha, 'Commit da tag');
            }
            else if (type !== 'commit')
                return { tagSha: null, releaseUrl: null,
                    conflict: `Tag ${entry.tag} tem tipo inesperado` };
        }
        const rawRelease = await request.read.getOptional(`${scope}/releases/tags/${tagPath}`);
        let releaseUrl = null;
        let conflict = kindConflict ?? (tagSha && tagSha !== publishedSha ?
            `Tag ${entry.tag} aponta para outro commit` : null);
        if (rawRelease) {
            const release = record(rawRelease, 'Release');
            if (!tagSha || release.tag_name !== entry.tag ||
                release.target_commitish !== publishedSha || typeof release.html_url !== 'string' ||
                !release.html_url.startsWith('https://')) {
                conflict = `Release ${entry.tag} diverge de tag/SHA ou URL`;
            }
            else
                releaseUrl = release.html_url;
        }
        return { tagSha, releaseUrl, conflict };
    };
    const refresh = async () => Promise.all(plan.entries.map(inventory));
    const applyInventory = (values, wrote) => {
        values.forEach((value, index) => {
            const entry = plan.entries[index];
            entries[index] = entryResult(entry, value.conflict ? 'conflict' : value.releaseUrl ?
                wrote.has(entry.tag) ? 'created' : 'existing' : 'pending', value.releaseUrl, value.conflict ?? undefined);
        });
    };
    const wrote = new Set();
    let current;
    try {
        current = await refresh();
        applyInventory(current, wrote);
    }
    catch (error) {
        return result('blocked', entries, '', message(error));
    }
    if (current.some(value => value.conflict))
        return result('conflict', entries, '', current.find(value => value.conflict)?.conflict ?? 'Conflito remoto');
    try {
        await verifyEvidence();
    }
    catch (error) {
        return result('blocked', entries, '', message(error));
    }
    if (current.every(value => value.releaseUrl))
        return result('already-published', entries, publishedSha);
    try {
        await readiness();
        current = await refresh();
        applyInventory(current, wrote);
    }
    catch (error) {
        return result('blocked', entries, '', message(error));
    }
    if (current.some(value => value.conflict))
        return result('conflict', entries, '', current.find(value => value.conflict)?.conflict ?? 'Conflito remoto');
    if (current.every(value => value.releaseUrl))
        return result('already-published', entries, publishedSha);
    for (const entry of plan.entries) {
        const index = plan.entries.indexOf(entry);
        try {
            await readiness();
            let observed = await inventory(entry);
            if (observed.conflict)
                throw new Error(observed.conflict);
            if (!observed.tagSha) {
                let referenceSha = publishedSha;
                if (entry.tagKind === 'annotated') {
                    const object = record(await request.write.post(`${scope}/git/tags`, {
                        tag: entry.tag, message: `Release ${entry.tag}`, object: publishedSha, type: 'commit',
                    }), 'Tag anotada criada');
                    referenceSha = sha(object.sha, 'Objeto da tag criada');
                }
                try {
                    await request.write.post(`${scope}/git/refs`, {
                        ref: `refs/tags/${entry.tag}`, sha: referenceSha,
                    });
                }
                catch (error) {
                    const race = await inventory(entry);
                    if (race.conflict || race.tagSha !== publishedSha)
                        throw error;
                }
                wrote.add(entry.tag);
                observed = await inventory(entry);
                if (observed.conflict || observed.tagSha !== publishedSha)
                    throw new Error(`Tag ${entry.tag} não convergiu`);
            }
            if (!observed.releaseUrl) {
                await readiness();
                try {
                    const created = record(await request.write.post(`${scope}/releases`, {
                        tag_name: entry.tag, target_commitish: publishedSha,
                        name: entry.tag, body: notes(plan, entry, request.additionalNotes),
                    }), 'Release criada');
                    if (created.tag_name !== entry.tag || created.target_commitish !== publishedSha ||
                        typeof created.html_url !== 'string' || !created.html_url.startsWith('https://')) {
                        throw new Error(`Release ${entry.tag} retornou identidade inválida`);
                    }
                    wrote.add(entry.tag);
                    entries[index] = entryResult(entry, 'created', created.html_url);
                }
                catch (error) {
                    const race = await inventory(entry);
                    if (race.conflict || !race.releaseUrl)
                        throw error;
                }
                wrote.add(entry.tag);
                observed = await inventory(entry);
                if (observed.conflict || !observed.releaseUrl)
                    throw new Error(`Release ${entry.tag} não convergiu`);
            }
            entries[index] = entryResult(entry, wrote.has(entry.tag) ? 'created' : 'existing', observed.releaseUrl);
        }
        catch (error) {
            try {
                current = await refresh();
                applyInventory(current, wrote);
            }
            catch { /* Preserve verified local progress when the API is unavailable. */ }
            const conflict = entries.some(value => value.status === 'conflict');
            return result(conflict ? 'conflict' : 'partial', entries, '', message(error));
        }
    }
    return result(wrote.size ? 'published' : 'already-published', entries, publishedSha);
}
