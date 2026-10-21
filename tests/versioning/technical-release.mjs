import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { prepareTechnicalPr } from '../../scripts/versioning/dist/services/technical-release.js';
import { captureVersionFiles } from '../../scripts/versioning/dist/services/version-files.js';
import { planFromReport, validateDescriptor } from '../../scripts/versioning/dist/adapter-contract.js';

const cwd = mkdtempSync(join(tmpdir(), 'technical-release-'));
const git = (...args) => execFileSync('git', args, { cwd, encoding: 'utf8' }).trim();
const json = (path, value) => writeFileSync(join(cwd, path), `${JSON.stringify(value)}\n`);
const descriptor = validateDescriptor({ id: 'release-please', runtime: 'node', reportKind: 'single',
  needsVersionPr: true, tagKind: 'lightweight', collect() {}, prepare() {} });
const objectSha = number => number.toString(16).padStart(40, '0');
const writerSource = readFileSync(join(import.meta.dirname,
  '../../scripts/versioning/src/services/technical-release.ts'), 'utf8');
assert.doesNotMatch(writerSource, /from ['"][^'"]*adapters\//);
assert.doesNotMatch(writerSource, /child_process|runProcess|npm ci|mvn /);
const api = { refs: new Map(), commits: new Map(), pulls: [], calls: [], next: 100, advanceOnCheck: false };
const body = value => ({ status: 200, headers: {}, body: value });
const transport = async request => {
  api.calls.push(request);
  const url = new URL(request.url);
  const path = url.pathname.replace(/^\/repos\/acme\/app\//, '');
  if (request.method === 'GET' && path.startsWith('git/ref/heads/')) {
    const ref = decodeURIComponent(path.slice('git/ref/heads/'.length));
    if (api.advanceOnCheck && ref === 'master' && api.calls.filter(call =>
      call.method === 'GET' && call.url.includes('/git/ref/heads/master')).length === 2) {
      api.refs.set('master', objectSha(999));
    }
    return api.refs.has(ref) ? body({ ref: `refs/heads/${ref}`, object: { sha: api.refs.get(ref) } }) :
      { status: 404, headers: {}, body: {} };
  }
  if (request.method === 'GET' && path.startsWith('git/commits/')) {
    const sha = path.slice('git/commits/'.length);
    return api.commits.has(sha) ? body(api.commits.get(sha)) : { status: 404, headers: {}, body: {} };
  }
  if (request.method === 'GET' && path === 'pulls') return body(api.pulls);
  if (request.method === 'POST' && path === 'git/blobs') return body({ sha: objectSha(api.next++) });
  if (request.method === 'POST' && path === 'git/trees') {
    const sha = objectSha(api.next++);
    return body({ sha, tree: request.body.tree });
  }
  if (request.method === 'POST' && path === 'git/commits') {
    const sha = objectSha(api.next++);
    api.commits.set(sha, { sha, ...request.body, tree: { sha: request.body.tree },
      parents: request.body.parents.map(parent => ({ sha: parent })) });
    return body({ sha });
  }
  if (request.method === 'POST' && path === 'git/refs') {
    const ref = request.body.ref.replace('refs/heads/', '');
    if (api.refs.has(ref)) return { status: 422, headers: {}, body: {} };
    api.refs.set(ref, request.body.sha);
    return body({ ref: request.body.ref, object: { sha: request.body.sha } });
  }
  if (request.method === 'PATCH' && path.startsWith('git/refs/heads/')) {
    const ref = decodeURIComponent(path.slice('git/refs/heads/'.length));
    assert.equal(request.body.force, false);
    assert.equal(api.commits.get(request.body.sha).parents[0].sha, api.refs.get(ref));
    api.refs.set(ref, request.body.sha);
    return body({ ref, object: { sha: request.body.sha } });
  }
  if (request.method === 'POST' && path === 'pulls') {
    const number = api.pulls.length + 1;
    const pull = { number, html_url: `https://github.com/acme/app/pull/${number}`,
      title: request.body.title, body: request.body.body, state: 'open',
      head: { ref: request.body.head, sha: api.refs.get(request.body.head) },
      base: { ref: request.body.base }, user: { login: 'version-bot[bot]' } };
    api.pulls.push(pull);
    return body(pull);
  }
  if (request.method === 'PATCH' && path.startsWith('pulls/')) {
    const pull = api.pulls.find(item => item.number === Number(path.slice('pulls/'.length)));
    Object.assign(pull, request.body, { head: { ...pull.head, sha: api.refs.get(pull.head.ref) } });
    return body(pull);
  }
  throw Error(`Unexpected API call: ${request.method} ${path}`);
};

function planFor(sha) {
  const report = { schemaVersion: 1, adapter: 'release-please', sha, branch: 'master',
    status: 'release', baseVersion: '1.0.0', candidateVersion: '1.0.1', bump: 'patch',
    tag: 'v1.0.1', native: { explanation: 'Fix output' } };
  const plan = planFromReport(report, descriptor, '.');
  const content = {
    'package.json': '{"name":"app","version":"1.0.1"}\n',
    'package-lock.json': '{"name":"app","version":"1.0.1","packages":{"":{"version":"1.0.1"}}}\n',
    '.release-please-manifest.json': '{".":"1.0.1"}\n',
    'CHANGELOG.md': '## 1.0.1\n',
  };
  const operations = Object.entries(content).map(([path, value]) => ({ op: 'write', path,
    content: Buffer.from(value).toString('base64') }));
  return { plan, bundle: captureVersionFiles({ repository: cwd, plan, operations }) };
}

try {
  git('init', '-q', '-b', 'master'); git('config', 'user.name', 'Fixture');
  git('config', 'user.email', 'fixture@example.test');
  json('package.json', { name: 'app', version: '1.0.0' });
  json('package-lock.json', { name: 'app', version: '1.0.0', packages: { '': { version: '1.0.0' } } });
  json('.release-please-manifest.json', { '.': '1.0.0' });
  json('release-please-config.json', { packages: { '.': { 'release-type': 'node' } } });
  git('add', '.'); git('commit', '-qm', 'chore: baseline');
  const sha = git('rev-parse', 'HEAD');
  api.refs.set('master', sha);
  api.commits.set(sha, { sha, tree: { sha: objectSha(1) }, parents: [] });
  const { plan, bundle } = planFor(sha);
  const input = { repository: cwd, owner: 'acme', repo: 'app', originPrNumber: 12,
    botLogin: 'version-bot[bot]', plan, bundle, transport };
  const created = await prepareTechnicalPr(input);
  assert.equal(created.outcome, 'created');
  assert.equal(api.pulls.length, 1);
  assert.equal(api.commits.get(created.headSha).parents[0].sha, sha);
  assert.equal(api.calls.some(call => call.method === 'POST' && call.url.endsWith('/git/trees') &&
    call.body.base_tree === objectSha(1)), true);
  const writes = api.calls.length;
  const retry = await prepareTechnicalPr(input);
  assert.equal(retry.outcome, 'existing');
  assert.equal(api.calls.slice(writes).some(call => call.method !== 'GET'), false);
  writeFileSync(join(cwd, 'feature.txt'), 'new feature\n');
  git('add', '.'); git('commit', '-qm', 'feat: next');
  const nextSha = git('rev-parse', 'HEAD');
  api.refs.set('master', nextSha);
  api.commits.set(nextSha, { sha: nextSha, tree: { sha: objectSha(2) }, parents: [{ sha }] });
  const updatedInput = { ...input, ...planFor(nextSha) };
  const updated = await prepareTechnicalPr(updatedInput);
  assert.equal(updated.outcome, 'updated');
  assert.equal(api.pulls.length, 1);
  assert.deepEqual(api.commits.get(updated.headSha).parents.map(parent => parent.sha),
    [created.headSha, nextSha]);
  const trees = api.calls.filter(call => call.method === 'POST' && call.url.endsWith('/git/trees'));
  assert.equal(trees.at(-1).body.base_tree, objectSha(2),
    'updated technical tree must start from new functional origin');
  api.refs.set(created.branch, objectSha(777));
  await assert.rejects(prepareTechnicalPr(updatedInput), /head|manual|proveniência/i);
  api.refs.set(created.branch, updated.headSha);
  await assert.rejects(prepareTechnicalPr({ ...updatedInput, bundle: { ...updatedInput.bundle,
    sha: sha } }), /SHA|identidade/i);
  api.advanceOnCheck = true;
  api.calls.length = 0;
  writeFileSync(join(cwd, 'more.txt'), 'race\n'); git('add', '.'); git('commit', '-qm', 'fix: race');
  const raceSha = git('rev-parse', 'HEAD');
  api.refs.set('master', raceSha);
  api.commits.set(raceSha, { sha: raceSha, tree: { sha: objectSha(3) }, parents: [{ sha: nextSha }] });
  const raceInput = { ...input, ...planFor(raceSha) };
  await assert.rejects(prepareTechnicalPr(raceInput), /avançou|corrida|branch-alvo/i);
  assert.equal(api.refs.get(created.branch), updated.headSha, 'race cannot update technical ref');
  api.advanceOnCheck = false;
  api.refs.set('master', raceSha);
  api.refs.delete(created.branch);
  api.pulls[0].state = 'closed';
  const nextCycle = await prepareTechnicalPr(raceInput);
  assert.equal(nextCycle.outcome, 'created', 'a closed prior PR cannot block the next release');
  assert.equal(api.pulls.length, 2);
  console.log('Technical PR: create, retry, update, two parents, manual head, foreign bundle and target race');
} finally { rmSync(cwd, { recursive: true, force: true, maxRetries: 10, retryDelay: 100 }); }
