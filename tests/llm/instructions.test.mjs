import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, writeFile, mkdir, symlink, rm, readFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createHash } from 'node:crypto';
import { prepareInstructions } from '../../scripts/llm/instructions.mjs';

const hash = data => createHash('sha256').update(data).digest('hex');
async function fixture(t) {
  const dir = await mkdtemp(join(tmpdir(), 'llm-guidance-'));
  t.after(() => rm(dir, { recursive: true, force: true }));
  const root = join(dir, 'repo'); await mkdir(root);
  const global = join(dir, 'global.md'); await writeFile(global, 'global guidance');
  return { dir, root, global };
}
const deny = promise => assert.rejects(promise, { code: 'INSTRUCTIONS_INVALID', message: 'INSTRUCTIONS_INVALID' });

test('LLM-15: preserves complete global content, joins consumer and records each source hash', async t => {
  const f = await fixture(t);
  await writeFile(f.global, 'all global lines\nincluding final newline\n');
  await writeFile(join(f.root, 'AGENTS.md'), 'consumer guidance');
  const result = await prepareInstructions(f.root, f.global);
  assert.equal(result.content, 'all global lines\nincluding final newline\n\n\nconsumer guidance');
  assert.deepEqual(result.sources, [
    { path: 'global/AGENTS.md', sha256: hash('all global lines\nincluding final newline\n'), bytes: 41 },
    { path: 'AGENTS.md', sha256: hash('consumer guidance'), bytes: 17 },
  ]);
  assert.equal(result.sha256, hash(result.content));
  assert.equal(result.bytes, Buffer.byteLength(result.content));
});
test('LLM-15: root-to-cwd precedence prefers override, retaining parent instructions', async t => {
  const f = await fixture(t); await mkdir(join(f.root, 'src'));
  await writeFile(join(f.root, 'AGENTS.md'), 'root');
  await writeFile(join(f.root, 'src', 'AGENTS.md'), 'ignored');
  await writeFile(join(f.root, 'src', 'AGENTS.override.md'), 'override');
  const result = await prepareInstructions(f.root, f.global, 65536, { cwd: 'src' });
  assert.equal(result.content, 'global guidance\n\nroot\n\noverride');
  assert.deepEqual(result.sources.map(s => s.path), ['global/AGENTS.md', 'AGENTS.md', 'src/AGENTS.override.md']);
});
test('LLM-15: empty override falls through to AGENTS', async t => {
  const f = await fixture(t);
  await writeFile(join(f.root, 'AGENTS.override.md'), '');
  await writeFile(join(f.root, 'AGENTS.md'), 'nonempty');
  assert.equal((await prepareInstructions(f.root, f.global)).content, 'global guidance\n\nnonempty');
});
test('LLM-15: does not load sibling instruction directories at repo root', async t => {
  const f = await fixture(t); await mkdir(join(f.root, 'other'));
  await writeFile(join(f.root, 'other', 'AGENTS.md'), 'not on cwd path');
  assert.deepEqual((await prepareInstructions(f.root, f.global)).sources.map(s => s.path), ['global/AGENTS.md']);
});
test('LLM-16: exact aggregate byte limit passes and one byte excess fails without truncation', async t => {
  const f = await fixture(t);
  await writeFile(f.global, 'x'.repeat(65536));
  const result = await prepareInstructions(f.root, f.global);
  assert.equal(result.bytes, 65536);
  assert.equal(result.content.length, 65536);
  await writeFile(f.global, 'x'.repeat(65537));
  await deny(prepareInstructions(f.root, f.global));
});
test('LLM-16: separators and multibyte characters count towards combined limit', async t => {
  const f = await fixture(t); await writeFile(f.global, 'é'.repeat(32767));
  await writeFile(join(f.root, 'AGENTS.md'), 'x');
  await deny(prepareInstructions(f.root, f.global));
});
test('LLM-16: instruction symlink and symlinked cwd cannot escape trusted root', async t => {
  const f = await fixture(t);
  // Junctions work without developer-mode privileges on Windows.
  await mkdir(join(f.root, 'AGENTS.override.md'));
  await deny(prepareInstructions(f.root, f.global));
  await rm(join(f.root, 'AGENTS.override.md'), { recursive: true });
  await symlink(f.dir, join(f.root, 'alias'), 'junction');
  await deny(prepareInstructions(f.root, f.global, 65536, { cwd: 'alias' }));
});
test('LLM-16: non-regular global source, missing source and invalid cwd fail explicitly', async t => {
  const f = await fixture(t);
  await deny(prepareInstructions(f.root, f.root));
  await deny(prepareInstructions(f.root, join(f.dir, 'missing')));
  await deny(prepareInstructions(f.root, f.global, 65536, { cwd: '../other' }));
});
test('LLM-16: an instruction link is rejected even when its target is inside the checkout', async t => {
  const f = await fixture(t);
  const target = process.platform === 'win32' ? f.root : f.global;
  await symlink(target, join(f.root, 'AGENTS.override.md'), process.platform === 'win32' ? 'junction' : 'file');
  await deny(prepareInstructions(f.root, f.global));
});
test('LLM-15: versioned global snapshot matches recorded hash and retains local source identity', async t => {
  const f = await fixture(t);
  const file = new URL('../../scripts/llm/instructions/AGENTS.md', import.meta.url);
  const bytes = await readFile(file);
  const provenance = JSON.parse(await readFile(new URL('../../scripts/llm/instructions/provenance.json', import.meta.url), 'utf8'));
  assert.equal(hash(bytes), provenance.sha256);
  assert.equal(provenance.source_sha256, '38ebd29a0c12506b5e53459d9a1add7734b19c56cca5fcc500302904d4cacf81');
  assert.equal(provenance.source_bytes, 25298);
  assert.equal((await prepareInstructions(f.root)).sources[0].sha256, provenance.sha256);
});
