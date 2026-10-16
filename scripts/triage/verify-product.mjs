import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { mkdtemp, realpath, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { randomUUID } from 'node:crypto';
import { contractError } from '../llm/validate-request.mjs';
import { validateTriageConfig } from './policy.mjs';

const exec = promisify(execFile);
export function validateVerificationImage(image) {
  if (typeof image !== 'string' || image.length > 300 || !/^[a-z0-9][a-z0-9._/-]*@sha256:[a-f0-9]{64}$/.test(image)) throw contractError('INVALID_TRIAGE_CONFIG');
  return image;
}

/** Product code runs only inside a container with no credentials or host process/socket mounts. */
export async function verifyProduct({ sourceRoot, config, image, source_sha, config_source_sha, patch_sha256 }, { execute = exec } = {}) {
  const policy = validateTriageConfig(config); validateVerificationImage(image);
  if (!/^[a-f0-9]{40}$/.test(source_sha ?? '') || !/^[a-f0-9]{40}$/.test(config_source_sha ?? '') || !/^[a-f0-9]{64}$/.test(patch_sha256 ?? '')) throw contractError('INVALID_TRIAGE_VERIFICATION');
  const source = await realpath(sourceRoot);
  if (/[\r\n,]/.test(source)) throw contractError('INVALID_TRIAGE_CONFIG');
  const dockerConfig = await mkdtemp(join(tmpdir(), 'triage-docker-config-'));
  const env = { PATH: process.env.PATH, SystemRoot: process.env.SystemRoot, DOCKER_CONFIG: dockerConfig };
  const report = { status: 'passed', source_sha, config_source_sha, patch_sha256, checks: [] };
  try {
    for (const [index, check] of policy.checks.entries()) {
      const name = `triage-check-${randomUUID()}`; let errorCode = ''; let exitCode = 0;
      try {
        await execute('docker', ['run', '--rm', '--name', name, '--network=none', '--read-only', '--cap-drop=ALL',
          '--security-opt=no-new-privileges', '--pids-limit=128', '--memory=2g', '--cpus=2', '--no-healthcheck',
          '--user', `${process.getuid?.() ?? 1000}:${process.getgid?.() ?? 1000}`, '--tmpfs', '/tmp:rw,nosuid,nodev,size=1g',
          '--env', 'HOME=/tmp', '--env', 'GOCACHE=/tmp/go-build', '--mount', `type=bind,source=${source},target=/workspace`,
          '--workdir', '/workspace', image, check.command, ...check.args],
        { env, encoding: 'utf8', windowsHide: true, timeout: 300000, maxBuffer: 1048576 });
      } catch (error) { exitCode = Number.isInteger(error.code) ? error.code : -1; errorCode = error.killed ? 'CHECK_TIMEOUT' : 'CHECK_FAILED'; report.status = 'failed'; }
      finally {
        try { await execute('docker', ['rm', '--force', name], { env, encoding: 'utf8', windowsHide: true, timeout: 10000, maxBuffer: 65536 }); }
        catch (error) { if (!/No such container/i.test(error.stderr ?? '')) throw contractError('CHECK_CLEANUP_FAILED'); }
      }
      report.checks.push({ index, exit_code: exitCode, error_code: errorCode });
      if (report.status === 'failed') break;
    }
    return report;
  } finally { await rm(dockerConfig, { recursive: true, force: true }); }
}
