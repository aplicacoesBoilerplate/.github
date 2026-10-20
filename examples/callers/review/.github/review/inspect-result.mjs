import { resolve } from 'node:path';
import { createHash } from 'node:crypto';
import { readTrustedFile } from '../../../automation/scripts/llm/validate-request.mjs';
import { prepareInstructions } from '../../../automation/scripts/llm/instructions.mjs';
import { checkedHead } from '../../../automation/scripts/triage/workflow.mjs';
import { validateReviewConfig, classifyPull } from '../../../automation/scripts/review/policy.mjs';
import { reviewFingerprint } from '../../../automation/scripts/review/collect.mjs';
import { readReviewPackage } from '../../../automation/scripts/review/result.mjs';

const hash = value => createHash('sha256').update(value).digest('hex');
try {
  const env = process.env; const consumer = resolve(env.GITHUB_WORKSPACE, 'consumer'); const number = Number(env.EXPECTED_PULL_NUMBER);
  if (!Number.isSafeInteger(number) || number < 1 || checkedHead(consumer) !== env.EXPECTED_CONFIG_SOURCE_SHA
    || checkedHead(resolve(env.GITHUB_WORKSPACE, 'consumer-source')) !== env.EXPECTED_SOURCE_SHA
    || checkedHead(resolve(env.GITHUB_WORKSPACE, 'automation')) !== env.EXPECTED_AUTOMATION_SHA) throw new Error();
  const snapshot = JSON.parse((await readTrustedFile(resolve(env.GITHUB_WORKSPACE, 'review-input'), 'snapshot.json', 1048576)).toString('utf8'));
  const identity = { repository: env.GITHUB_REPOSITORY, source_sha: env.EXPECTED_SOURCE_SHA, config_source_sha: env.EXPECTED_CONFIG_SOURCE_SHA,
    pull_number: number, base_sha: env.EXPECTED_BASE_SHA, merge_base_sha: env.EXPECTED_MERGE_BASE_SHA, review_fingerprint: env.EXPECTED_FINGERPRINT };
  if (snapshot.repository !== identity.repository || snapshot.pull?.number !== number || snapshot.source_sha !== identity.source_sha
    || snapshot.config_source_sha !== identity.config_source_sha || snapshot.base_sha !== identity.base_sha || snapshot.merge_base_sha !== identity.merge_base_sha
    || snapshot.fingerprint !== identity.review_fingerprint) throw new Error();
  const policyBytes = await readTrustedFile(consumer, '.github/review/config.json', 32768);
  const policy = validateReviewConfig(JSON.parse(policyBytes.toString('utf8')));
  if (snapshot.route !== classifyPull(snapshot.pull, policy) || snapshot.fingerprint !== reviewFingerprint(snapshot, policyBytes)) throw new Error();
  const configPath = policy.llm_configs[snapshot.route === 'correction' ? 'correction' : 'review'];
  const expected = { ...identity, run_id: env.GITHUB_RUN_ID, run_attempt: env.GITHUB_RUN_ATTEMPT, invocation_id: `review-${number}`,
    automation_sha: env.EXPECTED_AUTOMATION_SHA, config_sha256: hash(await readTrustedFile(consumer, configPath, 32768)),
    instructions_sha256: (await prepareInstructions(consumer)).sha256 };
  const result = await readReviewPackage(env.RESULT_DIRECTORY ?? resolve(env.GITHUB_WORKSPACE, 'llm-result'), expected, snapshot);
  process.stdout.write(`Verified review result: ${result.envelope.status}\n`);
} catch { process.stderr.write('INVALID_RESULT\n'); process.exitCode = 1; }
