import { createHash } from 'node:crypto';
/** Digest exported through trusted job outputs, independently of the downloaded artifact. */
export function publicationPayloadDigest(payload) {
    const canonical = (value) => {
        if (Array.isArray(value))
            return value.map(canonical);
        if (value && typeof value === 'object')
            return Object.fromEntries(Object.keys(value)
                .sort().map(key => [key, canonical(value[key])]));
        return value;
    };
    return createHash('sha256').update(JSON.stringify(canonical({ report: payload.report,
        plan: payload.plan, bundle: payload.bundle, snapshot: payload.snapshot,
        gitInputs: payload.gitInputs, publicationEvidence: payload.publicationEvidence }))).digest('hex');
}
