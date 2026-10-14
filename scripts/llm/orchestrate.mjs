import { createHash } from 'node:crypto';
import { verifyContext, githubMetadataApi } from './preflight.mjs';
import { loadRequest, readTrustedFile, contractError } from './validate-request.mjs';
import { prepareInstructions } from './instructions.mjs';
import { getFreshSessionMetadata } from './check-session-freshness.mjs';
import { restoreAuth, cleanupAuth, validateManagedSession, validateAuthConfig } from './auth.mjs';
import { persistIfChanged } from './persist-session.mjs';
import { executeRequest } from './execute.mjs';
import { validateAndPackage } from './result.mjs';

export async function runInvocation({ sourceRoot, outputRoot, event, inputs, secrets, automation_sha }, options = {}) {
  const metadata = await verifyContext(event, inputs, options.metadataApi ?? githubMetadataApi(secrets.GITHUB_TOKEN, options));
  if (options.checkedOutSha !== undefined && options.checkedOutSha !== metadata.source_sha) throw contractError('UNTRUSTED_CONTEXT');
  const request = await loadRequest(sourceRoot, inputs);
  const instructions = await prepareInstructions(sourceRoot);
  const configBytes = await readTrustedFile(sourceRoot, inputs.config_path, 32768);
  validateAuthConfig(inputs.auth_mode, secrets);
  const boundary = inputs.auth_mode === 'chatgpt-session'
    ? await getFreshSessionMetadata({ ...event, session_secret_name: inputs.session_secret_name }, secrets, options) : null;
  const sensitiveValues = Object.values(secrets).filter(value => typeof value === 'string' && value);
  let auth; let result; let failure;
  try {
    auth = await restoreAuth(inputs.auth_mode, secrets, options.auth);
    options.onAuth?.(auth);
    try {
      result = await (options.execute ?? executeRequest)(request, { sourceRoot, auth, instructions: instructions.content }, options.execution);
    } catch (error) { failure = error; }
    if (boundary) {
      try { await (options.persist ?? persistIfChanged)(auth, { repository: event.repository, session_secret_name: inputs.session_secret_name }, boundary, secrets.CODEX_AUTH_WRITE_PAT, options); }
      catch (error) { failure = error; }
      if (!failure) {
        try {
          const current = await readTrustedFile(auth.dir, 'auth.json', 49152, 'AUTH_PERSIST_FAILED');
          sensitiveValues.push(...Object.values(validateManagedSession(current.toString('utf8'), 'AUTH_PERSIST_FAILED').tokens).filter(value => typeof value === 'string' && value));
        } catch (error) { failure = error; }
      }
    }
  } catch (error) { failure = error; }
  finally {
    if (auth) {
      try { await cleanupAuth(auth); }
      catch (error) { failure ??= error; }
    }
  }
  if (failure) throw contractError(failure.code ?? 'PROVIDER_ERROR');
  if (boundary) sensitiveValues.push(...Object.values(validateManagedSession(secrets.CODEX_AUTH_JSON).tokens).filter(value => typeof value === 'string' && value));
  return validateAndPackage(result, {
    repository: event.repository, source_sha: metadata.source_sha, automation_sha,
    run_id: event.run_id, run_attempt: event.run_attempt, invocation_id: inputs.invocation_id,
    config_sha256: createHash('sha256').update(configBytes).digest('hex'), instructions_sha256: instructions.sha256,
  }, outputRoot, { sensitiveValues });
}

export function publicationStatus(invocation, upload, cleanup, resultStatus) {
  if ([invocation, upload, cleanup].some(outcome => outcome !== 'success') || !['succeeded', 'skipped', 'needs-human'].includes(resultStatus)) throw contractError('ARTIFACT_FAILED');
  return resultStatus;
}
