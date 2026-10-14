import sodium from 'libsodium-wrappers';
import { readTrustedFile, contractError } from './validate-request.mjs';
import { sessionHash, validateManagedSession } from './auth.mjs';
import { githubGet } from './preflight.mjs';
import { sessionTarget, githubTimestamp } from './check-session-freshness.mjs';

export async function persistIfChanged(auth, context, boundary, pat, { fetchImpl = fetch, delay } = {}) {
  const code = 'AUTH_PERSIST_FAILED';
  try {
    if (auth.mode !== 'chatgpt-session' || !pat || !auth.seedHash) throw contractError(code);
    const target = sessionTarget(context, code);
    if (boundary.repository !== context.repository || boundary.session_secret_name !== context.session_secret_name) throw contractError('AUTH_STATE_CONFLICT');
    githubTimestamp(boundary.updated_at, code);
    const current = await readTrustedFile(auth.dir, 'auth.json', 49152, code);
    validateManagedSession(current.toString('utf8'), code);
    const options = { fetchImpl, ...(delay ? { delay } : {}), errorCode: code };
    if (sessionHash(current) === auth.seedHash) {
      const metadata = await githubGet(target, pat, options);
      if (metadata.name !== context.session_secret_name || metadata.updated_at !== boundary.updated_at) throw contractError('AUTH_STATE_CONFLICT');
      return { persisted: false };
    }

    const publicKey = await githubGet(`/repos/${context.repository}/actions/secrets/public-key`, pat, options);
    await sodium.ready;
    const key = sodium.from_base64(publicKey.key, sodium.base64_variants.ORIGINAL);
    if (key.length !== sodium.crypto_box_PUBLICKEYBYTES || typeof publicKey.key_id !== 'string' || !publicKey.key_id) throw contractError(code);
    const encrypted_value = sodium.to_base64(sodium.crypto_box_seal(current, key), sodium.base64_variants.ORIGINAL);
    // Check again as close to the write as possible. GitHub does not provide CAS.
    const metadata = await githubGet(target, pat, options);
    if (metadata.name !== context.session_secret_name || metadata.updated_at !== boundary.updated_at) throw contractError('AUTH_STATE_CONFLICT');
    const response = await fetchImpl(`https://api.github.com${target}`, {
      method: 'PUT', redirect: 'error', signal: AbortSignal.timeout(10000),
      headers: { Accept: 'application/vnd.github+json', Authorization: `Bearer ${pat}`, 'Content-Type': 'application/json', 'X-GitHub-Api-Version': '2026-03-10' },
      body: JSON.stringify({ encrypted_value, key_id: publicKey.key_id }),
    });
    if (![201, 204].includes(response.status)) throw contractError(code);
    return { persisted: true };
  } catch (error) {
    throw contractError(error.code === 'AUTH_STATE_CONFLICT' ? error.code : code);
  }
}
