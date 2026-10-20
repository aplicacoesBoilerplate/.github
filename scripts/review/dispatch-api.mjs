import { contractError } from '../llm/validate-request.mjs';
import { createReviewApi } from './api.mjs';

const fail = () => { throw contractError('REVIEW_DISPATCH_FAILED'); };
const positive = value => { if (!/^[1-9][0-9]*$/.test(String(value)) || !Number.isSafeInteger(Number(value))) fail(); return String(value); };
export function createReviewDispatchApi(token, { readToken, fetchImpl = fetch } = {}) {
  if (typeof token !== 'string' || !token || /[\r\n]/.test(token)) fail();
  const read = createReviewApi(readToken, { fetchImpl });
  const repoPath = repo => { if (!/^[a-zA-Z0-9][a-zA-Z0-9-]*\/[a-zA-Z0-9_.-]+$/.test(repo ?? '')) fail(); return `/repos/${repo}`; };
  async function request(path, body) {
    try {
      const json = body === undefined ? undefined : JSON.stringify(body);
      if (json?.includes(token) || json?.includes(readToken)) fail();
      const response = await fetchImpl(`https://api.github.com${path}`, { method: body === undefined ? 'GET' : 'POST', redirect: 'error', signal: AbortSignal.timeout(10000),
        headers: { Accept: 'application/vnd.github+json', Authorization: `Bearer ${token}`, 'Content-Type': 'application/json', 'X-GitHub-Api-Version': '2026-03-10' },
        ...(json === undefined ? {} : { body: json }) });
      if (!response.ok) fail();
      const value = await response.json(); if (!value || typeof value !== 'object') fail(); return value;
    } catch { fail(); }
  }
  return { ...read,
    getIdentity: async () => {
      const value = await request('/graphql', { query: 'query { viewer { databaseId login } }' });
      if (value.errors?.length || !value.data?.viewer) fail(); return { id: value.data.viewer.databaseId, login: value.data.viewer.login };
    },
    getWorkflow: (repo, path) => {
      if (typeof path !== 'string' || !/^\.github\/workflows\/[a-zA-Z0-9_.-]+\.ya?ml$/.test(path)) fail();
      return request(`${repoPath(repo)}/actions/workflows/${encodeURIComponent(path.split('/').at(-1))}`);
    },
    getRun: (repo, id) => request(`${repoPath(repo)}/actions/runs/${positive(id)}`),
    listWorkflowRuns: async (repo, workflow) => {
      const all = []; let total;
      for (let page = 1; page <= 10; page++) {
        const data = await request(`${repoPath(repo)}/actions/workflows/${positive(workflow)}/runs?event=workflow_dispatch&per_page=100&page=${page}`);
        if (!Array.isArray(data.workflow_runs) || data.workflow_runs.length > 100 || !Number.isSafeInteger(data.total_count) || data.total_count < 0
          || (total !== undefined && total !== data.total_count)) fail();
        total = data.total_count; all.push(...data.workflow_runs);
        if (data.workflow_runs.length < 100) { if (all.length !== total) fail(); return all; }
      }
      fail();
    },
    dispatch: (repo, workflow, body) => {
      if (!body || Object.keys(body).some(k => !['ref', 'inputs'].includes(k)) || typeof body.ref !== 'string' || /[\r\n]/.test(body.ref)
        || !body.inputs || Object.keys(body.inputs).sort().join(',') !== 'dispatch_id,expected_head_sha,pull_number,review_handoff_json'
        || !/^[1-9][0-9]*$/.test(body.inputs.pull_number) || !/^[a-f0-9]{40}$/.test(body.inputs.expected_head_sha)
        || !/^[a-f0-9]{64}$/.test(body.inputs.dispatch_id) || typeof body.inputs.review_handoff_json !== 'string'
        || Buffer.byteLength(body.inputs.review_handoff_json) > 2048) fail();
      return request(`${repoPath(repo)}/actions/workflows/${positive(workflow)}/dispatches`, body);
    }
  };
}
