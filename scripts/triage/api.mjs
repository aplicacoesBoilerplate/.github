import { contractError } from '../llm/validate-request.mjs';

const unavailable = () => contractError('TRIAGE_METADATA_UNAVAILABLE');
const repoPattern = /^[a-zA-Z0-9][a-zA-Z0-9-]*\/[a-zA-Z0-9_.-]+$/;
const fieldFragments = `... on ProjectV2ItemFieldSingleSelectValue { name field { ... on ProjectV2SingleSelectField { id name } } }
  ... on ProjectV2ItemFieldNumberValue { number field { ... on ProjectV2Field { id name } } }
  ... on ProjectV2ItemFieldTextValue { text field { ... on ProjectV2Field { id name } } }`;
const definitions = `... on ProjectV2Field { id name } ... on ProjectV2SingleSelectField { id name } ... on ProjectV2IterationField { id name }`;

/** Read-only GitHub adapter: fixed origin, bounded pagination, sanitized errors. */
export function createTriageApi(token, { fetchImpl = fetch } = {}) {
  if (typeof token !== 'string' || !token || /[\r\n]/.test(token)) throw unavailable();
  async function read(path, variables, { allow404 = false } = {}) {
    try {
      const response = await fetchImpl(`https://api.github.com${path}`, {
        method: variables ? 'POST' : 'GET', redirect: 'error', signal: AbortSignal.timeout(10000),
        headers: { Accept: 'application/vnd.github+json', Authorization: `Bearer ${token}`, 'Content-Type': 'application/json', 'X-GitHub-Api-Version': '2026-03-10' },
        ...(variables ? { body: JSON.stringify(variables) } : {}),
      });
      if (allow404 && response.status === 404) return null;
      if (!response.ok) throw unavailable();
      const result = await response.json();
      if (variables && (result.errors?.length || !result.data)) throw unavailable();
      return variables ? result.data : result;
    } catch { throw unavailable(); }
  }
  const repoPath = repo => { if (!repoPattern.test(repo)) throw unavailable(); return `/repos/${repo}`; };
  const issuePath = (repo, number) => {
    if (!Number.isSafeInteger(number) || number < 1) throw unavailable();
    return `${repoPath(repo)}/issues/${number}`;
  };
  async function list(path) {
    const all = [];
    for (let page = 1; page <= 10; page++) {
      const batch = await read(`${path}?per_page=100&page=${page}`);
      if (!Array.isArray(batch) || batch.length > 100) throw unavailable();
      all.push(...batch);
      if (batch.length < 100) return all;
    }
    throw unavailable();
  }
  async function connection(loader) {
    const all = []; const seen = new Set(); let cursor = null;
    for (let page = 0; page < 10; page++) {
      const value = await loader(cursor);
      if (!Array.isArray(value?.nodes) || typeof value.pageInfo?.hasNextPage !== 'boolean') throw unavailable();
      all.push(...value.nodes);
      if (!value.pageInfo.hasNextPage) return all;
      cursor = value.pageInfo.endCursor;
      if (typeof cursor !== 'string' || !cursor || seen.has(cursor)) throw unavailable();
      seen.add(cursor);
    }
    throw unavailable();
  }
  async function getProjectMetadata(repo, number, project) {
    issuePath(repo, number);
    const [owner, name] = repo.split('/');
    const items = await connection(async cursor => {
      const data = await read('/graphql', { query: `query($owner:String!,$name:String!,$number:Int!,$cursor:String) {
        repository(owner:$owner,name:$name) { issue(number:$number) { projectItems(first:100,after:$cursor) {
          pageInfo { hasNextPage endCursor } nodes { id project { id number owner { ... on Organization { login } ... on User { login } } } }
        } } } }`, variables: { owner, name, number, cursor } });
      return data.repository?.issue?.projectItems;
    });
    const matches = items.filter(item => item?.project?.number === project.number && item.project.owner?.login?.toLowerCase() === project.owner.toLowerCase());
    if (matches.length > 1) throw unavailable();
    if (!matches.length) return { project_id: null, item_id: null, fields: [], values: [] };
    const item = matches[0];
    const fields = await connection(async cursor => {
      const data = await read('/graphql', { query: `query($id:ID!,$cursor:String) { node(id:$id) { ... on ProjectV2 {
        fields(first:100,after:$cursor) { pageInfo { hasNextPage endCursor } nodes { ${definitions} } }
      } } }`, variables: { id: item.project.id, cursor } });
      return data.node?.fields;
    });
    const values = await connection(async cursor => {
      const data = await read('/graphql', { query: `query($id:ID!,$cursor:String) { node(id:$id) { ... on ProjectV2Item {
        fieldValues(first:100,after:$cursor) { pageInfo { hasNextPage endCursor } nodes { ${fieldFragments} } }
      } } }`, variables: { id: item.id, cursor } });
      return data.node?.fieldValues;
    });
    return { project_id: item.project.id, item_id: item.id, fields,
      values: values.filter(v => v?.field?.id).map(v => ({ field: v.field, value: v.name ?? v.number ?? v.text ?? null })) };
  }
  return {
    getRepository: repo => read(repoPath(repo)),
    getIssue: (repo, number) => read(issuePath(repo, number)),
    getPermission: (repo, actor) => {
      if (typeof actor !== 'string' || !/^[a-zA-Z0-9][a-zA-Z0-9-]*(?:\[bot\])?$/.test(actor)) throw unavailable();
      return read(`${repoPath(repo)}/collaborators/${encodeURIComponent(actor)}/permission`);
    },
    getDependencies: (repo, number) => list(`${issuePath(repo, number)}/dependencies/blocked_by`),
    getParent: (repo, number) => read(`${issuePath(repo, number)}/parent`, undefined, { allow404: true }),
    getIssueFields: (repo, number) => list(`${issuePath(repo, number)}/issue-field-values`),
    getBranch: (repo, ref) => {
      if (typeof ref !== 'string' || !ref || ref.length > 240) throw unavailable();
      return read(`${repoPath(repo)}/branches/${encodeURIComponent(ref)}`, undefined, { allow404: true });
    },
    getProjectMetadata,
  };
}
