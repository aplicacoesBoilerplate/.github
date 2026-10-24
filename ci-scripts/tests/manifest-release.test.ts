import { test } from 'node:test';
import * as assert from 'node:assert/strict';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';
import { GitHub } from 'release-please';
import { buildStrategy } from 'release-please/build/src/factory.js';
import { parseConventionalCommits } from 'release-please/build/src/commit.js';
import { CManifestRelease } from '../scripts/CManifestRelease.js';
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');

async function github(pFiles: Record<string, object>) {
  const CLIENT = await GitHub.create({ owner: 'org', repo: 'repo', defaultBranch: 'master',
    fetch: async () => { throw new Error('Rede proibida no teste do motor'); } });
  CLIENT.getFileContentsOnBranch = async (pPath: string) => {
    if (!pFiles[pPath]) throw new Error(`Arquivo não simulado: ${pPath}`);
    const CONTENT = JSON.stringify(pFiles[pPath]);
    return { content: Buffer.from(CONTENT).toString('base64'), parsedContent: CONTENT, sha: 'a'.repeat(40), mode: '100644' };
  };
  return CLIENT;
}

test('SDK Node versiona docs/package.json e lock sem modificar o package da raiz', async () => {
  const PACKAGE = JSON.parse(fs.readFileSync(path.join(ROOT, 'docs/package.json'), 'utf8'));
  const LOCK = JSON.parse(fs.readFileSync(path.join(ROOT, 'docs/package-lock.json'), 'utf8'));
  const GITHUB = await github({ 'docs/package.json': PACKAGE });
  const STRATEGY = await buildStrategy({ github: GITHUB, targetBranch: 'master', path: 'docs', releaseType: 'node',
    includeComponentInTag: false, releaseAs: '0.0.2' });
  const PR = await STRATEGY.buildReleasePullRequest(parseConventionalCommits([{
    sha: 'b'.repeat(40), message: 'fix(docs): publica a versão do catálogo', files: ['docs/index.md'],
  }]));
  assert.ok(PR);
  assert.equal(PR.version?.toString(), '0.0.2');
  assert.ok(PR.updates.some(UPDATE => UPDATE.path === 'docs/package.json'));
  assert.equal(PR.updates.some(UPDATE => UPDATE.path === 'package.json'), false);
  const PACKAGE_UPDATE = PR.updates.find(UPDATE => UPDATE.path === 'docs/package.json')!;
  assert.deepEqual(JSON.parse(PACKAGE_UPDATE.updater.updateContent(JSON.stringify(PACKAGE))), { ...PACKAGE, version: '0.0.2' });
  const LOCK_UPDATE = PR.updates.find(UPDATE => UPDATE.path === 'docs/package-lock.json')!;
  const UPDATED_LOCK = JSON.parse(LOCK_UPDATE.updater.updateContent(JSON.stringify(LOCK)));
  assert.equal(UPDATED_LOCK.version, '0.0.2');
  assert.equal(UPDATED_LOCK.packages[''].version, '0.0.2');
});

test('Manifest oficial aplica override só ao pacote selecionado, diferente do bump natural', async () => {
  const GITHUB = await github({
    'release-please-config.json': { 'include-component-in-tag': true, packages: {
      'packages/a': { 'release-type': 'node', component: 'a' },
      'packages/b': { 'release-type': 'node', component: 'b' },
    } },
    '.release-please-manifest.json': { 'packages/a': '0.0.1', 'packages/b': '1.1.1' },
    'packages/a/package.json': { name: '@org/a', version: '0.0.1' },
    'packages/b/package.json': { name: '@org/b', version: '1.1.1' },
  });
  const MANIFEST = await CManifestRelease.load(GITHUB, 'master', 'release-please-config.json',
    '.release-please-manifest.json', { 'packages/a': '0.9.0' });
  assert.equal(MANIFEST.repositoryConfig['packages/a'].releaseAs, '0.9.0');
  assert.equal(MANIFEST.repositoryConfig['packages/b'].releaseAs, undefined);
  assert.equal(MANIFEST.releasedVersions['packages/b'].toString(), '1.1.1');
  const STRATEGY = await buildStrategy({ ...MANIFEST.repositoryConfig['packages/a'], github: GITHUB,
    targetBranch: 'master', path: 'packages/a' });
  const PR = await STRATEGY.buildReleasePullRequest(parseConventionalCommits([{
    sha: 'c'.repeat(40), message: 'fix: versão explícita', files: ['packages/a/index.ts'],
  }]));
  assert.equal(PR?.version?.toString(), '0.9.0', 'Não pode virar 0.0.2 ao perder o Release-As');
  const RELEASES = await STRATEGY.buildReleases({ number: 7, headBranchName: PR!.headRefName, baseBranchName: 'master',
    title: PR!.title.toString(), body: PR!.body.toString(), labels: PR!.labels,
    files: PR!.updates.map(UPDATE => UPDATE.path), sha: 'd'.repeat(40) });
  assert.equal(RELEASES[0].tag.toString(), 'a-v0.9.0');
});

test('Self-caller versiona package da documentação pelo manifest raiz sem recriar TXT', async () => {
  const CONFIG = JSON.parse(fs.readFileSync(path.join(ROOT, 'release-please-config.json'), 'utf8'));
  const STATE = JSON.parse(fs.readFileSync(path.join(ROOT, '.release-please-manifest.json'), 'utf8'));
  const PACKAGE = JSON.parse(fs.readFileSync(path.join(ROOT, 'docs/package.json'), 'utf8'));
  const LOCK = JSON.parse(fs.readFileSync(path.join(ROOT, 'docs/package-lock.json'), 'utf8'));
  const GITHUB = await github({ 'release-please-config.json': CONFIG, '.release-please-manifest.json': STATE });
  const MANIFEST = await CManifestRelease.load(GITHUB, 'master', 'release-please-config.json',
    '.release-please-manifest.json', { '.': '0.0.2' });
  const STRATEGY = await buildStrategy({ ...MANIFEST.repositoryConfig['.'], github: GITHUB, targetBranch: 'master', path: '.' });
  const PR = await STRATEGY.buildReleasePullRequest(parseConventionalCommits([{
    sha: 'e'.repeat(40), message: 'fix: evolui outra pipeline do catálogo', files: ['.github/workflows/outra.yml'],
  }]));
  assert.ok(PR);
  const CONTENT = new Map<string, string>([
    ['docs/package.json', JSON.stringify(PACKAGE)], ['docs/package-lock.json', JSON.stringify(LOCK)],
    ['CHANGELOG.md', '# Changelog\n'],
  ]);
  for (const UPDATE of PR.updates) {
    const BEFORE = CONTENT.get(UPDATE.path);
    if (BEFORE === undefined && !UPDATE.createIfMissing) continue;
    CONTENT.set(UPDATE.path, UPDATE.updater.updateContent(BEFORE));
  }
  assert.equal(CONTENT.has('version.txt'), false);
  assert.equal(CONTENT.has('package.json'), false);
  assert.equal(JSON.parse(CONTENT.get('docs/package.json')!).version, '0.0.2');
  assert.equal(JSON.parse(CONTENT.get('docs/package-lock.json')!).version, '0.0.2');
  assert.equal(JSON.parse(CONTENT.get('docs/package-lock.json')!).packages[''].version, '0.0.2');
  assert.match(CONTENT.get('CHANGELOG.md')!, /evolui outra pipeline do catálogo/);
});

import { TagName } from 'release-please/build/src/util/tag-name.js';
import { Version } from 'release-please/build/src/version.js';
import { Manifest } from 'release-please';

test('Guard verifica a versão calculada automaticamente antes de abrir PR', async () => {
  const GITHUB = await github({});
  const ENGINE = new Manifest(GITHUB, 'master', { '.': { releaseType: 'simple', includeComponentInTag: false } }, {});
  const STRATEGY = await buildStrategy({ github: GITHUB, releaseType: 'simple', includeComponentInTag: false, releaseAs: '0.0.2' });
  const CANDIDATE = await STRATEGY.buildReleasePullRequest(parseConventionalCommits([{
    sha: 'e'.repeat(40), message: 'fix: cálculo nativo', files: ['README.md'],
  }]));
  ENGINE.buildPullRequests = async () => [CANDIDATE!];
  const TAG_EXISTS: typeof fetch = async () => Response.json({ object: { type: 'commit', sha: 'old' } });
  await assert.rejects(CManifestRelease.guardCandidates(ENGINE, 'org/repo', 'token', false,
    'https://api.github.com', TAG_EXISTS), /tag v0\.0\.2 já existe/);
});

test('Proteção final impede escrita real de release quando a tag aponta para outro SHA', async () => {
  let REMOTE_WRITE = false;
  const GITHUB = await GitHub.create({ owner: 'org', repo: 'repo', defaultBranch: 'master', fetch: async () => {
    REMOTE_WRITE = true; throw new Error('Escrita remota inesperada');
  } });
  const TAG_EXISTS: typeof fetch = async () => Response.json({ object: { type: 'commit', sha: 'old' } });
  CManifestRelease.protectPublication(GITHUB, 'org/repo', 'token', 'https://api.github.com', TAG_EXISTS);
  await assert.rejects(GITHUB.createRelease({ tag: new TagName(Version.parse('0.0.2')!), sha: 'new', notes: 'release' }), /outro commit/);
  assert.equal(REMOTE_WRITE, false);
});

test('Exemplo PackagesVue preserva cinco versões independentes e tags distintas no SDK', async () => {
  const CONFIG = JSON.parse(fs.readFileSync(path.join(ROOT, 'examples/versioning/packages-vue/release-please-config.json'), 'utf8'));
  const STATE = JSON.parse(fs.readFileSync(path.join(ROOT, 'examples/versioning/packages-vue/.release-please-manifest.json'), 'utf8'));
  const FILES: Record<string, object> = { 'release-please-config.json': CONFIG, '.release-please-manifest.json': STATE };
  for (const [DIRECTORY, PACKAGE] of Object.entries(CONFIG.packages) as [string, { component: string }][]) {
    FILES[`${DIRECTORY}/package.json`] = { name: `@aplicacoesboilerplate/${PACKAGE.component}`, version: STATE[DIRECTORY] };
  }
  const GITHUB = await github(FILES);
  const OVERRIDES = Object.fromEntries(Object.keys(STATE).map(DIRECTORY => [DIRECTORY,
    DIRECTORY.endsWith('vuetify') ? '1.1.2' : '0.0.2']));
  const ENGINE = await CManifestRelease.load(GITHUB, 'master', 'release-please-config.json', '.release-please-manifest.json', OVERRIDES);
  assert.equal(Object.keys(ENGINE.repositoryConfig).length, 5);
  assert.equal(ENGINE.releasedVersions['packages/ui/vuetify'].toString(), '1.1.1');
  const TAGS: string[] = [];
  for (const [DIRECTORY, CONFIGURATION] of Object.entries(ENGINE.repositoryConfig)) {
    const STRATEGY = await buildStrategy({ ...CONFIGURATION, github: GITHUB, path: DIRECTORY, targetBranch: 'master' });
    const PR = await STRATEGY.buildReleasePullRequest(parseConventionalCommits([{
      sha: 'f'.repeat(40), message: 'fix: pacote independente', files: [`${DIRECTORY}/index.ts`],
    }]));
    assert.equal(PR?.version?.toString(), OVERRIDES[DIRECTORY]);
    const RELEASES = await STRATEGY.buildReleases({ number: 9, headBranchName: PR!.headRefName, baseBranchName: 'master',
      title: PR!.title.toString(), body: PR!.body.toString(), labels: PR!.labels,
      files: PR!.updates.map(UPDATE => UPDATE.path), sha: 'f'.repeat(40) });
    TAGS.push(RELEASES[0].tag.toString());
  }
  assert.deepEqual(TAGS.sort(), ['composables-v0.0.2', 'ui-core-v0.0.2', 'ui-prime-vue-v0.0.2', 'ui-vuetify-v1.1.2', 'utils-v0.0.2']);
});

import { NodeWorkspace } from 'release-please/build/src/plugins/node-workspace.js';

test('Workspace sincroniza o lockfile da raiz sem incrementar pacotes não liberados', async () => {
  const CONFIG = JSON.parse(fs.readFileSync(path.join(ROOT, 'examples/versioning/packages-vue/release-please-config.json'), 'utf8'));
  assert.deepEqual(CONFIG.plugins, ['node-workspace']);
  const STATE = JSON.parse(fs.readFileSync(path.join(ROOT, 'examples/versioning/packages-vue/.release-please-manifest.json'), 'utf8'));
  const FILES: Record<string, object> = { 'release-please-config.json': CONFIG, '.release-please-manifest.json': STATE };
  const PACKAGES: Record<string, object> = { '': { name: 'workspace-root', version: '0.0.1' } };
  for (const [DIRECTORY, PACKAGE] of Object.entries(CONFIG.packages) as [string, { component: string }][]) {
    const CONTENT = { name: `@aplicacoesboilerplate/${PACKAGE.component}`, version: STATE[DIRECTORY] };
    FILES[`${DIRECTORY}/package.json`] = CONTENT;
    PACKAGES[DIRECTORY] = CONTENT;
  }
  const GITHUB = await github(FILES);
  const ENGINE = await CManifestRelease.load(GITHUB, 'master', 'release-please-config.json',
    '.release-please-manifest.json', { 'packages/ui/core': '0.0.2' });
  const STRATEGY = await buildStrategy({ ...ENGINE.repositoryConfig['packages/ui/core'], github: GITHUB,
    targetBranch: 'master', path: 'packages/ui/core' });
  const PR = await STRATEGY.buildReleasePullRequest(parseConventionalCommits([{
    sha: '1'.repeat(40), message: 'fix: só core', files: ['packages/ui/core/index.ts'],
  }]));
  const CANDIDATES = await new NodeWorkspace(GITHUB, 'master', ENGINE.repositoryConfig).run([{
    path: 'packages/ui/core', config: ENGINE.repositoryConfig['packages/ui/core'], pullRequest: PR!,
  }]);
  const LOCK_UPDATE = CANDIDATES.flatMap(CANDIDATE => CANDIDATE.pullRequest.updates).find(UPDATE => UPDATE.path === 'package-lock.json');
  assert.ok(LOCK_UPDATE, 'O plugin precisa gerar atualização do lockfile da raiz');
  const LOCK = JSON.parse(LOCK_UPDATE.updater.updateContent(JSON.stringify({
    name: 'workspace-root', version: '0.0.1', lockfileVersion: 3, packages: PACKAGES,
  })));
  assert.equal(LOCK.packages['packages/ui/core'].version, '0.0.2');
  assert.equal(LOCK.packages['packages/ui/vuetify'].version, '1.1.1');
  assert.equal(LOCK.packages['packages/utils'].version, '0.0.1');
  assert.equal(LOCK.version, '0.0.1');
});
