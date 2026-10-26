import { test } from 'node:test';
import * as assert from 'node:assert/strict';
import { CReleaseTagGuard } from '../scripts/CReleaseTagGuard.js';

function guard(pSha?: string, pAnnotated = false, pStatus = 200) {
  const REQUEST: typeof fetch = async (pInput) => {
    const ENDPOINT = new URL(String(pInput)).pathname;
    if (pStatus !== 200) return new Response('', { status: pStatus });
    if (ENDPOINT.includes('/git/ref/tags/')) return pSha
      ? Response.json({ object: { type: pAnnotated ? 'tag' : 'commit', sha: pAnnotated ? 'annotation' : pSha } })
      : new Response('', { status: 404 });
    if (ENDPOINT.endsWith('/git/tags/annotation')) return Response.json({ object: { type: 'commit', sha: pSha } });
    if (ENDPOINT.includes('/releases/tags/')) return new Response('', { status: 404 });
    throw new Error(ENDPOINT);
  };
  return new CReleaseTagGuard(REQUEST);
}
test('Nova entrega é bloqueada quando sua tag já existe', async () => {
  await assert.rejects(guard('old').check('org/repo', 'v0.0.2', 'token'), /tag v0\.0\.2 já existe/);
});
test('Publicação técnica bloqueia tag criada em outro commit', async () => {
  await assert.rejects(guard('old').check('org/repo', 'v0.0.2', 'token', 'new'), /outro commit/);
});
test('Reexecução técnica aceita apenas a tag do mesmo commit', async () => {
  await assert.doesNotReject(guard('same').check('org/repo', 'v0.0.2', 'token', 'same'));
});
test('Tag anotada é resolvida antes de comparar a identidade do commit', async () => {
  await assert.doesNotReject(guard('same', true).check('org/repo', 'v0.0.2', 'token', 'same'));
  await assert.rejects(guard('old', true).check('org/repo', 'v0.0.2', 'token', 'new'), /outro commit/);
});
test('API sem acesso não pode liberar tag como se estivesse ausente', async () => {
  await assert.rejects(guard(undefined, false, 403).check('org/repo', 'v0.0.2', 'token'), /403/);
});
test('Uma tag inédita pode ser preparada e publicada', async () => {
  await assert.doesNotReject(guard().check('org/repo', 'v0.0.2', 'token'));
  await assert.doesNotReject(guard().check('org/repo', 'v0.0.2', 'token', 'new'));
});
