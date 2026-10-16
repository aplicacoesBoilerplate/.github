import { readdir } from 'node:fs/promises';
import { resolve } from 'node:path';
import { createHash } from 'node:crypto';
import { validateEnvelope, validatePatch } from '../../../automation/scripts/llm/result.mjs';
import { prepareInstructions } from '../../../automation/scripts/llm/instructions.mjs';
import { readTrustedFile } from '../../../automation/scripts/llm/validate-request.mjs';
import { validateTriageConfig } from '../../../automation/scripts/triage/policy.mjs';
import { checkedHead } from '../../../automation/scripts/triage/workflow.mjs';

const hash = bytes => createHash('sha256').update(bytes).digest('hex');
try {
  const env = process.env; const consumer = resolve(env.GITHUB_WORKSPACE, 'consumer');
  const directory = env.RESULT_DIRECTORY ?? resolve(env.GITHUB_WORKSPACE, 'llm-result');
  const issue = Number(env.EXPECTED_ISSUE_NUMBER);
  if (!Number.isSafeInteger(issue) || issue < 1 || checkedHead(consumer) !== env.EXPECTED_CONFIG_SOURCE_SHA
    || checkedHead(resolve(env.GITHUB_WORKSPACE, 'consumer-source')) !== env.EXPECTED_SOURCE_SHA) throw new Error('INVALID_RESULT');
  const snapshot = JSON.parse((await readTrustedFile(resolve(env.GITHUB_WORKSPACE, 'triage-input'), 'snapshot.json', 1048576)).toString('utf8'));
  if (snapshot.repository !== env.GITHUB_REPOSITORY || snapshot.issue.number !== issue || snapshot.source_sha !== env.EXPECTED_SOURCE_SHA
    || snapshot.config_source_sha !== env.EXPECTED_CONFIG_SOURCE_SHA || snapshot.fingerprint !== env.EXPECTED_FINGERPRINT
    || hash(snapshot.context_json) !== snapshot.fingerprint || Buffer.byteLength(snapshot.context_json) > 32768) throw new Error('INVALID_RESULT');
  const context = JSON.parse(snapshot.context_json);
  if (context.issue.number !== issue || context.source_sha !== snapshot.source_sha || context.config_source_sha !== snapshot.config_source_sha) throw new Error('INVALID_RESULT');
  const policy = validateTriageConfig(JSON.parse((await readTrustedFile(consumer, '.github/triage/config.json', 32768)).toString('utf8')));
  if (!['plan', 'propose-patch'].includes(snapshot.route.route)) throw new Error('INVALID_RESULT');
  const configPath = policy.llm_configs[snapshot.route.route === 'propose-patch' ? 'patch' : 'plan'];
  const config = await readTrustedFile(consumer, configPath, 32768); const json = await readTrustedFile(directory, 'result.json', 1048576, 'INVALID_RESULT');
  const envelope = JSON.parse(json.toString('utf8'));
  validateEnvelope(envelope, { repository: env.GITHUB_REPOSITORY, run_id: env.GITHUB_RUN_ID, run_attempt: env.GITHUB_RUN_ATTEMPT,
    invocation_id: `triage-${issue}`, source_sha: env.EXPECTED_SOURCE_SHA, config_source_sha: env.EXPECTED_CONFIG_SOURCE_SHA,
    automation_sha: env.EXPECTED_AUTOMATION_SHA, config_sha256: hash(config), instructions_sha256: (await prepareInstructions(consumer)).sha256 });
  const files = ['result.json', ...(envelope.patch_file ? ['proposal.patch'] : [])].sort();
  if (JSON.stringify((await readdir(directory)).sort()) !== JSON.stringify(files)) throw new Error('INVALID_RESULT');
  if (envelope.patch_file) {
    if (snapshot.route.route !== 'propose-patch') throw new Error('INVALID_RESULT');
    const patch = await readTrustedFile(directory, 'proposal.patch', 1048576, 'INVALID_RESULT');
    if (json.length + patch.length > 1048576) throw new Error('INVALID_RESULT');
    const text = new TextDecoder('utf-8', { fatal: true }).decode(patch); validatePatch(text);
    const paths = [...text.matchAll(/^diff --git a\/(\S+) b\/(\S+)\r?$/gm)].flatMap(match => [match[1], match[2]]);
    if (paths.some(path => path.startsWith('.github/triage/') || !policy.allowed_paths.some(p => path === p || path.startsWith(`${p}/`)))) throw new Error('INVALID_RESULT');
  }
  process.stdout.write(`Verified triage result: ${envelope.status}\n`);
} catch { process.stderr.write('INVALID_RESULT\n'); process.exitCode = 1; }
