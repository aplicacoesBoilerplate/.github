import { appendFileSync, mkdirSync, readFileSync, realpathSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { adapterCapabilities, planFromReport, validateReleasePlan } from '../adapter-contract.js';
import { resolveAdapter } from '../adapter-registry.js';
import { createGitPort } from '../ports/git.js';
import { createReadApi } from '../ports/github.js';
import { runProcess } from '../ports/process.js';
import { collectPrEvidence } from '../services/pr-evidence.js';
import { evaluateReleasePolicy } from '../services/release-policy.js';
import { publicationPayloadDigest } from '../services/publication-payload.js';
import { loadArtifact, verifyPlan, verifyProducer } from '../services/publication-artifact.js';
import { resolvePushOrigin } from './resolve-origin.js';
import { verifyLegacyTechnicalMerge } from '../services/legacy-technical-merge.js';
import { verifyTechnicalMerge } from '../services/technical-merge.js';
import { allowedVersionWrites, captureVersionFiles, validateVersionFiles } from '../services/version-files.js';
export { allowedVersionWrites } from '../services/version-files.js';
const shaPattern = /^[0-9a-f]{40}$/i;
const partPattern = /^[A-Za-z0-9_.-]+$/;
const branchPattern = /^[A-Za-z0-9._/-]+$/;
function record(value, label) {
    if (!value || typeof value !== 'object' || Array.isArray(value))
        throw new Error(`${label} inválido`);
    return value;
}
function checkedSha(value, label) {
    if (typeof value !== 'string' || !shaPattern.test(value))
        throw new Error(`${label} SHA inválido`);
    return value.toLowerCase();
}
function checkedProducer(value, repository) {
    if (!value || value.repository !== repository || !Number.isSafeInteger(value.runId) || value.runId < 1 ||
        !Number.isSafeInteger(value.runAttempt) || value.runAttempt < 1 ||
        typeof value.job !== 'string' || !partPattern.test(value.job)) {
        throw new Error('Identidade do job produtor inválida');
    }
    return { ...value, centralSha: checkedSha(value.centralSha, 'Workflow central') };
}
function isFunctional(ref) {
    return ref === 'develop' || typeof ref === 'string' && /^hotfix\/.+/.test(ref);
}
function validateOriginArtifact(origin, context, adapter) {
    const plan = validateReleasePlan(origin.plan);
    if (plan.adapter !== adapter || plan.branch !== context.targetBranch ||
        plan.status !== 'release' || !origin.bundle || !origin.report || !origin.snapshot) {
        throw new Error('Artifact de origem incompleto ou divergente');
    }
    const descriptor = resolveAdapter(adapter, { [adapter]: { collect: () => origin.report,
            ...(['standard-version', 'changesets', 'release-please'].includes(adapter) ?
                { prepare: () => origin.bundle } : {}) } });
    if (planFromReport(origin.report, descriptor, plan.entries[0].projectPath).planDigest !== plan.planDigest) {
        throw new Error('Artifact de origem tem plano adulterado');
    }
    if (adapter === 'changesets' || adapter === 'release-please') {
        validateVersionFiles({ repository: context.repository, plan,
            bundle: origin.bundle,
            trustedAllowedWrites: allowedVersionWrites(plan, context.repository) }, false, false);
    }
    else if (adapter !== 'standard-version')
        throw new Error('PR técnico não permitido para o adaptador');
    return { plan, bundle: origin.bundle };
}
/** A read-side result only: it never receives a WriteApi or an App credential. */
export async function preparePublication(request) {
    const repository = `${request.owner}/${request.repo}`;
    if (!partPattern.test(request.owner) || !partPattern.test(request.repo) ||
        !branchPattern.test(request.context.targetBranch) || request.context.targetBranch.includes('..') ||
        !Array.isArray(request.requiredChecks) || !request.requiredChecks.length ||
        request.requiredChecks.some(name => typeof name !== 'string' || !name)) {
        throw new Error('Contexto de publicação inválido');
    }
    const publishedSha = checkedSha(request.context.sha, 'Commit integrado');
    const producer = checkedProducer(request.producer, repository);
    if (request.git.headSha() !== publishedSha)
        throw new Error('Checkout difere do SHA integrado');
    const metadata = record(await request.read.get(`repos/${repository}`), 'Repositório');
    if (metadata.default_branch !== request.context.targetBranch) {
        throw new Error('Publicação restrita à branch principal');
    }
    const ref = record(await request.read.get(`repos/${repository}/git/ref/heads/${request.context.targetBranch}`), 'Ref principal');
    if (checkedSha(record(ref.object, 'Objeto da ref').sha, 'Ref principal') !== publishedSha) {
        throw new Error('Branch principal avançou; recolete evidência');
    }
    const associated = await request.read.list(`repos/${repository}/commits/${publishedSha}/pulls?per_page=100`);
    const matches = associated.map(value => record(value, 'PR associado')).filter(value => value.merged_at && value.merge_commit_sha === publishedSha &&
        record(value.base, 'Base do PR').ref === request.context.targetBranch);
    if (matches.length !== 1 || !Number.isSafeInteger(matches[0].number)) {
        throw new Error('Associação de PR integrado ambígua ou origem inválida');
    }
    const merged = matches[0];
    const headBranch = record(merged.head, 'Head do PR').ref;
    const technical = typeof headBranch === 'string' && headBranch.startsWith('versioning/');
    if (!technical && !isFunctional(headBranch))
        throw new Error('Origem do PR integrado inválida');
    const gitInputs = request.git.captureInputs(request.adapter);
    if (technical) {
        const origin = request.origin;
        if (!origin || !origin.report || !origin.plan || !origin.bundle || !origin.snapshot ||
            !origin.producer)
            throw new Error('Artifact técnico incompleto');
        checkedProducer(origin.producer, repository);
        const { plan, bundle } = (request.validateOrigin ?? (value => validateOriginArtifact(value, request.context, request.adapter)))(origin);
        if (plan.sha !== origin.snapshot.mergeCommitSha || origin.snapshot.number < 1 ||
            origin.snapshot.repository !== repository || origin.snapshot.baseBranch !== plan.branch ||
            !isFunctional(origin.snapshot.headBranch))
            throw new Error('Origem funcional do artifact inválida');
        const verified = request.adapter === 'standard-version' ?
            await verifyLegacyTechnicalMerge({ repository: request.context.repository, owner: request.owner,
                repo: request.repo, plan, bundle, origin: origin.snapshot,
                technicalPrNumber: Number(merged.number), publishedSha,
                requiredChecks: request.requiredChecks, read: request.read,
                ...(request.botLogin ? { botLogin: request.botLogin } : {}) }) :
            await (request.verifyTechnical ?? verifyTechnicalMerge)({
                repository: request.context.repository, owner: request.owner, repo: request.repo,
                botLogin: request.botLogin ?? '', plan, bundle: bundle,
                trustedAllowedWrites: allowedVersionWrites(plan, request.context.repository),
                originPrNumber: origin.snapshot.number,
                technicalPrNumber: Number(merged.number), expectedFunctionalEvidence: origin.snapshot,
                publishedSha, requiredChecks: request.requiredChecks, read: request.read,
            });
        if (verified.functionalSha !== plan.sha || verified.publishedSha !== publishedSha ||
            verified.planDigest !== plan.planDigest)
            throw new Error('Merge técnico diverge do artifact');
        const policy = evaluateReleasePolicy({ report: plan.report, snapshot: origin.snapshot,
            phase: 'publication' });
        if (policy.outcome === 'blocked')
            throw new Error(`Policy funcional bloqueou: ${policy.reasons.join('; ')}`);
        request.git.verifyInputs(gitInputs, publishedSha, '', request.adapter);
        return { phase: 'technical', producer, functionalSha: verified.functionalSha, publishedSha,
            originPrNumber: origin.snapshot.number, technicalPrNumber: Number(merged.number),
            report: origin.report, plan, bundle, snapshot: origin.snapshot,
            policy,
            gitInputs, technicalMerge: verified };
    }
    if (request.origin)
        throw new Error('Artifact técnico inesperado no merge funcional');
    const snapshot = await collectPrEvidence(request.read, { repository,
        targetBranch: request.context.targetBranch, commitSha: publishedSha,
        requiredChecks: request.requiredChecks });
    if (snapshot.number !== merged.number)
        throw new Error('Origem funcional divergente');
    const descriptor = resolveAdapter(request.adapter, request.implementations);
    const report = await descriptor.collect(request.context);
    const plan = planFromReport(report, descriptor, request.context.projectPath);
    if (plan.sha !== publishedSha || plan.branch !== request.context.targetBranch) {
        throw new Error('Plano nativo diverge do commit integrado');
    }
    const policy = plan.status === 'release' ? evaluateReleasePolicy({ report: plan.report,
        snapshot, phase: 'publication' }) : null;
    if (policy?.outcome === 'blocked')
        throw new Error(`Policy bloqueou publicação: ${policy.reasons.join('; ')}`);
    const bundle = plan.status === 'release' && descriptor.needsVersionPr ?
        await (request.prepareBundle ?? (async () => { throw new Error('Preparador de bundle ausente'); }))(plan) : null;
    if (plan.status === 'release' && descriptor.needsVersionPr && !bundle) {
        throw new Error('Artifact de bundle incompleto');
    }
    request.git.verifyInputs(gitInputs, publishedSha, plan.entries.map(entry => entry.tag), request.adapter);
    return { phase: 'functional', producer, functionalSha: publishedSha, publishedSha,
        originPrNumber: snapshot.number, technicalPrNumber: null, report, plan, bundle, snapshot,
        policy, gitInputs, technicalMerge: null };
}
function required(value, name) {
    if (!value)
        throw new Error(`${name} obrigatório`);
    return value;
}
function positive(value, name) {
    if (!value || !/^[1-9][0-9]*$/.test(value) || !Number.isSafeInteger(Number(value))) {
        throw new Error(`${name} inválido`);
    }
    return Number(value);
}
function transport(token) {
    return async (request) => {
        const response = await fetch(request.url, { method: request.method,
            headers: { Accept: 'application/vnd.github+json', 'X-GitHub-Api-Version': '2022-11-28',
                Authorization: `Bearer ${token}` } });
        const body = await response.text();
        return { status: response.status, headers: Object.fromEntries(response.headers.entries()),
            body: body ? JSON.parse(body) : null };
    };
}
async function nativeImplementations(adapter, owner, repo, api) {
    switch (adapter) {
        case 'go-gitsemver': {
            const module = await import('../adapters/go-gitsemver.js');
            return { [adapter]: { collect: context => module.collectGoVersion(context) } };
        }
        case 'jgitver': {
            const module = await import('../adapters/jgitver.js');
            return { [adapter]: { collect: context => module.collectJgitverReport(context) } };
        }
        case 'standard-version': {
            const module = await import('../adapters/standard-version.js');
            return { [adapter]: { collect: context => module.collectStandardVersion(context),
                    prepare: () => { throw new Error('Preparação acontece no leitor após o cálculo'); } } };
        }
        case 'changesets': {
            const module = await import('../adapters/changesets.js');
            return { [adapter]: { collect: context => module.collectChangesets(context),
                    prepare: (context, plan) => module.prepareChangesets(context, plan) } };
        }
        case 'release-please': {
            const module = await import('../adapters/release-please.js');
            return { [adapter]: { collect: context => module.collectReleasePlease(context, { owner, repo, transport: api }),
                    prepare: (context, plan) => module.prepareReleasePlease(context, plan, { owner, repo, transport: api }) } };
        }
    }
}
async function nativeBundle(context, plan, owner, repo, api) {
    if (plan.status !== 'release')
        throw new Error('Bundle exige plano de release');
    if (plan.adapter === 'release-please') {
        const module = await import('../adapters/release-please.js');
        const prepared = await module.prepareReleasePlease(context, plan, { owner, repo, transport: api });
        return captureVersionFiles({ repository: context.repository, plan,
            operations: prepared.files.map(file => ({ op: 'write', path: file.path, content: file.content })) });
    }
    if (plan.adapter === 'changesets') {
        const module = await import('../adapters/changesets.js');
        const changed = module.prepareChangesets(context, plan);
        return captureVersionFiles({ repository: context.repository, plan,
            trustedAllowedWrites: allowedVersionWrites(plan, context.repository), operations: changed.map(path => {
                try {
                    return { op: 'write', path,
                        content: readFileSync(join(context.repository, path)).toString('base64') };
                }
                catch (error) {
                    if (error.code === 'ENOENT')
                        return { op: 'delete', path };
                    throw error;
                }
            }) });
    }
    if (plan.adapter === 'standard-version') {
        const legacy = await import('../services/legacy-version-bundle.js');
        const { validateVersionReport } = await import('../compat/version-report.js');
        const standard = await import('../adapters/standard-version.js');
        runProcess({ command: standard.standardVersionBinary(context),
            args: ['--skip.commit', '--skip.tag', '--tag-prefix', context.tagPrefix],
            cwd: join(context.workspace, context.projectPath), workspace: context.workspace });
        return legacy.captureVersionBundle({ repository: context.repository,
            projectPath: context.projectPath, report: validateVersionReport(plan.report) });
    }
    throw new Error('Adaptador não gera bundle técnico');
}
export function publicationNeedsVersionPr(result) {
    return result.phase === 'functional' && result.plan.status === 'release' &&
        adapterCapabilities[result.plan.adapter].needsVersionPr;
}
/** CLI boundary. T24–T25 wire the hosted workflow and the technical-origin artifact. */
export async function preparePublicationMain(env = process.env, dependencies = {}) {
    try {
        if (env.GITHUB_EVENT_NAME !== 'push' || env.GITHUB_REF_NAME !== env.TARGET_BRANCH) {
            throw new Error('Publicação exige push na branch principal');
        }
        const workspace = realpathSync(required(env.VERSIONING_WORKSPACE ?? env.GITHUB_WORKSPACE, 'VERSIONING_WORKSPACE'));
        const [owner, repo, extra] = required(env.GITHUB_REPOSITORY, 'GITHUB_REPOSITORY').split('/');
        if (!owner || !repo || extra)
            throw new Error('Repositório inválido');
        const adapter = required(env.ADAPTER, 'ADAPTER');
        const api = dependencies.transport ?? transport(dependencies.read && (dependencies.implementations || env.VERSIONING_ORIGIN_DIR) ? '' :
            required(env.GH_TOKEN ?? env.GITHUB_TOKEN, 'GH_TOKEN'));
        const context = { repository: workspace, workspace,
            projectPath: env.PROJECT_PATH ?? '.', targetBranch: required(env.TARGET_BRANCH, 'TARGET_BRANCH'),
            sha: required(env.GITHUB_SHA, 'GITHUB_SHA'), tagPrefix: env.TAG_PREFIX ?? 'v',
            configuration: env.ADAPTER_BIN ? { adapterBin: env.ADAPTER_BIN } : {} };
        if (!context.projectPath || context.projectPath.startsWith('/') ||
            context.projectPath.includes('\\') || context.projectPath.includes(':') ||
            context.projectPath.split('/').some(part => !part || part === '..')) {
            throw new Error('projectPath fora do workspace');
        }
        const read = dependencies.read ?? createReadApi(api);
        let origin;
        let botLogin = env.VERSIONING_BOT_LOGIN;
        if (env.VERSIONING_ORIGIN_DIR) {
            const reference = await resolvePushOrigin({ owner, repo, adapter, read,
                targetBranch: context.targetBranch, publishedSha: context.sha,
                centralSha: required(env.CENTRAL_SHA, 'CENTRAL_SHA'),
                centralRepository: required(env.CENTRAL_REPOSITORY, 'CENTRAL_REPOSITORY') });
            if (!reference)
                throw new Error('Artifact técnico inesperado no merge funcional');
            if (botLogin && botLogin !== reference.botLogin)
                throw new Error('Identidade do bot técnico diverge');
            botLogin = reference.botLogin;
            const artifact = loadArtifact(env.VERSIONING_ORIGIN_DIR), source = reference.source;
            const trust = { owner, repo, adapter, projectPath: context.projectPath,
                targetBranch: context.targetBranch, tagPrefix: context.tagPrefix,
                publishedSha: reference.functionalSha, centralSha: source.centralSha,
                centralRepository: required(env.CENTRAL_REPOSITORY, 'CENTRAL_REPOSITORY'),
                runId: source.runId, runAttempt: source.runAttempt, artifactId: source.artifactId,
                expectedProducerJob: 'validate-publication', planDigest: source.planDigest, payloadDigest: source.payloadDigest };
            verifyPlan(artifact, trust);
            await verifyProducer(read, trust, artifact.publicationEvidence.producer);
            if (artifact.publicationEvidence.phase !== 'functional' || !artifact.bundle) {
                throw new Error('Artifact de origem não é funcional ou não contém bundle');
            }
            origin = { report: artifact.report, plan: artifact.plan, bundle: artifact.bundle,
                snapshot: artifact.snapshot, producer: artifact.publicationEvidence.producer };
        }
        const result = await preparePublication({ owner, repo, adapter, context,
            producer: { repository: `${owner}/${repo}`, runId: positive(env.GITHUB_RUN_ID, 'GITHUB_RUN_ID'),
                runAttempt: positive(env.GITHUB_RUN_ATTEMPT, 'GITHUB_RUN_ATTEMPT'),
                job: required(env.GITHUB_JOB, 'GITHUB_JOB'),
                centralSha: required(env.CENTRAL_SHA, 'CENTRAL_SHA') },
            read, git: dependencies.git ?? createGitPort(workspace),
            implementations: origin ? {} : dependencies.implementations ?? await nativeImplementations(adapter, owner, repo, api),
            requiredChecks: (env.REQUIRED_CHECKS ?? 'build').split(',').map(item => item.trim()).filter(Boolean),
            prepareBundle: dependencies.prepareBundle ?? (plan => nativeBundle(context, plan, owner, repo, api)),
            ...(origin ? { origin } : {}),
            ...(botLogin ? { botLogin } : {}),
        });
        const directory = env.VERSIONING_OUTPUT_DIR ?? join(env.RUNNER_TEMP ?? workspace, 'versioning');
        mkdirSync(directory, { recursive: true });
        const json = (value) => `${JSON.stringify(value, null, 2)}\n`;
        writeFileSync(join(directory, 'version-report.json'), json(result.report));
        writeFileSync(join(directory, 'release-plan.json'), json(result.plan));
        writeFileSync(join(directory, 'pr-policy.json'), json(result.snapshot));
        writeFileSync(join(directory, 'release-policy.json'), json(result.policy));
        writeFileSync(join(directory, 'git-inputs.json'), json(result.gitInputs));
        const publicationEvidence = { phase: result.phase,
            producer: result.producer, functionalSha: result.functionalSha,
            publishedSha: result.publishedSha, originPrNumber: result.originPrNumber,
            technicalPrNumber: result.technicalPrNumber, planDigest: result.plan.planDigest,
            technicalMerge: result.technicalMerge };
        writeFileSync(join(directory, 'publication-evidence.json'), json(publicationEvidence));
        if (result.bundle)
            writeFileSync(join(directory, 'version-bundle.json'), json(result.bundle));
        if (env.GITHUB_OUTPUT)
            appendFileSync(env.GITHUB_OUTPUT, `phase=${result.phase}\nartifact_name=publication-${result.producer.runId}-${result.producer.runAttempt}\n` +
                `needs_version_pr=${publicationNeedsVersionPr(result)}\nbot_login=${botLogin ?? ''}\n` +
                `producer_run_id=${result.producer.runId}\nproducer_run_attempt=${result.producer.runAttempt}\n` +
                `plan_digest=${result.plan.planDigest}\npayload_digest=${publicationPayloadDigest({ ...result,
                    publicationEvidence })}\n`);
        return 0;
    }
    catch (error) {
        (dependencies.error ?? console.error)(error instanceof Error ? error.message : String(error));
        return 1;
    }
}
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
    process.exitCode = await preparePublicationMain();
}
