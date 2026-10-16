import { createPublicationTransport } from '../shared/publication-api.mjs';

export function createPublicationApi(token, options = {}) {
  return createPublicationTransport(token, { ...options, errorCode: 'TRIAGE_PUBLISH_FAILED', patchErrorCode: 'INVALID_TRIAGE_PATCH',
    author: { name: 'Triage proposal', email: 'triage@example.invalid' },
    headAllowed: value => /^feature\/triage-issue-[1-9][0-9]*$/.test(value ?? ''),
    baseAllowed: value => /^(?:release|feature|codex|hotfix)\/.+/.test(value ?? '') });
}
