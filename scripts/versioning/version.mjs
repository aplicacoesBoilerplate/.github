import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';

const [command, ...args] = process.argv.slice(2);
const semver = /^(?:v)?(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)(?:-([0-9A-Za-z.-]+))?$/;
const parseVersion = (value) => {
  const match = semver.exec(value.trim());
  if (!match) throw Error(`Versão semântica inválida: ${value}`);
  return match.slice(1, 4).map(Number);
};
const rank = { none: 0, patch: 1, minor: 2, major: 3 };
const bumpFrom = (before, after) => {
  const a = parseVersion(before), b = parseVersion(after);
  if (b[0] < a[0]) return 'none';
  if (b[0] > a[0]) return 'major';
  if (b[1] < a[1]) return 'none';
  if (b[1] > a[1]) return 'minor';
  if (b[2] < a[2]) return 'none';
  if (b[2] > a[2]) return 'patch';
  return 'none';
};
const increment = (value, kind) => {
  const [major, minor, patch] = parseVersion(value);
  if (kind === 'major') return `${major + 1}.0.0`;
  if (kind === 'minor') return `${major}.${minor + 1}.0`;
  if (kind === 'patch') return `${major}.${minor}.${patch + 1}`;
  return `${major}.${minor}.${patch}`;
};

try {
  if (command === 'event') {
    const event = JSON.parse(readFileSync(args[0], 'utf8'));
    const pr = event.pull_request;
    const [, releaseBranch, targetBranch] = args;
    if (!pr || !Number.isInteger(pr.number) || !pr.base?.ref || !pr.head?.ref || !pr.head?.sha) {
      throw Error('Evento pull_request inválido');
    }
    const base = pr.base.ref, head = pr.head.ref, body = pr.body ?? '';
    let phase;
    if (head.startsWith('feature/') && base === releaseBranch) phase = 'feature-to-release';
    else if (head === releaseBranch && base === 'develop') phase = 'release-to-develop';
    else if (head === 'develop' && base === targetBranch) phase = 'develop-to-main';
    else if (head.startsWith('versioning/') && base === targetBranch) phase = 'version-pr';
    else throw Error(`Transição de PR não suportada: ${head} → ${base}`);
    const issueMatch = /(?:^|\s)(?:Refs|Fixes|Closes|Resolves)\s+#([1-9]\d*)\b/im.exec(body);
    const epicMatch = /(?:^|\s)(?:Epic|Épica):?\s+#([1-9]\d*)\b/im.exec(body);
    const reference = phase === 'feature-to-release' ? issueMatch : epicMatch ?? issueMatch;
    if (!reference) {
      throw Error(phase === 'feature-to-release'
        ? 'PR de feature deve referenciar sub-issue com Refs #N'
        : 'PR de integração/versionamento deve referenciar a épica com Epic: #N ou Refs #N');
    }
    process.stdout.write(JSON.stringify({ number: pr.number, base, head,
      headSha: pr.head.sha, phase, issue: reference?.[1] ?? null }) + '\n');
  } else if (command === 'analyze') {
    const [base, head, current] = args;
    const log = execFileSync('git', ['log', '--no-merges', '--format=%B%x00', `${base}..${head}`],
      { encoding: 'utf8' });
    const messages = log.split('\0').map(value => value.trim()).filter(Boolean);
    if (messages.length === 0) throw Error('Nenhum commit de entrega encontrado');
    let bump = 'none';
    for (const message of messages) {
      const match = /^(feat|fix|perf|refactor|chore|docs|test|build|ci|revert|release)(?:\([^)]+\))?(!)?: .+/i.exec(message);
      if (!match) throw Error(`Commit sem Conventional Commit: ${message.split('\n')[0]}`);
      const type = match[1].toLowerCase();
      const kind = match[2] || /^BREAKING CHANGE:/m.test(message) ? 'major'
        : type === 'feat' ? 'minor' : ['fix', 'perf', 'revert'].includes(type) ? 'patch' : 'none';
      if (rank[kind] > rank[bump]) bump = kind;
    }
    process.stdout.write(JSON.stringify({ bump, candidate_version: increment(current, bump),
      summary: `${messages.length} commit(s) válidos; incremento ${bump}` }));
  } else if (command === 'changesets') {
    const data = JSON.parse(readFileSync(args[0], 'utf8'));
    const release = data.releases?.find(item => item.name === args[1]);
    if (!release) throw Error(`Nenhuma release Changesets prevista para ${args[1]}`);
    parseVersion(release.newVersion);
    if (!(release.type in rank)) throw Error('Tipo de incremento Changesets desconhecido');
    process.stdout.write(JSON.stringify({ bump: release.type,
      candidate_version: release.newVersion,
      summary: `Changesets: ${args[1]} → ${release.newVersion}` }));
  } else if (command === 'standard') {
    const matches = [...args[0].matchAll(/bumping version in [^\r\n]+? from \S+ to (\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?)/gi)];
    if (!matches.length) throw Error('Dry-run standard-version sem versão calculada; confira configuração e commits');
    const candidate = matches[0][1];
    process.stdout.write(JSON.stringify({ bump: bumpFrom(args[1], candidate),
      candidate_version: candidate, summary: `standard-version: ${args[1]} → ${candidate}` }));
  } else if (command === 'compare') {
    process.stdout.write(bumpFrom(args[0], args[1]));
  } else if (command === 'stable') {
    parseVersion(args[0]);
    if (args[0].includes('-')) throw Error('Release requer versão estável (sem prerelease)');
    process.stdout.write(args[0].replace(/^v/, ''));
  } else if (command === 'version') {
    parseVersion(args[0]);
    process.stdout.write(args[0].replace(/^v/, ''));
  } else {
    throw Error(`Subcomando desconhecido: ${command}`);
  }
} catch (error) {
  console.error(error.message);
  process.exitCode = 1;
}
