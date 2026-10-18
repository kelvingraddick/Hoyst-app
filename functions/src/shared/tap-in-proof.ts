/** Missing stored fields retain the legacy optional-photo behavior. */
export type ProofRequirement = 'photo' | 'none';

export function readProofRequirement(value: unknown): ProofRequirement {
  return value === 'photo' ? 'photo' : 'none';
}

export function getTapInProofRequirement(
  circle: {proofRequirement?: unknown},
  existingTapIn?: {proofRequirement?: unknown},
): ProofRequirement {
  return readProofRequirement(
    existingTapIn ? existingTapIn.proofRequirement : circle.proofRequirement,
  );
}
