import { createHash } from 'node:crypto';
import { verifyContext, githubMetadataApi } from './preflight.mjs';
import { loadRequest, readTrustedFile, contractError } from './validate-request.mjs';
import { prepareInstructions } from './instructions.mjs';
import { getFreshSessionMetadata } from './check-session-freshness.mjs';
import { restoreAuth, cleanupAuth, validateManagedSession, validateAuthConfig } from './auth.mjs';
import { persistIfChanged } from './persist-session.mjs';
import { executeRequest } from './execute.mjs';
import { validateAndPackage } from './result.mjs';
import { resolveTriageInvocation } from '../triage/invocation.mjs';
import { createTriageApi } from '../triage/api.mjs';

export async function runInvocation({ sourceRoot, configRoot = sourceRoot, outputRoot, event, inputs, secrets, automation_sha }, options = {}) {
  const manualMetadata = inputs.caller_profile !== 'triage'
    ? await verifyContext(event, inputs, options.metadataApi ?? githubMetadataApi(secrets.GITHUB_TOKEN, options)) : null;
  const request = await loadRequest(configRoot, inputs);
  let triage;
  if (inputs.caller_profile === 'triage') {
    if (!secrets.TRIAGE_READ_TOKEN) throw contractError('TRIAGE_METADATA_UNAVAILABLE');
    triage = await resolveTriageInvocation({ configRoot, event, inputs, checkedConfigSha: options.checkedConfigSha, checkedOutSha: options.checkedOutSha },
      options.triageApi ?? createTriageApi(secrets.TRIAGE_READ_TOKEN, options));
    request.context = JSON.parse(triage.context_json);
  }
  const metadata = triage ?? manualMetadata;
  if (options.checkedOutSha !== undefined && options.checkedOutSha !== metadata.source_sha) throw contractError('UNTRUSTED_CONTEXT');
  const instructions = await prepareInstructions(configRoot);
  const configBytes = await readTrustedFile(configRoot, inputs.config_path, 32768);
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
      if (triage?.route.route === 'plan' && result?.patch !== null) throw contractError('INVALID_RESULT');
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
    ...(triage ? { config_source_sha: triage.config_source_sha } : {}),
    run_id: event.run_id, run_attempt: event.run_attempt, invocation_id: inputs.invocation_id,
    config_sha256: createHash('sha256').update(configBytes).digest('hex'), instructions_sha256: instructions.sha256,
  }, outputRoot, { sensitiveValues });
}

export function publicationStatus(invocation, upload, cleanup, resultStatus) {
  if ([invocation, upload, cleanup].some(outcome => outcome !== 'success') || !['succeeded', 'skipped', 'needs-human'].includes(resultStatus)) throw contractError('ARTIFACT_FAILED');
  return resultStatus;
}
