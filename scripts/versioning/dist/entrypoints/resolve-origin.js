import { appendFileSync, readFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';
import { adapterCapabilities } from '../adapter-contract.js';
import { createReadApi } from '../ports/github.js';
import { parseTechnicalPrProvenance } from '../services/technical-release.js';
import { validateSourceArtifact, verifyProducer } from '../services/publication-artifact.js';
function object(value) {
    if (!value || typeof value !== 'object' || Array.isArray(value))
        throw new Error('Metadata de origem inválido');
    return value;
}
/** Selects existing evidence; no native adapter is run on a technical PR's head. */
export async function resolveOriginArtifact(request) {
    if (!/^[A-Za-z0-9_.-]+$/.test(request.owner) || !/^[A-Za-z0-9_.-]+$/.test(request.repo) ||
        !Object.hasOwn(adapterCapabilities, request.adapter) || !Number.isSafeInteger(request.prNumber) ||
        request.prNumber < 1 || !/^[0-9a-f]{40}$/.test(request.expectedHeadSha) ||
        !/^[0-9a-f]{40}$/.test(request.centralSha) ||
        !/^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/.test(request.centralRepository)) {
        throw new Error('Contexto de origem inválido');
    }
    const name = `${request.owner}/${request.repo}`;
    const pr = object(await request.read.get(`repos/${name}/pulls/${request.prNumber}`));
    const head = object(pr.head), base = object(pr.base);
    if (pr.number !== request.prNumber || head.sha !== request.expectedHeadSha)
        throw new Error('Head/SHA do PR mudou');
    if (typeof head.ref !== 'string')
        throw new Error('Branch do PR ausente');
    if (!head.ref.startsWith('versioning/'))
        return null;
    if (!adapterCapabilities[request.adapter].needsVersionPr || base.ref !== request.targetBranch ||
        !head.ref.startsWith(`versioning/${request.adapter}/`))
        throw new Error('Rota técnica incompatível com o adaptador');
    const author = object(pr.user);
    if (author.type !== 'Bot' || typeof author.login !== 'string' || !/^[A-Za-z0-9_.-]+\[bot\]$/.test(author.login)) {
        throw new Error('PR técnico não pertence a uma automação');
    }
    const marker = parseTechnicalPrProvenance(pr.body);
    const source = validateSourceArtifact(marker.sourceArtifact);
    if (source.repository !== name || source.centralSha !== request.centralSha ||
        source.planDigest !== marker.planDigest || marker.headSha !== head.sha) {
        throw new Error('Identidade do plano/artifact técnico diverge da origem esperada');
    }
    await verifyProducer(request.read, { owner: request.owner, repo: request.repo,
        adapter: request.adapter, projectPath: '.', targetBranch: request.targetBranch, tagPrefix: 'v',
        publishedSha: marker.functionalSha, centralSha: request.centralSha,
        centralRepository: request.centralRepository, runId: source.runId, runAttempt: source.runAttempt,
        artifactId: source.artifactId, expectedProducerJob: 'validate-publication',
        planDigest: source.planDigest, payloadDigest: source.payloadDigest }, { repository: name, runId: source.runId, runAttempt: source.runAttempt,
        job: 'validate-publication', centralSha: source.centralSha });
    return { source, originPrNumber: marker.originPrNumber, functionalSha: marker.functionalSha,
        technicalPrNumber: request.prNumber, botLogin: author.login };
}
export async function resolvePushOrigin(request) {
    if (!/^[0-9a-f]{40}$/.test(request.publishedSha))
        throw new Error('SHA integrado inválido');
    const associated = await request.read.list(`repos/${request.owner}/${request.repo}/commits/${request.publishedSha}/pulls?per_page=100`);
    const matches = associated.map(object).filter(pr => pr.merged_at &&
        pr.merge_commit_sha === request.publishedSha && object(pr.base).ref === request.targetBranch);
    if (matches.length !== 1)
        throw new Error('Associação do PR integrado ausente ou ambígua');
    const pr = matches[0];
    return resolveOriginArtifact({ ...request, prNumber: Number(pr.number),
        expectedHeadSha: String(object(pr.head).sha ?? '') });
}
export async function resolveOriginMain(env = process.env, dependencies = {}) {
    try {
        const event = object(JSON.parse(readFileSync(env.GITHUB_EVENT_PATH ?? '', 'utf8')));
        const [owner, repo, extra] = (env.GITHUB_REPOSITORY ?? '').split('/');
        if (!owner || !repo || extra)
            throw new Error('Repositório inválido');
        const token = env.GH_TOKEN ?? env.GITHUB_TOKEN;
        if (!dependencies.read && !token)
            throw new Error('GH_TOKEN obrigatório');
        const transport = async (request) => {
            const response = await fetch(request.url, { method: 'GET', headers: {
                    Authorization: `Bearer ${token}`, Accept: 'application/vnd.github+json',
                    'X-GitHub-Api-Version': '2022-11-28'
                } });
            return { status: response.status, headers: Object.fromEntries(response.headers.entries()),
                body: await response.json() };
        };
        const common = { owner, repo,
            targetBranch: env.TARGET_BRANCH ?? '', adapter: env.ADAPTER,
            centralSha: env.CENTRAL_SHA ?? '', centralRepository: env.CENTRAL_REPOSITORY ?? '',
            read: dependencies.read ?? createReadApi(transport) };
        let origin;
        if (env.GITHUB_EVENT_NAME === 'push') {
            if (env.GITHUB_REF_NAME !== common.targetBranch)
                throw new Error('Push fora da branch alvo');
            origin = await resolvePushOrigin({ ...common, publishedSha: env.GITHUB_SHA ?? '' });
        }
        else {
            const pr = object(event.pull_request), head = object(pr.head);
            origin = await resolveOriginArtifact({ ...common, prNumber: Number(pr.number),
                expectedHeadSha: String(head.sha ?? '') });
        }
        if (env.GITHUB_OUTPUT)
            appendFileSync(env.GITHUB_OUTPUT, `technical=${Boolean(origin)}\n` +
                (origin ? `artifact_id=${origin.source.artifactId}\nrun_id=${origin.source.runId}\nbot_login=${origin.botLogin}\n` : ''));
        return 0;
    }
    catch (error) {
        (dependencies.error ?? console.error)(error instanceof Error ? error.message : String(error));
        return 1;
    }
}
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
    process.exitCode = await resolveOriginMain();
}
