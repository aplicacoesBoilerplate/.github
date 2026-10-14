import test from 'node:test';
import assert from 'node:assert/strict';
import { checkFreshness, withFreshSession } from '../../scripts/llm/check-session-freshness.mjs';

const context = { repository: 'owner/app', run_id: '42', session_secret_name: 'MY_CODEX_AUTH' };
const secrets = { CODEX_AUTH_WRITE_PAT: 'pat-fixture', GITHUB_TOKEN: 'github-fixture' };
const run = { id: 42, created_at: '2026-10-12T12:00:01Z', repository: { full_name: 'owner/app' } };
const secret = { name: 'MY_CODEX_AUTH', updated_at: '2026-10-12T12:00:00Z' };
const deny = promise => assert.rejects(promise, { code: 'AUTH_SNAPSHOT_STALE', message: 'AUTH_SNAPSHOT_STALE' });
const fake = (metadata = secret, execution = run) => async (url, options) => {
  if (url.endsWith('/actions/secrets/MY_CODEX_AUTH')) {
    assert.equal(options.headers.Authorization, 'Bearer pat-fixture');
    return { ok: true, json: async () => metadata };
  }
  assert.equal(url, 'https://api.github.com/repos/owner/app/actions/runs/42');
  assert.equal(options.headers.Authorization, 'Bearer github-fixture');
  return { ok: true, json: async () => execution };
};

test('LLM-09: guard releases the original session only when secret predates the run', async () => {
  const result = await withFreshSession(context, secrets, boundary => ({ source: boundary.repository, updated_at: boundary.updated_at }), { fetchImpl: fake() });
  assert.deepEqual(result, { source: 'owner/app', updated_at: secret.updated_at });
  assert.equal(checkFreshness(secret, run), secret.updated_at);
});
test('LLM-09: queued snapshot and rerun cannot invoke or persist after a rotation', async () => {
  let sessionUsed = false;
  for (const updated_at of ['2026-10-12T12:00:01Z', '2026-10-12T12:00:02Z']) {
    await deny(withFreshSession(context, secrets, () => { sessionUsed = true; }, { fetchImpl: fake({ ...secret, updated_at }, { ...run, run_attempt: 2 }) }));
  }
  assert.equal(sessionUsed, false);
});
test('LLM-09: precision within same second and invalid calendar timestamps fail closed', () => {
  for (const [updated_at, created_at] of [
    ['2026-10-12T12:00:01.001Z', '2026-10-12T12:00:01.999Z'],
    ['not-a-timestamp', run.created_at], [secret.updated_at, ''],
    ['2026-02-30T12:00:00Z', run.created_at],
  ]) assert.throws(() => checkFreshness({ updated_at }, { created_at }), { code: 'AUTH_SNAPSHOT_STALE' });
});
test('LLM-09: forbidden/unavailable or mismatched metadata prevents session use', async () => {
  let sessionUsed = false;
  const work = () => { sessionUsed = true; };
  await deny(withFreshSession(context, secrets, work, { fetchImpl: async () => ({ ok: false, status: 403 }) }));
  await deny(withFreshSession(context, secrets, work, { fetchImpl: fake({ ...secret, name: 'OTHER_SECRET' }) }));
  await deny(withFreshSession(context, secrets, work, { fetchImpl: fake(secret, { ...run, id: 43 }) }));
  await deny(withFreshSession(context, secrets, work, { fetchImpl: fake(secret, { ...run, repository: { full_name: 'other/app' } }) }));
  assert.equal(sessionUsed, false);
});
