import { readFile } from 'node:fs/promises';
const data = JSON.parse(await readFile(process.env.REVIEW_API_FIXTURE, 'utf8'));
globalThis.fetch = async url => {
  const path = new URL(url).pathname;
  if (path === '/repos/owner/app') return Response.json(data.repo);
  if (path === '/repos/owner/app/branches/master') return Response.json({ name: 'master', commit: { sha: data.config_sha } });
  if (path === '/repos/owner/app/pulls/9') return Response.json(data.pull);
  const permission = /^\/repos\/owner\/app\/collaborators\/([^/]+)\/permission$/.exec(path);
  if (permission && [data.pull.user.login, data.operator ?? 'operator'].includes(permission[1]))
    return Response.json({ permission: 'write', user: { login: permission[1] } });
  throw new Error('Unexpected fixture request');
};
