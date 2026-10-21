import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { buildHomologationGuide as render } from './dist/services/homologation-guide.js';
import { validateVersionReport } from './version-report.mjs';

export function buildHomologationGuide(reportInput, snapshot) {
  const report = reportInput?.planDigest ? reportInput : validateVersionReport(reportInput);
  return render(report, snapshot);
}

if (process.argv[1] && import.meta.filename === process.argv[1]) {
  try {
    const [reportPath, snapshotPath, outputDirectory] = process.argv.slice(2);
    if (!reportPath || !snapshotPath || !outputDirectory) {
      throw new Error('Uso: homologation-guide.mjs <report.json> <pr-snapshot.json> <output-directory>');
    }
    const report = JSON.parse(readFileSync(reportPath, 'utf8'));
    const snapshot = JSON.parse(readFileSync(snapshotPath, 'utf8'));
    const { guide, markdown } = buildHomologationGuide(report, snapshot);
    mkdirSync(outputDirectory, { recursive: true });
    writeFileSync(join(outputDirectory, 'homologation.json'), `${JSON.stringify(guide, null, 2)}\n`);
    writeFileSync(join(outputDirectory, 'homologation.md'), markdown);
    process.stdout.write(markdown);
  } catch (error) {
    console.error(error.message);
    process.exitCode = 1;
  }
}
