import { execFileSync } from 'node:child_process';
import { appendFileSync, readFileSync } from 'node:fs';
import { parseStableVersion, validateVersionReport } from './version-report.mjs';

function compareVersions(left, right) {
  const a = parseStableVersion(left).parts;
  const b = parseStableVersion(right).parts;
  for (let index = 0; index < 3; index += 1) {
    if (a[index] !== b[index]) return a[index] - b[index];
  }
  return 0;
}

function releaseBody(report, release) {
  const batch = report.releases.map(item => `- ${item.tag} (${item.bump})`).join('\n');
  const summaries = report.native.result.changesets.map(item =>
    `- ${item.id}: ${item.summary ?? ''}`).join('\n');
  return [`${release.tag} foi calculada pelo Changesets no commit homologado ${report.sha}.`,
    '', 'Lote coordenado:', batch, '', 'Changesets:', summaries].join('\n');
}

function checkIdentity(tag, sha, tagSha, release) {
  if (tagSha && tagSha.toLowerCase() !== sha.toLowerCase()) {
    throw Error(`Conflito: tag ${tag} aponta para ${tagSha}, não ${sha}`);
  }
  if (release && !tagSha) throw Error(`Conflito: Release ${tag} existe sem tag verificável`);
  if (release && (release.tag_name !== tag || release.target_commitish?.toLowerCase() !== sha.toLowerCase())) {
    throw Error(`Conflito: Release ${tag} diverge da tag/SHA`);
  }
}

function retryRead(read) {
  for (let attempt = 0; attempt < 10; attempt += 1) {
    const value = read();
    if (value) return value;
  }
  return null;
}

export function publishChangesets({ report, sha, stale, api }) {
  validateVersionReport(report);
  if (report.adapter !== 'changesets' || !/^[0-9a-f]{40}$/i.test(sha)) {
    throw Error('Plano Changesets ou SHA de publicação inválido');
  }
  const existing = report.releases.map(item => {
    const tagSha = api.getTag(item.tag);
    const release = api.getRelease(item.tag);
    checkIdentity(item.tag, sha, tagSha, release);
    if (!tagSha && api.latestVersion) {
      const latest = api.latestVersion(item.name, sha);
      if (latest && compareVersions(item.version, latest) <= 0) {
        throw Error(`Versão ${item.tag} não supera a última tag ${item.name}@${latest}`);
      }
    }
    return { item, tagSha, release };
  });
  if (stale && existing.some(entry => !entry.tagSha || !entry.release)) {
    throw Error('Push antigo com lote Changesets incompleto; nenhuma escrita será feita');
  }
  let wrote = false;
  const releases = [];
  for (const entry of existing) {
    const { item } = entry;
    if (!entry.tagSha) {
      try { api.createTag(item.tag, sha); wrote = true; }
      catch (error) {
        const current = retryRead(() => api.getTag(item.tag));
        if (!current) throw Error(`Falha ao criar tag ${item.tag}: ${error.message}`);
      }
      checkIdentity(item.tag, sha, api.getTag(item.tag), null);
      if (!api.getTag(item.tag)) throw Error(`Tag ${item.tag} não ficou visível`);
    }
    let release = entry.release;
    if (!release) {
      try { release = api.createRelease(item.tag, sha, releaseBody(report, item)); wrote = true; }
      catch (error) {
        release = retryRead(() => api.getRelease(item.tag));
        if (!release) throw Error(`Tag ${item.tag} preservada, mas Release falhou: ${error.message}`);
      }
      checkIdentity(item.tag, sha, api.getTag(item.tag), release);
    }
    releases.push({ name: item.name, version: item.version, tag: item.tag,
      release_url: release.html_url, published_sha: sha });
  }
  const single = releases.length === 1 ? releases[0] : null;
  return { outcome: wrote ? 'published' : 'already-published', publishedSha: sha,
    version: single?.version ?? '', tag: single?.tag ?? '', releaseUrl: single?.release_url ?? '',
    releases };
}

function gh(args) {
  return JSON.parse(execFileSync('gh', ['api', ...args], { encoding: 'utf8' }));
}

function optionalGh(path) {
  try { return gh([path]); }
  catch (error) {
    if (/HTTP 404/.test(String(error.stderr ?? ''))) return null;
    throw Error(`Falha na API GitHub em ${path}: ${String(error.stderr ?? error.message).trim()}`);
  }
}

export function githubApi(repository, workspace) {
  return {
    getTag(tag) {
      const ref = optionalGh(`repos/${repository}/git/ref/tags/${tag}`);
      if (!ref) return null;
      let { type, sha } = ref.object ?? {};
      if (type === 'tag') {
        const annotated = gh([`repos/${repository}/git/tags/${sha}`]);
        ({ type, sha } = annotated.object ?? {});
      }
      if (type !== 'commit' || !/^[0-9a-f]{40}$/i.test(sha)) throw Error(`Tag ${tag} não aponta para commit`);
      return sha;
    },
    getRelease(tag) { return optionalGh(`repos/${repository}/releases/tags/${tag}`); },
    createTag(tag, sha) {
      return gh(['-X', 'POST', `repos/${repository}/git/refs`, '-f', `ref=refs/tags/${tag}`, '-f', `sha=${sha}`]);
    },
    createRelease(tag, sha, body) {
      return gh(['-X', 'POST', `repos/${repository}/releases`, '-f', `tag_name=${tag}`,
        '-f', `target_commitish=${sha}`, '-f', `name=${tag}`, '-f', `body=${body}`]);
    },
    latestVersion(name, sha) {
      const tags = execFileSync('git', ['tag', '--merged', sha], { cwd: workspace, encoding: 'utf8' });
      return tags.split(/\r?\n/).filter(tag => tag.startsWith(`${name}@`))
        .map(tag => tag.slice(name.length + 1))
        .filter(version => /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)$/.test(version))
        .sort(compareVersions).at(-1) ?? null;
    },
  };
}

if (process.argv[1] && import.meta.filename === process.argv[1]) {
  try {
    const [reportPath] = process.argv.slice(2);
    const report = JSON.parse(readFileSync(reportPath, 'utf8'));
    const { GITHUB_SHA: sha, GITHUB_REPOSITORY: repository, GITHUB_WORKSPACE: workspace,
      STALE_PUSH: stale, GITHUB_OUTPUT: output, GITHUB_STEP_SUMMARY: summary,
      VERSION_PR_NUMBER: prNumber } = process.env;
    if (!repository || !workspace || !sha) throw Error('Contexto GitHub obrigatório');
    const result = publishChangesets({ report, sha, stale: stale === '1',
      api: githubApi(repository, workspace) });
    const versionPrUrl = prNumber ? `https://github.com/${repository}/pull/${prNumber}` : '';
    if (output) appendFileSync(output, [
      `version=${result.version}`, `tag=${result.tag}`, `published_sha=${result.publishedSha}`,
      `release_url=${result.releaseUrl}`, `outcome=${result.outcome}`,
      `version_pr_url=${versionPrUrl}`, `releases_json=${JSON.stringify(result.releases)}`, '',
    ].join('\n'));
    if (summary) appendFileSync(summary,
      `### Changesets: ${result.outcome}\n${result.releases.map(item =>
        `- ${item.tag}: ${item.release_url}`).join('\n')}\n`);
    process.stdout.write(`${result.outcome}: ${result.releases.map(item => item.tag).join(', ')}\n`);
  } catch (error) {
    console.error(error.message);
    process.exitCode = 1;
  }
}
