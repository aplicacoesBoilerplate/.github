import assert from 'node:assert/strict';
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { installNpmDependencies } from '../../scripts/versioning/dist/adapters/npm-project.js';

const root = mkdtempSync(join(tmpdir(), 'install-node-'));
const project = join(root, 'project');
try {
  mkdirSync(project);
  writeFileSync(join(project, 'package.json'), '{"name":"fixture","version":"0.1.0"}\n');
  writeFileSync(join(project, 'package-lock.json'), '{"version":"0.1.0"}\n');
  const log = join(root, 'npm.log'), calls = [];
  const run = () => {
    try {
      installNpmDependencies({workspace:root,projectPath:'project'},{run:request=>{
        calls.push(request);
        assert.match(request.command,/^npm(?:\.cmd)?$/);
        assert.equal(request.cwd,project);
        assert.equal(request.workspace,root);
        assert.deepEqual(request.args,['ci','--ignore-scripts']);
        writeFileSync(log,request.args.join(' '));
        return {stdout:'',stderr:''};
      }});
      return {status:0,stderr:''};
    } catch(error) { return {status:1,stderr:error.message}; }
  };
  let result = run();
  assert.equal(result.status, 0, result.stderr);
  assert.match(readFileSync(log, 'utf8'), /ci --ignore-scripts/);
  assert.equal(calls.length,1);
  writeFileSync(join(project, 'pnpm-lock.yaml'), 'lockfileVersion: 9\n');
  result = run();
  assert.notEqual(result.status, 0, 'pnpm lock cannot silently use npm preparation');
  assert.match(result.stderr, /apenas lockfile npm/);
  assert.equal(calls.length,1,'unsupported lock cannot start a native installer');
  console.log('Node install: npm-only profile and unsupported lock rejection validated');
} finally { rmSync(root, { recursive: true, force: true }); }
