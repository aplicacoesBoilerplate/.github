import { contractError, validateRelativePath } from '../llm/validate-request.mjs';

/** Consumer-owned writer. Fixed endpoint; creations are never retried by the transport. */
export function createPublicationTransport(token, { recollect, fetchImpl = fetch, errorCode, patchErrorCode, author, headAllowed, baseAllowed }) {
  const fail = () => { throw contractError(errorCode); };
  const sha = value => { if (!/^[a-f0-9]{40}$/.test(value ?? '')) fail(); return value; };
  const number = value => { if (!Number.isSafeInteger(value) || value < 1) fail(); return value; };
  const branch = value => { if (!headAllowed(value)) fail(); return value; };
  if (typeof token !== 'string' || !token || /[\r\n]/.test(token) || typeof recollect !== 'function') fail();
  const repoPath = repo => {
    if (!/^[a-zA-Z0-9][a-zA-Z0-9-]*\/[a-zA-Z0-9_.-]+$/.test(repo ?? '')) fail(); return `/repos/${repo}`;
  };
  async function request(path, { method = 'GET', body, allow404 = false } = {}) {
    try {
      const json = body === undefined ? undefined : JSON.stringify(body);
      if (json?.includes(token)) fail();
      const response = await fetchImpl(`https://api.github.com${path}`, { method, redirect: 'error', signal: AbortSignal.timeout(10000),
        headers: { Accept: 'application/vnd.github+json', Authorization: `Bearer ${token}`, 'Content-Type': 'application/json', 'X-GitHub-Api-Version': '2026-03-10' },
        ...(json === undefined ? {} : { body: json }) });
      if (allow404 && response.status === 404) return null;
      if (!response.ok) fail();
      const value = await response.json(); if (!value || typeof value !== 'object') fail(); return value;
    } catch { fail(); }
  }
  async function list(path) {
    const values = [];
    for (let page = 1; page <= 10; page++) {
      const batch = await request(`${path}${path.includes('?') ? '&' : '?'}per_page=100&page=${page}`);
      if (!Array.isArray(batch) || batch.length > 100) fail(); values.push(...batch); if (batch.length < 100) return values;
    }
    fail();
  }
  const pullPath = (repo, n) => `${repoPath(repo)}/pulls/${number(n)}`;
  const getPull = (repo, n) => request(pullPath(repo, n));
  const getCommit = (repo, value) => request(`${repoPath(repo)}/git/commits/${sha(value)}`);
  return {
    recollect,
    getIdentity: async () => {
      const result = await request('/graphql', { method: 'POST', body: { query: 'query { viewer { databaseId login } }' } });
      if (result.errors?.length || !result.data?.viewer) fail();
      const viewer = result.data.viewer; return { id: viewer.databaseId, login: viewer.login };
    },
    listComments: (repo, issue) => list(`${repoPath(repo)}/issues/${number(issue)}/comments`),
    getComment: (repo, id) => request(`${repoPath(repo)}/issues/comments/${number(id)}`),
    createComment: (repo, issue, body) => request(`${repoPath(repo)}/issues/${number(issue)}/comments`, { method: 'POST', body: { body } }),
    updateComment: (repo, id, body) => request(`${repoPath(repo)}/issues/comments/${number(id)}`, { method: 'PATCH', body: { body } }),
    getRef: (repo, ref) => request(`${repoPath(repo)}/git/ref/heads/${encodeURIComponent(branch(ref))}`, { allow404: true }),
    getCommit,
    createCommit: async (repo, proposal) => {
      sha(proposal.base_sha); sha(proposal.tree_sha);
      if (!Array.isArray(proposal.changes) || !proposal.changes.length || !Number.isFinite(Date.parse(proposal.date))) fail();
      const base = await getCommit(repo, proposal.base_sha); sha(base.tree?.sha);
      const tree = [];
      for (const change of proposal.changes) {
        validateRelativePath(change.path);
        if (!['100644', '100755'].includes(change.mode) || change.type !== 'blob') fail();
        let object = null;
        if (change.sha !== null) {
          if (typeof change.content !== 'string' || Buffer.from(change.content, 'base64').toString('base64') !== change.content
            || Buffer.from(change.content, 'base64').includes(Buffer.from(token))) fail();
          const blob = await request(`${repoPath(repo)}/git/blobs`, { method: 'POST', body: { content: change.content, encoding: 'base64' } }); object = sha(blob.sha);
        }
        tree.push({ path: change.path, mode: change.mode, type: 'blob', sha: object });
      }
      const uploaded = await request(`${repoPath(repo)}/git/trees`, { method: 'POST', body: { base_tree: base.tree.sha, tree } });
      if (uploaded.sha !== proposal.tree_sha) throw contractError(patchErrorCode);
      const identity = { ...author, date: proposal.date };
      return request(`${repoPath(repo)}/git/commits`, { method: 'POST', body: { message: proposal.message, tree: uploaded.sha,
        parents: [proposal.base_sha], author: identity, committer: identity } });
    },
    createRef: (repo, ref, value) => request(`${repoPath(repo)}/git/refs`, { method: 'POST', body: { ref: `refs/heads/${branch(ref)}`, sha: sha(value) } }),
    listPulls: (repo, ref) => { branch(ref); return list(`${repoPath(repo)}/pulls?state=all`); },
    getPull,
    createPull: (repo, payload) => {
      branch(payload.head); if (payload.draft !== true || !baseAllowed(payload.base)) fail();
      return request(`${repoPath(repo)}/pulls`, { method: 'POST', body: payload });
    },
    setMilestone: async (repo, n, milestone) => {
      await request(`${repoPath(repo)}/issues/${number(n)}`, { method: 'PATCH', body: { milestone: number(milestone) } });
      return getPull(repo, n);
    },
    requestReview: (repo, n, reviewer) => {
      if (!/^[a-zA-Z0-9][a-zA-Z0-9-]*$/.test(reviewer ?? '')) fail();
      return request(`${pullPath(repo, n)}/requested_reviewers`, { method: 'POST', body: { reviewers: [reviewer] } });
    },
    listReviews: (repo, n) => list(`${pullPath(repo, n)}/reviews`),
  };
}
