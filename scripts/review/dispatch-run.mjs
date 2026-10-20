import { readFile, appendFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { contractError } from '../llm/validate-request.mjs';
import { checkedHead } from '../triage/workflow.mjs';
import { createReviewDispatchApi } from './dispatch-api.mjs';
import { dispatchReview } from './dispatch.mjs';

const env = process.env;
try {
  if (!env.GITHUB_WORKSPACE || checkedHead(resolve(env.GITHUB_WORKSPACE, 'automation')) !== env.AUTOMATION_SHA) throw contractError('UNTRUSTED_CONTEXT');
  const payload = JSON.parse(await readFile(env.GITHUB_EVENT_PATH, 'utf8'));
  const bridge = env.GITHUB_EVENT_NAME === 'pull_request_target';
  const number = Number(bridge ? payload.pull_request?.number : env.REVIEW_PULL_NUMBER);
  if (bridge && env.REVIEW_PULL_NUMBER && Number(env.REVIEW_PULL_NUMBER) !== number) throw contractError('UNTRUSTED_CONTEXT');
  const event = { repository: env.GITHUB_REPOSITORY, event_name: env.GITHUB_EVENT_NAME, action: payload.action,
    pull_number: number, actor: env.GITHUB_ACTOR, actor_id: Number(env.GITHUB_ACTOR_ID), sha: env.GITHUB_SHA, workflow_sha: env.GITHUB_WORKFLOW_SHA,
    ref: env.GITHUB_REF, workflow_ref: env.GITHUB_WORKFLOW_REF, server_url: env.GITHUB_SERVER_URL, run_id: env.GITHUB_RUN_ID, run_attempt: env.GITHUB_RUN_ATTEMPT };
  let handoff;
  if (!bridge) {
    const issue = Number(env.TRIAGE_SOURCE_ISSUE);
    if (Number(env.GITHUB_EVENT_NAME === 'issues' ? payload.issue?.number : payload.inputs?.issue_number) !== issue) throw contractError('UNTRUSTED_CONTEXT');
    handoff = { source_run_id: env.GITHUB_RUN_ID, source_run_attempt: env.GITHUB_RUN_ATTEMPT, issue_number: issue, source_fingerprint: env.TRIAGE_SOURCE_FINGERPRINT };
  }
  const api = createReviewDispatchApi(env.REVIEW_DISPATCH_TOKEN, { readToken: env.REVIEW_READ_TOKEN });
  const head = bridge ? payload.pull_request?.head?.sha : (await api.getPull(env.GITHUB_REPOSITORY, number)).head?.sha;
  const result = await dispatchReview({ pull: number, expected_head_sha: head, handoff, event, configRoot: resolve(env.GITHUB_WORKSPACE, 'consumer'),
    target: { repository: env.GITHUB_REPOSITORY, ref: payload.repository?.default_branch,
      workflow_path: env.REVIEW_TARGET_WORKFLOW ?? '.github/workflows/review.yml', config_path: env.REVIEW_CONFIG_PATH ?? '.github/review/config.json' } }, api);
  const text = `status=${result.status}\nrun_id=${result.run_id ?? ''}\ndispatch_id=${result.dispatch_id ?? ''}\n`;
  if (Buffer.byteLength(text) > 8192 || /[\r\n]/.test(result.status) || (result.run_id !== null && !/^[1-9][0-9]*$/.test(result.run_id))) throw contractError('INVALID_RESULT');
  if (env.GITHUB_OUTPUT) await appendFile(env.GITHUB_OUTPUT, text);
  process.stdout.write(`Review dispatch: ${result.status}\n`);
} catch (error) {
  const code = ['UNTRUSTED_CONTEXT', 'STALE_REVIEW_INPUT', 'INVALID_REVIEW_CONFIG', 'REVIEW_RESOURCE_CONFLICT'].includes(error.code) ? error.code : 'REVIEW_DISPATCH_FAILED';
  if (env.GITHUB_OUTPUT) await appendFile(env.GITHUB_OUTPUT, `status=failed\nerror_code=${code}\n`);
  process.stderr.write(`${code}\n`); process.exitCode = 1;
}
