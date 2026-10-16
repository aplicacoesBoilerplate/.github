import { contractError, readTrustedFile } from '../llm/validate-request.mjs';
import { collectReview } from './collect.mjs';
import { validateReviewConfig } from './policy.mjs';
import { prepareReviewSource } from './source.mjs';

/** Resolve the domain policy again; the executor receives only a bounded trusted snapshot. */
export async function resolveReviewInvocation({ configRoot, sourceRoot, event, inputs, checkedConfigSha, checkedOutSha }, api) {
  if (event.pull_number !== inputs.pull_number || (inputs.context_json ?? '{}') !== '{}') throw contractError('UNTRUSTED_CONTEXT');
  let handoff; let config;
  try {
    handoff = JSON.parse(inputs.review_handoff_json ?? '{}');
    if (!handoff || typeof handoff !== 'object' || Array.isArray(handoff)) throw new Error();
    const bytes = await readTrustedFile(configRoot, inputs.review_config_path, 32768);
    config = validateReviewConfig(JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(bytes)));
  } catch { throw contractError('INVALID_REVIEW_CONFIG'); }
  const snapshot = await collectReview({ configRoot, sourceRoot, event,
    inputs: { config_path: inputs.review_config_path, pull_number: inputs.pull_number, expected_source_sha: inputs.expected_source_sha,
      ...(Object.keys(handoff).length ? { handoff } : {}) } }, api);
  if (snapshot.pull.head.ref !== inputs.source_ref) throw contractError('UNTRUSTED_CONTEXT');
  if (snapshot.fingerprint !== inputs.review_fingerprint || (checkedConfigSha !== undefined && snapshot.config_source_sha !== checkedConfigSha)
    || (checkedOutSha !== undefined && snapshot.source_sha !== checkedOutSha)) throw contractError('STALE_REVIEW_INPUT');
  if (snapshot.route === 'needs-human') throw contractError('REVIEW_INCONCLUSIVE');
  if (inputs.config_path !== config.llm_configs[snapshot.route === 'correction' ? 'correction' : 'review']) throw contractError('UNTRUSTED_CONTEXT');
  return { ...snapshot, source_files: await prepareReviewSource(sourceRoot, snapshot) };
}
