import { setTimeout as sleep } from 'node:timers/promises';
import { contractError, validateRelativePath } from './validate-request.mjs';

const shaPattern = /^[a-f0-9]{40}$/;
const repoPattern = /^[a-zA-Z0-9][a-zA-Z0-9-]*\/[a-zA-Z0-9_.-]+$/;

export async function githubGet(path, token, { fetchImpl = fetch, delay = sleep, errorCode = 'UNTRUSTED_CONTEXT' } = {}) {
  if (!token || !path.startsWith('/repos/') || /[\x00-\x20?#\\]/.test(path)) throw contractError(errorCode);
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const response = await fetchImpl(`https://api.github.com${path}`, {
        method: 'GET', redirect: 'error', signal: AbortSignal.timeout(10000),
        headers: { Accept: 'application/vnd.github+json', Authorization: `Bearer ${token}`, 'X-GitHub-Api-Version': '2026-03-10' },
      });
      if (response.ok) return await response.json();
      if (response.status < 500 || attempt === 1) throw contractError(errorCode);
    } catch (error) {
      if (error.code === errorCode || attempt === 1) throw contractError(errorCode);
    }
    await delay(200);
  }
  throw contractError(errorCode);
}

export function githubMetadataApi(token, options = {}) {
  return {
    getRepository: repo => githubGet(`/repos/${repo}`, token, options),
    getBranch: (repo, branch) => githubGet(`/repos/${repo}/branches/${encodeURIComponent(branch)}`, token, options),
  };
}

export async function verifyContext(event, inputs, api) {
  try {
    if (event.event_name !== 'workflow_dispatch' || event.server_url !== 'https://github.com'
      || !repoPattern.test(event.repository) || !shaPattern.test(event.sha) || event.workflow_sha !== event.sha) throw contractError('UNTRUSTED_CONTEXT');
    const repo = await api.getRepository(event.repository);
    if (repo.full_name?.toLowerCase() !== event.repository.toLowerCase() || repo.fork !== false
      || typeof repo.private !== 'boolean' || !repo.default_branch
      || (inputs.auth_mode === 'chatgpt-session' && !repo.private)
      || !['chatgpt-session', 'api-key'].includes(inputs.auth_mode)) throw contractError('UNTRUSTED_CONTEXT');
    const ref = `refs/heads/${repo.default_branch}`;
    const prefix = `${event.repository}/.github/workflows/`;
    const suffix = `@${ref}`;
    if (inputs.source_ref !== repo.default_branch || event.ref !== ref
      || typeof event.workflow_ref !== 'string' || !event.workflow_ref.startsWith(prefix) || !event.workflow_ref.endsWith(suffix)) throw contractError('UNTRUSTED_CONTEXT');
    const workflowFile = event.workflow_ref.slice(prefix.length, -suffix.length);
    validateRelativePath(workflowFile);
    if (!/^[a-zA-Z0-9_.-]+\.ya?ml$/.test(workflowFile)) throw contractError('UNTRUSTED_CONTEXT');
    const branch = await api.getBranch(event.repository, repo.default_branch);
    if (branch.name !== repo.default_branch || !shaPattern.test(branch.commit?.sha)) throw contractError('UNTRUSTED_CONTEXT');
    return { repository: event.repository, default_branch: repo.default_branch, source_sha: branch.commit.sha, private: repo.private };
  } catch { throw contractError('UNTRUSTED_CONTEXT'); }
}
