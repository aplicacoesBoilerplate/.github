import test from 'node:test';
import assert from 'node:assert/strict';
import { writeFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { restoreAuth, cleanupAuth } from '../../scripts/llm/auth.mjs';
import { persistIfChanged } from '../../scripts/llm/persist-session.mjs';

const require = createRequire(new URL('../../scripts/llm/package.json', import.meta.url));
const sodium = require('libsodium-wrappers');
await sodium.ready;
const key = sodium.crypto_box_keypair();
const initial = JSON.stringify({ auth_mode: 'chatgpt', tokens: { access_token: 'old-access', id_token: 'old-id', refresh_token: 'old-refresh' } });
const refreshed = initial.replace('old-access', 'new-access').replace('old-refresh', 'new-refresh');
const context = { repository: 'owner/app', session_secret_name: 'MY_CODEX_AUTH' };
const boundary = { ...context, updated_at: '2026-10-12T12:00:00Z' };
async function authFixture(t, content = refreshed) {
  const auth = await restoreAuth('chatgpt-session', { CODEX_AUTH_JSON: initial, CODEX_AUTH_WRITE_PAT: 'pat-fixture' });
  t.after(() => cleanupAuth(auth));
  await writeFile(auth.file, content);
  return auth;
}
function api({ status = 204, updated_at = boundary.updated_at, publicKey = sodium.to_base64(key.publicKey, sodium.base64_variants.ORIGINAL), writeError = null } = {}) {
  const requests = [];
  return { requests, fetchImpl: async (url, options) => {
    requests.push({ url, ...options });
    assert.equal(options.headers.Authorization, 'Bearer pat-fixture');
    if (options.method === 'PUT') {
      if (writeError) throw writeError;
      return { status, ok: status === 201 || status === 204 };
    }
    if (url.endsWith('/public-key')) return { ok: true, json: async () => ({ key_id: 'key-fixture', key: publicKey }) };
    return { ok: true, json: async () => ({ name: context.session_secret_name, updated_at }) };
  } };
}

test('LLM-10: encrypted PUT contains refreshed session, fixed consumer destination and key ID', async t => {
  const auth = await authFixture(t);
  for (const status of [201, 204]) {
    const transport = api({ status });
    assert.deepEqual(await persistIfChanged(auth, context, boundary, 'pat-fixture', transport), { persisted: true });
    const writes = transport.requests.filter(r => r.method === 'PUT');
    assert.equal(writes.length, 1);
    assert.equal(writes[0].url, 'https://api.github.com/repos/owner/app/actions/secrets/MY_CODEX_AUTH');
    assert.equal(writes[0].redirect, 'error');
    const body = JSON.parse(writes[0].body);
    assert.deepEqual(Object.keys(body).sort(), ['encrypted_value', 'key_id']);
    assert.equal(body.key_id, 'key-fixture');
    const decrypted = sodium.crypto_box_seal_open(sodium.from_base64(body.encrypted_value, sodium.base64_variants.ORIGINAL), key.publicKey, key.privateKey, 'text');
    assert.equal(decrypted, refreshed);
    assert.equal(writes[0].body.includes('new-refresh'), false);
  }
});
test('LLM-10: unchanged session causes no request, avoiding unnecessary secret rotation', async t => {
  const auth = await authFixture(t, initial); const transport = api();
  assert.deepEqual(await persistIfChanged(auth, context, boundary, 'pat-fixture', transport), { persisted: false });
  assert.deepEqual(transport.requests, []);
});
test('LLM-11: invalid refreshed file and cross-repository boundary cannot overwrite a secret', async t => {
  const auth = await authFixture(t, 'malformed-session-sentinel'); const transport = api();
  await assert.rejects(persistIfChanged(auth, context, boundary, 'pat-fixture', transport), { code: 'AUTH_PERSIST_FAILED' });
  await writeFile(auth.file, refreshed);
  await assert.rejects(persistIfChanged(auth, context, { ...boundary, repository: 'other/app' }, 'pat-fixture', transport), { code: 'AUTH_STATE_CONFLICT' });
  assert.deepEqual(transport.requests, []);
});
test('LLM-11: external rotation wins over writeback; no PUT after conflict', async t => {
  const auth = await authFixture(t); const transport = api({ updated_at: '2026-10-12T12:00:02Z' });
  await assert.rejects(persistIfChanged(auth, context, boundary, 'pat-fixture', transport), { code: 'AUTH_STATE_CONFLICT' });
  assert.equal(transport.requests.some(r => r.method === 'PUT'), false);
});
test('LLM-11: denied/ambiguous writes and malformed public key cannot produce persistence success', async t => {
  const auth = await authFixture(t);
  for (const options of [{ status: 403 }, { writeError: new Error('timeout-token-sentinel') }, { publicKey: 'bad-key' }]) {
    const transport = api(options);
    await assert.rejects(persistIfChanged(auth, context, boundary, 'pat-fixture', transport), { code: 'AUTH_PERSIST_FAILED', message: 'AUTH_PERSIST_FAILED' });
    assert.equal(transport.requests.filter(r => r.method === 'PUT').length, options.publicKey ? 0 : 1);
  }
});
test('LLM-10/11: provider error after refresh does not discard the renewed session', async t => {
  const auth = await authFixture(t, initial); const transport = api();
  await assert.rejects((async () => {
    try { await writeFile(auth.file, refreshed); throw new Error('provider-failed'); }
    finally { await persistIfChanged(auth, context, boundary, 'pat-fixture', transport); }
  })(), /provider-failed/);
  const body = JSON.parse(transport.requests.find(r => r.method === 'PUT').body);
  assert.equal(sodium.crypto_box_seal_open(sodium.from_base64(body.encrypted_value, sodium.base64_variants.ORIGINAL), key.publicKey, key.privateKey, 'text'), refreshed);
});
