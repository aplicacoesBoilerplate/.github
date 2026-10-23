import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { captureGitInputs, verifyGitInputs, type GitInputsSnapshot } from '../ports/git.js';
import type { AdapterId } from '../adapter-contract.js';
import { evaluateReleasePolicy } from '../services/release-policy.js';
import { buildHomologationGuide as render } from '../services/homologation-guide.js';
import { installNpmDependencies, synchronizeNpmLock } from '../adapters/npm-project.js';
import { installPinnedMaven } from '../adapters/maven-installer.js';
import { validateVersionReport } from './version-report.js';
import { argument } from './cli.js';

export function gitInputsMain(args: readonly string[]): void {
  const get = (index: number) => argument(args, index);
  if (get(0) === 'capture') writeFileSync(get(2), JSON.stringify(captureGitInputs(get(1), get(3) as AdapterId), null, 2) + '\n');
  else if (get(0) === 'verify') verifyGitInputs(get(1), JSON.parse(readFileSync(get(2), 'utf8')) as GitInputsSnapshot,
    get(3), get(4), get(5) as AdapterId);
  else throw new Error('Modo de snapshot Git inválido');
}
export function policyMain(args: readonly string[]): void {
  if (args[0] !== 'evaluate' || !args[1] || !args[2]) throw new Error('Uso: release-policy.mjs evaluate <input.json> <output.json>');
  const decision = evaluateReleasePolicy(JSON.parse(readFileSync(args[1], 'utf8')));
  writeFileSync(args[2], JSON.stringify(decision, null, 2) + '\n');
}
export function buildHomologationGuide(input: unknown, snapshot: unknown) {
  const report = input && typeof input === 'object' && Object.hasOwn(input, 'planDigest') ? input : validateVersionReport(input);
  return render(report, snapshot);
}
export function guideMain(args: readonly string[]): void {
  const get = (index: number) => argument(args, index);
  const { guide, markdown } = buildHomologationGuide(JSON.parse(readFileSync(get(0), 'utf8')), JSON.parse(readFileSync(get(1), 'utf8')));
  const output = get(2);
  mkdirSync(output, { recursive: true });
  writeFileSync(join(output, 'homologation.json'), JSON.stringify(guide, null, 2) + '\n');
  writeFileSync(join(output, 'homologation.md'), markdown);
  process.stdout.write(markdown);
}
function required(value: string | undefined, name: string): string {
  if (!value) throw new Error(name + ' obrigatório');
  return value;
}
export function installNodeMain(): void {
  if (process.env.NODE_PACKAGE_MANAGER !== 'npm') throw new Error('Gerenciador Node ainda não migrado: use npm para standard-version');
  installNpmDependencies({ workspace: required(process.env.GITHUB_WORKSPACE, 'GITHUB_WORKSPACE'), projectPath: process.env.PROJECT_PATH ?? '.' });
}
export function installMavenMain(): void {
  installPinnedMaven({ runnerTemp: required(process.env.RUNNER_TEMP, 'RUNNER_TEMP'), githubPath: required(process.env.GITHUB_PATH, 'GITHUB_PATH') });
}
export function syncLockMain(args: readonly string[]): void {
  synchronizeNpmLock({ lockPath: argument(args, 0), projectPath: argument(args, 1), packagePath: argument(args, 2) });
}
