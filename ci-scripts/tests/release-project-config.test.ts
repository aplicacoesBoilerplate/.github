import { test } from 'node:test';
import * as assert from 'node:assert/strict';
import { CReleaseProjectConfig } from '../scripts/CReleaseProjectConfig.js';

test('Diretório raiz é padrão e docs é preservado como caminho relativo', () => {
  assert.equal(CReleaseProjectConfig.normalizePath('.'), '.');
  assert.equal(CReleaseProjectConfig.normalizePath('docs/'), 'docs');
});
for (const PATH of ['../docs', '/docs', 'C:/docs', 'docs/../../outro', 'docs\\outro', '']) {
  test(`Diretório inseguro ou vazio é rejeitado: ${PATH}`, () => {
    assert.throws(() => CReleaseProjectConfig.normalizePath(PATH), /diretório/);
  });
}
test('Manifest mantém os adaptadores e namespaces de cada pacote', () => {
  assert.equal(CReleaseProjectConfig.read({
    'include-component-in-tag': true, 'include-v-in-tag': false, 'tag-separator': '@',
    packages: { 'packages/ui/vuetify': { component: '@aplicacoesboilerplate/ui-vuetify' } },
  })[0].tagPrefix, '@aplicacoesboilerplate/ui-vuetify@');
  assert.deepEqual(CReleaseProjectConfig.read({
    'include-component-in-tag': true,
    packages: { docs: { 'release-type': 'node', component: 'docs' }, api: { 'release-type': 'maven', component: 'api' } },
  }), [
    { path: 'docs', releaseType: 'node', tagPrefix: 'docs-v', component: 'docs' },
    { path: 'api', releaseType: 'maven', tagPrefix: 'api-v', component: 'api' },
  ]);
});
test('Selecionar pacote não inclui outros componentes do manifest', () => {
  const PROJECTS = CReleaseProjectConfig.read({
    'include-component-in-tag': true,
    packages: { docs: { 'release-type': 'node', component: 'docs' }, api: { 'release-type': 'maven', component: 'api' } },
  }, 'docs');
  assert.equal(PROJECTS.length, 1);
  assert.equal(PROJECTS[0].path, 'docs');
});
test('Manifest multi-pacote rejeita tags compartilhadas e componentes ausentes', () => {
  for (const CONFIG of [
    { 'include-component-in-tag': false, packages: { a: { 'release-type': 'node' }, b: { 'release-type': 'node' } } },
    { 'include-component-in-tag': true, packages: { a: { 'release-type': 'node' } } },
    { 'include-component-in-tag': true, packages: { a: { 'release-type': 'node', component: 'x' }, b: { 'release-type': 'node', component: 'x' } } },
  ]) assert.throws(() => CReleaseProjectConfig.read(CONFIG), /componente|tag/);
});
test('Manifest rejeita caminho não configurado e adaptador não suportado', () => {
  const CONFIG = { 'include-component-in-tag': false, packages: { docs: { 'release-type': 'node' } } };
  assert.throws(() => CReleaseProjectConfig.read(CONFIG, 'outro'), /configurado/);
  assert.throws(() => CReleaseProjectConfig.read({ 'include-component-in-tag': false, packages: { docs: { 'release-type': 'inexistente' } } }), /adaptador/);
});

test('release-as global do JSON não propaga a mesma versão a todos os pacotes', () => {
  assert.throws(() => CReleaseProjectConfig.read({
    'include-component-in-tag': true, 'release-as': '0.0.2',
    packages: { a: { 'release-type': 'node', component: 'a' }, b: { 'release-type': 'node', component: 'b' } },
  }), /release-as global.*ambíguo/);
});
