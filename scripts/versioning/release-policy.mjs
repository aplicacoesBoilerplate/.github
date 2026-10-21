import { readFileSync, writeFileSync } from 'node:fs';
import { evaluateReleasePolicy } from './dist/services/release-policy.js';

export { evaluateReleasePolicy };

if (process.argv[1] && import.meta.filename === process.argv[1]) {
  try {
    const [command, inputPath, outputPath] = process.argv.slice(2);
    if (command !== 'evaluate' || !inputPath || !outputPath) {
      throw new Error('Uso: release-policy.mjs evaluate <input.json> <output.json>');
    }
    const decision = evaluateReleasePolicy(JSON.parse(readFileSync(inputPath, 'utf8')));
    writeFileSync(outputPath, `${JSON.stringify(decision, null, 2)}\n`);
  } catch (error) {
    console.error(error.message);
    process.exitCode = 1;
  }
}
