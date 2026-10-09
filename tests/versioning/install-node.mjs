import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { chmodSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { delimiter, join, resolve } from 'node:path';

const root = mkdtempSync(join(tmpdir(), 'install-node-'));
const bin = join(root, 'bin');
const project = join(root, 'project');
try {
  mkdirSync(bin); mkdirSync(project);
  writeFileSync(join(project, 'package.json'), '{"name":"fixture","version":"0.1.0"}\n');
  writeFileSync(join(project, 'package-lock.json'), '{"version":"0.1.0"}\n');
  const npm = join(bin, 'npm');
  writeFileSync(npm, '#!/usr/bin/env sh\nprintf "%s" "$*" > "$MOCK_NPM_LOG"\n');
  chmodSync(npm, 0o755);
  const log = join(root, 'npm.log');
  const run = () => spawnSync('bash', [resolve(import.meta.dirname,
    '../../scripts/versioning/install-node.sh')], { cwd: root, encoding: 'utf8',
    env: { ...process.env, PATH: `${bin}${delimiter}${process.env.PATH}`,
      GITHUB_WORKSPACE: root, PROJECT_PATH: 'project', NODE_PACKAGE_MANAGER: 'npm',
      MOCK_NPM_LOG: log } });
  let result = run();
  assert.equal(result.status, 0, result.stderr);
  assert.match(readFileSync(log, 'utf8'), /ci --ignore-scripts/);
  writeFileSync(join(project, 'pnpm-lock.yaml'), 'lockfileVersion: 9\n');
  result = run();
  assert.notEqual(result.status, 0, 'pnpm lock cannot silently use npm preparation');
  assert.match(result.stderr, /apenas lockfile npm/);
  console.log('Node install: npm-only profile and unsupported lock rejection validated');
} finally { rmSync(root, { recursive: true, force: true }); }
