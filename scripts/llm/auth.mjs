import { mkdtemp, chmod, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createHash } from 'node:crypto';
import { contractError } from './validate-request.mjs';

const ownedDirectories = new WeakMap();
const present = value => typeof value === 'string' && value.trim().length > 0;
export const sessionHash = bytes => createHash('sha256').update(bytes).digest('hex');

export function validateManagedSession(raw, code = 'AUTH_CONFIG_ERROR') {
  try {
    if (typeof raw !== 'string' || Buffer.byteLength(raw) > 49152) throw contractError(code);
    const data = JSON.parse(raw);
    if (data?.auth_mode !== 'chatgpt' || present(data.OPENAI_API_KEY)
      || !['access_token', 'id_token', 'refresh_token'].every(key => present(data.tokens?.[key]))) throw contractError(code);
    return data;
  } catch { throw contractError(code); }
}

export async function restoreAuth(mode, secrets, { tempRoot = tmpdir(), runtimeEnv = process.env } = {}) {
  if (mode === 'chatgpt-session') {
    if (!present(secrets.CODEX_AUTH_WRITE_PAT) || present(secrets.OPENAI_API_KEY)) throw contractError('AUTH_CONFIG_ERROR');
    validateManagedSession(secrets.CODEX_AUTH_JSON);
  } else if (mode === 'api-key') {
    if (!present(secrets.OPENAI_API_KEY) || /[\r\n]/.test(secrets.OPENAI_API_KEY)
      || present(secrets.CODEX_AUTH_JSON) || present(secrets.CODEX_AUTH_WRITE_PAT)) throw contractError('AUTH_CONFIG_ERROR');
  } else throw contractError('AUTH_CONFIG_ERROR');

  let dir;
  try {
    dir = await mkdtemp(join(tempRoot, 'llm-auth-'));
    await chmod(dir, 0o700);
    const env = {};
    for (const key of ['PATH', 'SystemRoot', 'SYSTEMROOT', 'WINDIR', 'LANG', 'LC_ALL']) {
      if (runtimeEnv[key]) env[key] = runtimeEnv[key];
    }
    Object.assign(env, { CODEX_HOME: dir, HOME: dir, USERPROFILE: dir, TMPDIR: dir, TEMP: dir, TMP: dir });
    let file = null;
    if (mode === 'chatgpt-session') {
      file = join(dir, 'auth.json');
      await writeFile(file, secrets.CODEX_AUTH_JSON, { mode: 0o600, flag: 'wx' });
    } else env.CODEX_API_KEY = secrets.OPENAI_API_KEY;
    const auth = { mode, dir, file, env };
    Object.defineProperty(auth, 'seedHash', { value: file ? sessionHash(secrets.CODEX_AUTH_JSON) : null });
    ownedDirectories.set(auth, dir);
    return auth;
  } catch {
    if (dir) await rm(dir, { recursive: true, force: true });
    throw contractError('AUTH_CONFIG_ERROR');
  }
}

export async function cleanupAuth(auth) {
  const dir = ownedDirectories.get(auth);
  if (!dir) throw contractError('AUTH_CONFIG_ERROR');
  // Only delete the directory allocated for this object, never a mutable caller path.
  await rm(dir, { recursive: true, force: true });
  for (const key of Object.keys(auth.env)) delete auth.env[key];
}
