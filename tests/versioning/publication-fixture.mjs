import { publicationPayloadDigest } from '../../scripts/versioning/dist/services/publication-payload.js';

/** Controlled GitHub Actions metadata; all actual artifact/digest checks stay in the writer. */
export function producerTransport(context, transport) {
  const { repository, sha, centralSha, runId = 77, runAttempt = 1, artifactId = 500 } = context;
  return async request => {
    const endpoint = new URL(request.url).pathname;
    const scope = `/repos/${repository}`;
    let body;
    if (endpoint === `${scope}/actions/artifacts/${artifactId}`) body = {
      id: artifactId, name: `publication-${runId}-${runAttempt}`, expired: false, size_in_bytes: 123,
      workflow_run: { id: runId, head_sha: sha } };
    else if (endpoint === `${scope}/actions/runs/${runId}/attempts/${runAttempt}`) body = {
      id: runId, run_attempt: runAttempt, head_sha: sha, head_branch: 'master', event: 'push',
      referenced_workflows: [{ sha: centralSha,
        path: `aplicacoesBoilerplate/.github/.github/workflows/version-publish.yml@${centralSha}` }] };
    else if (endpoint === `${scope}/actions/runs/${runId}/attempts/${runAttempt}/jobs`) body = { jobs: [
      { id: 50, run_id: runId, head_sha: sha, name: 'validate-publication', status: 'completed', conclusion: 'success' }] };
    else return transport(request);
    if (request.method !== 'GET') throw Error('Producer evidence cannot be mutated');
    return { status: 200, headers: {}, body };
  };
}

export function writerTrust(artifact, repository, overrides = {}) {
  const producer = artifact.publicationEvidence.producer;
  const [owner, repo] = repository.split('/');
  return { owner, repo, adapter: artifact.plan.adapter, projectPath: '.', targetBranch: 'master',
    tagPrefix: 'v', publishedSha: artifact.publicationEvidence.publishedSha,
    centralSha: producer.centralSha, centralRepository: 'aplicacoesBoilerplate/.github',
    runId: producer.runId, runAttempt: producer.runAttempt, artifactId: 500,
    expectedProducerJob: 'validate-publication', planDigest: artifact.plan.planDigest,
    payloadDigest: publicationPayloadDigest(artifact), ...overrides };
}
