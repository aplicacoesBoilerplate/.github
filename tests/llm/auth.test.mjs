import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile, stat, access } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';
import { restoreAuth, cleanupAuth } from '../../scripts/llm/auth.mjs';

const session = JSON.stringify({ auth_mode: 'chatgpt', OPENAI_API_KEY: null, tokens: { access_token: 'access-fixture', id_token: 'id-fixture', refresh_token: 'refresh-fixture', account_id: 'account-fixture' }, last_refresh: '2026-10-01T00:00:00Z' });
const secrets = () => ({ CODEX_AUTH_JSON: session, CODEX_AUTH_WRITE_PAT: 'pat-fixture' });

test('LLM-06/12: parallel consumer sessions use separate private files and remove them on success/error', async () => {
  const a = await restoreAuth('chatgpt-session', secrets());
  const b = await restoreAuth('chatgpt-session', { ...secrets(), CODEX_AUTH_JSON: session.replace('access-fixture', 'second-consumer') });
  try {
    assert.notEqual(a.dir, b.dir);
    assert.equal(await readFile(a.file, 'utf8'), session);
    assert.equal(JSON.parse(await readFile(b.file, 'utf8')).tokens.access_token, 'second-consumer');
    if (process.platform !== 'win32') {
      assert.equal((await stat(a.dir)).mode & 0o777, 0o700);
      assert.equal((await stat(a.file)).mode & 0o777, 0o600);
    }
    const child = spawnSync(process.execPath, ['-e', 'process.stdout.write(JSON.stringify(process.env))'], { env: a.env, encoding: 'utf8' });
    assert.equal(child.status, 0);
    const env = JSON.parse(child.stdout);
    assert.equal(env.CODEX_HOME, a.dir);
    assert.equal(env.HOME, a.dir);
    assert.equal(JSON.stringify(env).includes('pat-fixture'), false);
    assert.equal(env.OPENAI_API_KEY, undefined);
    assert.equal(env.GITHUB_TOKEN, undefined);
  } finally { await cleanupAuth(a); await cleanupAuth(b); }
  await assert.rejects(access(a.dir), { code: 'ENOENT' });
  await assert.rejects(access(b.dir), { code: 'ENOENT' });
  const failed = await restoreAuth('chatgpt-session', secrets());
  await assert.rejects((async () => { try { throw new Error('provider-failed'); } finally { await cleanupAuth(failed); } })(), /provider-failed/);
  await assert.rejects(access(failed.dir), { code: 'ENOENT' });
});

test('LLM-06/07: API opt-in uses only its key and does not restore a refresh session', async () => {
  const auth = await restoreAuth('api-key', { OPENAI_API_KEY: 'api-fixture' }, { runtimeEnv: { PATH: process.env.PATH, GITHUB_TOKEN: 'github-fixture', GH_TOKEN: 'gh-fixture', ACTIONS_RUNTIME_TOKEN: 'runtime-fixture', OPENAI_BASE_URL: 'https://untrusted', NODE_OPTIONS: '--import untrusted' } });
  try {
    assert.equal(auth.env.CODEX_API_KEY, 'api-fixture');
    for (const forbidden of ['GITHUB_TOKEN', 'GH_TOKEN', 'ACTIONS_RUNTIME_TOKEN', 'OPENAI_BASE_URL', 'NODE_OPTIONS']) assert.equal(auth.env[forbidden], undefined);
    assert.equal(auth.file, null);
    await assert.rejects(access(auth.dir + '/auth.json'), { code: 'ENOENT' });
  } finally { await cleanupAuth(auth); }
});

test('LLM-07: wrong/mixed/missing/malformed credentials fail without fallback or secret disclosure', async () => {
  const invalid = [
    ['automatic', secrets()], ['api-key', {}], ['api-key', { OPENAI_API_KEY: 'api', ...secrets() }],
    ['chatgpt-session', { ...secrets(), OPENAI_API_KEY: 'api' }], ['chatgpt-session', { CODEX_AUTH_JSON: session }],
    ['chatgpt-session', { ...secrets(), CODEX_AUTH_JSON: 'secret-sentinel-not-json' }],
    ['chatgpt-session', { ...secrets(), CODEX_AUTH_JSON: session.replace('chatgpt', 'chatgptAuthTokens') }],
    ['chatgpt-session', { ...secrets(), CODEX_AUTH_JSON: session.replace('refresh-fixture', '') }],
    ['chatgpt-session', { ...secrets(), CODEX_AUTH_JSON: session.replace('"OPENAI_API_KEY":null', '"OPENAI_API_KEY":"mixed"') }],
  ];
  for (const [mode, values] of invalid) await assert.rejects(restoreAuth(mode, values), { code: 'AUTH_CONFIG_ERROR', message: 'AUTH_CONFIG_ERROR' });
});
