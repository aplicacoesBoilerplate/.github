import { contractError } from '../llm/validate-request.mjs';
import { createTriageApi } from '../triage/api.mjs';

const fail = () => { throw contractError('REVIEW_METADATA_UNAVAILABLE'); };
const positive = value => { if (!/^[1-9][0-9]*$/.test(String(value)) || !Number.isSafeInteger(Number(value))) fail(); return String(value); };

/** Read-only review additions to the existing fixed-origin metadata adapter. */
export function createReviewApi(token, { fetchImpl = fetch } = {}) {
  if (typeof token !== 'string' || !token || /[\r\n]/.test(token)) fail();
  function repoPath(repo) {
    if (!/^[a-zA-Z0-9][a-zA-Z0-9-]*\/[a-zA-Z0-9_.-]+$/.test(repo ?? '')) fail();
    return `/repos/${repo}`;
  }
  async function get(path) {
    try {
      const response = await fetchImpl(`https://api.github.com${path}`, {
        method: 'GET', redirect: 'error', signal: AbortSignal.timeout(10000),
        headers: { Accept: 'application/vnd.github+json', Authorization: `Bearer ${token}`, 'X-GitHub-Api-Version': '2026-03-10' },
      });
      if (!response.ok) fail();
      const data = await response.json(); if (!data || typeof data !== 'object') fail(); return data;
    } catch { fail(); }
  }
  return {
    ...createTriageApi(token, { fetchImpl }),
    getPull: (repo, number) => get(`${repoPath(repo)}/pulls/${positive(number)}`),
    getRun: (repo, id) => get(`${repoPath(repo)}/actions/runs/${positive(id)}`),
    getCommit: (repo, sha) => {
      if (!/^[a-f0-9]{40}$/.test(sha ?? '')) fail(); return get(`${repoPath(repo)}/git/commits/${sha}`);
    },
    getRunJobs: async (repo, id, attempt) => {
      const path = `${repoPath(repo)}/actions/runs/${positive(id)}/attempts/${positive(attempt)}/jobs`;
      const all = []; let total;
      for (let page = 1; page <= 10; page++) {
        const data = await get(`${path}?per_page=100&page=${page}`);
        if (!Array.isArray(data.jobs) || data.jobs.length > 100 || !Number.isSafeInteger(data.total_count) || data.total_count < 0
          || (total !== undefined && total !== data.total_count)) fail();
        total = data.total_count; all.push(...data.jobs);
        if (data.jobs.length < 100) { if (all.length !== total) fail(); return all; }
      }
      fail();
    },
  };
}
