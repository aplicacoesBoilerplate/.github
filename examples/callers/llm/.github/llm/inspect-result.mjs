import { readFile, readdir } from 'node:fs/promises';
import { resolve } from 'node:path';
import { createHash } from 'node:crypto';
import { validateEnvelope, validatePatch } from '../../../automation/scripts/llm/result.mjs';
import { prepareInstructions } from '../../../automation/scripts/llm/instructions.mjs';
import { readTrustedFile } from '../../../automation/scripts/llm/validate-request.mjs';

try {
  const env = process.env;
  const source = resolve(env.GITHUB_WORKSPACE, 'consumer');
  const directory = env.RESULT_DIRECTORY ?? resolve(env.GITHUB_WORKSPACE, 'llm-result');
  const config = await readTrustedFile(source, env.EXPECTED_CONFIG_PATH, 32768);
  const instructions = await prepareInstructions(source);
  const json = await readTrustedFile(directory, 'result.json', 1048576, 'INVALID_RESULT');
  const envelope = JSON.parse(json.toString('utf8'));
  validateEnvelope(envelope, {
    repository: env.GITHUB_REPOSITORY, run_id: env.GITHUB_RUN_ID, run_attempt: env.GITHUB_RUN_ATTEMPT,
    invocation_id: env.EXPECTED_INVOCATION_ID, source_sha: env.EXPECTED_SOURCE_SHA, automation_sha: env.EXPECTED_AUTOMATION_SHA,
    config_sha256: createHash('sha256').update(config).digest('hex'), instructions_sha256: instructions.sha256,
  });
  const expectedFiles = ['result.json', ...(envelope.patch_file ? [envelope.patch_file] : [])].sort();
  const actualFiles = (await readdir(directory)).sort();
  if (JSON.stringify(actualFiles) !== JSON.stringify(expectedFiles)) throw new Error('INVALID_RESULT');
  if (envelope.patch_file) {
    const patch = await readTrustedFile(directory, envelope.patch_file, 1048576, 'INVALID_RESULT');
    if (json.length + patch.length > 1048576) throw new Error('INVALID_RESULT');
    validatePatch(patch.toString('utf8'));
  }
  process.stdout.write('Verified result: ' + envelope.status + '\n');
} catch {
  process.stderr.write('INVALID_RESULT\n');
  process.exitCode = 1;
}
