import React, {
  useCallback,
  useEffect,
  useRef,
  useState,
  type PropsWithChildren,
} from 'react';
import {useSessionStore} from '../../store/session-store';
import {LegalAcceptanceContext} from './LegalAcceptanceContext';
import {acceptLegalTerms, subscribeToLegalAcceptance} from './policy-service';

// Keep acknowledgment state separate from navigation. Signup and Settings own
// their inline controls; this provider never displays a screen or blocks taps.
export function LegalAcceptanceProvider({children}: PropsWithChildren) {
  const accountUid = useSessionStore(state => state.user?.uid);
  const status = useSessionStore(state => state.status);
  const uid = status !== 'guest' ? accountUid : undefined;
  const [state, setState] = useState<{
    uid?: string;
    accepted?: boolean;
    error?: string;
  }>({});
  const [attempt, setAttempt] = useState(0);
  const activeUid = useRef(uid);
  activeUid.current = uid;
  useEffect(() => {
    if (!uid) return;
    let active = true;
    setState({uid});
    const unsubscribe = subscribeToLegalAcceptance(
      uid,
      accepted => {
        if (active) setState({uid, accepted});
      },
      () => {
        if (active)
          setState({
            uid,
            error:
              'Could not check your acknowledgment. Try again when you’re online.',
          });
      },
    );
    return () => {
      active = false;
      unsubscribe();
    };
  }, [uid, attempt]);
  const retry = useCallback(() => setAttempt(value => value + 1), []);
  const acknowledge = useCallback(async () => {
    if (!uid) throw new Error('Sign in to continue.');
    await acceptLegalTerms(uid);
    if (
      activeUid.current !== uid ||
      useSessionStore.getState().user?.uid !== uid
    )
      throw new Error('Your account changed. Please try again.');
    setState({uid, accepted: true});
  }, [uid]);
  return (
    <LegalAcceptanceContext.Provider
      value={{
        uid,
        accepted: uid && state.uid === uid ? state.accepted : undefined,
        error: uid && state.uid === uid ? state.error : undefined,
        retry,
        acknowledge,
      }}>
      {children}
    </LegalAcceptanceContext.Provider>
  );
}
