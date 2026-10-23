import { readFileSync } from 'node:fs';
import { parseVersionPr, validateHumanReview, verifyVersionFiles, changedVersionFiles,
  type LegacyPr, type LegacyReview } from '../services/standard-version-files.js';
import { argument } from './cli.js';
export { parseVersionPr, validateHumanReview, verifyVersionFiles };
export function main(args: readonly string[]): void {
  const command = argument(args, 0), get = (index: number) => argument(args, index);
  if (command === 'parse') process.stdout.write(`${JSON.stringify(parseVersionPr(JSON.parse(readFileSync(get(1), 'utf8')) as LegacyPr,
    { targetBranch: get(2), projectPath: get(3), tagPrefix: get(4), adapter: args[5] ?? 'standard-version' }))}\n`);
  else if (command === 'validate-human-review') process.stdout.write(`${validateHumanReview(JSON.parse(readFileSync(get(1), 'utf8')) as LegacyPr,
    JSON.parse(readFileSync(get(2), 'utf8')) as LegacyReview[][])}\n`);
  else if (command === 'verify-files' || command === 'verify-manifests') verifyVersionFiles({ repository: get(1),
    projectPath: get(2), version: get(3), ...(args[4] ? { base: args[4] } : {}), ...(args[5] ? { head: args[5] } : {}) });
  else throw new Error('Comando version-pr desconhecido');
}
export function verifyFilesMain(args: readonly string[]): void {
  const get = (index: number) => argument(args, index);
  if (!['working', 'pr'].includes(get(0))) throw new Error('Modo de arquivos inválido');
  process.stdout.write(changedVersionFiles(process.cwd(), get(2), get(1), args[3], args[4]).join('\n'));
}
