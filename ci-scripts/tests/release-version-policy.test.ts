import { test } from 'node:test';
import * as assert from 'node:assert/strict';
import { CReleaseVersionPolicy } from '../scripts/CReleaseVersionPolicy.js';

test('Release-As no commit resolve a versão sem milestone', () => {
  assert.equal(CReleaseVersionPolicy.resolve(undefined, ['fix(docs): navegação\n\nRelease-As: 0.0.2']), '0.0.2');
});
test('Milestone normaliza o prefixo v', () => {
  assert.equal(CReleaseVersionPolicy.resolve('v0.0.2', []), '0.0.2');
});
for (const FIRST_SOURCE of ['footer', 'milestone']) {
  test(`Tag já publicada por ${FIRST_SOURCE} bloqueia nova entrega pela outra origem`, () => {
    const VERSION = FIRST_SOURCE === 'footer'
      ? CReleaseVersionPolicy.resolve('v0.0.2', [])
      : CReleaseVersionPolicy.resolve(undefined, ['fix: entrega\n\nRelease-As: 0.0.2']);
    assert.throws(() => CReleaseVersionPolicy.assertAvailable(VERSION, true), /tag v0\.0\.2 já existe/);
  });
}
test('Versão inédita pode prosseguir por qualquer origem', () => {
  for (const VERSION of [
    CReleaseVersionPolicy.resolve('v0.0.2', []),
    CReleaseVersionPolicy.resolve(undefined, ['fix: entrega\n\nRelease-As: 0.0.2']),
  ]) assert.doesNotThrow(() => CReleaseVersionPolicy.assertAvailable(VERSION, false));
});
test('Milestone e footer divergentes não escolhem silenciosamente uma versão', () => {
  assert.throws(() => CReleaseVersionPolicy.resolve('v0.0.3', ['Release-As: 0.0.2']), /diverg/);
});
test('Footers divergentes entre commits são bloqueados', () => {
  assert.throws(() => CReleaseVersionPolicy.resolve(undefined, ['Release-As: 0.0.2', 'Release-As: 0.0.3']), /diverg/);
});
test('Mesma versão em milestone e footer é aceita', () => {
  assert.equal(CReleaseVersionPolicy.resolve('v0.0.2', ['Release-As: 0.0.2']), '0.0.2');
});
test('Milestone inválida não pode ser contornada pelo footer', () => {
  assert.throws(() => CReleaseVersionPolicy.resolve('entrega', ['Release-As: 0.0.2']), /SemVer/);
});
test('Footer inválido e ausência de ambas as fontes são bloqueados', () => {
  assert.throws(() => CReleaseVersionPolicy.resolve(undefined, ['Release-As: invalida']), /SemVer/);
  assert.throws(() => CReleaseVersionPolicy.resolve(undefined, ['fix: sem versão']), /sem uma Milestone/);
});
test('Exemplos em blocos de código do PR não declaram a versão da entrega', () => {
  assert.throws(() => CReleaseVersionPolicy.resolve(undefined, ['Exemplo:\n```text\nRelease-As: 0.0.2\n```']), /sem uma Milestone/);
});
test('Footer aceita diferenças de caixa e espaços, preservando a identidade da tag', () => {
  assert.equal(CReleaseVersionPolicy.resolve(undefined, ['fix: ajuste\n\nrelease-as:   0.0.2  ']), '0.0.2');
});

import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';
import { parse } from 'yaml';

test('Workflows validam antes do release e reagem a mudanças na declaração da versão', () => {
  const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
  const CALLED = parse(fs.readFileSync(path.join(ROOT, '.github/workflows/version-release-please-called.yml'), 'utf8'));
  const CALLER = parse(fs.readFileSync(path.join(ROOT, '.github/workflows/version-release-please-self-caller.yml'), 'utf8'));
  const PREVIEW = parse(fs.readFileSync(path.join(ROOT, '.github/workflows/version-release-please-validate.yml'), 'utf8'));
  const STEPS = CALLED.jobs['release-please'].steps;
  const POLICY = STEPS.findIndex((step: { id?: string }) => step.id === 'version-policy');
  const ENGINE = STEPS.findIndex((step: { uses?: string }) => step.uses === 'googleapis/release-please-action@v4');
  assert.ok(POLICY >= 0 && POLICY < ENGINE);
  assert.equal(STEPS[POLICY]['continue-on-error'], undefined);
  assert.match(STEPS[POLICY].run, /CReleaseVersionValidator\.ts$/);
  const ORCHESTRATOR = STEPS.find((step: { id?: string }) => step.id === 'orchestrator');
  assert.equal(ORCHESTRATOR.env.VALIDATED_RELEASE_VERSION, '${{ steps.version-policy.outputs.version }}');
  for (const EVENT of ['opened', 'reopened', 'synchronize', 'edited', 'milestoned', 'demilestoned']) {
    assert.ok(CALLER.on.pull_request.types.includes(EVENT));
  }
  assert.equal(CALLER.jobs['version-policy'].uses, './.github/workflows/version-release-please-validate.yml');
  assert.equal(CALLER.jobs['version-policy'].if, "github.event.action != 'closed'");
  assert.deepEqual(PREVIEW.permissions, { contents: 'read', 'pull-requests': 'read' });
  assert.equal(CALLED.concurrency['cancel-in-progress'], false);
});

test('Orquestrador entrega ao motor a versão do footer e a versão já validada no GitHub', () => {
  const SCRIPTS = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
  const TEMP = fs.mkdtempSync(path.join(os.tmpdir(), 'release-policy-'));
  const OUTPUT = path.join(TEMP, 'outputs');
  const SAFE_ENV = Object.fromEntries(Object.entries(process.env).filter(([KEY]) =>
    /^(PATH|SYSTEMROOT|WINDIR|COMSPEC|PATHEXT|TEMP|TMP|USERPROFILE|APPDATA|LOCALAPPDATA)$/i.test(KEY)));
  try {
    for (const INPUT of [
      { PR_COMMIT_MESSAGES_JSON: JSON.stringify(['fix: doc\n\nRelease-As: 0.0.2']) },
      { VALIDATED_RELEASE_VERSION: '0.0.2' },
    ]) {
      fs.writeFileSync(OUTPUT, '');
      execFileSync(process.execPath, [
        path.join(SCRIPTS, 'node_modules/tsx/dist/cli.mjs'),
        path.join(SCRIPTS, 'scripts/release-orchestrator.ts'),
      ], { cwd: TEMP, env: { ...SAFE_ENV, ...INPUT, PROJECT_TYPE: 'simple', PR_HEAD_REF: 'feature/docs', GITHUB_OUTPUT: OUTPUT } });
      assert.equal(fs.readFileSync(OUTPUT, 'utf8'), 'release_type=simple\nrelease_as=0.0.2\nengine=action\n');
    }
  } finally {
    fs.rmSync(TEMP, { recursive: true, force: true });
  }
});
