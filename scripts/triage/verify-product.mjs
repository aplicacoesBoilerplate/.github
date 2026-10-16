import { validateTriageConfig } from './policy.mjs';
import { verifyProduct as verifyInContainer, validateVerificationImage as validateImage } from '../shared/verify-product.mjs';

export const validateVerificationImage = image => validateImage(image, 'INVALID_TRIAGE_CONFIG');
export async function verifyProduct(input, options) {
  const policy = validateTriageConfig(input.config);
  return verifyInContainer({ ...input, checks: policy.checks, configError: 'INVALID_TRIAGE_CONFIG', verificationError: 'INVALID_TRIAGE_VERIFICATION' }, options);
}
