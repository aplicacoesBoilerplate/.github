import { createHash } from 'node:crypto';
import { contractError } from '../llm/validate-request.mjs';
import { validateTriageConfig, selectRoute, resolveBase } from './policy.mjs';
export { createTriageApi } from './api.mjs';

const sha = /^[a-f0-9]{40}$/;
const fail = code => { throw contractError(code); };

function fieldValue(key, config, project, issueFields) {
  const source = config.field_sources?.[key] ?? 'project';
  const name = config.fields[key];
  const records = source === 'issue' ? issueFields : project?.fields;
  const matches = Array.isArray(records) ? records.filter(f => (source === 'issue' ? f?.issue_field_name : f?.name) === name) : [];
  if (matches.length !== 1) return { source, name, available: false };
  const field = matches[0];
  if (source === 'issue') {
    const value = field.data_type === 'single_select' ? field.single_select_option?.name : field.value;
    if (value === undefined) return { source, name, available: false };
    return { source, field_id: field.issue_field_id, name, available: true, value };
  }
  const values = project.values?.filter(v => v?.field?.id === field.id) ?? [];
  if (values.length > 1) return { source, name, available: false };
  return { source, field_id: field.id, name, available: true, value: values[0]?.value ?? null };
}

/** Validate platform origin independently of policy or LLM authentication. */
export async function verifyTriageOrigin(event, api) {
  try {
    if (!event || event.server_url !== 'https://github.com'
      || !/^[a-zA-Z0-9][a-zA-Z0-9-]*\/[a-zA-Z0-9_.-]+$/.test(event.repository ?? '')
      || !['issues', 'workflow_dispatch'].includes(event.event_name)
      || (event.event_name === 'issues' && event.action !== 'opened')
      || !Number.isSafeInteger(event.issue_number) || event.issue_number < 1
      || !sha.test(event.sha ?? '') || event.workflow_sha !== event.sha) fail('UNTRUSTED_CONTEXT');
    const repo = await api.getRepository(event.repository);
    if (repo.full_name?.toLowerCase() !== event.repository.toLowerCase() || repo.private !== true || repo.fork !== false
      || !repo.default_branch || event.ref !== `refs/heads/${repo.default_branch}`) fail('UNTRUSTED_CONTEXT');
    const prefix = `${event.repository}/.github/workflows/`;
    const suffix = `@refs/heads/${repo.default_branch}`;
    if (typeof event.workflow_ref !== 'string' || !event.workflow_ref.startsWith(prefix) || !event.workflow_ref.endsWith(suffix)
      || !/^[a-zA-Z0-9_.-]+\.ya?ml$/.test(event.workflow_ref.slice(prefix.length, -suffix.length))) fail('UNTRUSTED_CONTEXT');
    const issue = await api.getIssue(event.repository, event.issue_number);
    if (issue.number !== event.issue_number || issue.repository_url !== `https://api.github.com/repos/${event.repository}`
      || issue.pull_request || typeof issue.node_id !== 'string') fail('UNTRUSTED_CONTEXT');
    if (issue.state !== 'open') fail('STALE_TRIAGE_INPUT');
    for (const actor of new Set([event.actor, issue.user?.login])) {
      if (typeof actor !== 'string' || !actor) fail('UNTRUSTED_CONTEXT');
      const permission = await api.getPermission(event.repository, actor);
      if (!['write', 'maintain', 'admin'].includes(permission.permission)
        || permission.user?.login?.toLowerCase() !== actor.toLowerCase()) fail('UNTRUSTED_CONTEXT');
    }
    const defaultBranch = await api.getBranch(event.repository, repo.default_branch);
    if (defaultBranch?.name !== repo.default_branch || !sha.test(defaultBranch.commit?.sha ?? '')) fail('UNTRUSTED_CONTEXT');
    return { repo, issue, config_source_sha: defaultBranch.commit.sha };
  } catch (error) {
    throw contractError(['UNTRUSTED_CONTEXT', 'STALE_TRIAGE_INPUT', 'TRIAGE_METADATA_UNAVAILABLE'].includes(error.code) ? error.code : 'TRIAGE_METADATA_UNAVAILABLE');
  }
}

/** Collect only API-backed state; the caller body is never authority for routing. */
export async function collectIssue({ event, config }, api) {
  const policy = validateTriageConfig(config);
  try {
    const { repo, issue, config_source_sha } = await verifyTriageOrigin(event, api);
    const body = issue.body ?? '';
    if (typeof body !== 'string' || Buffer.byteLength(body, 'utf8') > 16384) fail('INVALID_TRIAGE_INPUT');
    const missing = [];
    async function optional(name, action) {
      try { return await action(); }
      catch { missing.push(name); return undefined; }
    }
    const dependencies = await optional('BLOCKERS_UNAVAILABLE', () => api.getDependencies(event.repository, issue.number));
    const epic = await optional('PARENT_UNAVAILABLE', () => api.getParent(event.repository, issue.number));
    const project = await optional('PROJECT_UNAVAILABLE', () => api.getProjectMetadata(event.repository, issue.number, policy.project));
    const issueFields = await optional('ISSUE_FIELDS_UNAVAILABLE', () => api.getIssueFields(event.repository, issue.number));
    const fields = Object.fromEntries(Object.keys(policy.fields).map(key => [key, fieldValue(key, policy, project, issueFields)]));
    const blockers = Array.isArray(dependencies) ? dependencies.map(d => ({ number: d.number, state: d.state, repository_url: d.repository_url ?? `https://api.github.com/repos/${event.repository}` }))
      .sort((a, b) => a.repository_url.localeCompare(b.repository_url) || a.number - b.number) : [];
    const metadata = { issue_number: issue.number, type: issue.type?.name,
      ...Object.fromEntries(Object.entries(fields).map(([key, field]) => [key, field.value])),
      fields, epic: epic === undefined ? null : epic, milestone: issue.milestone ? { title: issue.milestone.title, number: issue.milestone.number } : null,
      blockers, complete: Array.isArray(dependencies) && epic !== undefined && body.trim().length > 0
        && Object.values(fields).every(f => f.available) && blockers.every(b => Number.isSafeInteger(b.number) && ['open', 'closed'].includes(b.state)) };
    const candidate = resolveBase(metadata, policy);
    const branch = candidate ? await optional('BASE_UNAVAILABLE', () => api.getBranch(event.repository, candidate)) : null;
    metadata.base_ref = branch?.name === candidate && sha.test(branch?.commit?.sha ?? '') ? candidate : null;
    metadata.base_sha = metadata.base_ref ? branch.commit.sha : null;
    const sourceSha = metadata.base_sha ?? config_source_sha;
    const issueData = { number: issue.number, node_id: issue.node_id, title: issue.title, body, updated_at: issue.updated_at, state: issue.state };
    const route = selectRoute(metadata);
    const context = { issue: issueData, metadata, missing, route, source_sha: sourceSha, config_source_sha };
    const contextJson = JSON.stringify(context);
    if (Buffer.byteLength(contextJson, 'utf8') > 32768) fail('INVALID_TRIAGE_INPUT');
    const fingerprint = createHash('sha256').update(contextJson).digest('hex');
    return { repository: event.repository, default_branch: repo.default_branch, issue: issueData, metadata, route, fingerprint,
      base_ref: metadata.base_ref, source_sha: sourceSha, config_source_sha, context_json: contextJson };
  } catch (error) {
    const code = ['UNTRUSTED_CONTEXT', 'STALE_TRIAGE_INPUT', 'INVALID_TRIAGE_INPUT', 'TRIAGE_METADATA_UNAVAILABLE'].includes(error.code) ? error.code : 'TRIAGE_METADATA_UNAVAILABLE';
    throw contractError(code);
  }
}
