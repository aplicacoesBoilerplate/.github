import { bumpBetween } from '../adapter-contract.js';
const authorizedRoles = new Set(['maintain', 'admin']);
const strictMilestone = /^v(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)$/;
const stableVersion = /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)$/;
const shaPattern = /^[0-9a-f]{40}$/i;
function object(value) {
    return value !== null && typeof value === 'object' && !Array.isArray(value)
        ? value : {};
}
function stringOrNull(value) {
    return typeof value === 'string' ? value : null;
}
function auditFrom(input) {
    const override = object(input);
    return {
        labeler: stringOrNull(override.labeledBy),
        labelerRole: stringOrNull(override.labelerRole),
        approver: stringOrNull(override.approvalBy),
        approverRole: stringOrNull(override.approverRole),
        labeledAt: stringOrNull(override.labeledAt),
        approvedAt: stringOrNull(override.approvedAt),
    };
}
function validOverride(input, currentSha, reasons) {
    const override = object(input);
    if (!override.labelPresent) {
        reasons.push('label versioning:override ausente');
        return false;
    }
    if (!override.labeledAt || !override.labeledBy || !authorizedRoles.has(String(override.labelerRole))) {
        reasons.push(`autor do label sem papel Maintain/Admin: ${override.labeledBy ?? '<ausente>'} (papel atual: ${override.labelerRole ?? '<ausente>'})`);
        return false;
    }
    if (!override.approvedAt || !override.approvalBy || !authorizedRoles.has(String(override.approverRole))) {
        reasons.push(`aprovação posterior por Maintain/Admin ausente: ${override.approvalBy ?? '<ausente>'}`);
        return false;
    }
    if (override.labeledBy === override.approvalBy) {
        reasons.push('autor do label e aprovador devem ser pessoas distintas');
        return false;
    }
    const labeledTime = Date.parse(String(override.labeledAt));
    const approvedTime = Date.parse(String(override.approvedAt));
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
export function evaluateReleasePolicy(input) {
    const values = object(input);
    const report = object(values.report);
    const snapshot = object(values.snapshot);
    const phase = values.phase ?? 'preview';
    if (!values.report || !values.snapshot)
        throw new Error('Relatório e snapshot são obrigatórios');
    if (phase !== 'preview' && phase !== 'publication')
        throw new Error('Fase de avaliação inválida');
    if (phase === 'publication' && (!snapshot.mergedAt || !snapshot.mergeCommitSha || !snapshot.headSha)) {
        throw new Error('PR integrado obrigatório para publicação');
    }
    if (typeof report.sha !== 'string' || !shaPattern.test(report.sha) ||
        typeof snapshot.headSha !== 'string' || !shaPattern.test(snapshot.headSha) ||
        (phase === 'publication' && (typeof snapshot.mergeCommitSha !== 'string' ||
            !shaPattern.test(snapshot.mergeCommitSha)))) {
        throw new Error('SHA da policy inválido');
    }
    const calculatedSha = phase === 'publication' ? snapshot.mergeCommitSha : snapshot.headSha;
    if (calculatedSha !== report.sha)
        throw new Error('Snapshot não corresponde ao SHA calculado');
    if (typeof report.candidateVersion !== 'string' || !stableVersion.test(report.candidateVersion) ||
        typeof report.baseVersion !== 'string' || !stableVersion.test(report.baseVersion) ||
        typeof report.bump !== 'string' || !['none', 'patch', 'minor', 'major'].includes(report.bump)) {
        throw new Error('Versão ou incremento calculado inválido');
    }
    const decision = {
        outcome: 'blocked', plannedVersion: null, calculatedVersion: report.candidateVersion,
        plannedBump: null, calculatedBump: report.bump, reasons: [], audit: auditFrom(snapshot.override),
    };
    if (!snapshot.milestone) {
        decision.outcome = 'adapter-authoritative';
        decision.reasons.push('milestone ausente; adaptador é autoritativo');
        return decision;
    }
    if (report.adapter === 'changesets' && Array.isArray(report.releases) && report.releases.length > 1) {
        decision.reasons.push('milestone única não representa o lote Changesets com múltiplos pacotes; remova a milestone e revise o PR técnico');
        return decision;
    }
    const title = String(object(snapshot.milestone).title ?? '');
    if (!strictMilestone.test(title)) {
        decision.reasons.push(`milestone inválida: ${title}; esperado vMAJOR.MINOR.PATCH`);
        return decision;
    }
    decision.plannedVersion = title.slice(1);
    if (typeof report.baseVersion !== 'string')
        throw new Error('Versão base inválida');
    decision.plannedBump = bumpBetween(report.baseVersion, decision.plannedVersion);
    if (decision.plannedVersion !== report.candidateVersion) {
        decision.reasons.push(`versão planejada ${decision.plannedVersion} diverge da calculada ${report.candidateVersion}`);
    }
    if (decision.plannedBump !== report.bump) {
        decision.reasons.push(`incremento planejado ${decision.plannedBump} diverge do calculado ${report.bump}`);
    }
    if (decision.reasons.length === 0) {
        decision.outcome = 'matched';
        decision.reasons.push('milestone corresponde à versão e ao incremento calculados');
        return decision;
    }
    const policyReasons = [...decision.reasons];
    if (validOverride(snapshot.override, String(snapshot.headSha), decision.reasons)) {
        decision.outcome = 'overridden';
        decision.reasons = [...policyReasons, 'divergência autorizada por override auditável'];
    }
    return decision;
}
