import { createHash } from 'node:crypto';
import { contractError } from '../llm/validate-request.mjs';
import { validateReviewConfig, classifyPull } from './policy.mjs';
import { validateReviewEnvelope, validateReviewResult } from './result.mjs';
import { readPreparedProposal } from './prepare-patch.mjs';

const digest = value => createHash('sha256').update(value).digest('hex');
const fail = code => { throw contractError(code); };
const conflict = () => fail('REVIEW_RESOURCE_CONFLICT');
const sealPattern = /^<!-- review-body-sha256:([a-f0-9]{64}) -->\n/;
const seal = text => `<!-- review-body-sha256:${digest(text)} -->\n${text}`;
const intact = text => typeof text === 'string' && sealPattern.test(text) && text.match(sealPattern)[1] === digest(text.replace(sealPattern, ''));
const quote = text => text.replace(/\b(?:close[sd]?|fix(?:es|ed)?|resolve[sd]?)\b/gi, word => `${word[0]}\u200b${word.slice(1)}`)
  .replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').split(/\r?\n/).map(line => `> ${line}`).join('\n');
const sha = value => /^[a-f0-9]{40}$/.test(value ?? '');

export async function publishReview(input, api) {
  try { return await publish(input, api); }
  catch (error) {
    const codes = ['INVALID_REVIEW_CONFIG', 'INVALID_REVIEW_INPUT', 'INVALID_RESULT', 'INVALID_REVIEW_PATCH',
      'INVALID_REVIEW_VERIFICATION', 'STALE_REVIEW_INPUT', 'REVIEW_RESOURCE_CONFLICT'];
    throw contractError(codes.includes(error.code) ? error.code : 'REVIEW_PUBLISH_FAILED');
  }
}

/** No product code, inference, native approval, merge, closure or original-head update. */
async function publish({ snapshot, result, prepared, verification, config }, api) {
  const policy = validateReviewConfig(config);
  const repo = snapshot?.repository; const number = snapshot?.pull?.number;
  if (!/^[a-zA-Z0-9][a-zA-Z0-9-]*\/[a-zA-Z0-9_.-]+$/.test(repo ?? '') || !Number.isSafeInteger(number) || number < 1
    || snapshot.pull.state !== 'open' || !sha(snapshot.source_sha) || !sha(snapshot.base_sha) || !sha(snapshot.config_source_sha)
    || snapshot.pull.head?.sha !== snapshot.source_sha || snapshot.pull.base?.sha !== snapshot.base_sha
    || !/^[a-f0-9]{64}$/.test(snapshot.fingerprint ?? '')
    || !['correction', 'review-only', 'skip-correction', 'needs-human'].includes(snapshot.route)) fail('INVALID_REVIEW_INPUT');
  const inconclusive = snapshot.route === 'needs-human';
  if (inconclusive) {
    if (snapshot.error_code !== 'REVIEW_INCONCLUSIVE' || result != null || prepared != null) fail('INVALID_REVIEW_INPUT');
  } else {
    if (!result?.envelope || !result.expected || classifyPull(snapshot.pull, policy) !== snapshot.route) fail('INVALID_RESULT');
    validateReviewEnvelope(result.envelope, result.expected);
    const identity = { repository: repo, pull_number: number, source_sha: snapshot.source_sha, base_sha: snapshot.base_sha,
      merge_base_sha: snapshot.merge_base_sha, config_source_sha: snapshot.config_source_sha, review_fingerprint: snapshot.fingerprint };
    if (Object.entries(identity).some(([key, value]) => result.envelope[key] !== value)) fail('INVALID_RESULT');
    validateReviewResult({ status: result.envelope.status, decision: result.envelope.decision, summary: result.envelope.summary,
      findings: result.findings, patch: result.patch }, snapshot);
    if (digest(JSON.stringify({ schema_version: 1, findings: result.findings }, null, 2) + '\n') !== result.envelope.review_sha256
      || (result.patch === null ? result.envelope.patch_sha256 !== null : digest(result.patch) !== result.envelope.patch_sha256)) fail('INVALID_RESULT');
  }
  const patch = result?.patch != null;
  let proposal;
  if (patch) {
    if (!verification || !['passed', 'failed'].includes(verification.status) || verification.source_sha !== snapshot.source_sha
      || verification.config_source_sha !== snapshot.config_source_sha || verification.patch_sha256 !== digest(result.patch)) fail('INVALID_REVIEW_VERIFICATION');
    proposal = await readPreparedProposal(prepared);
    if (proposal.base_sha !== snapshot.source_sha || proposal.patch_sha256 !== digest(result.patch)
      || proposal.changes.some(change => !snapshot.diff_index.files.some(file => file.path === change.path)
        || !policy.allowed_paths.some(prefix => change.path === prefix || change.path.startsWith(`${prefix}/`)))) fail('INVALID_REVIEW_PATCH');
  }
  async function current() {
    const latest = await api.recollect();
    if (['repository', 'default_branch', 'source_sha', 'base_sha', 'merge_base_sha', 'config_source_sha', 'fingerprint', 'route', 'error_code']
      .some(key => latest?.[key] !== snapshot[key]) || JSON.stringify(latest?.pull) !== JSON.stringify(snapshot.pull)) fail('STALE_REVIEW_INPUT');
  }
  await current();
  const identity = await api.getIdentity();
  if (!Number.isSafeInteger(identity?.id) || identity.id < 1 || !/^[a-zA-Z0-9][a-zA-Z0-9-]*(?:\[bot\])?$/.test(identity.login ?? '')
    || identity.login.toLowerCase() === policy.reviewer.toLowerCase()
    || (patch && !policy.automation_actors.some(actor => actor.id === identity.id && actor.login.toLowerCase() === identity.login.toLowerCase()))) fail('REVIEW_PUBLISH_FAILED');
  const own = value => value?.user?.id === identity.id && value.user.login?.toLowerCase() === identity.login.toLowerCase();
  const marker = `<!-- review:v1:${repo}:${number} -->`;
  const key = digest(JSON.stringify([repo, number, snapshot.source_sha, snapshot.base_sha, snapshot.config_source_sha,
    snapshot.fingerprint, result?.envelope.automation_sha ?? null]));
  const keyMarker = `<!-- review-key:${key} -->`;
  const proof = `Entrada: ${snapshot.fingerprint}\nHead original: ${snapshot.source_sha}\nConfiguração: ${snapshot.config_source_sha}`;
  const provenance = `${proof}\nBase: ${snapshot.base_sha}\nMerge-base: ${snapshot.merge_base_sha ?? 'inconclusivo'}\nAutomação: ${result?.envelope.automation_sha ?? 'sem inferência'}`;
  async function findComment() {
    const found = (await api.listComments(repo, number)).filter(c => own(c) && c.body?.includes(marker));
    if (found.length > 1 || found.some(c => !intact(c.body) || !/^<!-- review-key:[a-f0-9]{64} -->$/m.test(c.body))) conflict();
    return found[0];
  }
  // Detect an edited own comment before creating any complementary resources.
  await findComment();
  async function reconcile(create, recover) {
    await current();
    try { return await create(); }
    catch (error) {
      if (['STALE_REVIEW_INPUT', 'REVIEW_RESOURCE_CONFLICT'].includes(error.code)) throw error;
      await current(); const found = await recover(); if (found) return found; fail('REVIEW_PUBLISH_FAILED');
    }
  }
  async function comment(text) {
    const body = seal(`${marker}\n${keyMarker}\n${text}\n\n${provenance}\n`);
    let existing = await findComment();
    if (existing && existing.body !== body) {
      if (existing.body.includes(keyMarker)) conflict();
      const before = existing;
      existing = await reconcile(async () => {
        const reread = await api.getComment(repo, before.id);
        if (!own(reread) || reread.body !== before.body) conflict();
        return api.updateComment(repo, before.id, body);
      }, async () => { const found = await findComment(); return found?.body === body ? found : null; });
    } else if (!existing) existing = await reconcile(() => api.createComment(repo, number, body), async () => {
      const found = await findComment(); return found?.body === body ? found : null;
    });
    if (!own(existing) || existing.body !== body || !Number.isSafeInteger(existing.id) || existing.id < 1) fail('REVIEW_PUBLISH_FAILED');
    await current(); return existing.id;
  }
  function findingsText() {
    if (inconclusive) return '## Revisão automática: inconclusiva\n\nREVIEW_INCONCLUSIVE. É necessária intervenção humana; não foi realizada uma revisão completa.';
    const header = `## Revisão automática: não é aprovação\n\n### Resumo\n${quote(result.envelope.summary)}`;
    if (result.envelope.status !== 'succeeded') return `${header}\n\nIntervenção: ${result.envelope.status}; decisão ${result.envelope.decision}.`;
    if (!result.findings.length) return `${header}\n\nNenhum achado. Isso não representa aprovação nem autorização de merge.`;
    return header + [['critical', 'Críticos'], ['warning', 'Avisos'], ['suggestion', 'Sugestões']].map(([severity, label]) => {
      const values = result.findings.filter(f => f.severity === severity);
      return `\n\n### ${label}\n${values.length ? values.map(f => `${quote(`${f.path}:${f.line}`)}\n${quote(f.message)}`).join('\n\n') : 'Nenhum.'}`;
    }).join('');
  }
  if (!patch) return { status: inconclusive ? 'needs-human' : result.envelope.status === 'succeeded' ? 'reviewed' : result.envelope.status,
    pull_number: number, pr_number: null, comment_id: await comment(findingsText()), source_sha: snapshot.source_sha };

  const ref = `feature/review-pr-${number}-${snapshot.source_sha.slice(0, 12)}`;
  const message = `Review correction for PR #${number}\n\n${marker}\n${proof}\nPatch: ${digest(result.patch)}`;
  const matchesCommit = c => sha(c?.sha) && c.tree?.sha === proposal.tree_sha && c.parents?.length === 1
    && c.parents[0].sha === snapshot.source_sha && c.message?.trimEnd() === message;
  let branch = await api.getRef(repo, ref); let commit;
  if (branch) { commit = await api.getCommit(repo, branch.object?.sha); if (!matchesCommit(commit) || commit.sha !== branch.object.sha) conflict(); }
  else {
    await current(); commit = await api.createCommit(repo, { ...proposal, message, date: snapshot.pull.updated_at });
    if (!matchesCommit(commit)) fail('REVIEW_PUBLISH_FAILED');
    branch = await reconcile(() => api.createRef(repo, ref, commit.sha), async () => {
      const found = await api.getRef(repo, ref); if (found && found.object?.sha !== commit.sha) conflict(); return found;
    });
  }
  if (branch.object?.sha !== commit.sha) conflict();
  const status = verification.status === 'passed' ? 'draft' : 'draft-checks-failed';
  const body = seal(`${marker}\n${keyMarker}\n## Correção complementar: rascunho não aprovado\n\nRefs #${number}\n\n${quote(result.envelope.summary)}\n\nEstado: ${status}. Verificações: ${verification.status}. Revisão humana obrigatória.\n\n${provenance}\n`);
  const validPull = p => own(p) && Number.isSafeInteger(p.number) && p.number > 0 && p.state === 'open' && p.draft === true
    && p.head?.ref === ref && p.head.sha === commit.sha && p.head.repo?.full_name === repo
    && p.base?.ref === snapshot.pull.head.ref && p.base.sha === snapshot.source_sha && p.base.repo?.full_name === repo
    && p.body === body && intact(p.body) && p.html_url === `https://github.com/${repo}/pull/${p.number}`;
  async function findPull() {
    const found = (await api.listPulls(repo, ref)).filter(p => p.head?.ref === ref || (p.body?.includes(marker) && p.body.includes(keyMarker)));
    if (found.length > 1 || found.some(p => !validPull(p))) conflict(); return found[0];
  }
  let pull = await findPull();
  if (!pull) pull = await reconcile(() => api.createPull(repo, { title: `Review: correção complementar do PR #${number}`, head: ref,
    base: snapshot.pull.head.ref, draft: true, body }), findPull);
  if (!validPull(pull)) conflict();
  async function rereadPull() {
    const value = await api.getPull(repo, pull.number); const head = await api.getRef(repo, ref);
    if (!validPull(value) || head?.object?.sha !== commit.sha) conflict(); return value;
  }
  const reviewed = async p => (p.requested_reviewers ?? []).some(r => r.login?.toLowerCase() === policy.reviewer.toLowerCase())
    || (await api.listReviews(repo, p.number)).some(r => r.user?.login?.toLowerCase() === policy.reviewer.toLowerCase());
  pull = await rereadPull();
  if (!await reviewed(pull)) await reconcile(async () => {
    await rereadPull(); return api.requestReview(repo, pull.number, policy.reviewer);
  }, async () => { const found = await rereadPull(); return await reviewed(found) ? found : null; });
  pull = await rereadPull(); if (!await reviewed(pull)) fail('REVIEW_PUBLISH_FAILED');
  const comment_id = await comment(`${findingsText()}\n\nCorreção complementar: ${pull.html_url}\nEstado: ${status}; verificações ${verification.status}. Revisão humana obrigatória.`);
  await rereadPull(); await current();
  return { status, pull_number: number, pr_number: pull.number, comment_id, source_sha: snapshot.source_sha };
}
