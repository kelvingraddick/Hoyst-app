import type {NativeStackNavigationProp} from '@react-navigation/native-stack';

import type {RootStackParamList} from '../../../navigation/types';
import {useOnboardingStore} from '../../../store/onboarding-store';
import {
  useSessionStore,
  type PendingProtectedAction,
} from '../../../store/session-store';

export function useProtectedAction(
  navigation?: NativeStackNavigationProp<RootStackParamList>,
) {
  const status = useSessionStore(state => state.status);
  const beginAuthFlow = useSessionStore(state => state.beginAuthFlow);
  const startOnboardingWizard = useOnboardingStore(
    state => state.startOnboardingWizard,
  );

  return (
    pendingAction: PendingProtectedAction,
    onReady: () => void,
  ): void => {
    if (status === 'authenticatedReady') {
      onReady();
      return;
    }

    beginAuthFlow(pendingAction);
    startOnboardingWizard();
    navigation?.navigate('Auth', {screen: 'Welcome'});
  };
}
