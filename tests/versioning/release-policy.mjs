import assert from 'node:assert/strict';
import { evaluateReleasePolicy } from '../../scripts/versioning/release-policy.mjs';

const sha = 'a'.repeat(40);
const report = { baseVersion: '1.2.3', candidateVersion: '2.0.0', bump: 'major', sha };
const emptyOverride = {
  labelPresent: false, labeledBy: null, labeledAt: null, labelerRole: null,
  approvalBy: null, approvedAt: null, approverRole: null, reviewedCommitSha: null,
};
const snapshot = (milestone, override = emptyOverride) => ({ headSha: sha, milestone, override });
const validOverride = {
  labelPresent: true, labeledBy: 'maintainer-one', labeledAt: '2026-10-01T10:00:00Z',
  labelerRole: 'maintain', approvalBy: 'maintainer-two', approvedAt: '2026-10-01T10:01:00Z',
  approverRole: 'admin', reviewedCommitSha: sha,
};

let assertions = 0;
const outcome = (milestone, expected, override) => {
  const decision = evaluateReleasePolicy({ report, snapshot: snapshot(milestone, override) });
  assertions += 1; assert.equal(decision.outcome, expected, decision.reasons.join('; '));
  return decision;
};

const authoritative = outcome(null, 'adapter-authoritative');
assertions += 4;
assert.equal(authoritative.plannedVersion, null);
assert.equal(authoritative.plannedBump, null);
assert.equal(authoritative.calculatedVersion, '2.0.0');
assert.equal(authoritative.calculatedBump, 'major');
const matched = outcome({ title: 'v2.0.0' }, 'matched');
assertions += 2;
assert.equal(matched.plannedVersion, '2.0.0');
assert.equal(matched.plannedBump, 'major');

const invalid = outcome({ title: 'release-2' }, 'blocked');
assertions += 1; assert.match(invalid.reasons.join(' '), /vMAJOR\.MINOR\.PATCH/);
const invalidWithOverride = outcome({ title: 'release-2' }, 'blocked', validOverride);
assertions += 2;
assert.match(invalidWithOverride.reasons.join(' '), /milestone inválida: release-2/);
assert.match(invalidWithOverride.reasons.join(' '), /esperado vMAJOR\.MINOR\.PATCH/);
const exactMismatch = outcome({ title: 'v3.0.0' }, 'blocked');
assertions += 1; assert.match(exactMismatch.reasons.join(' '), /planejada 3\.0\.0.*calculada 2\.0\.0/);
const bumpMismatchReport = { ...report, candidateVersion: '1.3.0', bump: 'patch' };
const bumpMismatch = evaluateReleasePolicy({ report: bumpMismatchReport,
  snapshot: snapshot({ title: 'v1.3.0' }) });
assertions += 2;
assert.equal(bumpMismatch.outcome, 'blocked');
assert.match(bumpMismatch.reasons.join(' '), /incremento planejado minor.*calculado patch/);

const overridden = outcome({ title: 'v3.0.0' }, 'overridden', validOverride);
assertions += 8;
assert.equal(overridden.plannedVersion, '3.0.0');
assert.equal(overridden.calculatedVersion, '2.0.0');
assert.equal(overridden.plannedBump, 'major');
assert.equal(overridden.calculatedBump, 'major');
assert.equal(overridden.audit.labeler, 'maintainer-one');
assert.equal(overridden.audit.approver, 'maintainer-two');
assert.equal(overridden.audit.labeledAt, validOverride.labeledAt);
assert.equal(overridden.audit.approvedAt, validOverride.approvedAt);

outcome({ title: 'v3.0.0' }, 'blocked', { ...validOverride, labelPresent: false });
outcome({ title: 'v3.0.0' }, 'blocked', { ...validOverride, labelerRole: 'triage' });
outcome({ title: 'v3.0.0' }, 'blocked', { ...validOverride, approverRole: 'write' });
outcome({ title: 'v3.0.0' }, 'blocked', { ...validOverride, approvalBy: 'maintainer-one' });
outcome({ title: 'v3.0.0' }, 'blocked', { ...validOverride,
  approvedAt: '2026-10-01T09:59:00Z' });
outcome({ title: 'v3.0.0' }, 'blocked', { ...validOverride, approvedAt: 'not-a-date' });
outcome({ title: 'v3.0.0' }, 'blocked', { ...validOverride, reviewedCommitSha: 'b'.repeat(40) });
outcome({ title: 'v3.0.0' }, 'blocked', { ...validOverride, labeledAt: null });

console.log(`Release policy: ${assertions} assertions passed`);
