import { githubGet } from './preflight.mjs';
import { contractError } from './validate-request.mjs';

export function githubTimestamp(value, errorCode) {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,3})?Z$/.test(value)) throw contractError(errorCode);
  const parsed = Date.parse(value);
  if (!Number.isFinite(parsed) || new Date(parsed).toISOString().slice(0, 19) !== value.slice(0, 19)) throw contractError(errorCode);
  return Math.floor(parsed / 1000);
}

export function checkFreshness(secretMetadata, runMetadata) {
  const code = 'AUTH_SNAPSHOT_STALE';
  if (githubTimestamp(secretMetadata?.updated_at, code) >= githubTimestamp(runMetadata?.created_at, code)) throw contractError(code);
  return secretMetadata.updated_at;
}

export function sessionTarget(context, errorCode) {
  if (!/^[a-zA-Z0-9][a-zA-Z0-9-]*\/[a-zA-Z0-9_.-]+$/.test(context.repository)
    || ['.', '..'].includes(context.repository.split('/')[1])
    || !/^[A-Z][A-Z0-9_]{0,99}$/.test(context.session_secret_name) || context.session_secret_name.startsWith('GITHUB_')) throw contractError(errorCode);
  return `/repos/${context.repository}/actions/secrets/${context.session_secret_name}`;
}

export async function getFreshSessionMetadata(context, secrets, options = {}) {
  const errorCode = 'AUTH_SNAPSHOT_STALE';
  const target = sessionTarget(context, errorCode);
  if (!/^[1-9][0-9]*$/.test(String(context.run_id))) throw contractError(errorCode);
  const fetchOptions = { ...options, errorCode };
  const [metadata, run] = await Promise.all([
    githubGet(target, secrets.CODEX_AUTH_WRITE_PAT, fetchOptions),
    githubGet(`/repos/${context.repository}/actions/runs/${context.run_id}`, secrets.GITHUB_TOKEN, fetchOptions),
  ]);
  if (metadata?.name !== context.session_secret_name || String(run?.id) !== String(context.run_id)
    || run.repository?.full_name?.toLowerCase() !== context.repository.toLowerCase()) throw contractError(errorCode);
  const updated_at = checkFreshness(metadata, run);
  return Object.freeze({ repository: context.repository, session_secret_name: context.session_secret_name, updated_at, run_created_at: run.created_at, run_id: String(run.id) });
}

export async function withFreshSession(context, secrets, work, options = {}) {
  const boundary = await getFreshSessionMetadata(context, secrets, options);
  return work(boundary);
}
