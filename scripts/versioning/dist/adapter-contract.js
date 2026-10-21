import { createHash } from 'node:crypto';
const expected = Object.freeze({
    'go-gitsemver': Object.freeze({ runtime: 'go', reportKind: 'single', needsVersionPr: false, tagKind: 'lightweight' }),
    jgitver: Object.freeze({ runtime: 'java', reportKind: 'single', needsVersionPr: false, tagKind: 'annotated' }),
    'standard-version': Object.freeze({ runtime: 'node', reportKind: 'single', needsVersionPr: true, tagKind: 'lightweight' }),
    changesets: Object.freeze({ runtime: 'node', reportKind: 'batch', needsVersionPr: true, tagKind: 'lightweight' }),
    'release-please': Object.freeze({ runtime: 'node', reportKind: 'single', needsVersionPr: true, tagKind: 'lightweight' }),
});
const shaPattern = /^[0-9a-f]{40}$/i;
const digestPattern = /^[0-9a-f]{64}$/i;
const semverPattern = /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)$/;
const packagePattern = /^(?:@[a-z0-9][a-z0-9._-]*\/)?[a-z0-9][a-z0-9._-]*$/;
const bumps = new Set(['major', 'minor', 'patch', 'none']);
function record(value, label) {
    if (value === null || typeof value !== 'object' || Array.isArray(value))
        throw new Error(`${label} inválido`);
    return value;
}
function adapterId(value) {
    if (typeof value !== 'string' || !Object.hasOwn(expected, value)) {
        throw new Error(`Adaptador não suportado: ${String(value)}`);
    }
    return value;
}
export function validateDescriptor(value) {
    const candidate = record(value, 'Descriptor');
    const id = adapterId(candidate.id);
    const capability = expected[id];
    if (candidate.runtime !== capability.runtime || candidate.reportKind !== capability.reportKind ||
        candidate.needsVersionPr !== capability.needsVersionPr || candidate.tagKind !== capability.tagKind) {
        throw new Error(`Adaptador ${id} com capacidade inválida`);
    }
    if (typeof candidate.collect !== 'function')
        throw new Error(`Adaptador ${id} sem collect`);
    if (capability.needsVersionPr && typeof candidate.prepare !== 'function') {
        throw new Error(`Adaptador ${id} requer prepare`);
    }
    if (!capability.needsVersionPr && candidate.prepare !== undefined) {
        throw new Error(`Adaptador ${id} não permite prepare`);
    }
    return Object.freeze({ ...candidate });
}
function canonical(value, seen = new Set()) {
    if (value === null || typeof value === 'string' || typeof value === 'boolean')
        return value;
    if (typeof value === 'number' && Number.isFinite(value))
        return value;
    if (typeof value !== 'object')
        throw new Error('Plano contém valor não serializável');
    if (seen.has(value))
        throw new Error('Plano contém ciclo');
    seen.add(value);
    if (Array.isArray(value)) {
        const result = value.map(item => canonical(item, seen));
        seen.delete(value);
        return result;
    }
    const prototype = Object.getPrototypeOf(value);
    if (prototype !== Object.prototype && prototype !== null)
        throw new Error('Plano contém objeto não JSON');
    const result = Object.create(null);
    for (const key of Object.keys(value).sort())
        result[key] = canonical(value[key], seen);
    seen.delete(value);
    return result;
}
function planDigest(body) {
    return createHash('sha256').update(JSON.stringify(canonical(body))).digest('hex');
}
function checkedPath(value) {
    if (typeof value !== 'string' || !value || value.startsWith('/') || value.includes('\\') ||
        value.includes(':') ||
        value.split('/').includes('..') || value.includes('\0'))
        throw new Error('projectPath inválido');
    return value;
}
function checkedVersion(value) {
    if (typeof value !== 'string' || !semverPattern.test(value))
        throw new Error('SemVer estável inválido');
    return value;
}
function bumpBetween(before, after) {
    const left = before.split('.').map(Number);
    const right = after.split('.').map(Number);
    if (right[0] < left[0] || (right[0] === left[0] && right[1] < left[1]) ||
        (right[0] === left[0] && right[1] === left[1] && right[2] <= left[2]))
        return 'none';
    if (right[0] !== left[0])
        return 'major';
    if (right[1] !== left[1])
        return 'minor';
    return 'patch';
}
function checkedEntry(value, descriptor) {
    const entry = record(value, 'ReleaseEntry');
    const allowed = new Set(['package', 'projectPath', 'baseVersion', 'version', 'bump', 'tag', 'tagKind', 'notes']);
    if (Object.keys(entry).some(key => !allowed.has(key)))
        throw new Error('ReleaseEntry contém campo não permitido');
    const name = entry.package;
    if (descriptor.reportKind === 'batch') {
        if (typeof name !== 'string' || !packagePattern.test(name))
            throw new Error('Package de release inválido');
    }
    else if (name !== null)
        throw new Error('Perfil single não aceita package');
    const version = checkedVersion(entry.version);
    const baseVersion = checkedVersion(entry.baseVersion);
    if (typeof entry.bump !== 'string' || !bumps.has(entry.bump))
        throw new Error('Bump inválido');
    if (entry.bump !== bumpBetween(baseVersion, version) || entry.bump === 'none') {
        throw new Error('Bump diverge das versões');
    }
    if (typeof entry.tag !== 'string' || !entry.tag ||
        (descriptor.reportKind === 'batch' ? entry.tag !== `${name}@${version}` :
            !/^[A-Za-z0-9][A-Za-z0-9._/-]*$/.test(entry.tag) || entry.tag.includes('..') ||
                !entry.tag.endsWith(version))) {
        throw new Error('Tag de release inválida');
    }
    if (entry.tagKind !== descriptor.tagKind || typeof entry.notes !== 'string') {
        throw new Error('Tag kind ou notes inválidos');
    }
    return {
        package: name, projectPath: checkedPath(entry.projectPath),
        baseVersion, version, bump: entry.bump, tag: entry.tag,
        tagKind: descriptor.tagKind, notes: entry.notes,
    };
}
function staticDescriptor(id) {
    const collect = () => undefined;
    const capability = expected[id];
    return validateDescriptor({ id, ...capability, collect,
        ...(capability.needsVersionPr ? { prepare: () => undefined } : {}) });
}
export function validateReleasePlan(value) {
    const candidate = record(value, 'ReleasePlan');
    const allowed = new Set(['schemaVersion', 'adapter', 'sha', 'branch', 'status', 'report', 'entries', 'planDigest']);
    if (Object.keys(candidate).some(key => !allowed.has(key)))
        throw new Error('ReleasePlan contém campo não permitido');
    const id = adapterId(candidate.adapter);
    const descriptor = staticDescriptor(id);
    if (candidate.schemaVersion !== 1 || typeof candidate.sha !== 'string' ||
        !shaPattern.test(candidate.sha) || typeof candidate.branch !== 'string' || !candidate.branch ||
        !Array.isArray(candidate.entries) || !digestPattern.test(String(candidate.planDigest))) {
        throw new Error('ReleasePlan inválido');
    }
    const entries = candidate.entries.map(entry => checkedEntry(entry, descriptor));
    if (candidate.status === 'release' && entries.length === 0)
        throw new Error('Plano de release vazio');
    if (candidate.status === 'no-release' && entries.length !== 0)
        throw new Error('No-release com entradas');
    if (candidate.status !== 'release' && candidate.status !== 'no-release')
        throw new Error('Status de release inválido');
    const tags = new Set(entries.map(entry => entry.tag));
    if (tags.size !== entries.length || (descriptor.reportKind === 'single' && entries.length > 1)) {
        throw new Error('Entradas de release duplicadas ou incompatíveis');
    }
    const order = entries.map(entry => `${entry.package ?? ''}/${entry.projectPath}/${entry.tag}`);
    if (JSON.stringify(order) !== JSON.stringify([...order].sort((left, right) => left.localeCompare(right)))) {
        throw new Error('Entradas de release fora da ordem canônica');
    }
    const body = { schemaVersion: 1, adapter: id, sha: candidate.sha, branch: candidate.branch,
        status: candidate.status, report: canonical(candidate.report), entries };
    if (planDigest(body) !== candidate.planDigest)
        throw new Error('ReleasePlan digest divergente');
    const base = { schemaVersion: 1, adapter: id, sha: candidate.sha,
        branch: candidate.branch, report: body.report, planDigest: candidate.planDigest };
    if (candidate.status === 'release') {
        return Object.freeze({ ...base, status: 'release',
            entries: entries });
    }
    return Object.freeze({ ...base, status: 'no-release', entries: [] });
}
export function parseReleasePlan(json) {
    let value;
    try {
        value = JSON.parse(json);
    }
    catch {
        throw new Error('ReleasePlan JSON inválido');
    }
    return validateReleasePlan(value);
}
export function planFromReport(reportInput, descriptor, projectPath) {
    const report = record(reportInput, 'Report');
    const id = adapterId(report.adapter);
    if (id !== descriptor.id || report.schemaVersion !== 1 || typeof report.sha !== 'string' ||
        !shaPattern.test(report.sha) || typeof report.branch !== 'string' || !report.branch) {
        throw new Error('Report e descriptor incompatíveis');
    }
    const path = checkedPath(projectPath);
    const releaseStatus = report.status === 'no-release' ? 'no-release' : 'release';
    const native = record(report.native, 'Native report');
    if (typeof native.explanation !== 'string')
        throw new Error('Explicação nativa ausente');
    let entries = [];
    if (releaseStatus === 'release') {
        const sources = descriptor.reportKind === 'batch' ? report.releases : [report];
        if (!Array.isArray(sources) || sources.length === 0)
            throw new Error('Plano de release vazio');
        entries = sources.map(source => {
            const item = record(source, 'Release');
            const packageName = descriptor.reportKind === 'batch' ? item.name : null;
            return checkedEntry({ package: packageName, projectPath: path,
                baseVersion: descriptor.reportKind === 'batch' ? item.oldVersion : item.baseVersion,
                version: descriptor.reportKind === 'batch' ? item.version : item.candidateVersion,
                bump: item.bump, tag: item.tag, tagKind: descriptor.tagKind,
                notes: native.explanation }, descriptor);
        }).sort((left, right) => `${left.package ?? ''}/${left.projectPath}/${left.tag}`.localeCompare(`${right.package ?? ''}/${right.projectPath}/${right.tag}`));
    }
    const reportJson = canonical(report);
    const body = { schemaVersion: 1, adapter: id, sha: report.sha, branch: report.branch,
        status: releaseStatus, report: reportJson, entries };
    return validateReleasePlan({ ...body, planDigest: planDigest(body) });
}
export const adapterCapabilities = expected;
