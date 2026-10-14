import { createHash } from 'node:crypto';
import { validateEnvelope, validatePatch } from '../llm/result.mjs';
import { contractError } from '../llm/validate-request.mjs';
import { validateTriageConfig } from './policy.mjs';
import { readPreparedProposal } from './prepare-patch.mjs';

const digest = value => createHash('sha256').update(value).digest('hex');
const fail = code => { throw contractError(code); };
const conflict = () => fail('TRIAGE_RESOURCE_CONFLICT');
const bodyHash = /^<!-- triage-body-sha256:([a-f0-9]{64}) -->\n/;
const seal = text => `<!-- triage-body-sha256:${digest(text)} -->\n${text}`;
const intact = body => typeof body === 'string' && bodyHash.test(body) && body.match(bodyHash)[1] === digest(body.replace(bodyHash, ''));
const safeSummary = text => text.replace(/\b(?:close[sd]?|fix(?:es|ed)?|resolve[sd]?)\b/gi, word => `${word[0]}\u200b${word.slice(1)}`);

export async function publishTriage(input, api) {
  try { return await publish(input, api); }
  catch (error) {
    const codes = ['INVALID_TRIAGE_CONFIG', 'INVALID_TRIAGE_INPUT', 'INVALID_RESULT', 'INVALID_TRIAGE_PATCH',
      'INVALID_TRIAGE_VERIFICATION', 'STALE_TRIAGE_INPUT', 'TRIAGE_RESOURCE_CONFLICT'];
    throw contractError(codes.includes(error.code) ? error.code : 'TRIAGE_PUBLISH_FAILED');
  }
}

/** Domain gateway; its API never runs product code or inference. Workflow serializes by issue. */
async function publish({ snapshot, result, prepared, verification, config }, api) {
  const policy = validateTriageConfig(config);
  const repo = snapshot.repository; const issue = snapshot.issue?.number; const route = snapshot.route?.route;
  if (!/^[a-zA-Z0-9][a-zA-Z0-9-]*\/[a-zA-Z0-9_.-]+$/.test(repo ?? '') || !Number.isSafeInteger(issue) || issue < 1
    || !['plan', 'propose-patch', 'needs-human'].includes(route) || !/^[a-f0-9]{64}$/.test(snapshot.fingerprint ?? '')) fail('INVALID_TRIAGE_INPUT');
  if (route !== 'needs-human') {
    if (!result?.envelope || !result.expected) fail('INVALID_RESULT');
    validateEnvelope(result.envelope, result.expected);
    if (result.envelope.schema_version !== 2 || result.envelope.repository !== repo || result.envelope.source_sha !== snapshot.source_sha
      || result.envelope.config_source_sha !== snapshot.config_source_sha || result.envelope.status !== 'succeeded') fail('INVALID_RESULT');
    if (route === 'plan' && (result.patch !== null || result.envelope.patch_file !== null)) fail('INVALID_RESULT');
  }
  const patch = route === 'propose-patch' && prepared && result.patch && result.envelope.patch_file === 'proposal.patch';
  let proposal;
  if (patch) {
    validatePatch(result.patch);
    if (!verification || !['passed', 'failed'].includes(verification.status) || verification.source_sha !== snapshot.source_sha
      || verification.config_source_sha !== snapshot.config_source_sha || verification.patch_sha256 !== digest(result.patch)) fail('INVALID_TRIAGE_VERIFICATION');
    proposal = await readPreparedProposal(prepared);
    if (proposal.base_sha !== snapshot.source_sha || proposal.patch_sha256 !== digest(result.patch)
      || proposal.changes.some(change => !policy.allowed_paths.some(p => change.path === p || change.path.startsWith(`${p}/`)))) fail('INVALID_TRIAGE_PATCH');
    if (!snapshot.base_ref || !snapshot.metadata?.milestone?.number) fail('INVALID_TRIAGE_INPUT');
  }
  async function current() {
    const latest = await api.recollect();
    if (latest.repository !== repo || latest.issue?.number !== issue || latest.issue?.state !== 'open'
      || latest.fingerprint !== snapshot.fingerprint || latest.source_sha !== snapshot.source_sha
      || latest.config_source_sha !== snapshot.config_source_sha || latest.base_ref !== snapshot.base_ref
      || latest.route?.route !== route) fail('STALE_TRIAGE_INPUT');
  }
  // No privileged operation starts until the input and the writer are independently verified.
  await current();
  const identity = await api.getIdentity();
  if (!Number.isSafeInteger(identity?.id) || identity.id < 1 || !/^[a-zA-Z0-9][a-zA-Z0-9-]*(?:\[bot\])?$/.test(identity.login ?? '')
    || identity.login.toLowerCase() === policy.reviewer.toLowerCase()) fail('TRIAGE_PUBLISH_FAILED');
  const own = value => value?.user?.id === identity.id && value.user.login?.toLowerCase() === identity.login.toLowerCase();
  const marker = `<!-- triage:v1:${repo}:${issue} -->`;
  const provenance = `Entrada: ${snapshot.fingerprint}\nBase: ${snapshot.source_sha}\nConfiguração: ${snapshot.config_source_sha}`;

  async function reconcile(create, recover) {
    await current();
    try { return await create(); }
    catch (error) {
      const found = await recover();
      if (found) return found;
      fail(error.code === 'TRIAGE_RESOURCE_CONFLICT' ? error.code : 'TRIAGE_PUBLISH_FAILED');
    }
  }
  async function comment(text) {
    const body = seal(`${marker}\n${text}\n\n${provenance}\n`);
    const find = async () => {
      const found = (await api.listComments(repo, issue)).filter(c => own(c) && c.body?.includes(marker));
      if (found.length > 1 || found.some(c => !intact(c.body))) conflict(); return found[0];
    };
    let existing = await find();
    if (existing) {
      if (existing.body !== body) {
        const reread = await api.getComment(repo, existing.id);
        if (!own(reread) || reread.body !== existing.body) conflict();
        existing = await reconcile(() => api.updateComment(repo, existing.id, body), async () => {
          const recovered = await find(); return recovered?.body === body ? recovered : null;
        });
      }
    } else existing = await reconcile(() => api.createComment(repo, issue, body), async () => {
      const recovered = await find(); return recovered?.body === body ? recovered : null;
    });
    if (!own(existing) || existing.body !== body) fail('TRIAGE_PUBLISH_FAILED');
    return existing.id;
  }

  if (!patch) {
    const status = route === 'plan' ? 'planned' : 'needs-human';
    const text = route === 'plan'
      ? `## Planejamento: rascunho não aprovado\n\n### Contexto\nIssue #${issue}; base ${snapshot.base_ref ?? 'não resolvida'}.\n\n### Necessidade de SDD\n${snapshot.route.reasons.join(', ')}\n\n### Proposta\n${safeSummary(result.envelope.summary)}\n\n### Riscos\nValidar premissas e metadados antes de implementar; esta análise não é aprovação.\n\n### Próximos passos\nRevisar especificação e definir tarefas com o mantenedor.`
      : `## Intervenção necessária: rascunho não aprovado\n\n${snapshot.route.reasons.join(', ')}\n${route === 'propose-patch' ? 'Não há patch aplicável preparado; solicitar nova análise.' : 'Completar ou corrigir os metadados antes de analisar.'}`;
    return { status, route, issue, comment_id: await comment(text), pr_number: null };
  }

  const ref = `feature/triage-issue-${issue}`;
  const message = `Triage proposal for issue #${issue}\n\n${marker}\n${provenance}\nPatch: ${digest(result.patch)}`;
  const matchesCommit = value => value?.tree?.sha === proposal.tree_sha && value.parents?.length === 1
    && value.parents[0].sha === snapshot.source_sha && value.message?.trimEnd() === message;
  let branch = await api.getRef(repo, ref); let commit;
  if (branch) {
    commit = await api.getCommit(repo, branch.object?.sha);
    if (!matchesCommit(commit)) conflict();
  } else {
    await current();
    commit = await api.createCommit(repo, { ...proposal, message, date: snapshot.issue.updated_at });
    if (!/^[a-f0-9]{40}$/.test(commit?.sha ?? '') || !matchesCommit(commit)) fail('TRIAGE_PUBLISH_FAILED');
    branch = await reconcile(() => api.createRef(repo, ref, commit.sha), async () => {
      const recovered = await api.getRef(repo, ref); if (recovered && recovered.object?.sha !== commit.sha) conflict(); return recovered;
    });
  }
  if (branch.object?.sha !== commit.sha) conflict();
  const body = seal(`${marker}\n## Proposta de correção: rascunho não aprovado\n\nRefs #${issue}\n\n${safeSummary(result.envelope.summary)}\n\nVerificações: ${verification.status}. Revisão humana obrigatória.\n\n${provenance}\n`);
  const validPull = p => own(p) && p.state === 'open' && p.draft === true && p.head?.ref === ref && p.head.sha === commit.sha
    && p.head.repo?.full_name === repo && p.base?.ref === snapshot.base_ref && p.base.sha === snapshot.source_sha
    && p.base.repo?.full_name === repo && p.body === body && intact(p.body);
  async function findPull() {
    const found = (await api.listPulls(repo, ref)).filter(p => p.head?.ref === ref || p.body?.includes(marker));
    if (found.length > 1 || found.some(p => !validPull(p))) conflict(); return found[0];
  }
  let pull = await findPull();
  if (!pull) pull = await reconcile(() => api.createPull(repo, { title: `Triagem: proposta para issue #${issue}`, head: ref,
    base: snapshot.base_ref, draft: true, body }), findPull);
  if (!validPull(pull)) conflict();
  async function rereadPull() {
    const value = await api.getPull(repo, pull.number); const head = await api.getRef(repo, ref);
    if (!validPull(value) || head?.object?.sha !== commit.sha) conflict(); return value;
  }
  pull = await rereadPull();
  const milestone = snapshot.metadata.milestone.number;
  if (pull.milestone && pull.milestone.number !== milestone) conflict();
  if (!pull.milestone) pull = await reconcile(() => api.setMilestone(repo, pull.number, milestone), async () => {
    const recovered = await rereadPull(); return recovered.milestone?.number === milestone ? recovered : null;
  });
  pull = await rereadPull();
  if (!(pull.requested_reviewers ?? []).some(r => r.login?.toLowerCase() === policy.reviewer.toLowerCase())
    && !(await api.listReviews(repo, pull.number)).some(r => r.user?.login?.toLowerCase() === policy.reviewer.toLowerCase())) {
    await reconcile(() => api.requestReview(repo, pull.number, policy.reviewer), async () => {
      const recovered = await rereadPull(); return recovered.requested_reviewers?.some(r => r.login === policy.reviewer) ? recovered : null;
    });
  }
  const final = await rereadPull();
  if (final.milestone?.number !== milestone || (!(final.requested_reviewers ?? []).some(r => r.login?.toLowerCase() === policy.reviewer.toLowerCase())
    && !(await api.listReviews(repo, pull.number)).some(r => r.user?.login?.toLowerCase() === policy.reviewer.toLowerCase()))) fail('TRIAGE_PUBLISH_FAILED');
  const status = verification.status === 'passed' ? 'draft' : 'draft-checks-failed';
  const comment_id = await comment(`## Proposta: rascunho não aprovado\n\n${final.html_url}\nVerificações: ${verification.status}. Revisão humana obrigatória.`);
  return { status, route, issue, comment_id, pr_number: final.number };
}
