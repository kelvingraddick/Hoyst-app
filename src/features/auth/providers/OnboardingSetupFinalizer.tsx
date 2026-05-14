import {useEffect, useRef, useState} from 'react';

import {useUserProfileStore} from '../../../store/profile-store';
import {useOnboardingStore} from '../../../store/onboarding-store';
import {useSessionStore} from '../../../store/session-store';
import {completeProfile} from '../services/account-service';
import {isStarterCircleDraftReady} from '../services/onboarding-circle';
import {finalizeReadyProfileOnboardingSetup} from '../services/onboarding-finalizer';

export function OnboardingSetupFinalizer(): null {
  const inFlightSetupIdRef = useRef<string | undefined>(undefined);
  const retryTimeoutRef = useRef<ReturnType<typeof setTimeout> | undefined>(
    undefined,
  );
  const [retryTick, setRetryTick] = useState(0);
  const clearPendingAction = useSessionStore(state => state.clearPendingAction);
  const status = useSessionStore(state => state.status);
  const currentStep = useOnboardingStore(state => state.currentStep);
  const clearStarterCircleSetup = useOnboardingStore(
    state => state.clearStarterCircleSetup,
  );
  const firstCircleSkipped = useOnboardingStore(
    state => state.firstCircleSkipped,
  );
  const getOnboardingPreferences = useOnboardingStore(
    state => state.getPreferences,
  );
  const hasPendingStarterCircleSetup = useOnboardingStore(
    state => state.hasPendingStarterCircleSetup,
  );
  const hasSeenOnboarding = useOnboardingStore(
    state => state.hasSeenOnboarding,
  );
  const markSeen = useOnboardingStore(state => state.markSeen);
  const profile = useUserProfileStore(state => state.profile);
  const starterCircleDraft = useOnboardingStore(
    state => state.starterCircleDraft,
  );
  const starterCircleSetupId = useOnboardingStore(
    state => state.starterCircleSetupId,
  );
  const timezone = useOnboardingStore(state => state.timezone);

  useEffect(() => {
    return () => {
      if (retryTimeoutRef.current) {
        clearTimeout(retryTimeoutRef.current);
      }
    };
  }, []);

  useEffect(() => {
    if (status !== 'authenticatedReady' || !profile) {
      return;
    }

    if (
      !hasSeenOnboarding &&
      (currentStep === 'notifications' ||
        currentStep === 'auth' ||
        currentStep === 'finishProfile')
    ) {
      return;
    }

    if (!hasPendingStarterCircleSetup) {
      if (!hasSeenOnboarding) {
        clearPendingAction();
        markSeen();
      }
      return;
    }

    if (
      firstCircleSkipped ||
      !starterCircleSetupId ||
      !isStarterCircleDraftReady(starterCircleDraft)
    ) {
      clearStarterCircleSetup();
      clearPendingAction();
      markSeen();
      return;
    }

    if (inFlightSetupIdRef.current === starterCircleSetupId) {
      return;
    }

    let isActive = true;
    inFlightSetupIdRef.current = starterCircleSetupId;

    finalizeReadyProfileOnboardingSetup(
      {
        firstCircleSkipped,
        onboardingPreferences: getOnboardingPreferences(),
        profile,
        starterCircleDraft,
        starterCircleSetupId,
        timezone,
      },
      {completeProfile},
    )
      .then(() => {
        if (!isActive) {
          return;
        }

        clearPendingAction();
        clearStarterCircleSetup();
        markSeen();
      })
      .catch(error => {
        if (!isActive) {
          return;
        }

        inFlightSetupIdRef.current = undefined;
        console.warn('Could not finalize onboarding starter circle.', error);
        retryTimeoutRef.current = setTimeout(() => {
          setRetryTick(currentRetryTick => currentRetryTick + 1);
        }, 3000);
      });

    return () => {
      isActive = false;
    };
  }, [
    clearPendingAction,
    clearStarterCircleSetup,
    currentStep,
    firstCircleSkipped,
    getOnboardingPreferences,
    hasPendingStarterCircleSetup,
    hasSeenOnboarding,
    markSeen,
    profile,
    retryTick,
    starterCircleDraft,
    starterCircleSetupId,
    status,
    timezone,
  ]);

  return null;
}
