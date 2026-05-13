import type {AuthSessionStatus} from '../store/session-store';

export function canResumePendingAction({
  hasPendingStarterCircleSetup,
  status,
}: {
  hasPendingStarterCircleSetup: boolean;
  status: AuthSessionStatus;
}) {
  return status === 'authenticatedReady' && !hasPendingStarterCircleSetup;
}
