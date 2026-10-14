import test from 'node:test';
import assert from 'node:assert/strict';
import { verifyContext, githubGet } from '../../scripts/llm/preflight.mjs';

const sha = 'a'.repeat(40);
const latest = 'b'.repeat(40);
const event = () => ({ repository: 'owner/app', event_name: 'workflow_dispatch', ref: 'refs/heads/master', sha, workflow_sha: sha, workflow_ref: 'owner/app/.github/workflows/llm.yml@refs/heads/master', server_url: 'https://github.com' });
const inputs = () => ({ auth_mode: 'chatgpt-session', source_ref: 'master' });
const repository = () => ({ full_name: 'owner/app', default_branch: 'master', private: true, fork: false });
const api = (repo = repository(), branch = { name: 'master', commit: { sha: latest } }) => ({ getRepository: async () => repo, getBranch: async () => branch });
const deny = promise => assert.rejects(promise, { code: 'UNTRUSTED_CONTEXT', message: 'UNTRUSTED_CONTEXT' });

test('LLM-02/13: resolves current default branch SHA; text context cannot replace it', async () => {
  const calls = [];
  const result = await verifyContext(event(), { ...inputs(), context_json: '{"source_ref":"attacker"}' }, {
    getRepository: async repo => { calls.push(repo); return repository(); },
    getBranch: async (repo, branch) => { calls.push([repo, branch]); return { name: 'master', commit: { sha: latest } }; },
  });
  assert.deepEqual(result, { repository: 'owner/app', default_branch: 'master', source_sha: latest, private: true });
  assert.deepEqual(calls, ['owner/app', ['owner/app', 'master']]);
});
for (const name of ['pull_request', 'pull_request_target', 'push', 'issue_comment']) {
  test(`LLM-13: denies event ${name} before any metadata request`, async () => {
    let called = false;
    await deny(verifyContext({ ...event(), event_name: name }, inputs(), { getRepository: async () => { called = true; return repository(); } }));
    assert.equal(called, false);
  });
}
test('LLM-13: denies fork and cross-repository metadata', async () => {
  await deny(verifyContext(event(), inputs(), api({ ...repository(), fork: true })));
  await deny(verifyContext(event(), inputs(), api({ ...repository(), full_name: 'other/app' })));
});
test('LLM-13: session requires private repo, API mode permits public trusted repo', async () => {
  await deny(verifyContext(event(), inputs(), api({ ...repository(), private: false })));
  assert.equal((await verifyContext(event(), { ...inputs(), auth_mode: 'api-key' }, api({ ...repository(), private: false }))).private, false);
});
test('LLM-13: denies arbitrary caller branch and source branch', async () => {
  await deny(verifyContext({ ...event(), ref: 'refs/heads/feature/test' }, inputs(), api()));
  await deny(verifyContext(event(), { ...inputs(), source_ref: 'develop' }, api()));
});
test('LLM-13: caller workflow must come from this repository default branch', async () => {
  for (const workflow_ref of ['other/app/.github/workflows/llm.yml@refs/heads/master', 'owner/app/.github/workflows/llm.yml@refs/heads/feature/test', '', 'owner/app/.github/workflows/../other.yml@refs/heads/master']) {
    await deny(verifyContext({ ...event(), workflow_ref }, inputs(), api()));
  }
  await deny(verifyContext({ ...event(), workflow_sha: latest }, inputs(), api()));
});
test('LLM-02/13: malformed or wrong branch metadata cannot become checkout authority', async () => {
  for (const branch of [{ name: 'master', commit: { sha: '--help' } }, { name: 'other', commit: { sha } }, {}, { name: 'master', commit: { sha: '' } }]) await deny(verifyContext(event(), inputs(), api(repository(), branch)));
});
test('LLM-13: unavailable API and missing trust fields fail closed without exposing errors', async () => {
  await deny(verifyContext(event(), inputs(), { getRepository: async () => { throw new Error('sentinel-token'); } }));
  await deny(verifyContext(event(), inputs(), api({ full_name: 'owner/app', default_branch: 'master' })));
  await deny(verifyContext({ ...event(), server_url: 'https://enterprise.example' }, inputs(), api()));
});
test('T2: REST GET is limited to GitHub, bounded and supplies bearer auth without forwarding redirects', async () => {
  let observed;
  const result = await githubGet('/repos/owner/app', 'test-token', { fetchImpl: async (url, options) => { observed = { url, options }; return { ok: true, json: async () => repository() }; } });
  assert.deepEqual(result, repository());
  assert.equal(observed.url, 'https://api.github.com/repos/owner/app');
  assert.equal(observed.options.headers.Authorization, 'Bearer test-token');
  assert.equal(observed.options.redirect, 'error');
  assert.equal(observed.options.signal instanceof AbortSignal, true);
});
for (const status of [401, 403, 429]) {
  test(`T2: HTTP ${status} fails without retry or response body disclosure`, async () => {
    let calls = 0;
    await deny(githubGet('/repos/owner/app', 'token', { fetchImpl: async () => { calls++; return { ok: false, status }; } }));
    assert.equal(calls, 1);
  });
}
test('T2: transient GET receives at most two attempts', async () => {
  let calls = 0;
  await deny(githubGet('/repos/owner/app', 'token', { fetchImpl: async () => { calls++; throw new Error('network'); }, delay: async () => {} }));
  assert.equal(calls, 2);
});
