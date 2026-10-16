import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { runProcess } from '../../scripts/versioning/process-runner.mjs';
const root = mkdtempSync(join(tmpdir(), 'process-port-'));
const outside = mkdtempSync(join(tmpdir(), 'process-outside-'));
try {
  const request = { command: process.execPath, cwd: root, workspace: root };
  const result = runProcess({ ...request, args: ['-e',
    'process.stdout.write(JSON.stringify({token:process.env.GH_TOKEN??null,packages:process.env.GITHUB_PACKAGES_TOKEN??null,value:process.env.VISIBLE}))'],
    env: { ...process.env, GH_TOKEN: 'never-export', GITHUB_PACKAGES_TOKEN: 'never-export', VISIBLE: 'kept' } });
  assert.deepEqual(JSON.parse(result.stdout), { token: null, packages: null, value: 'kept' });
  assert.throws(() => runProcess({ ...request, cwd: outside, args: [] }), /fora do workspace/);
  assert.throws(() => runProcess({ ...request, timeoutMs: 30, args: ['-e', 'setTimeout(()=>{},10000)'] }), /timeout/);
  assert.throws(() => runProcess({ ...request, args: ['-e', 'process.exit(7)'] }), /exit 7/);
  assert.throws(() => runProcess({ ...request, args: 'invalid' }), /argv/);
  assert.throws(() => runProcess({ ...request, command: 'missing-version-tool', args: [] }), /executar/);
  mkdirSync(join(root, 'sub'));
  assert.equal(runProcess({ ...request, cwd: join(root, 'sub'), args: ['-e', 'process.stdout.write("ok")'] }).stdout, 'ok');
  if (process.platform === 'win32') {
    const script = join(root, 'echo-argv.cmd');
    writeFileSync(script, '@echo off\r\necho(%~1\r\n');
    assert.equal(runProcess({ ...request, command: script, args: ['hello world'] }).stdout.trim(), 'hello world');
    assert.throws(() => runProcess({ ...request, command: script, args: ['unsafe&echo'] }), /Argumento inseguro/);
  }
  console.log('Process port contract passed');
} finally { rmSync(root, { recursive: true, force: true }); rmSync(outside, { recursive: true, force: true }); }
