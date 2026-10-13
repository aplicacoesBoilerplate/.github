import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { validateVersionReport } from './version-report.mjs';

function markdownText(value) {
  return String(value ?? '')
    .replace(/javascript:/gi, 'javascript&#58;')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/([\\`*_{}[\]()#+.!|~-])/g, '\\$1');
}

function codeText(value) {
  return String(value ?? '').replace(/`/g, '\\`').replace(/[\r\n]+/g, ' ');
}

function validateSnapshot(snapshot, report) {
  if (!snapshot || typeof snapshot !== 'object') throw new Error('Snapshot do pull request inválido');
  if (typeof snapshot.repository !== 'string' || !Number.isInteger(snapshot.number)) {
    throw new Error('Snapshot sem repositório ou pull request');
  }
  if (snapshot.headSha !== report.sha) throw new Error('Snapshot e relatório possuem SHAs diferentes');
  for (const field of ['changes', 'checks', 'suggestedChecks']) {
    if (snapshot[field] !== undefined && !Array.isArray(snapshot[field])) throw new Error(`${field} deve ser array`);
  }
}

export function buildHomologationGuide(reportInput, snapshot) {
  const report = validateVersionReport(reportInput);
  validateSnapshot(snapshot, report);
  const suggestedChecks = (snapshot.suggestedChecks ?? []).map(item => ({
    id: String(item.id), description: String(item.description), status: 'pending',
  }));
  const guide = {
    schemaVersion: 1,
    facts: {
      repository: snapshot.repository,
      pullRequest: snapshot.number,
      sha: report.sha,
      candidateVersion: report.candidateVersion,
      bump: report.bump,
      nativeExplanation: report.native.explanation,
      changes: (snapshot.changes ?? []).map(String),
      checks: (snapshot.checks ?? []).map(check => ({
        name: String(check.name), status: String(check.status),
        conclusion: check.conclusion == null ? null : String(check.conclusion),
      })),
    },
    suggestedChecks,
  };
  const lines = [
    '# Homologation guide', '',
    `- Repository: \`${codeText(guide.facts.repository)}\``,
    `- Pull request: \`${guide.facts.pullRequest}\``,
    `- SHA: \`${codeText(guide.facts.sha)}\``,
    `- Candidate version: \`${codeText(guide.facts.candidateVersion)}\``,
    `- Increment: \`${codeText(guide.facts.bump)}\``, '',
    '## Native adapter explanation', '', markdownText(guide.facts.nativeExplanation), '',
    '## Delivered changes', '',
    ...(guide.facts.changes.length ? guide.facts.changes.map(change => `- ${markdownText(change)}`) : ['- No changes collected.']),
    '', '## Known CI checks', '',
    ...(guide.facts.checks.length ? guide.facts.checks.map(check =>
      `- ${markdownText(check.name)}: ${markdownText(check.status)} / ${markdownText(check.conclusion ?? 'pending')}`)
      : ['- No check results collected.']),
    '', '## Suggested checks (pending)', '',
    ...(guide.suggestedChecks.length ? guide.suggestedChecks.map(item =>
      `- [ ] ${markdownText(item.description)} (\`${codeText(item.id)}\`)`) : ['- No suggested checks.']), '',
  ];
  return { guide, markdown: lines.join('\n') };
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
