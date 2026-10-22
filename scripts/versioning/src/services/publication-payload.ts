import { createHash } from 'node:crypto';

export interface PublicationPayload {
  readonly report: unknown;
  readonly plan: unknown;
  readonly bundle: unknown;
  readonly snapshot: unknown;
  readonly gitInputs: unknown;
  readonly publicationEvidence: unknown;
}

/** Digest exported through trusted job outputs, independently of the downloaded artifact. */
export function publicationPayloadDigest(payload: PublicationPayload): string {
  const canonical = (value: unknown): unknown => {
    if (Array.isArray(value)) return value.map(canonical);
    if (value && typeof value === 'object') return Object.fromEntries(Object.keys(value)
      .sort().map(key => [key, canonical((value as Record<string, unknown>)[key])]));
    return value;
  };
  return createHash('sha256').update(JSON.stringify(canonical({ report: payload.report,
    plan: payload.plan, bundle: payload.bundle, snapshot: payload.snapshot,
    gitInputs: payload.gitInputs, publicationEvidence: payload.publicationEvidence }))).digest('hex');
}
