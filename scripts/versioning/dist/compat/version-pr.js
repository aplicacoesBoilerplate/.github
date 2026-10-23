import { readFileSync } from 'node:fs';
import { parseVersionPr, validateHumanReview, verifyVersionFiles, changedVersionFiles } from '../services/standard-version-files.js';
import { argument } from './cli.js';
export { parseVersionPr, validateHumanReview, verifyVersionFiles };
export function main(args) {
    const command = argument(args, 0), get = (index) => argument(args, index);
    if (command === 'parse')
        process.stdout.write(`${JSON.stringify(parseVersionPr(JSON.parse(readFileSync(get(1), 'utf8')), { targetBranch: get(2), projectPath: get(3), tagPrefix: get(4), adapter: args[5] ?? 'standard-version' }))}\n`);
    else if (command === 'validate-human-review')
        process.stdout.write(`${validateHumanReview(JSON.parse(readFileSync(get(1), 'utf8')), JSON.parse(readFileSync(get(2), 'utf8')))}\n`);
    else if (command === 'verify-files' || command === 'verify-manifests')
        verifyVersionFiles({ repository: get(1),
            projectPath: get(2), version: get(3), ...(args[4] ? { base: args[4] } : {}), ...(args[5] ? { head: args[5] } : {}) });
    else
        throw new Error('Comando version-pr desconhecido');
}
export function verifyFilesMain(args) {
    const get = (index) => argument(args, index);
    if (!['working', 'pr'].includes(get(0)))
        throw new Error('Modo de arquivos inválido');
    process.stdout.write(changedVersionFiles(process.cwd(), get(2), get(1), args[3], args[4]).join('\n'));
}
