import type {AuthSessionStatus} from '../store/session-store';

export type RootNavigatorMode = 'loading' | 'authFirst' | 'main';

type RootNavigatorModeInput = {
  hasHydratedOnboarding: boolean;
  hasSeenOnboarding: boolean;
  status: AuthSessionStatus;
};

export function getRootNavigatorMode({
  hasHydratedOnboarding,
  hasSeenOnboarding,
  status,
}: RootNavigatorModeInput): RootNavigatorMode {
  if (status === 'initializing' || !hasHydratedOnboarding) {
    return 'loading';
  }

  if (
    status === 'authenticatedIncompleteProfile' ||
    (status === 'guest' && !hasSeenOnboarding)
  ) {
    return 'authFirst';
  }

  return 'main';
}
