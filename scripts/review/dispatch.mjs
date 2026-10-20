import { createHash } from 'node:crypto';
import { readTrustedFile, contractError } from '../llm/validate-request.mjs';
import { checkedHead } from '../triage/workflow.mjs';
import { validateReviewConfig } from './policy.mjs';
import { reviewPullState, verifyTriageDispatchOrigin, verifyReviewCorrectionOrigin } from './collect.mjs';

const fail = code => { throw contractError(code); };
const workflowPath = value => typeof value === 'string' && /^\.github\/workflows\/[a-zA-Z0-9_.-]+\.ya?ml$/.test(value);
const login = value => typeof value === 'string' && /^[a-zA-Z0-9][a-zA-Z0-9-]*(?:\[bot\])?$/.test(value);
const digest = value => createHash('sha256').update(value).digest('hex');
const knownActor = (actor, policy) => {
  const byId = policy.automation_actors.find(a => a.id === actor.id); const byName = policy.automation_actors.find(a => a.login.toLowerCase() === actor.login.toLowerCase());
  if (byId !== byName) fail('UNTRUSTED_CONTEXT'); return Boolean(byId);
};

export async function dispatchReview(input, api) {
  try { return await dispatch(input, api); }
  catch (error) { throw contractError(['UNTRUSTED_CONTEXT', 'STALE_REVIEW_INPUT', 'INVALID_REVIEW_CONFIG', 'REVIEW_RESOURCE_CONFLICT'].includes(error.code) ? error.code : 'REVIEW_DISPATCH_FAILED'); }
}
async function dispatch({ pull, expected_head_sha, handoff, target, event, configRoot }, api) {
  const repo = target?.repository;
  if (!/^[a-zA-Z0-9][a-zA-Z0-9-]*\/[a-zA-Z0-9_.-]+$/.test(repo ?? '') || !workflowPath(target.workflow_path)
    || !Number.isSafeInteger(pull) || pull < 1 || !/^[a-f0-9]{40}$/.test(expected_head_sha ?? '') || event?.repository !== repo
    || event.server_url !== 'https://github.com' || !login(event.actor) || !/^[1-9][0-9]*$/.test(String(event.run_id))
    || !/^[1-9][0-9]*$/.test(String(event.run_attempt))) fail('UNTRUSTED_CONTEXT');
  let policy;
  try { policy = validateReviewConfig(JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(await readTrustedFile(configRoot, target.config_path, 32768, 'INVALID_REVIEW_CONFIG')))); }
  catch { fail('INVALID_REVIEW_CONFIG'); }
  const repository = await api.getRepository(repo);
  if (repository.full_name !== repo || repository.private !== true || repository.fork !== false || target.ref !== repository.default_branch) fail('UNTRUSTED_CONTEXT');
  const configSha = checkedHead(configRoot); const defaultBranch = await api.getBranch(repo, repository.default_branch);
  if (defaultBranch.name !== repository.default_branch || defaultBranch.commit?.sha !== configSha) fail('STALE_REVIEW_INPUT');
  const origin = { repository: repo, default_branch: repository.default_branch, config_source_sha: configSha,
    pull: reviewPullState(await api.getPull(repo, pull), repo, pull) };
  if (origin.pull.head.sha !== expected_head_sha) fail('STALE_REVIEW_INPUT');
  const workflow = await api.getWorkflow(repo, target.workflow_path);
  if (workflow.path !== target.workflow_path || workflow.state !== 'active' || !Number.isSafeInteger(workflow.id) || workflow.id < 1) fail('UNTRUSTED_CONTEXT');
  async function writer(actor) {
    const p = await api.getPermission(repo, actor);
    if (!['write', 'maintain', 'admin'].includes(p?.permission) || p.user?.login?.toLowerCase() !== actor.toLowerCase()) fail('UNTRUSTED_CONTEXT');
  }
  await writer(event.actor);
  const service = knownActor(origin.pull.user, policy);
  if (handoff) {
    if (!service) fail('UNTRUSTED_CONTEXT');
    await verifyTriageDispatchOrigin({ config: policy, configRoot, event, origin, inputs: { handoff } }, api);
  } else if (service) {
    await verifyReviewCorrectionOrigin(origin, api);
    return { status: 'skipped-correction', run_id: null, dispatch_id: null };
  } else {
    if (event.event_name !== 'pull_request_target' || !['opened', 'reopened', 'synchronize'].includes(event.action) || event.pull_number !== pull
      || event.sha !== configSha || event.workflow_sha !== configSha || event.ref !== `refs/heads/${repository.default_branch}`) fail('UNTRUSTED_CONTEXT');
    await writer(origin.pull.user.login);
  }
  const identity = await api.getIdentity();
  if (!Number.isSafeInteger(identity?.id) || identity.id < 1 || !login(identity.login)) fail('UNTRUSTED_CONTEXT');
  // The dispatch identity must be usable by the existing collector without granting arbitrary bot trust.
  if (!(service && identity.id === origin.pull.user.id && identity.login.toLowerCase() === origin.pull.user.login.toLowerCase())) await writer(identity.login);
  const id = digest(JSON.stringify([repo, pull, expected_head_sha, origin.pull.base.sha, configSha, target.workflow_path,
    String(event.run_id), String(event.run_attempt), handoff ?? null]));
  const title = `review:${pull}:${id}`;
  const matches = run => Number.isSafeInteger(run?.id) && run.id > 0 && run.id !== Number(event.run_id) && run.event === 'workflow_dispatch'
    && run.repository?.full_name === repo && run.head_repository?.full_name === repo && run.path === target.workflow_path
    && run.head_branch === repository.default_branch && run.head_sha === configSha && run.display_title === title
    && run.actor?.id === identity.id && run.actor.login?.toLowerCase() === identity.login.toLowerCase()
    && ['queued', 'in_progress', 'completed', 'waiting', 'pending', 'requested'].includes(run.status);
  const usable = run => run.status === 'completed' ? run.conclusion === 'success' : run.conclusion == null;
  async function current() {
    const freshRepo = await api.getRepository(repo); const branch = await api.getBranch(repo, repository.default_branch);
    if (freshRepo.private !== true || freshRepo.fork !== false || freshRepo.default_branch !== repository.default_branch || branch.commit?.sha !== configSha
      || JSON.stringify(reviewPullState(await api.getPull(repo, pull), repo, pull)) !== JSON.stringify(origin.pull)) fail('STALE_REVIEW_INPUT');
  }
  async function recover() {
    await current();
    const runs = (await api.listWorkflowRuns(repo, workflow.id)).filter(matches).sort((a, b) => a.id - b.id);
    // Exact correlation, never the latest run. A failed old run is not evidence of successful dispatch recovery.
    const run = runs.find(usable);
    if (runs.length && !run) fail('REVIEW_DISPATCH_FAILED');
    return run ? { status: 'recovered', run_id: String(run.id), dispatch_id: id } : null;
  }
  const existing = await recover(); if (existing) return existing;
  await current();
  const inputs = { pull_number: String(pull), expected_head_sha, review_handoff_json: JSON.stringify(handoff ?? {}), dispatch_id: id };
  try {
    const value = await api.dispatch(repo, workflow.id, { ref: repository.default_branch, inputs });
    const run = await api.getRun(repo, value?.workflow_run_id);
    if (!matches(run) || !usable(run)) fail('REVIEW_DISPATCH_FAILED');
    await current(); return { status: 'dispatched', run_id: String(run.id), dispatch_id: id };
  } catch (error) {
    if (error.code === 'STALE_REVIEW_INPUT') throw error;
    const recovered = await recover(); if (recovered) return recovered; fail('REVIEW_DISPATCH_FAILED');
  }
}
