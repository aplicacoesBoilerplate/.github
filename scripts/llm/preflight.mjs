import { setTimeout as sleep } from 'node:timers/promises';
import { contractError, validateRelativePath } from './validate-request.mjs';
import { verifyTriageOrigin } from '../triage/collect.mjs';
import { verifyReviewOrigin } from '../review/collect.mjs';

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
    if (inputs.caller_profile === 'review') {
      if (event.pull_number !== inputs.pull_number) throw contractError('UNTRUSTED_CONTEXT');
      const origin = await verifyReviewOrigin(event, api);
      return { repository: event.repository, default_branch: origin.default_branch, source_sha: origin.config_source_sha,
        config_source_sha: origin.config_source_sha, review_source_sha: origin.pull.head.sha, review_base_sha: origin.pull.base.sha, private: true };
    }
    if (inputs.caller_profile === 'triage') {
      if (event.issue_number !== inputs.issue_number) throw contractError('UNTRUSTED_CONTEXT');
      const origin = await verifyTriageOrigin(event, api);
      return { repository: event.repository, default_branch: origin.repo.default_branch,
        source_sha: origin.config_source_sha, config_source_sha: origin.config_source_sha, private: true };
    }
    if (inputs.caller_profile !== undefined && inputs.caller_profile !== 'manual') throw contractError('UNTRUSTED_CONTEXT');
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
