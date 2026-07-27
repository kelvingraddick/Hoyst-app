import {useEffect, useRef} from 'react';
import {
  CommonActions,
  type NavigationContainerRef,
} from '@react-navigation/native';
import {AppState, Linking, NativeModules, Settings} from 'react-native';

import type {RootStackParamList} from '../../../navigation/types';
import {useOnboardingStore} from '../../../store/onboarding-store';
import {useCircleInviteStore} from '../../../store/circle-invite-store';
import {useSessionStore} from '../../../store/session-store';
import {joinCircle} from '../../circles/services/circle-service';
import {resolveCircleInvite} from '../services/invite-service';
import {parseCircleInviteUrl} from '../services/invite-url';

type Props = {
  isNavigationReady: boolean;
  navigationRef: NavigationContainerRef<RootStackParamList>;
};

const pendingNativeInviteUrlKey = 'HoystPendingCircleInviteURL';

type HoystInviteLinkNativeModule = {
  takePendingURL?: () => Promise<unknown>;
};

function takePendingNativeInviteUrl(): Promise<unknown> {
  const nativeModule = NativeModules.HoystInviteLink as
    | HoystInviteLinkNativeModule
    | undefined;

  if (nativeModule?.takePendingURL) {
    return nativeModule.takePendingURL();
  }

  const pendingUrl = Settings.get(pendingNativeInviteUrlKey);
  if (typeof pendingUrl === 'string') {
    Settings.set({[pendingNativeInviteUrlKey]: null});
  }
  return Promise.resolve(pendingUrl);
}

function isUnavailableError(error: unknown) {
  const code = (error as {code?: string}).code ?? '';
  return code.endsWith('/not-found') || code === 'not-found';
}

function isFullError(error: unknown) {
  const code = (error as {code?: string}).code ?? '';
  return code.endsWith('/resource-exhausted') || code === 'resource-exhausted';
}

export function CircleInviteCoordinator({
  isNavigationReady,
  navigationRef,
}: Props): null {
  const queuedUrlRef = useRef<string | undefined>(undefined);
  const resolutionRequestIdRef = useRef(0);
  const joinRequestIdRef = useRef(0);
  const hasHydrated = useCircleInviteStore(state => state.hasHydrated);
  const markInitialUrlChecked = useCircleInviteStore(
    state => state.markInitialUrlChecked,
  );
  const inviteCode = useCircleInviteStore(state => state.inviteCode);
  const preview = useCircleInviteStore(state => state.preview);
  const consented = useCircleInviteStore(state => state.consented);
  const resolutionStatus = useCircleInviteStore(
    state => state.resolutionStatus,
  );
  const joinStatus = useCircleInviteStore(state => state.joinStatus);
  const setInviteCode = useCircleInviteStore(state => state.setInviteCode);
  const setResolutionLoading = useCircleInviteStore(
    state => state.setResolutionLoading,
  );
  const setResolvedPreview = useCircleInviteStore(
    state => state.setResolvedPreview,
  );
  const setResolutionUnavailable = useCircleInviteStore(
    state => state.setResolutionUnavailable,
  );
  const setResolutionError = useCircleInviteStore(
    state => state.setResolutionError,
  );
  const setJoining = useCircleInviteStore(state => state.setJoining);
  const setJoinError = useCircleInviteStore(state => state.setJoinError);
  const setPreviewFull = useCircleInviteStore(state => state.setPreviewFull);
  const clearInvite = useCircleInviteStore(state => state.clearInvite);
  const sessionStatus = useSessionStore(state => state.status);
  const hasHydratedOnboarding = useOnboardingStore(state => state.hasHydrated);
  const onboardingJourney = useOnboardingStore(state => state.journey);
  const hasSeenOnboarding = useOnboardingStore(
    state => state.hasSeenOnboarding,
  );

  useEffect(
    () => () => {
      resolutionRequestIdRef.current += 1;
      joinRequestIdRef.current += 1;
    },
    [],
  );

  useEffect(() => {
    const handleUrl = (url: string) => {
      const isHydrated = useCircleInviteStore.getState().hasHydrated;
      if (!isHydrated) {
        queuedUrlRef.current = url;
        return;
      }

      const code = parseCircleInviteUrl(url);
      if (code) {
        setInviteCode(code);
      }
    };

    const consumePendingNativeInviteUrl = () => {
      takePendingNativeInviteUrl()
        .then(pendingUrl => {
          if (typeof pendingUrl === 'string') {
            handleUrl(pendingUrl);
          }
        })
        .catch(() => undefined);
    };

    consumePendingNativeInviteUrl();
    Linking.getInitialURL()
      .then(url => {
        if (url) {
          handleUrl(url);
        }
      })
      .catch(() => undefined)
      .finally(markInitialUrlChecked);
    const subscription = Linking.addEventListener('url', event => {
      handleUrl(event.url);
      consumePendingNativeInviteUrl();
    });
    const settingsWatchId = Settings.watchKeys(
      pendingNativeInviteUrlKey,
      consumePendingNativeInviteUrl,
    );
    const appStateSubscription = AppState.addEventListener(
      'change',
      nextState => {
        if (nextState === 'active') {
          consumePendingNativeInviteUrl();
        }
      },
    );

    return () => {
      subscription.remove();
      Settings.clearWatch(settingsWatchId);
      appStateSubscription.remove();
    };
  }, [markInitialUrlChecked, setInviteCode]);

  useEffect(() => {
    if (!hasHydrated || !queuedUrlRef.current) {
      return;
    }

    const code = parseCircleInviteUrl(queuedUrlRef.current);
    queuedUrlRef.current = undefined;
    if (code) {
      setInviteCode(code);
    }
  }, [hasHydrated, setInviteCode]);

  useEffect(() => {
    if (!inviteCode || resolutionStatus !== 'idle') {
      return;
    }

    const requestId = resolutionRequestIdRef.current + 1;
    resolutionRequestIdRef.current = requestId;
    setResolutionLoading();
    resolveCircleInvite(inviteCode)
      .then(nextPreview => {
        if (
          resolutionRequestIdRef.current === requestId &&
          useCircleInviteStore.getState().inviteCode === inviteCode
        ) {
          setResolvedPreview(inviteCode, nextPreview);
        }
      })
      .catch(error => {
        if (
          resolutionRequestIdRef.current !== requestId ||
          useCircleInviteStore.getState().inviteCode !== inviteCode
        ) {
          return;
        }

        if (isUnavailableError(error)) {
          setResolutionUnavailable();
          return;
        }

        setResolutionError(
          'Could not load this invitation. Check your connection and try again.',
        );
      });
  }, [
    inviteCode,
    resolutionStatus,
    setResolutionError,
    setResolutionLoading,
    setResolutionUnavailable,
    setResolvedPreview,
  ]);

  useEffect(() => {
    if (
      !isNavigationReady ||
      !hasHydratedOnboarding ||
      sessionStatus === 'initializing' ||
      !inviteCode ||
      resolutionStatus === 'idle' ||
      resolutionStatus === 'loading'
    ) {
      return;
    }

    const isInviteOnboardingActive =
      consented &&
      onboardingJourney === 'invite' &&
      !hasSeenOnboarding &&
      sessionStatus !== 'authenticatedReady';
    if (isInviteOnboardingActive || joinStatus === 'joining') {
      return;
    }

    const currentRoute = navigationRef.getCurrentRoute();
    if (currentRoute?.name !== 'CircleInvite') {
      navigationRef.navigate('CircleInvite', {inviteCode});
    }
  }, [
    consented,
    hasHydratedOnboarding,
    hasSeenOnboarding,
    inviteCode,
    isNavigationReady,
    joinStatus,
    navigationRef,
    onboardingJourney,
    resolutionStatus,
    sessionStatus,
  ]);

  useEffect(() => {
    if (
      !consented ||
      !inviteCode ||
      !preview ||
      preview.isFull ||
      sessionStatus !== 'authenticatedReady' ||
      joinStatus !== 'idle'
    ) {
      return;
    }

    const requestId = joinRequestIdRef.current + 1;
    joinRequestIdRef.current = requestId;
    setJoining();
    joinCircle(preview.circleId, inviteCode)
      .then(() => {
        const currentInvite = useCircleInviteStore.getState();
        if (
          joinRequestIdRef.current !== requestId ||
          currentInvite.inviteCode !== inviteCode ||
          !currentInvite.consented
        ) {
          return;
        }

        clearInvite();
        navigationRef.dispatch(
          CommonActions.reset({
            index: 1,
            routes: [
              {name: 'MainTabs'},
              {
                name: 'CircleDetail',
                params: {circleId: preview.circleId},
              },
            ],
          }),
        );
      })
      .catch(error => {
        const currentInvite = useCircleInviteStore.getState();
        if (
          joinRequestIdRef.current !== requestId ||
          currentInvite.inviteCode !== inviteCode ||
          !currentInvite.consented
        ) {
          return;
        }

        if (isFullError(error)) {
          setPreviewFull();
          return;
        }

        if (isUnavailableError(error)) {
          setResolutionUnavailable();
          return;
        }

        setJoinError(
          'Could not join this Circle. Check your connection and try again.',
        );
      });
  }, [
    clearInvite,
    consented,
    inviteCode,
    joinStatus,
    navigationRef,
    preview,
    sessionStatus,
    setJoinError,
    setJoining,
    setPreviewFull,
    setResolutionUnavailable,
  ]);

  return null;
}
