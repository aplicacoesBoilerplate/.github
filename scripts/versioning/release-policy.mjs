import { readFileSync, writeFileSync } from 'node:fs';
import { bumpBetween, parseStableVersion } from './version-report.mjs';

const authorizedRoles = new Set(['maintain', 'admin']);
const strictMilestone = /^v(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)$/;

function auditFrom(override = {}) {
  return {
    labeler: override.labeledBy ?? null,
    approver: override.approvalBy ?? null,
    labeledAt: override.labeledAt ?? null,
    approvedAt: override.approvedAt ?? null,
  };
}

function validOverride(override, currentSha, reasons) {
  if (!override?.labelPresent) { reasons.push('label versioning:override ausente'); return false; }
  if (!override.labeledAt || !override.labeledBy || !authorizedRoles.has(override.labelerRole)) {
    reasons.push(`autor do label sem papel Maintain/Admin: ${override.labeledBy ?? '<ausente>'}`);
    return false;
  }
  if (!override.approvedAt || !override.approvalBy || !authorizedRoles.has(override.approverRole)) {
    reasons.push(`aprovação posterior por Maintain/Admin ausente: ${override.approvalBy ?? '<ausente>'}`);
    return false;
  }
  if (override.labeledBy === override.approvalBy) {
    reasons.push('autor do label e aprovador devem ser pessoas distintas');
    return false;
  }
  const labeledTime = Date.parse(override.labeledAt);
  const approvedTime = Date.parse(override.approvedAt);
  if (!Number.isFinite(labeledTime) || !Number.isFinite(approvedTime) || approvedTime <= labeledTime) {
    reasons.push('aprovação deve ocorrer depois do label');
    return false;
  }
  if (override.reviewedCommitSha !== currentSha) {
    reasons.push('aprovação não corresponde ao SHA atual');
    return false;
  }
  return true;
}

export function evaluateReleasePolicy({ report, snapshot }) {
  if (!report || !snapshot) throw new Error('Relatório e snapshot são obrigatórios');
  if (snapshot.headSha !== report.sha) throw new Error('Snapshot não corresponde ao SHA calculado');
  const decision = {
    outcome: 'blocked',
    plannedVersion: null,
    calculatedVersion: report.candidateVersion,
    plannedBump: null,
    calculatedBump: report.bump,
    reasons: [],
    audit: auditFrom(snapshot.override),
  };
  if (!snapshot.milestone) {
    decision.outcome = 'adapter-authoritative';
    decision.reasons.push('milestone ausente; adaptador é autoritativo');
    return decision;
  }

  const title = String(snapshot.milestone.title ?? '');
  const match = strictMilestone.exec(title);
  if (!match) {
    decision.reasons.push(`milestone inválida: ${title}; esperado vMAJOR.MINOR.PATCH`);
  } else {
    decision.plannedVersion = parseStableVersion(title).text;
    decision.plannedBump = bumpBetween(report.baseVersion, decision.plannedVersion);
    if (decision.plannedVersion !== report.candidateVersion) {
      decision.reasons.push(`versão planejada ${decision.plannedVersion} diverge da calculada ${report.candidateVersion}`);
    }
    if (decision.plannedBump !== report.bump) {
      decision.reasons.push(`incremento planejado ${decision.plannedBump} diverge do calculado ${report.bump}`);
    }
  }

  if (decision.reasons.length === 0) {
    decision.outcome = 'matched';
    decision.reasons.push('milestone corresponde à versão e ao incremento calculados');
    return decision;
  }
  const policyReasons = [...decision.reasons];
  if (validOverride(snapshot.override, report.sha, decision.reasons)) {
    decision.outcome = 'overridden';
    decision.reasons = [...policyReasons, 'divergência autorizada por override auditável'];
  }
  return decision;
}

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
