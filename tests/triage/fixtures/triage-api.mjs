import { readFile } from 'node:fs/promises';

const data = JSON.parse(await readFile(process.env.TRIAGE_API_FIXTURE, 'utf8'));
const connection = nodes => ({ nodes, pageInfo: { hasNextPage: false, endCursor: null } });
// Test-only preload. Unknown requests never fall back to the network.
globalThis.fetch = async (url, options) => {
  if (!url.startsWith('https://api.github.com/') || options.headers.Authorization !== 'Bearer read-fixture') throw new Error('fixture transport denied');
  const path = new URL(url).pathname;
  let response;
  if (path === '/graphql') {
    const { query } = JSON.parse(options.body);
    if (query.includes('projectItems')) response = { data: { repository: { issue: { projectItems: connection([
      { id: 'ITEM', project: { id: 'PROJECT', number: 12, owner: { login: 'owner' } } },
    ]) } } } };
    else if (query.includes('fieldValues')) response = { data: { node: { fieldValues: connection(data.project.values.map(v => ({ field: v.field,
      ...(typeof v.value === 'number' ? { number: v.value } : { name: v.value }) }))) } } };
    else response = { data: { node: { fields: connection(data.project.fields) } } };
  } else if (path === '/repos/owner/app') response = data.repo;
  else if (path === '/repos/owner/app/issues/7') response = data.issue;
  else if (path.endsWith('/permission')) response = { permission: 'write', user: { login: 'author' } };
  else if (path.endsWith('/blocked_by') || path.endsWith('/issue-field-values')) response = [];
  else if (path.endsWith('/parent')) response = { number: 3, state: 'open' };
  else if (path.includes('/branches/')) {
    const ref = decodeURIComponent(path.split('/branches/')[1]);
    response = { name: ref, commit: { sha: ref === 'master' ? data.config_sha : 'b'.repeat(40) } };
  } else throw new Error('fixture route missing');
  return { ok: true, json: async () => response };
};
