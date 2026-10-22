import { appendFileSync, readFileSync, realpathSync } from 'node:fs';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { adapterCapabilities, planFromReport, validateDescriptor, validateReleasePlan } from '../adapter-contract.js';
import { createGitPort } from '../ports/git.js';
import { createReadApi, createWriteApi } from '../ports/github.js';
import { collectPrEvidence } from '../services/pr-evidence.js';
import { evaluateReleasePolicy } from '../services/release-policy.js';
import { validateLegacyBundle, verifyLegacyTechnicalMerge } from '../services/legacy-technical-merge.js';
import { prepareTechnicalPr } from '../services/technical-release.js';
import { verifyTechnicalMerge } from '../services/technical-merge.js';
import { publishReleasePlan } from '../services/publication.js';
import { publicationPayloadDigest } from '../services/publication-payload.js';
import { allowedVersionWrites, validateVersionFiles } from '../services/version-files.js';
const shaPattern = /^[0-9a-f]{40}$/i;
const partPattern = /^[A-Za-z0-9_.-]+$/;
function object(value, label) {
    if (!value || typeof value !== 'object' || Array.isArray(value))
        throw new Error(`${label} inválido`);
    return value;
}
function positive(value, label) {
    if (!Number.isSafeInteger(value) || Number(value) < 1)
        throw new Error(`${label} inválido`);
    return Number(value);
}
function sameFunctionalMetadata(left, right) {
    const fields = (value) => JSON.stringify({ repository: value.repository,
        number: value.number, headSha: value.headSha, headBranch: value.headBranch,
        baseBranch: value.baseBranch, mergedAt: value.mergedAt,
        mergeCommitSha: value.mergeCommitSha, milestone: value.milestone, override: value.override });
    return fields(left) === fields(right);
}
function outputs(plan, outcome, publication, technicalPr) {
    const single = plan.status === 'release' && plan.entries.length === 1;
    const entry = single ? plan.entries[0] : null;
    const released = publication?.entries ?? [];
    const completed = publication?.publishedSha ?? '';
    const entries = plan.entries.map(planned => {
        const result = released.find(item => item.tag === planned.tag && item.package === planned.package);
        return { package: planned.package, version: planned.version, tag: planned.tag,
            release_url: result?.releaseUrl ?? null, status: result?.status ?? 'pending',
            ...(result?.reason ? { reason: result.reason } : {}) };
    });
    return { version: entry?.version ?? '', tag: entry?.tag ?? '', published_sha: completed,
        release_url: completed && released.length === 1 ? released[0]?.releaseUrl ?? '' : '',
        outcome, version_pr_url: technicalPr?.url ?? '', releases_json: JSON.stringify(entries) };
}
function verifyPlan(artifact, trust) {
    const plan = validateReleasePlan(artifact.plan);
    if (!/^[0-9a-f]{64}$/.test(trust.planDigest) || !/^[0-9a-f]{64}$/.test(trust.payloadDigest) ||
        plan.planDigest !== trust.planDigest || publicationPayloadDigest(artifact) !== trust.payloadDigest) {
        throw new Error('Identidade do plano/artifact diverge das saídas confiáveis do leitor');
    }
    if (!Object.hasOwn(adapterCapabilities, trust.adapter) || plan.adapter !== trust.adapter ||
        plan.branch !== trust.targetBranch || !artifact.report) {
        throw new Error('Plano/artifact diverge do caller confiável');
    }
    const capability = adapterCapabilities[trust.adapter];
    const descriptor = validateDescriptor({ id: trust.adapter, ...capability,
        collect: () => artifact.report,
        ...(capability.needsVersionPr ? { prepare: () => artifact.bundle } : {}) });
    const expected = planFromReport(artifact.report, descriptor, trust.projectPath);
    if (expected.planDigest !== plan.planDigest)
        throw new Error('Plano/artifact adulterado');
    const report = object(artifact.report, 'Relatório');
    if (typeof trust.tagPrefix !== 'string' ||
        (report.tagPrefix !== undefined && report.tagPrefix !== trust.tagPrefix) ||
        (['go-gitsemver', 'changesets', 'release-please'].includes(trust.adapter) && trust.tagPrefix !== 'v') ||
        plan.entries.some(entry => entry.tag !== (trust.adapter === 'changesets' ?
            `${entry.package}@${entry.version}` : `${trust.tagPrefix}${entry.version}`))) {
        throw new Error('Tag/prefixo do plano diverge do caller confiável');
    }
    const evidence = object(artifact.publicationEvidence, 'Evidência de publicação');
    if (evidence.planDigest !== plan.planDigest || evidence.publishedSha !== trust.publishedSha ||
        !Number.isSafeInteger(evidence.originPrNumber) || Number(evidence.originPrNumber) < 1 ||
        artifact.gitInputs?.sha !== trust.publishedSha || artifact.gitInputs.adapter !== trust.adapter) {
        throw new Error('Artifact incompleto ou de SHA incorreto');
    }
    if (evidence.phase === 'functional') {
        if (plan.sha !== trust.publishedSha || evidence.functionalSha !== plan.sha ||
            evidence.technicalPrNumber !== null)
            throw new Error('Origem funcional do artifact inválida');
    }
    else if (evidence.phase === 'technical') {
        if (plan.status !== 'release' || !capability.needsVersionPr ||
            evidence.functionalSha !== plan.sha || plan.sha === trust.publishedSha ||
            !Number.isSafeInteger(evidence.technicalPrNumber) || Number(evidence.technicalPrNumber) < 1) {
            throw new Error('Origem técnica do artifact inválida');
        }
    }
    else
        throw new Error('Fase do artifact inválida');
    return plan;
}
async function verifyProducer(request) {
    const { trust, artifact, read } = request;
    const name = `${trust.owner}/${trust.repo}`;
    if (!partPattern.test(trust.owner) || !partPattern.test(trust.repo) ||
        !partPattern.test(trust.expectedProducerJob) ||
        positive(trust.runId, 'Run') !== trust.runId ||
        positive(trust.runAttempt, 'Tentativa') !== trust.runAttempt ||
        positive(trust.artifactId, 'Artifact ID') !== trust.artifactId ||
        !shaPattern.test(trust.publishedSha) || !shaPattern.test(trust.centralSha)) {
        throw new Error('Contexto confiável de publicação inválido');
    }
    const producer = object(object(artifact.publicationEvidence, 'Evidência').producer, 'Produtor');
    if (producer.repository !== name || producer.runId !== trust.runId ||
        producer.runAttempt !== trust.runAttempt || producer.job !== trust.expectedProducerJob ||
        producer.centralSha !== trust.centralSha)
        throw new Error('Produtor do artifact divergente');
    const scope = `repos/${name}`;
    const remoteArtifact = object(await read.get(`${scope}/actions/artifacts/${trust.artifactId}`), 'Artifact remoto');
    const workflowRun = object(remoteArtifact.workflow_run, 'Run produtor do artifact');
    if (remoteArtifact.id !== trust.artifactId ||
        remoteArtifact.name !== `publication-${trust.runId}-${trust.runAttempt}` ||
        remoteArtifact.expired !== false || !Number.isSafeInteger(remoteArtifact.size_in_bytes) ||
        Number(remoteArtifact.size_in_bytes) < 1 || workflowRun.id !== trust.runId ||
        workflowRun.head_sha !== trust.publishedSha)
        throw new Error('Artifact expirado ou de outra execução');
    const run = object(await read.get(`${scope}/actions/runs/${trust.runId}/attempts/${trust.runAttempt}`), 'Tentativa do workflow');
    if (run.id !== trust.runId || run.run_attempt !== trust.runAttempt ||
        run.head_sha !== trust.publishedSha || run.head_branch !== trust.targetBranch ||
        run.event !== 'push')
        throw new Error('Run produtor diverge do push integrado');
    const jobs = await read.listField(`${scope}/actions/runs/${trust.runId}/attempts/${trust.runAttempt}` +
        '/jobs?per_page=100', 'jobs');
    const matches = jobs.map(item => object(item, 'Job produtor')).filter(item => item.name === trust.expectedProducerJob && item.run_id === trust.runId &&
        item.head_sha === trust.publishedSha && item.status === 'completed' &&
        item.conclusion === 'success');
    if (matches.length !== 1 || !Number.isSafeInteger(matches[0]?.id)) {
        throw new Error('Job produtor não comprovado no run esperado');
    }
}
/** Writer composition: only checked artifacts and typed GitHub mutations cross this boundary. */
export async function runPublish(request) {
    const { trust, artifact } = request;
    if (!Array.isArray(request.requiredChecks) || !request.requiredChecks.length ||
        request.requiredChecks.some(value => typeof value !== 'string' || !value) ||
        !partPattern.test(trust.owner) || !partPattern.test(trust.repo)) {
        throw new Error('Contexto do escritor inválido');
    }
    const plan = verifyPlan(artifact, trust);
    const evidence = object(artifact.publicationEvidence, 'Evidência');
    const root = realpathSync(request.repository);
    const validateFiles = (value, bundle) => {
        const writes = request.services?.allowedWrites ?? allowedVersionWrites;
        if (request.validateBundle)
            return request.validateBundle(value, bundle);
        if (value.adapter === 'standard-version')
            return validateLegacyBundle(bundle, value, root);
        return validateVersionFiles({ repository: root, plan: value, bundle: bundle,
            trustedAllowedWrites: writes(value, root) }, false, evidence.phase === 'functional');
    };
    if (plan.status === 'release' && adapterCapabilities[trust.adapter].needsVersionPr) {
        if (!artifact.bundle)
            throw new Error('Artifact de bundle incompleto');
        validateFiles(plan, artifact.bundle);
    }
    const verifyLive = async () => {
        await verifyProducer(request);
        if (request.git.headSha() !== trust.publishedSha)
            throw new Error('Checkout difere do SHA publicado');
        request.git.verifyInputs(artifact.gitInputs, trust.publishedSha, plan.status === 'release' ? plan.entries[0].tag : '', trust.adapter);
        if (evidence.phase === 'functional') {
            const current = await collectPrEvidence(request.read, { repository: `${trust.owner}/${trust.repo}`,
                targetBranch: trust.targetBranch, commitSha: trust.publishedSha,
                requiredChecks: request.requiredChecks });
            if (!sameFunctionalMetadata(current, artifact.snapshot) ||
                current.number !== evidence.originPrNumber)
                throw new Error('Metadado funcional mudou após a leitura');
            if (plan.status === 'release') {
                const policy = evaluateReleasePolicy({ report: plan.report, snapshot: current, phase: 'publication' });
                if (policy.outcome === 'blocked')
                    throw new Error('Policy funcional bloqueou publicação');
            }
        }
        else {
            const verified = trust.adapter === 'standard-version' ?
                await verifyLegacyTechnicalMerge({ repository: root, owner: trust.owner, repo: trust.repo,
                    plan, bundle: artifact.bundle, origin: artifact.snapshot,
                    technicalPrNumber: Number(evidence.technicalPrNumber), publishedSha: trust.publishedSha,
                    requiredChecks: request.requiredChecks, read: request.read,
                    ...(trust.botLogin ? { botLogin: trust.botLogin } : {}) }) :
                await (request.services?.verifyTechnical ?? verifyTechnicalMerge)({ repository: root,
                    owner: trust.owner, repo: trust.repo, botLogin: trust.botLogin ?? '', plan,
                    bundle: artifact.bundle,
                    trustedAllowedWrites: (request.services?.allowedWrites ?? allowedVersionWrites)(plan, root),
                    originPrNumber: Number(evidence.originPrNumber),
                    technicalPrNumber: Number(evidence.technicalPrNumber),
                    expectedFunctionalEvidence: artifact.snapshot, publishedSha: trust.publishedSha,
                    requiredChecks: request.requiredChecks, read: request.read });
            if (verified.functionalSha !== plan.sha || verified.publishedSha !== trust.publishedSha ||
                verified.planDigest !== plan.planDigest)
                throw new Error('Merge técnico diverge do plano');
        }
        return { publishedSha: trust.publishedSha };
    };
    await verifyLive();
    if (plan.status === 'no-release')
        return { outcome: 'no-release',
            outputs: outputs(plan, 'no-release', null, null), publication: null, technicalPr: null };
    if (evidence.phase === 'functional' && adapterCapabilities[trust.adapter].needsVersionPr) {
        if (!request.technicalTransport && !request.services?.prepareTechnical) {
            throw new Error('Token de PR técnico ausente');
        }
        const pr = await (request.services?.prepareTechnical ?? prepareTechnicalPr)({
            repository: root, owner: trust.owner, repo: trust.repo,
            originPrNumber: Number(evidence.originPrNumber), botLogin: trust.botLogin ?? '',
            plan, bundle: artifact.bundle,
            trustedAllowedWrites: (request.services?.allowedWrites ?? allowedVersionWrites)(plan, root),
            transport: request.technicalTransport ?? (async () => { throw new Error('Token App ausente'); }),
        });
        if (pr.functionalSha !== plan.sha)
            throw new Error('PR técnico diverge da origem');
        return { outcome: 'pending-version-pr',
            outputs: outputs(plan, 'pending-version-pr', null, pr), publication: null, technicalPr: pr };
    }
    const publication = await (request.services?.publishPlan ?? publishReleasePlan)({
        owner: trust.owner, repo: trust.repo, plan, publishedSha: trust.publishedSha,
        read: request.read, write: request.write, verify: verifyLive
    });
    return { outcome: publication.outcome,
        outputs: outputs(plan, publication.outcome, publication, null), publication, technicalPr: null };
}
function required(value, label) {
    if (!value)
        throw new Error(`${label} obrigatório`);
    return value;
}
function envNumber(value, label) {
    if (!value || !/^[1-9][0-9]*$/.test(value) || !Number.isSafeInteger(Number(value))) {
        throw new Error(`${label} inválido`);
    }
    return Number(value);
}
function fetchTransport(token) {
    return async (request) => {
        const response = await fetch(request.url, { method: request.method,
            headers: { Accept: 'application/vnd.github+json', 'X-GitHub-Api-Version': '2022-11-28',
                Authorization: `Bearer ${token}`,
                ...(request.body === undefined ? {} : { 'Content-Type': 'application/json' }) },
            ...(request.body === undefined ? {} : { body: JSON.stringify(request.body) }) });
        const body = await response.text();
        return { status: response.status, headers: Object.fromEntries(response.headers.entries()),
            body: body ? JSON.parse(body) : null };
    };
}
function loadArtifact(directory) {
    const file = (name) => {
        try {
            return JSON.parse(readFileSync(join(directory, name), 'utf8'));
        }
        catch {
            throw new Error(`Artifact incompleto ou expirado: ${name}`);
        }
    };
    const plan = file('release-plan.json');
    return { report: file('version-report.json'), plan,
        snapshot: file('pr-policy.json'),
        gitInputs: file('git-inputs.json'),
        publicationEvidence: object(file('publication-evidence.json'), 'Evidência'),
        bundle: plan.status === 'release' && adapterCapabilities[plan.adapter]?.needsVersionPr ?
            file('version-bundle.json') : null };
}
export async function publishMain(env = process.env, dependencies = {}) {
    try {
        if (env.GITHUB_EVENT_NAME !== 'push' || env.GITHUB_REF_NAME !== env.TARGET_BRANCH) {
            throw new Error('Escritor exige push na branch principal');
        }
        const workspace = realpathSync(required(env.GITHUB_WORKSPACE, 'GITHUB_WORKSPACE'));
        const [owner, repo, extra] = required(env.GITHUB_REPOSITORY, 'GITHUB_REPOSITORY').split('/');
        if (!owner || !repo || extra)
            throw new Error('Repositório inválido');
        const trust = { owner, repo,
            adapter: required(env.ADAPTER, 'ADAPTER'),
            projectPath: env.PROJECT_PATH ?? '.', targetBranch: required(env.TARGET_BRANCH, 'TARGET_BRANCH'),
            tagPrefix: env.TAG_PREFIX ?? 'v', publishedSha: required(env.GITHUB_SHA, 'GITHUB_SHA'),
            centralSha: required(env.CENTRAL_SHA, 'CENTRAL_SHA'),
            runId: envNumber(env.GITHUB_RUN_ID, 'GITHUB_RUN_ID'),
            runAttempt: envNumber(env.GITHUB_RUN_ATTEMPT, 'GITHUB_RUN_ATTEMPT'),
            artifactId: envNumber(env.VERSIONING_ARTIFACT_ID, 'VERSIONING_ARTIFACT_ID'),
            expectedProducerJob: 'validate-publication',
            planDigest: required(env.VERSIONING_PLAN_DIGEST, 'VERSIONING_PLAN_DIGEST'),
            payloadDigest: required(env.VERSIONING_PAYLOAD_DIGEST, 'VERSIONING_PAYLOAD_DIGEST'),
            ...(env.VERSIONING_BOT_LOGIN ? { botLogin: env.VERSIONING_BOT_LOGIN } : {}) };
        const api = dependencies.transport ?? fetchTransport(required(env.GH_TOKEN ?? env.GITHUB_TOKEN, 'GH_TOKEN'));
        const result = await runPublish({ trust,
            artifact: loadArtifact(required(env.VERSIONING_ARTIFACT_DIR, 'VERSIONING_ARTIFACT_DIR')),
            read: dependencies.read ?? createReadApi(api), write: dependencies.write ?? createWriteApi(api),
            git: dependencies.git ?? createGitPort(workspace),
            requiredChecks: (env.REQUIRED_CHECKS ?? 'build').split(',').map(item => item.trim()).filter(Boolean),
            ...(dependencies.technicalTransport || env.VERSIONING_TOKEN ? {
                technicalTransport: dependencies.technicalTransport ?? fetchTransport(env.VERSIONING_TOKEN),
            } : {}), repository: workspace });
        if (env.GITHUB_OUTPUT)
            appendFileSync(env.GITHUB_OUTPUT, Object.entries(result.outputs).map(([key, value]) => `${key}=${value}`).join('\n') + '\n');
        if (env.GITHUB_STEP_SUMMARY)
            appendFileSync(env.GITHUB_STEP_SUMMARY, `Versioning outcome: ${result.outcome}\n`);
        return result.outcome === 'partial' || result.outcome === 'blocked' || result.outcome === 'conflict' ? 1 : 0;
    }
    catch (error) {
        (dependencies.error ?? console.error)(error instanceof Error ? error.message : String(error));
        return 1;
    }
}
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
    process.exitCode = await publishMain();
}
