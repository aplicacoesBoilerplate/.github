import { execFileSync } from 'node:child_process';

const [mode, adapter, projectPath, base, head] = process.argv.slice(2);
const prefix = projectPath === '.' ? '' : `${projectPath.replace(/^\.\//, '').replace(/\/$/, '')}/`;
const files = mode === 'working'
  ? execFileSync('git', ['status', '--porcelain', '-z', '--untracked-files=all'], { encoding: 'utf8' })
    .split('\0').filter(Boolean).map(row => row.slice(3))
    .filter(file => file !== '.shared-versioning/' && !file.startsWith('.shared-versioning/'))
  : execFileSync('git', ['diff', '--name-only', `${base}...${head}`], { encoding: 'utf8' })
    .split('\n').filter(Boolean);
if (!files.length) throw Error('PR de versionamento sem arquivos alterados');
const packageFiles = ['package.json', 'package-lock.json', 'npm-shrinkwrap.json',
  'pnpm-lock.yaml', 'yarn.lock', 'CHANGELOG.md'];
const allowed = (file) => {
  if (packageFiles.some(name => file === `${prefix}${name}`)) return true;
  if (['pnpm-lock.yaml', 'yarn.lock', 'package-lock.json'].includes(file)) return true;
  if (adapter === 'changesets' && /^\.changeset\/[A-Za-z0-9_.-]+\.md$/.test(file)) return true;
  return false;
};
const invalid = files.filter(file => !allowed(file));
if (invalid.length) throw Error(`PR de versionamento contém arquivos não permitidos: ${invalid.join(', ')}`);
if (!files.includes(`${prefix}package.json`)) throw Error('PR de versionamento não altera o package.json selecionado');
process.stdout.write(files.join('\n'));
