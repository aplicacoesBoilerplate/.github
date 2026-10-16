import { createHash } from 'node:crypto';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { contractError, readTrustedFile } from '../llm/validate-request.mjs';
import { checkedHead } from '../triage/workflow.mjs';
import { patchGitEnvironment } from '../triage/prepare-patch.mjs';
import { collectIssue } from '../triage/collect.mjs';
import { validateReviewConfig, classifyPull } from './policy.mjs';
import { buildDiffIndex } from './diff.mjs';

const execute = promisify(execFile);
const sha = /^[a-f0-9]{40}$/;
const login = /^[a-zA-Z0-9][a-zA-Z0-9-]*(?:\[bot\])?$/;
const fail = code => { throw contractError(code); };
const digest = value => createHash('sha256').update(value).digest('hex');
export function reviewFingerprint(snapshot, configBytes) {
  const { automation_origin, ...pull } = snapshot.pull;
  return digest(JSON.stringify({ repository: snapshot.repository, default_branch: snapshot.default_branch,
    config_source_sha: snapshot.config_source_sha, pull, config_sha256: digest(configBytes),
    merge_base_sha: snapshot.merge_base_sha, diff: snapshot.diff, diff_index: snapshot.diff_index, handoff: snapshot.handoff }));
}
const knownCodes = new Set(['UNTRUSTED_CONTEXT', 'STALE_REVIEW_INPUT', 'INVALID_REVIEW_CONFIG', 'REVIEW_INCONCLUSIVE']);
function decodeConfig(bytes) {
  try { return JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(bytes)); }
  catch { fail('INVALID_REVIEW_CONFIG'); }
}

function pullState(pull, repository, number) {
  if (pull?.number !== number || !Number.isSafeInteger(pull.user?.id) || pull.user.id < 1 || !login.test(pull.user?.login ?? '')
    || typeof pull.title !== 'string' || !(pull.body === null || typeof pull.body === 'string') || typeof pull.draft !== 'boolean'
    || !Number.isFinite(Date.parse(pull.updated_at)) || ['head', 'base'].some(side => pull[side]?.repo?.full_name !== repository
      || !sha.test(pull[side]?.sha ?? '') || typeof pull[side]?.ref !== 'string' || !pull[side].ref)) fail('UNTRUSTED_CONTEXT');
  if (pull.state !== 'open') fail('STALE_REVIEW_INPUT');
  return { number, state: pull.state, title: pull.title, body: pull.body ?? '', draft: pull.draft, updated_at: pull.updated_at,
    user: { id: pull.user.id, login: pull.user.login },
    head: { ref: pull.head.ref, sha: pull.head.sha }, base: { ref: pull.base.ref, sha: pull.base.sha } };
}

/** Bootstrap reads no consumer configuration or LLM secret. */
export async function verifyReviewOrigin(event, api) {
  try {
    if (!event || event.server_url !== 'https://github.com' || event.event_name !== 'workflow_dispatch'
      || !/^[a-zA-Z0-9][a-zA-Z0-9-]*\/[a-zA-Z0-9_.-]+$/.test(event.repository ?? '') || !login.test(event.actor ?? '')
      || !Number.isSafeInteger(event.pull_number) || event.pull_number < 1 || !sha.test(event.sha ?? '') || event.workflow_sha !== event.sha
      || !/^[1-9][0-9]*$/.test(String(event.run_id)) || !/^[1-9][0-9]*$/.test(String(event.run_attempt))) fail('UNTRUSTED_CONTEXT');
    const repo = await api.getRepository(event.repository);
    if (repo.full_name !== event.repository || repo.private !== true || repo.fork !== false || !repo.default_branch
      || event.ref !== `refs/heads/${repo.default_branch}`) fail('UNTRUSTED_CONTEXT');
    const prefix = `${event.repository}/.github/workflows/`; const suffix = `@refs/heads/${repo.default_branch}`;
    if (!event.workflow_ref?.startsWith(prefix) || !event.workflow_ref.endsWith(suffix)
      || !/^[a-zA-Z0-9_.-]+\.ya?ml$/.test(event.workflow_ref.slice(prefix.length, -suffix.length))) fail('UNTRUSTED_CONTEXT');
    const branch = await api.getBranch(event.repository, repo.default_branch);
    if (branch?.name !== repo.default_branch || !sha.test(branch.commit?.sha ?? '')) fail('UNTRUSTED_CONTEXT');
    if (branch.commit.sha !== event.sha) fail('STALE_REVIEW_INPUT');
    const pull = pullState(await api.getPull(event.repository, event.pull_number), event.repository, event.pull_number);
    return { repository: event.repository, default_branch: repo.default_branch, config_source_sha: branch.commit.sha, pull };
  } catch (error) { throw contractError(knownCodes.has(error.code) ? error.code : 'REVIEW_METADATA_UNAVAILABLE'); }
}

function actorIsKnown(actor, config) {
  const byLogin = config.automation_actors.find(a => a.login.toLowerCase() === actor?.login?.toLowerCase());
  const byId = config.automation_actors.find(a => a.id === actor?.id);
  if ((byLogin || byId) && (byLogin !== byId)) fail('UNTRUSTED_CONTEXT');
  return Boolean(byLogin);
}
async function requireWriter(repo, actor, api) {
  const permission = await api.getPermission(repo, actor);
  if (!['write', 'maintain', 'admin'].includes(permission?.permission)
    || permission.user?.login?.toLowerCase() !== actor.toLowerCase()) fail('UNTRUSTED_CONTEXT');
}
function intactBody(body, kind) {
  const pattern = new RegExp(`^<!-- ${kind}-body-sha256:([a-f0-9]{64}) -->\\n`);
  return typeof body === 'string' && pattern.test(body) && body.match(pattern)[1] === digest(body.replace(pattern, ''));
}

async function triageOrigin({ config, event, inputs, configRoot, origin }, api, sourceDispatch = false) {
  const h = inputs.handoff; const policy = config.triage_handoff; const repo = event.repository;
  if (!policy || !h || Object.keys(h).some(k => !['source_run_id', 'source_run_attempt', 'issue_number', 'source_fingerprint'].includes(k))
    || !/^[1-9][0-9]*$/.test(h.source_run_id) || !/^[1-9][0-9]*$/.test(h.source_run_attempt)
    || (sourceDispatch ? h.source_run_id !== String(event.run_id) || h.source_run_attempt !== String(event.run_attempt) : h.source_run_id === String(event.run_id))
    || !Number.isSafeInteger(h.issue_number) || h.issue_number < 1
    || !/^[a-f0-9]{64}$/.test(h.source_fingerprint ?? '') || !intactBody(origin.pull.body, 'triage')) fail('UNTRUSTED_CONTEXT');
  const run = await api.getRun(repo, h.source_run_id);
  if (String(run.id) !== h.source_run_id || String(run.run_attempt) !== h.source_run_attempt || run.repository?.full_name !== repo
    || run.head_repository?.full_name !== repo || run.path !== policy.workflow_path || run.head_branch !== origin.default_branch
    || run.head_sha !== origin.config_source_sha || !['issues', 'workflow_dispatch'].includes(run.event)
    || !['in_progress', 'completed'].includes(run.status) || (run.status === 'completed' && run.conclusion !== 'success')) fail('UNTRUSTED_CONTEXT');
  if (sourceDispatch && (event.event_name !== run.event || event.actor !== run.actor?.login || event.sha !== run.head_sha
    || event.workflow_sha !== run.head_sha || event.ref !== `refs/heads/${origin.default_branch}`
    || event.workflow_ref !== `${repo}/${policy.workflow_path}@refs/heads/${origin.default_branch}`)) fail('UNTRUSTED_CONTEXT');
  const jobs = await api.getRunJobs(repo, h.source_run_id, h.source_run_attempt);
  const finish = jobs.filter(job => job.name === policy.finish_job);
  if (finish.length !== 1 || String(finish[0].run_id) !== h.source_run_id
    || finish[0].head_sha !== origin.config_source_sha || finish[0].status !== 'completed' || finish[0].conclusion !== 'success') fail('UNTRUSTED_CONTEXT');
  const triageConfig = JSON.parse((await readTrustedFile(configRoot, policy.config_path, 32768)).toString('utf8'));
  const sourceEvent = { ...event, event_name: run.event, action: run.event === 'issues' ? 'opened' : undefined,
    issue_number: h.issue_number, actor: run.actor?.login,
    workflow_ref: `${repo}/${policy.workflow_path}@refs/heads/${origin.default_branch}` };
  const snapshot = await collectIssue({ event: sourceEvent, config: triageConfig }, api);
  const marker = `<!-- triage:v1:${repo}:${h.issue_number} -->`;
  const proof = `Entrada: ${snapshot.fingerprint}\nBase: ${snapshot.source_sha}\nConfiguração: ${snapshot.config_source_sha}`;
  const commit = await api.getCommit(repo, origin.pull.head.sha);
  if (snapshot.fingerprint !== h.source_fingerprint || snapshot.config_source_sha !== origin.config_source_sha
    || snapshot.route.route !== 'propose-patch' || origin.pull.head.ref !== `feature/triage-issue-${h.issue_number}`
    || origin.pull.base.ref !== snapshot.base_ref || origin.pull.base.sha !== snapshot.source_sha
    || !origin.pull.body.includes(`${marker}\n`) || !origin.pull.body.includes(`${proof}\n`)
    || commit?.sha !== origin.pull.head.sha || commit.parents?.length !== 1 || commit.parents[0].sha !== snapshot.source_sha
    || !sha.test(commit.tree?.sha ?? '')) fail('UNTRUSTED_CONTEXT');
  const prefix = `Triage proposal for issue #${h.issue_number}\n\n${marker}\n${proof}\nPatch: `;
  if (!commit.message?.startsWith(prefix) || !/^[a-f0-9]{64}\n?$/.test(commit.message.slice(prefix.length))) fail('UNTRUSTED_CONTEXT');
  return { origin: 'triage', handoff: structuredClone(h) };
}

/** Only the source run may request its own post-finish dispatch. The LLM collector still refuses self-run handoffs. */
export const verifyTriageDispatchOrigin = (input, api) => triageOrigin(input, api, true);
export { pullState as reviewPullState, reviewCorrectionOrigin as verifyReviewCorrectionOrigin };

/** A sealed body is an integrity check, not a signature; configured API authorship and commit ancestry are mandatory. */
async function reviewCorrectionOrigin(origin, api) {
  const body = origin.pull.body;
  if (!intactBody(body, 'review')) fail('UNTRUSTED_CONTEXT');
  const markers = body.split('\n').filter(line => line.startsWith('<!-- review:v1:'));
  const match = markers.length === 1 && /^<!-- review:v1:([^:]+):([1-9][0-9]*) -->$/.exec(markers[0]);
  if (!match || match[1] !== origin.repository || !Number.isSafeInteger(Number(match[2])) || Number(match[2]) === origin.pull.number) fail('UNTRUSTED_CONTEXT');
  const parent = pullState(await api.getPull(origin.repository, Number(match[2])), origin.repository, Number(match[2]));
  const fields = body.split('\n').filter(line => line.startsWith('Entrada: '));
  if (fields.length !== 1 || !/^Entrada: [a-f0-9]{64}$/.test(fields[0]) || origin.pull.base.ref !== parent.head.ref
    || origin.pull.base.sha !== parent.head.sha || origin.pull.head.ref !== `feature/review-pr-${parent.number}-${parent.head.sha.slice(0, 12)}`) fail('UNTRUSTED_CONTEXT');
  const proof = `${fields[0]}\nHead original: ${parent.head.sha}\nConfiguração: ${origin.config_source_sha}`;
  const commit = await api.getCommit(origin.repository, origin.pull.head.sha);
  const prefix = `Review correction for PR #${parent.number}\n\n${markers[0]}\n${proof}\nPatch: `;
  if (!body.includes(`${proof}\n`) || commit?.sha !== origin.pull.head.sha || commit.parents?.length !== 1
    || commit.parents[0].sha !== parent.head.sha || !sha.test(commit.tree?.sha ?? '')
    || !commit.message?.startsWith(prefix) || !/^[a-f0-9]{64}\n?$/.test(commit.message.slice(prefix.length))) fail('UNTRUSTED_CONTEXT');
  return { origin: 'review', handoff: null };
}

async function gitDiff(root, base, head) {
  const run = async (args, maxBuffer) => (await execute('git', ['--no-pager', '-c', 'core.fsmonitor=false', '-c', 'core.hooksPath=NUL',
    '-c', 'core.quotePath=false', ...args], { cwd: root, env: patchGitEnvironment(), encoding: 'utf8', timeout: 30000, maxBuffer, windowsHide: true })).stdout;
  try {
    if (checkedHead(root) !== head) fail('STALE_REVIEW_INPUT');
    const merge = (await run(['merge-base', base, head], 128)).trim(); if (!sha.test(merge)) fail('REVIEW_INCONCLUSIVE');
    const diff = await run(['diff', '--no-ext-diff', '--no-textconv', '--find-renames', '--full-index', merge, head, '--'], 16385);
    return { merge_base_sha: merge, diff, diff_index: buildDiffIndex(diff) };
  } catch (error) { throw contractError(error.code === 'STALE_REVIEW_INPUT' ? error.code : 'REVIEW_INCONCLUSIVE'); }
}

/** A bounded snapshot of API-backed metadata and the exact local Git comparison. */
export async function collectReview({ event, configRoot, sourceRoot, inputs }, api) {
  try {
    if (!inputs || inputs.pull_number !== event?.pull_number) fail('UNTRUSTED_CONTEXT');
    const origin = await verifyReviewOrigin(event, api);
    if (checkedHead(configRoot) !== origin.config_source_sha) fail('STALE_REVIEW_INPUT');
    const configBytes = await readTrustedFile(configRoot, inputs.config_path, 32768, 'INVALID_REVIEW_CONFIG');
    const config = validateReviewConfig(decodeConfig(configBytes));
    const configuredAuthor = actorIsKnown(origin.pull.user, config);
    let provenance = { origin: null, handoff: null };
    if (configuredAuthor) provenance = inputs.handoff ? await triageOrigin({ config, event, inputs, configRoot, origin }, api)
      : await reviewCorrectionOrigin(origin, api);
    else { if (inputs.handoff) fail('UNTRUSTED_CONTEXT'); await requireWriter(event.repository, origin.pull.user.login, api); }
    if (event.actor !== origin.pull.user.login || !configuredAuthor) await requireWriter(event.repository, event.actor, api);
    else if (!actorIsKnown({ login: event.actor, id: Number(event.actor_id) }, config)) fail('UNTRUSTED_CONTEXT');
    if (inputs.expected_source_sha !== undefined && inputs.expected_source_sha !== origin.pull.head.sha) fail('STALE_REVIEW_INPUT');
    const pull = { ...origin.pull, automation_origin: provenance.origin };
    let comparison; let error_code = '';
    try {
      if (Buffer.byteLength(pull.body) > 16384) fail('REVIEW_INCONCLUSIVE');
      comparison = await gitDiff(sourceRoot, pull.base.sha, pull.head.sha);
    } catch (error) {
      if (error.code !== 'REVIEW_INCONCLUSIVE') throw error;
      error_code = error.code; comparison = { merge_base_sha: null, diff: '', diff_index: { files: [] } };
    }
    const latest = await verifyReviewOrigin(event, api);
    if (JSON.stringify(latest) !== JSON.stringify(origin) || checkedHead(configRoot) !== origin.config_source_sha
      || checkedHead(sourceRoot) !== pull.head.sha) fail('STALE_REVIEW_INPUT');
    const fingerprint = reviewFingerprint({ ...origin, ...comparison, handoff: provenance.handoff }, configBytes);
    const context = { repository: event.repository, pull, source_sha: pull.head.sha, base_sha: pull.base.sha,
      config_source_sha: origin.config_source_sha, merge_base_sha: comparison.merge_base_sha, diff: comparison.diff };
    let context_json = JSON.stringify(context);
    if (Buffer.byteLength(context_json) > 32768 || error_code) {
      error_code = 'REVIEW_INCONCLUSIVE'; context_json = JSON.stringify({ repository: event.repository, pull_number: pull.number, source_sha: pull.head.sha, error_code });
    }
    return { repository: event.repository, default_branch: origin.default_branch, config_source_sha: origin.config_source_sha,
      source_sha: pull.head.sha, base_sha: pull.base.sha, ...comparison, pull: error_code ? { ...pull, body: '' } : pull,
      route: error_code ? 'needs-human' : classifyPull(pull, config), error_code, handoff: provenance.handoff, fingerprint, context_json };
  } catch (error) { throw contractError(knownCodes.has(error.code) ? error.code : 'REVIEW_METADATA_UNAVAILABLE'); }
}
