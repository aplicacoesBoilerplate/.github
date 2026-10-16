import { createPublicationTransport } from '../shared/publication-api.mjs';

/** This adapter cannot move an existing ref, merge, approve, close, or transition Projects. */
export function createReviewPublicationApi(token, options = {}) {
  const api = createPublicationTransport(token, { ...options, errorCode: 'REVIEW_PUBLISH_FAILED', patchErrorCode: 'INVALID_REVIEW_PATCH',
    author: { name: 'Review proposal', email: 'review@example.invalid' },
    headAllowed: value => /^feature\/review-pr-[1-9][0-9]*-[a-f0-9]{12}$/.test(value ?? ''),
    baseAllowed: value => typeof value === 'string' && value.length <= 240 && /^[a-zA-Z0-9][a-zA-Z0-9._/-]*$/.test(value)
      && !/^(?:master|develop|release|refs)(?:\/|$)/.test(value) && !value.includes('..') && !value.endsWith('.')
      && value.split('/').every(part => part && !part.startsWith('.') && !part.endsWith('.lock')) });
  const { setMilestone, ...review } = api;
  return review;
}
