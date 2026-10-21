import { createHash } from 'node:crypto';
import { appendFileSync, existsSync, mkdtempSync, readFileSync, realpathSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { runProcess, type ProcessRequest, type ProcessResult } from '../ports/process.js';

const mavenVersion = '3.9.9';
const downloadUrl = 'https://archive.apache.org/dist/maven/maven-3/3.9.9/binaries/apache-maven-3.9.9-bin.tar.gz';
const pinnedSha512 = 'a555254d6b53d267965a3404ecb14e53c3827c09c3b94b5678835887ab404556bfaf78dcfe03ba76fa2508649dca8531c74bca4d5846513522404d48e8c4ac8b';

export interface MavenInstallation {
  readonly version: string;
  readonly bin: string;
}

export function installPinnedMaven(options: { runnerTemp: string; githubPath: string },
  dependencies: { run?: (request: ProcessRequest) => ProcessResult;
    expectedSha512?: string } = {}): MavenInstallation {
  if (!options.runnerTemp || !options.githubPath) throw new Error('RUNNER_TEMP e GITHUB_PATH obrigatórios');
  const workspace = realpathSync(options.runnerTemp);
  const run = dependencies.run ?? runProcess;
  const temporary = mkdtempSync(join(workspace, 'central-maven-download-'));
  let destination: string | null = null;
  try {
    const archive = join(temporary, 'maven.tar.gz');
    run({ command: 'curl', args: ['--fail', '--silent', '--show-error', '--location',
      downloadUrl, '-o', archive], cwd: workspace, workspace });
    const actual = createHash('sha512').update(readFileSync(archive)).digest('hex');
    if (actual !== (dependencies.expectedSha512 ?? pinnedSha512)) {
      throw new Error('Maven 3.9.9 checksum SHA-512 divergente');
    }
    destination = mkdtempSync(join(workspace, `central-maven-${mavenVersion}-`));
    run({ command: 'tar', args: ['-xzf', archive, '-C', destination, '--strip-components=1'],
      cwd: workspace, workspace });
    const bin = join(destination, 'bin');
    if (!existsSync(join(bin, 'mvn'))) throw new Error('Arquivo Maven mvn ausente após extração');
    appendFileSync(options.githubPath, `${bin}\n`);
    return { version: mavenVersion, bin };
  } catch (error) {
    if (destination) rmSync(destination, { recursive: true, force: true });
    throw error;
  } finally {
    rmSync(temporary, { recursive: true, force: true });
  }
}
