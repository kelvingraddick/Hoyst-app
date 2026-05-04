import React, {useEffect, type PropsWithChildren} from 'react';
import type {FirebaseAuthTypes} from '@react-native-firebase/auth';

import {firebaseAuth} from '../../../lib/firebase/auth';
import {useUserProfileStore} from '../../../store/profile-store';
import {useSessionStore, type AuthSessionUser} from '../../../store/session-store';
import {configureAuthProviders} from '../services/auth-service';
import {subscribeToUserProfile} from '../services/account-service';

function mapAuthUser(user: FirebaseAuthTypes.User): AuthSessionUser {
  return {
    displayName: user.displayName ?? undefined,
    email: user.email ?? undefined,
    phoneNumber: user.phoneNumber ?? undefined,
    photoURL: user.photoURL ?? undefined,
    providerIds: user.providerData.map(provider => provider.providerId),
    uid: user.uid,
  };
}

export function AuthStateProvider({
  children,
}: PropsWithChildren): React.JSX.Element {
  const setAuthenticatedIncompleteProfile = useSessionStore(
    state => state.setAuthenticatedIncompleteProfile,
  );
  const setAuthenticatedReady = useSessionStore(
    state => state.setAuthenticatedReady,
  );
  const setGuest = useSessionStore(state => state.setGuest);
  const setInitializing = useSessionStore(state => state.setInitializing);
  const setProfile = useUserProfileStore(state => state.setProfile);

  useEffect(() => {
    configureAuthProviders().catch(() => undefined);
    setInitializing();

    let unsubscribeProfile: (() => void) | undefined;

    const unsubscribeAuth = firebaseAuth().onAuthStateChanged(user => {
      unsubscribeProfile?.();
      unsubscribeProfile = undefined;

      if (!user) {
        setProfile(undefined);
        setGuest();
        return;
      }

      const sessionUser = mapAuthUser(user);
      setAuthenticatedIncompleteProfile(sessionUser);

      unsubscribeProfile = subscribeToUserProfile(
        user.uid,
        profile => {
          setProfile(profile);
          if (profile?.onboardingStatus === 'complete') {
            setAuthenticatedReady(sessionUser);
            return;
          }

          setAuthenticatedIncompleteProfile(sessionUser);
        },
        () => {
          setProfile(undefined);
          setAuthenticatedIncompleteProfile(sessionUser);
        },
      );
    });

    return () => {
      unsubscribeProfile?.();
      unsubscribeAuth();
    };
  }, [
    setAuthenticatedIncompleteProfile,
    setAuthenticatedReady,
    setGuest,
    setInitializing,
    setProfile,
  ]);

  return <>{children}</>;
}
