import { createHash } from 'node:crypto';
import { readTrustedFile, contractError } from '../llm/validate-request.mjs';
import { validateTriageConfig } from './policy.mjs';
import { collectIssue } from './collect.mjs';

/** Domain adapter authorizes context; the generic executor only performs inference. */
export async function resolveTriageInvocation({ configRoot, event, inputs, checkedConfigSha, checkedOutSha }, api) {
  if (event.issue_number !== inputs.issue_number) throw contractError('UNTRUSTED_CONTEXT');
  let config;
  try {
    const bytes = await readTrustedFile(configRoot, inputs.triage_config_path, 32768);
    config = validateTriageConfig(JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(bytes)));
  } catch { throw contractError('INVALID_TRIAGE_CONFIG'); }
  const snapshot = await collectIssue({ event, config }, api);
  const sourceRef = snapshot.base_ref ?? snapshot.default_branch;
  if (sourceRef !== inputs.source_ref) throw contractError('UNTRUSTED_CONTEXT');
  const contextMatches = inputs.triage_fingerprint
    ? inputs.triage_fingerprint === snapshot.fingerprint && (inputs.context_json ?? '{}') === '{}'
    : createHash('sha256').update(inputs.context_json ?? '{}').digest('hex') === snapshot.fingerprint;
  if (snapshot.source_sha !== inputs.expected_source_sha || snapshot.config_source_sha !== checkedConfigSha
    || (checkedOutSha !== undefined && snapshot.source_sha !== checkedOutSha)
    || !contextMatches) throw contractError('STALE_TRIAGE_INPUT');
  if (snapshot.route.route === 'needs-human') throw contractError('STALE_TRIAGE_INPUT');
  const route = snapshot.route.route === 'propose-patch' ? 'patch' : 'plan';
  if (inputs.config_path !== config.llm_configs[route]) throw contractError('UNTRUSTED_CONTEXT');
  return snapshot;
}
