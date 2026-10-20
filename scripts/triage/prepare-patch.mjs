import { validateEnvelope, validatePatch } from '../llm/result.mjs';
import { contractError } from '../llm/validate-request.mjs';
import { validateTriageConfig } from './policy.mjs';
import { preparePatch as prepareGitPatch, readPreparedProposal as readGitProposal } from '../shared/prepare-patch.mjs';
export { cleanupPreparedPatch, patchGitEnvironment } from '../shared/prepare-patch.mjs';

/** Domain authorization stays here; the shared Git core receives only authorized operations. */
export async function preparePatch({ envelope, expected, patch, sourceRoot, config }) {
  const policy = validateTriageConfig(config);
  validateEnvelope(envelope, expected);
  if (envelope.schema_version !== 2 || envelope.status !== 'succeeded' || envelope.patch_file !== 'proposal.patch') throw contractError('INVALID_RESULT');
  validatePatch(patch);
  if (Buffer.byteLength(patch) > 1048576) throw contractError('INVALID_TRIAGE_PATCH');
  const allowed = path => policy.allowed_paths.some(prefix => path === prefix || path.startsWith(`${prefix}/`));
  const paths = [...patch.matchAll(/^diff --git a\/(\S+) b\/(\S+)\r?$/gm)].flatMap(match => [match[1], match[2]]);
  if (paths.some(path => !allowed(path) || path.startsWith('.github/triage/'))) throw contractError('INVALID_TRIAGE_PATCH');
  try { return await prepareGitPatch({ source_sha: expected.source_sha, patch, sourceRoot, allowed, commitMessage: 'Apply validated triage proposal' }); }
  catch (error) { throw contractError(error.code === 'STALE_PATCH_SOURCE' ? 'STALE_TRIAGE_INPUT' : 'INVALID_TRIAGE_PATCH'); }
}

export async function readPreparedProposal(prepared) {
  try { return await readGitProposal(prepared); }
  catch { throw contractError('INVALID_TRIAGE_PATCH'); }
}
