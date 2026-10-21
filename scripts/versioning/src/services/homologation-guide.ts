import { validateReleasePlan, type ReleaseEntry } from '../adapter-contract.js';

type JsonRecord = Record<string, unknown>;

function record(value: unknown, name: string): JsonRecord {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error(`${name} inválido`);
  return value as JsonRecord;
}

function text(value: unknown): string { return String(value ?? ''); }

function markdownText(value: unknown): string {
  return text(value).replace(/javascript:/gi, 'javascript&#58;')
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/([\\`*_{}[\]()#+.!|~-])/g, '\\$1');
}

function codeText(value: unknown): string {
  return text(value).replace(/`/g, '\\`').replace(/[\r\n]+/g, ' ');
}

function array(value: unknown, name: string): unknown[] {
  if (value === undefined) return [];
  if (!Array.isArray(value)) throw new Error(`${name} deve ser array`);
  return value;
}

export function buildHomologationGuide(reportInput: unknown, snapshotInput: unknown): {
  guide: JsonRecord; markdown: string;
} {
  const source = record(reportInput, 'Relatório');
  const isPlan = Object.hasOwn(source, 'planDigest');
  const plan = isPlan ? validateReleasePlan(reportInput) : null;
  const report = plan ? record(plan.report, 'Relatório nativo') : source;
  const snapshot = record(snapshotInput, 'Snapshot do pull request');
  if (typeof snapshot.repository !== 'string' || !Number.isInteger(snapshot.number) ||
    (snapshot.number as number) <= 0) throw new Error('Snapshot sem repositório ou pull request');
  const sha = plan?.sha ?? report.sha;
  if (snapshot.headSha !== sha) throw new Error('Snapshot e relatório possuem SHAs diferentes');
  const changes = array(snapshot.changes, 'changes').map(text);
  const checks = array(snapshot.checks, 'checks').map(item => {
    const check = record(item, 'Check');
    return { name: text(check.name), status: text(check.status),
      conclusion: check.conclusion == null ? null : text(check.conclusion) };
  });
  const suggestedChecks = array(snapshot.suggestedChecks, 'suggestedChecks').map(item => {
    const check = record(item, 'Checklist');
    return { id: text(check.id), description: text(check.description), status: 'pending' as const };
  });
  const native = record(report.native, 'Relatório nativo');
  const releases = plan ? plan.entries.map((entry: ReleaseEntry) => ({
    package: entry.package, projectPath: entry.projectPath, baseVersion: entry.baseVersion,
    version: entry.version, bump: entry.bump, tag: entry.tag, notes: entry.notes,
  })) : report.adapter === 'changesets' ? array(report.releases, 'releases') : [];
  const batch = plan ? plan.entries.length > 1 : report.adapter === 'changesets' && releases.length > 1;
  const noRelease = plan?.status === 'no-release';
  const facts: JsonRecord = {
    repository: snapshot.repository, pullRequest: snapshot.number, sha,
    candidateVersion: batch || noRelease ? null : plan ? plan.entries[0]?.version : report.candidateVersion,
    bump: batch || noRelease ? null : plan ? plan.entries[0]?.bump : report.bump,
    releases, nativeExplanation: native.explanation, changes, checks,
  };
  if (plan) facts.status = plan.status;
  const propertiesEvidence = native.format === 'java-properties';
  if (propertiesEvidence) facts.nativeEvidence = {
    format: 'java-properties', properties: native.result,
    explanation: { kind: 'derived', text: native.explanation },
  };
  const lines = [
    '# Homologation guide', '',
    `- Repository: \`${codeText(facts.repository)}\``,
    `- Pull request: \`${facts.pullRequest}\``,
    `- SHA: \`${codeText(sha)}\``,
    ...(noRelease ? ['- No release planned'] : batch ? ['- Package releases:',
      ...releases.map(item => {
        const release = record(item, 'Release');
        return `  - \`${codeText(release.tag)}\` (${codeText(release.bump)})`;
      })] : [
      `- Candidate version: \`${codeText(facts.candidateVersion)}\``,
      `- Increment: \`${codeText(facts.bump)}\``,
    ]), '',
    ...(propertiesEvidence ? ['## Native jgitver properties', '',
      ...Object.entries(record(native.result, 'Propriedades nativas')).map(([key, value]) =>
        `- ${markdownText(key)}: ${markdownText(value)}`), '',
      '## Derived adapter explanation', ''] : ['## Native adapter explanation', '']),
    markdownText(native.explanation), '',
    ...(plan && releases.length ? ['## Native release notes', '',
      ...releases.map(item => {
        const release = record(item, 'Release');
        return `- \`${codeText(release.tag)}\`: ${markdownText(release.notes)}`;
      }), ''] : []),
    '## Delivered changes', '',
    ...(changes.length ? changes.map(change => `- ${markdownText(change)}`) : ['- No changes collected.']),
    '', '## Known CI checks', '',
    ...(checks.length ? checks.map(check =>
      `- ${markdownText(check.name)}: ${markdownText(check.status)} / ${markdownText(check.conclusion ?? 'pending')}`)
      : ['- No check results collected.']),
    '', '## Suggested checks (pending)', '',
    ...(suggestedChecks.length ? suggestedChecks.map(item =>
      `- [ ] ${markdownText(item.description)} (\`${codeText(item.id)}\`)`)
      : ['- No suggested checks.']), '',
  ];
  return { guide: { schemaVersion: 1, facts, suggestedChecks }, markdown: lines.join('\n') };
}
