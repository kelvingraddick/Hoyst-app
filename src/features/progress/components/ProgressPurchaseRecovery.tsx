import {useEffect} from 'react';
import {AppState} from 'react-native';
import {useSessionStore} from '../../../store/session-store';
import {recoverRewardPurchases} from '../services/purchase-service';
/** Delivery recovery never grants client-side inventory. Firebase verifies every transaction. */
export function ProgressPurchaseRecovery() {
  const uid = useSessionStore(state =>
    state.status === 'authenticatedReady' ? state.user?.uid : undefined,
  );
  useEffect(() => {
    if (!uid) return;
    const recover = () => recoverRewardPurchases(uid).catch(() => undefined);
    recover();
    const subscription = AppState.addEventListener('change', state => {
      if (state === 'active') recover();
    });
    return () => subscription.remove();
  }, [uid]);
  return null;
}
