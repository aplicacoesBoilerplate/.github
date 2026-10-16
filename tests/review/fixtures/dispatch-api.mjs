import { readFile, writeFile } from 'node:fs/promises';
const data = JSON.parse(await readFile(process.env.DISPATCH_API_FIXTURE, 'utf8')); let dispatched;
globalThis.fetch = async (url, options) => {
  const path = decodeURIComponent(new URL(url).pathname);
  if (path === '/repos/owner/app') return Response.json(data.repo);
  if (path === '/repos/owner/app/branches/master') return Response.json({ name: 'master', commit: { sha: data.config_sha } });
  if (path === '/repos/owner/app/pulls/9') return Response.json(data.pull);
  const permission = /^\/repos\/owner\/app\/collaborators\/([^/]+)\/permission$/.exec(path);
  if (permission && [data.pull.user.login, data.identity.login].includes(permission[1])) return Response.json({ permission: 'write', user: { login: permission[1] } });
  if (path === '/graphql') return Response.json({ data: { viewer: { databaseId: data.identity.id, login: data.identity.login } } });
  if (path === '/repos/owner/app/actions/workflows/review.yml') return Response.json({ id: 99, path: '.github/workflows/review.yml', state: 'active' });
  if (path === '/repos/owner/app/actions/workflows/99/runs') return Response.json({ total_count: dispatched ? 1 : 0, workflow_runs: dispatched ? [dispatched] : [] });
  if (path === '/repos/owner/app/actions/workflows/99/dispatches') {
    const payload = JSON.parse(options.body); await writeFile(process.env.DISPATCH_CAPTURE, JSON.stringify(payload));
    dispatched = { id: 200, event: 'workflow_dispatch', repository: data.repo, head_repository: data.repo, path: '.github/workflows/review.yml',
      head_branch: 'master', head_sha: data.config_sha, display_title: `review:9:${payload.inputs.dispatch_id}`, actor: data.identity, status: 'queued', conclusion: null };
    return Response.json({ workflow_run_id: 200 });
  }
  if (path === '/repos/owner/app/actions/runs/200' && dispatched) return Response.json(dispatched);
  throw new Error('Unexpected dispatch fixture request');
};
