import * as fs from 'node:fs';
import * as path from 'node:path';
import { pathToFileURL } from 'node:url';
import { GitHub, Manifest } from 'release-please';
import { CReleaseConfiguration } from './release-configuration.js';

export interface IConfiguredReleaseOptions {
  repository: string;
  targetBranch: string;
  configFile: string;
  manifestFile: string;
  releaseAs?: string;
  token?: string;
  workspace?: string;
}
type TNativeWriter = Pick<Manifest, 'createReleases' | 'createPullRequests'>;
type TManifestLoader = (pOptions: IConfiguredReleaseOptions) => Promise<TNativeWriter>;

/** Ponte pequena para opções nativas que a Action v4 não encaminha. */
export async function loadConfiguredManifest(pOptions: IConfiguredReleaseOptions, pGitHub?: GitHub): Promise<Manifest> {
  CReleaseConfiguration.load(pOptions.configFile, pOptions.manifestFile, 'milestone', pOptions.workspace);
  if (!/^[^/\s]+\/[^/\s]+$/.test(pOptions.repository) || !pOptions.targetBranch || /[\r\n]/.test(pOptions.targetBranch)) {
    throw new Error('Repositório e branch de destino devem vir do contexto confiável do workflow');
  }
  if (pOptions.releaseAs) CReleaseConfiguration.assertVersion(pOptions.releaseAs);
  if (!pGitHub && !pOptions.token) throw new Error('GITHUB_TOKEN é necessário para a execução configurada');
  const [owner, repo] = pOptions.repository.split('/');
  const github = pGitHub ?? await GitHub.create({ owner, repo, token: pOptions.token, defaultBranch: pOptions.targetBranch });
  const manifest = await Manifest.fromManifest(github, pOptions.targetBranch, pOptions.configFile, pOptions.manifestFile, {}, '.', pOptions.releaseAs || undefined);
  if (Object.keys(manifest.repositoryConfig).length !== 1 || !manifest.repositoryConfig['.']) {
    throw new Error('Override configurado exige um único componente raiz');
  }
  return manifest;
}

export class CConfiguredReleaseEngine {
  constructor(private readonly loader: TManifestLoader = loadConfiguredManifest) {}

  public async run(pOptions: IConfiguredReleaseOptions) {
    // Mesma ordem da Action oficial; recarregar o histórico após criar Releases.
    const releases = (await (await this.loader(pOptions)).createReleases()).filter(release => release !== undefined);
    const pullRequests = (await (await this.loader(pOptions)).createPullRequests()).filter(pr => pr !== undefined);
    return { releases, pullRequests, release_created: releases.length > 0, prs_created: pullRequests.length > 0 };
  }
}

if (process.argv[1] && pathToFileURL(path.resolve(process.argv[1])).href === import.meta.url) {
  try {
    const result = await new CConfiguredReleaseEngine().run({
      repository: process.env.GITHUB_REPOSITORY || '', targetBranch: process.env.TARGET_BRANCH || '',
      configFile: process.env.RELEASE_CONFIG_FILE || '',
      manifestFile: process.env.RELEASE_MANIFEST_FILE || '.release-please-manifest.json',
      releaseAs: process.env.RELEASE_AS || undefined, token: process.env.GITHUB_TOKEN,
    });
    if (process.env.GITHUB_OUTPUT) {
      fs.appendFileSync(process.env.GITHUB_OUTPUT, `release_created=${result.release_created}\nprs_created=${result.prs_created}\n`);
    }
    console.log(`Release Please nativo: ${result.releases.length} Releases e ${result.pullRequests.length} PRs retornados`);
  } catch (error) {
    console.error((error as Error).message);
    process.exitCode = 1;
  }
}
