import { createHash } from 'node:crypto';
import { contractError } from '../llm/validate-request.mjs';
import { validateReviewConfig, classifyPull } from './policy.mjs';
import { validateReviewEnvelope, validateReviewResult } from './result.mjs';
import { preparePatch as prepareGitPatch, readPreparedProposal as readGitProposal } from '../shared/prepare-patch.mjs';
export { cleanupPreparedPatch } from '../shared/prepare-patch.mjs';

/** Review v3 is never converted into a triage envelope to bypass domain guards. */
export async function prepareReviewPatch({ snapshot, envelope, expected, patch, sourceRoot, config }) {
  const policy = validateReviewConfig(config);
  validateReviewEnvelope(envelope, expected);
  const identity = { repository: snapshot.repository, source_sha: snapshot.source_sha, config_source_sha: snapshot.config_source_sha,
    pull_number: snapshot.pull?.number, base_sha: snapshot.base_sha, merge_base_sha: snapshot.merge_base_sha, review_fingerprint: snapshot.fingerprint };
  if (Object.entries(identity).some(([key, value]) => expected[key] !== value)
    || envelope.status !== 'succeeded' || envelope.patch_file !== 'proposal.patch' || typeof patch !== 'string'
    || createHash('sha256').update(patch).digest('hex') !== envelope.patch_sha256) throw contractError('INVALID_RESULT');
  validateReviewResult({ status: envelope.status, decision: envelope.decision, summary: envelope.summary, findings: [], patch }, snapshot);
  if (classifyPull(snapshot.pull, policy) !== 'correction') throw contractError('INVALID_REVIEW_PATCH');
  if (Buffer.byteLength(patch) > 1048576) throw contractError('INVALID_REVIEW_PATCH');
  const paths = new Set(snapshot.diff_index.files.map(file => file.path));
  const allowed = path => paths.has(path) && policy.allowed_paths.some(prefix => path === prefix || path.startsWith(`${prefix}/`));
  const proposed = [...patch.matchAll(/^diff --git a\/(\S+) b\/(\S+)\r?$/gm)].flatMap(match => [match[1], match[2]]);
  if (proposed.some(path => !allowed(path))) throw contractError('INVALID_REVIEW_PATCH');
  try { return await prepareGitPatch({ source_sha: snapshot.source_sha, patch, sourceRoot, allowed, commitMessage: 'Apply validated review proposal' }); }
  catch (error) { throw contractError(error.code === 'STALE_PATCH_SOURCE' ? 'STALE_REVIEW_INPUT' : 'INVALID_REVIEW_PATCH'); }
}

export async function readPreparedProposal(prepared) {
  try { return await readGitProposal(prepared); }
  catch { throw contractError('INVALID_REVIEW_PATCH'); }
}
