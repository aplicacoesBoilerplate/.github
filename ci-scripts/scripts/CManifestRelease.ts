import * as fs from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';
import { GitHub, Manifest } from 'release-please';
import { TagName } from 'release-please/build/src/util/tag-name.js';
import { CReleaseTagGuard } from './CReleaseTagGuard.js';
import { CReleaseProjectConfig } from './CReleaseProjectConfig.js';
import { CReleaseVersionPolicy } from './CReleaseVersionPolicy.js';

// O SDK oficial continua calculando versões, changelogs, PRs e tags.
export class CManifestRelease {
  public static async load(pGitHub: GitHub, pBranch: string, pConfig: string, pManifest: string,
    pOverrides: Record<string, string>, pPath = '.'): Promise<Manifest> {
    const CONFIG_FILE = CReleaseProjectConfig.normalizePath(pConfig);
    const MANIFEST_FILE = CReleaseProjectConfig.normalizePath(pManifest);
    const PROJECT_PATH = CReleaseProjectConfig.normalizePath(pPath);
    CReleaseProjectConfig.read(await pGitHub.getFileJson(CONFIG_FILE, pBranch), PROJECT_PATH);
    const ENGINE = await Manifest.fromManifest(pGitHub, pBranch, CONFIG_FILE, MANIFEST_FILE, {},
      PROJECT_PATH === '.' ? undefined : PROJECT_PATH);
    for (const [DIRECTORY, VERSION] of Object.entries(pOverrides)) {
      if (!ENGINE.repositoryConfig[DIRECTORY]) throw new Error(`Override para pacote não configurado: ${DIRECTORY}`);
      // A Action v4 não repassa release-as em manifest-mode; aplicar por pacote evita broadcast.
      ENGINE.repositoryConfig[DIRECTORY].releaseAs = CReleaseVersionPolicy.resolve(undefined, [`Release-As: ${VERSION}`]);
    }
    return ENGINE;
  }
  public static async guardCandidates(pEngine: Manifest, pRepository: string, pToken: string,
    pTechnical: boolean, pApiUrl = 'https://api.github.com', pRequest: typeof fetch = fetch): Promise<void> {
    const GUARD = new CReleaseTagGuard(pRequest);
    if (pTechnical) {
      for (const RELEASE of await pEngine.buildReleases()) {
        await GUARD.check(pRepository, RELEASE.tag.toString(), pToken, RELEASE.sha, pApiUrl);
      }
      return;
    }
    for (const PR of await pEngine.buildPullRequests()) for (const DATA of PR.body.releaseData) {
      if (!DATA.version) throw new Error('Plano de release sem versão.');
      const CONFIG = Object.values(pEngine.repositoryConfig).find(ITEM =>
        ITEM.includeComponentInTag ? ITEM.component === DATA.component : !DATA.component)
        || (Object.keys(pEngine.repositoryConfig).length === 1 ? Object.values(pEngine.repositoryConfig)[0] : undefined);
      if (!CONFIG) throw new Error('Plano de release com componente não configurado.');
      const TAG = new TagName(DATA.version, CONFIG.includeComponentInTag ? CONFIG.component : undefined,
        CONFIG.tagSeparator, CONFIG.includeVInTag).toString();
      await GUARD.check(pRepository, TAG, pToken, undefined, pApiUrl);
    }
  }

  public static protectPublication(pGitHub: GitHub, pRepository: string, pToken: string,
    pApiUrl = 'https://api.github.com', pRequest: typeof fetch = fetch): void {
    const CREATE = pGitHub.createRelease.bind(pGitHub);
    const GUARD = new CReleaseTagGuard(pRequest);
    // Revalidar cada escrita real, mesmo se o SDK encontrar outro PR pendente no mesmo run.
    pGitHub.createRelease = async (pRelease, pOptions) => {
      await GUARD.check(pRepository, pRelease.tag.toString(), pToken, pRelease.sha, pApiUrl);
      return CREATE(pRelease, pOptions);
    };
  }

}

async function main(): Promise<void> {
  const EVENT = JSON.parse(fs.readFileSync(process.env.GITHUB_EVENT_PATH || '', 'utf8'));
  const [OWNER, REPOSITORY] = (process.env.GITHUB_REPOSITORY || '').split('/');
  if (!OWNER || !REPOSITORY || !EVENT.pull_request?.base?.ref) throw new Error('Contexto de release do PR ausente.');
  const GITHUB = await GitHub.create({
    owner: OWNER, repo: REPOSITORY, defaultBranch: EVENT.pull_request.base.ref,
    token: process.env.GITHUB_TOKEN, apiUrl: process.env.GITHUB_API_URL,
    graphqlUrl: process.env.GITHUB_GRAPHQL_URL,
  });
  const ENGINE = await CManifestRelease.load(GITHUB, EVENT.pull_request.base.ref,
    process.env.RELEASE_CONFIG_FILE || 'release-please-config.json',
    process.env.RELEASE_MANIFEST_FILE || '.release-please-manifest.json',
    JSON.parse(process.env.RELEASE_OVERRIDES || '{}'), process.env.PROJECT_PATH || '.');
  const TECHNICAL = process.env.TECHNICAL_RELEASE === 'true';
  await CManifestRelease.guardCandidates(ENGINE, process.env.GITHUB_REPOSITORY!, process.env.GITHUB_TOKEN || '',
    TECHNICAL, process.env.GITHUB_API_URL);
  CManifestRelease.protectPublication(GITHUB, process.env.GITHUB_REPOSITORY!, process.env.GITHUB_TOKEN || '',
    process.env.GITHUB_API_URL);
  const RELEASES = TECHNICAL ? (await ENGINE.createReleases()).filter(RELEASE => RELEASE !== undefined) : [];
  const PRS = TECHNICAL ? [] : (await ENGINE.createPullRequests()).filter(PR => PR !== undefined);
  const PACKAGES = RELEASES.map(RELEASE => ({
    path: RELEASE.path, version: RELEASE.version, tag_name: RELEASE.tagName,
    release_type: ENGINE.repositoryConfig[RELEASE.path].releaseType,
  }));
  if (process.env.GITHUB_OUTPUT) fs.appendFileSync(process.env.GITHUB_OUTPUT,
    `releases=${JSON.stringify(PACKAGES)}\nreleases_created=${PACKAGES.length > 0}\nprs_created=${PRS.length > 0}\n`, 'utf8');
  console.log(`Manifest: ${PRS.length} PR(s) técnico(s), ${PACKAGES.length} release(s).`);
}
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch(ERROR => { console.error(ERROR.message); process.exitCode = 1; });
}
