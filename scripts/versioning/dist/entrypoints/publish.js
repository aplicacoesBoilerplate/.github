import { appendFileSync, realpathSync } from 'node:fs';
import { pathToFileURL } from 'node:url';
import { adapterCapabilities } from '../adapter-contract.js';
import { createGitPort } from '../ports/git.js';
import { createReadApi, createWriteApi } from '../ports/github.js';
import { collectPrEvidence } from '../services/pr-evidence.js';
import { evaluateReleasePolicy } from '../services/release-policy.js';
import { validateLegacyBundle, verifyLegacyTechnicalMerge } from '../services/legacy-technical-merge.js';
import { prepareTechnicalPr } from '../services/technical-release.js';
import { verifyTechnicalMerge } from '../services/technical-merge.js';
import { publishReleasePlan } from '../services/publication.js';
import { verifyPlan, verifyProducer, loadArtifact } from '../services/publication-artifact.js';
import { allowedVersionWrites, validateVersionFiles } from '../services/version-files.js';
const partPattern = /^[A-Za-z0-9_.-]+$/;
function object(value, label) {
    if (!value || typeof value !== 'object' || Array.isArray(value))
        throw new Error(`${label} inválido`);
    return value;
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
        await verifyProducer(request.read, trust, artifact.publicationEvidence.producer);
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
            sourceArtifact: { repository: `${trust.owner}/${trust.repo}`, artifactId: trust.artifactId,
                runId: trust.runId, runAttempt: trust.runAttempt, centralSha: trust.centralSha,
                planDigest: trust.planDigest, payloadDigest: trust.payloadDigest },
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
            ...(env.CENTRAL_REPOSITORY ? { centralRepository: env.CENTRAL_REPOSITORY } : {}),
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
