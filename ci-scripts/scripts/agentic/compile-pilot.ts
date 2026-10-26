import * as fs from 'node:fs';
import * as path from 'node:path';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { CGhAwPilot, GH_AW_REF, GH_AW_VERSION, normalized } from './CGhAwPilot.js';

// Checksums publicados na release fixada, verificados antes de executar o binário.
const ASSETS: Record<string, { name: string; hash: string }> = {
  'win32-x64': { name: 'windows-amd64.exe', hash: 'e1661fa10956ed969c33b9208790b2857148699dd5f9ab97a149c605bdfb2eb6' },
  'linux-x64': { name: 'linux-amd64', hash: 'a7b06bffaf7c24f713d10ec0a865514b764e62af639b13df953a480d74e8a8de' },
};

try {
  const ROOT = execFileSync('git', ['rev-parse', '--show-toplevel'], { encoding: 'utf8' }).trim();
  const CHECK = process.argv.includes('--check');
  CGhAwPilot.generate(ROOT, undefined, CHECK);
  const ASSET = ASSETS[`${process.platform}-${process.arch}`];
  if (!ASSET) throw new Error('Compilador homologado somente para Windows/Linux x64.');
  const DIRECTORY = path.join(ROOT, 'ci-scripts/tmp-gh-aw');
  fs.mkdirSync(DIRECTORY, { recursive: true });
  const BINARY = path.join(DIRECTORY, process.platform === 'win32' ? 'gh-aw.exe' : 'gh-aw');
  if (!fs.existsSync(BINARY)) {
    const RESPONSE = await fetch(`https://github.com/github/gh-aw/releases/download/v${GH_AW_VERSION}/${ASSET.name}`, { signal: AbortSignal.timeout(90000) });
    if (!RESPONSE.ok) throw new Error(`Download gh-aw falhou: HTTP ${RESPONSE.status}.`);
    const DATA = Buffer.from(await RESPONSE.arrayBuffer());
    if (createHash('sha256').update(DATA).digest('hex') !== ASSET.hash) throw new Error('Checksum do compilador inválido.');
    fs.writeFileSync(BINARY, DATA, { mode: 0o755 });
  }
  if (createHash('sha256').update(fs.readFileSync(BINARY)).digest('hex') !== ASSET.hash) throw new Error('Checksum do compilador inválido.');
  const LOCKS = ['triage', 'review'].map(NAME => path.join(ROOT, `.github/workflows/agentic-${NAME}.lock.yml`));
  const PREVIOUS = CHECK ? LOCKS.map(FILE => normalized(fs.readFileSync(FILE, 'utf8'))) : [];
  execFileSync(BINARY, ['compile', 'agentic-triage', 'agentic-review', '--action-mode', 'release', '--action-tag', GH_AW_REF, '--strict', '--validate', '--no-check-update'], { cwd: ROOT, stdio: 'inherit', timeout: 180000 });
  if (CHECK) LOCKS.forEach((FILE, INDEX) => {
    if (normalized(fs.readFileSync(FILE, 'utf8')) !== PREVIOUS[INDEX]) throw new Error(`Lock compilado divergente: ${path.basename(FILE)}`);
  });
  console.log(`gh-aw ${GH_AW_VERSION}: fontes e locks ${CHECK ? 'reproduzidos' : 'gerados'}. Nenhuma inferência executada.`);
} catch (ERROR) { console.error(ERROR instanceof Error ? ERROR.message : 'Falha ao compilar piloto.'); process.exitCode = 1; }
