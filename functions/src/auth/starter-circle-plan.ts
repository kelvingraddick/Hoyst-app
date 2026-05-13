type StarterCircleDecisionInput = {
  existingCircleId?: string;
  existingCircleIsValid: boolean;
  existingSetupId?: string;
  hasStarterCirclePayload: boolean;
  setupId?: string;
};

export type StarterCircleDecision = 'create' | 'repair' | 'reuse' | 'skip';

export function resolveStarterCircleDecision({
  existingCircleId,
  existingCircleIsValid,
  existingSetupId,
  hasStarterCirclePayload,
  setupId,
}: StarterCircleDecisionInput): StarterCircleDecision {
  if (!hasStarterCirclePayload || !setupId) {
    return 'skip';
  }

  if (existingSetupId === setupId && existingCircleId) {
    return existingCircleIsValid ? 'reuse' : 'repair';
  }

  return 'create';
}
