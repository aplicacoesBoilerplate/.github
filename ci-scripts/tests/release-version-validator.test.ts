import { Version } from 'release-please/build/src/version.js';
import { PullRequestBody } from 'release-please/build/src/util/pull-request-body.js';
import { test } from 'node:test';
import * as assert from 'node:assert/strict';
import { CReleaseVersionValidator } from '../scripts/CReleaseVersionValidator.js';

function validator(pMilestone: string | undefined, pCommits: string[], pTagExists = false, pOptions: { status?: number; actor?: string; branch?: string; labels?: string[]; merged?: boolean; totalCommits?: number; tagSha?: string } = {}) {
  const REQUEST: typeof fetch = async (pInput) => {
    const URL_VALUE = new URL(String(pInput));
    const ENDPOINT = URL_VALUE.pathname;
    if (pOptions.status) return new Response('', { status: pOptions.status });
    if (ENDPOINT === '/repos/org/repo/pulls/1') return Response.json({
      commits: pOptions.totalCommits ?? pCommits.length, body: pOptions.actor === 'github-actions[bot]'
        ? new PullRequestBody([{ version: Version.parse('0.0.2'), notes: '## 0.0.2\nFix' }]).toString() : '', milestone: pMilestone ? { title: pMilestone } : null,
      user: { login: pOptions.actor || 'maintainer' },
      head: { ref: pOptions.branch || 'feature/docs', repo: { full_name: 'org/repo' } },
      labels: (pOptions.labels || []).map(name => ({ name })),
      merged: pOptions.merged || false, merge_commit_sha: pOptions.merged ? 'abc' : null,
    });
    if (ENDPOINT.endsWith('/pulls/1/commits')) return Response.json(pCommits.map(message => ({ commit: { message } })));
    if (ENDPOINT.endsWith('/commits/abc')) return Response.json({ commit: { message: 'fix: integração' } });
    if (ENDPOINT.includes('/git/ref/tags/')) return new Response(pTagExists ? JSON.stringify({ object: { type: 'commit', sha: pOptions.tagSha || 'abc' } }) : '', { status: pTagExists ? 200 : 404 });
    if (ENDPOINT.includes('/releases/tags/')) return new Response('', { status: 404 });
    throw new Error(`Consulta inesperada: ${ENDPOINT}`);
  };
  return new CReleaseVersionValidator(REQUEST);
}
for (const SOURCE of ['milestone', 'footer']) {
  test(`Consulta GitHub bloqueia ${SOURCE} para tag existente, antes e depois do merge`, async () => {
    for (const MERGED of [false, true]) {
      const POLICY = validator(SOURCE === 'milestone' ? 'v0.0.2' : undefined,
        SOURCE === 'footer' ? ['fix: entrega\n\nRelease-As: 0.0.2'] : [], true, { merged: MERGED });
      await assert.rejects(POLICY.validate('org/repo', 1, 'token-de-teste'), /tag v0\.0\.2 já existe/);
    }
  });
}
test('Consulta GitHub libera footer de versão inédita sem milestone', async () => {
  assert.deepEqual(await validator(undefined, ['fix: entrega\n\nRelease-As: 0.0.2']).validate('org/repo', 1, 'token-de-teste'),
    { version: '0.0.2', technical: false });
});
test('Falha de autorização da API não é interpretada como tag inexistente', async () => {
  await assert.rejects(validator('v0.0.2', [], false, { status: 403 }).validate('org/repo', 1, 'token-de-teste'), /403/);
});
test('Reexecução do PR técnico legítimo não é tratada como nova entrega', async () => {
  const POLICY = validator(undefined, [], true, {
    actor: 'github-actions[bot]', branch: 'release-please--branches--master', labels: ['autorelease: tagged'], merged: true,
  });
  assert.deepEqual(await POLICY.validate('org/repo', 1, 'token-de-teste'), { technical: true });
});
test('Branch com nome do robô criada por pessoa não contorna colisão da tag', async () => {
  await assert.rejects(validator('v0.0.2', [], true, {
    branch: 'release-please--branches--master', labels: ['autorelease: pending'],
  }).validate('org/repo', 1, 'token-de-teste'), /tag v0\.0\.2 já existe/);
});

test('PR acima de 250 commits não pode passar com análise incompleta dos footers', async () => {
  await assert.rejects(validator(undefined, ['Release-As: 0.0.2'], false, { totalCommits: 251 })
    .validate('org/repo', 1, 'token-de-teste'), /250 commits/);
});

function monorepo(pFiles: string[], pExistingTags: string[], pMessage: string, pConfig: object) {
  const REQUEST: typeof fetch = async (pInput) => {
    const URL_VALUE = new URL(String(pInput));
    const ENDPOINT = URL_VALUE.pathname;
    if (ENDPOINT === '/repos/org/repo/pulls/1') return Response.json({
      commits: 1, changed_files: pFiles.length, body: '', milestone: null,
      user: { login: 'maintainer' }, head: { ref: 'feature/packages', sha: 'abc', repo: { full_name: 'org/repo' } },
      labels: [], merged: false, merge_commit_sha: null,
    });
    if (ENDPOINT.endsWith('/pulls/1/commits')) return Response.json([{ commit: { message: pMessage } }]);
    if (ENDPOINT.endsWith('/pulls/1/files')) return Response.json(pFiles.map(filename => ({ filename })));
    if (ENDPOINT.endsWith('/contents/release-please-config.json')) return Response.json({ content: Buffer.from(JSON.stringify(pConfig)).toString('base64') });
    if (ENDPOINT.includes('/git/ref/tags/')) {
      const TAG = decodeURIComponent(ENDPOINT.split('/').at(-1)!);
      return new Response(pExistingTags.includes(TAG) ? '{}' : '', { status: pExistingTags.includes(TAG) ? 200 : 404 });
    }
    if (ENDPOINT.includes('/releases/tags/')) return new Response('', { status: 404 });
    throw new Error(`Consulta inesperada: ${ENDPOINT}`);
  };
  return new CReleaseVersionValidator(REQUEST);
}
const MONOREPO_CONFIG = {
  'include-component-in-tag': true,
  packages: { 'packages/a': { 'release-type': 'node', component: 'a' }, 'packages/b': { 'release-type': 'node', component: 'b' } },
};
test('Release-As global não é aplicado a dois pacotes alterados', async () => {
  await assert.rejects(monorepo(['packages/a/index.ts', 'packages/b/index.ts'], [], 'fix: dois pacotes\n\nRelease-As: 0.0.2', MONOREPO_CONFIG)
    .validate('org/repo', 1, 'token', 'https://api.github.com', { configFile: 'release-please-config.json' }), /ambíguo/);
});
test('Mesmo número em outro componente não é uma colisão', async () => {
  const RESULT = await monorepo(['packages/b/index.ts'], ['a-v0.0.2'], 'fix: b\n\nRelease-As: 0.0.2', MONOREPO_CONFIG)
    .validate('org/repo', 1, 'token', 'https://api.github.com', { configFile: 'release-please-config.json' });
  assert.deepEqual(RESULT, { technical: false, overrides: { 'packages/b': '0.0.2' } });
});
test('Tag do próprio componente bloqueia o footer duplicado', async () => {
  await assert.rejects(monorepo(['packages/b/index.ts'], ['b-v0.0.2'], 'fix: b\n\nRelease-As: 0.0.2', MONOREPO_CONFIG)
    .validate('org/repo', 1, 'token', 'https://api.github.com', { configFile: 'release-please-config.json' }), /tag b-v0\.0\.2 já existe/);
});
test('Sem override global o manifest preserva as versões independentes', async () => {
  assert.deepEqual(await monorepo(['packages/a/index.ts', 'packages/b/index.ts'], [], 'fix: ajustes', MONOREPO_CONFIG)
    .validate('org/repo', 1, 'token', 'https://api.github.com', { configFile: 'release-please-config.json' }),
    { technical: false, overrides: {} });
});
test('release-as por pacote é validado contra a tag desse pacote', async () => {
  const CONFIG = { ...MONOREPO_CONFIG, packages: {
    ...MONOREPO_CONFIG.packages, 'packages/a': { ...MONOREPO_CONFIG.packages['packages/a'], 'release-as': '0.0.2' },
  } };
  await assert.rejects(monorepo(['packages/a/index.ts'], ['a-v0.0.2'], 'fix: a', CONFIG)
    .validate('org/repo', 1, 'token', 'https://api.github.com', { configFile: 'release-please-config.json' }), /tag a-v0\.0\.2 já existe/);
});

test('PR técnico legítimo bloqueia uma tag manual criada em outro SHA', async () => {
  await assert.rejects(validator(undefined, [], true, {
    actor: 'github-actions[bot]', branch: 'release-please--branches--master', labels: ['autorelease: pending'], merged: true, tagSha: 'outro',
  }).validate('org/repo', 1, 'token'), /outro commit/);
});

test('Contrato compatível rejeita política inválida e milestone escalar em manifest independente', async () => {
  const POLICY = monorepo([], [], 'fix: ajustes', MONOREPO_CONFIG);
  await assert.rejects(POLICY.validate('org/repo', 1, 'token', 'https://api.github.com',
    { configFile: 'release-please-config.json', versionPolicy: 'typo' }), /Política/);
  await assert.rejects(POLICY.validate('org/repo', 1, 'token', 'https://api.github.com',
    { configFile: 'release-please-config.json', versionPolicy: 'milestone' }), /único componente/);
  assert.deepEqual(await POLICY.validate('org/repo', 1, 'token', 'https://api.github.com',
    { configFile: 'release-please-config.json', versionPolicy: 'native' }), { technical: false, overrides: {} });
});

test('PR técnico individual resolve componente pela branch e verifica a tag scoped exata', async () => {
  const COMPONENT = '@org/pkg';
  const CONFIG = { 'include-component-in-tag': true, 'include-v-in-tag': false, 'tag-separator': '@',
    packages: { 'packages/pkg': { component: COMPONENT }, 'packages/other': { component: '@org/other' } } };
  const BODY = new PullRequestBody([{ component: COMPONENT, version: Version.parse('0.0.2'), notes: '## 0.0.2\nFix' }]).toString();
  assert.equal(PullRequestBody.parse(BODY)?.releaseData[0].component, undefined);
  const TAGS: string[] = [];
  let TAG_EXISTS = false;
  const REQUEST: typeof fetch = async input => {
    const ENDPOINT = new URL(String(input)).pathname;
    if (ENDPOINT.endsWith('/pulls/1')) return Response.json({
      commits: 1, body: BODY, milestone: null, user: { login: 'github-actions[bot]' },
      head: { ref: 'release-please--branches--master--components--' + COMPONENT, sha: 'abc', repo: { full_name: 'org/repo' } },
      labels: [{ name: 'autorelease: pending' }], merged: false, merge_commit_sha: null,
    });
    if (ENDPOINT.includes('/contents/')) return Response.json({ content: Buffer.from(JSON.stringify(CONFIG)).toString('base64') });
    if (ENDPOINT.includes('/git/ref/tags/')) {
      TAGS.push(decodeURIComponent(ENDPOINT.split('/tags/')[1]));
      return new Response(TAG_EXISTS ? JSON.stringify({ object: { type: 'commit', sha: 'old' } }) : '', { status: TAG_EXISTS ? 200 : 404 });
    }
    if (ENDPOINT.includes('/releases/tags/')) return new Response('', { status: 404 });
    throw new Error(ENDPOINT);
  };
  const POLICY = new CReleaseVersionValidator(REQUEST);
  await assert.rejects(POLICY.validate('org/repo', 1, 'token', 'https://api.github.com',
    { configFile: 'release-please-config.json', versionPolicy: 'milestone' }), /único componente/);
  assert.deepEqual(await POLICY.validate('org/repo', 1, 'token', 'https://api.github.com',
    { configFile: 'release-please-config.json' }), { technical: true });
  assert.deepEqual(TAGS, ['@org/pkg@0.0.2']);
  TAG_EXISTS = true;
  await assert.rejects(POLICY.validate('org/repo', 1, 'token', 'https://api.github.com',
    { configFile: 'release-please-config.json' }), /já existe/);
});
