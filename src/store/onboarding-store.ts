import AsyncStorage from '@react-native-async-storage/async-storage';
import {create} from 'zustand';
import {createJSONStorage, persist} from 'zustand/middleware';

import {
  buildOnboardingPreferences,
  type OnboardingIntentDraft,
} from '../features/auth/services/onboarding-payload';
import {
  onboardingSteps,
  type OnboardingFocusArea,
  type OnboardingPreferences,
  type OnboardingStep,
} from '../features/auth/services/onboarding-options';
import {
  applyStarterCircleHiddenDefaults,
  createInitialStarterCircleDraft,
  updateStarterCircleFocusArea,
  updateStarterCirclePrivacyMode,
  updateStarterCirclePublicJoinMode,
} from '../features/auth/services/onboarding-circle';
import type {
  CircleJoinMode,
  CirclePrivacyMode,
  CreateCircleDraft,
} from '../types/models';

export type OnboardingStoreState = OnboardingIntentDraft & {
  currentStep: OnboardingStep;
  displayName: string;
  firstCircleSkipped: boolean;
  handle: string;
  hasPendingProfileCompletion: boolean;
  hasPendingStarterCircleSetup: boolean;
  hasHydrated: boolean;
  hasSeenOnboarding: boolean;
  starterCircleDraft: CreateCircleDraft;
  starterCircleSetupId?: string;
  timezone: string;
  clearStarterCircleSetup: () => void;
  clearProfileCompletion: () => void;
  getPreferences: () => OnboardingPreferences | undefined;
  markSeen: () => void;
  nextStep: () => void;
  prepareStarterCircleSetup: () => string;
  prepareProfileCompletion: () => void;
  previousStep: () => void;
  reset: () => void;
  setCurrentStep: (step: OnboardingStep) => void;
  setDisplayName: (displayName: string) => void;
  setFirstCircleSkipped: (firstCircleSkipped: boolean) => void;
  setFocusArea: (focusArea: OnboardingFocusArea) => void;
  setHandle: (handle: string) => void;
  setHasHydrated: (hasHydrated: boolean) => void;
  setStarterCircleDraft: (draft: CreateCircleDraft) => void;
  setStarterCircleField: <Key extends keyof CreateCircleDraft>(
    key: Key,
    value: CreateCircleDraft[Key],
  ) => void;
  setStarterCirclePrivacyMode: (privacyMode: CirclePrivacyMode) => void;
  setStarterCirclePublicJoinMode: (
    joinMode: Extract<CircleJoinMode, 'open' | 'request_to_join'>,
  ) => void;
  setTimezone: (timezone: string) => void;
  startOnboardingWizard: () => void;
};

const initialState = {
  currentStep: 'welcome' as OnboardingStep,
  displayName: '',
  firstCircleSkipped: false,
  focusArea: undefined,
  handle: '',
  hasPendingProfileCompletion: false,
  hasPendingStarterCircleSetup: false,
  hasHydrated: false,
  hasSeenOnboarding: false,
  starterCircleDraft: createInitialStarterCircleDraft(),
  starterCircleSetupId: undefined as string | undefined,
  timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC',
};

const legacyStepFallbacks: Record<string, OnboardingStep> = {
  categories: 'circleTitle',
  comfort: 'circleTitle',
  circleFrequency: 'circleCadence',
  circleDailyTask: 'circleCommitment',
  commitmentFrequency: 'circleCadence',
  goal: 'focusArea',
  pace: 'circleTitle',
  profile: 'circleTitle',
  preview: 'circleReview',
  reminders: 'circleTitle',
};

export function normalizeOnboardingStep(value: unknown): OnboardingStep {
  if (typeof value === 'string') {
    if (onboardingSteps.includes(value as OnboardingStep)) {
      return value as OnboardingStep;
    }

    return legacyStepFallbacks[value] ?? 'welcome';
  }

  return 'welcome';
}

function getNextStep(currentStep: OnboardingStep, direction: 1 | -1) {
  const currentIndex = onboardingSteps.indexOf(currentStep);
  const nextIndex = Math.max(
    0,
    Math.min(onboardingSteps.length - 1, currentIndex + direction),
  );

  return onboardingSteps[nextIndex];
}

function createStarterCircleSetupId() {
  return `starter-${Date.now().toString(36)}-${Math.random()
    .toString(36)
    .slice(2, 10)}`;
}

export const useOnboardingStore = create<OnboardingStoreState>()(
  persist(
    (set, get) => ({
      ...initialState,
      clearStarterCircleSetup: () =>
        set({
          hasPendingStarterCircleSetup: false,
          starterCircleSetupId: undefined,
        }),
      clearProfileCompletion: () =>
        set({
          hasPendingProfileCompletion: false,
        }),
      getPreferences: () =>
        buildOnboardingPreferences({
          focusArea: get().focusArea,
        }),
      markSeen: () =>
        set({
          hasPendingProfileCompletion: false,
          hasSeenOnboarding: true,
        }),
      nextStep: () =>
        set(state => ({
          currentStep: getNextStep(state.currentStep, 1),
        })),
      prepareStarterCircleSetup: () => {
        const existingSetupId = get().starterCircleSetupId;
        const setupId =
          get().hasPendingStarterCircleSetup && existingSetupId
            ? existingSetupId
            : createStarterCircleSetupId();

        set({
          firstCircleSkipped: false,
          hasPendingStarterCircleSetup: true,
          starterCircleSetupId: setupId,
        });

        return setupId;
      },
      prepareProfileCompletion: () =>
        set({
          hasPendingProfileCompletion: true,
          hasSeenOnboarding: false,
        }),
      previousStep: () =>
        set(state => ({
          currentStep: getNextStep(state.currentStep, -1),
        })),
      reset: () =>
        set({
          ...initialState,
          hasHydrated: get().hasHydrated,
          hasPendingProfileCompletion: false,
          hasPendingStarterCircleSetup: false,
          starterCircleDraft: createInitialStarterCircleDraft(),
          starterCircleSetupId: undefined,
        }),
      setCurrentStep: currentStep => set({currentStep}),
      setDisplayName: displayName => set({displayName}),
      setFirstCircleSkipped: firstCircleSkipped =>
        set({
          firstCircleSkipped,
          ...(firstCircleSkipped
            ? {
                hasPendingStarterCircleSetup: false,
                starterCircleSetupId: undefined,
              }
            : {}),
        }),
      setFocusArea: focusArea =>
        set(state => ({
          firstCircleSkipped: false,
          focusArea,
          starterCircleDraft: updateStarterCircleFocusArea(
            state.starterCircleDraft,
            focusArea,
          ),
        })),
      setHandle: handle => set({handle}),
      setHasHydrated: hasHydrated => set({hasHydrated}),
      setStarterCircleDraft: starterCircleDraft => set({starterCircleDraft}),
      setStarterCircleField: (key, value) =>
        set(state => ({
          firstCircleSkipped: false,
          starterCircleDraft: {
            ...state.starterCircleDraft,
            [key]: value,
          },
        })),
      setStarterCirclePrivacyMode: privacyMode =>
        set(state => ({
          firstCircleSkipped: false,
          starterCircleDraft: updateStarterCirclePrivacyMode(
            state.starterCircleDraft,
            privacyMode,
          ),
        })),
      setStarterCirclePublicJoinMode: joinMode =>
        set(state => ({
          firstCircleSkipped: false,
          starterCircleDraft: updateStarterCirclePublicJoinMode(
            state.starterCircleDraft,
            joinMode,
          ),
        })),
      setTimezone: timezone =>
        set(state => ({
          starterCircleDraft: {
            ...state.starterCircleDraft,
            timezone,
          },
          timezone,
        })),
      startOnboardingWizard: () =>
        set(state => ({
          currentStep: 'welcome',
          firstCircleSkipped: false,
          hasPendingProfileCompletion: false,
          hasPendingStarterCircleSetup: false,
          hasSeenOnboarding: false,
          starterCircleDraft: createInitialStarterCircleDraft({
            focusArea: state.focusArea,
            timezone: state.timezone,
          }),
          starterCircleSetupId: undefined,
        })),
    }),
    {
      name: 'hoyst-onboarding-v1',
      onRehydrateStorage: () => state => {
        if (!state) {
          return;
        }

        state.setCurrentStep(normalizeOnboardingStep(state.currentStep));
        state.setStarterCircleDraft(
          applyStarterCircleHiddenDefaults(
            state.starterCircleDraft ??
              createInitialStarterCircleDraft({
                focusArea: state.focusArea,
                timezone: state.timezone,
              }),
            {
              focusArea: state.focusArea,
              timezone: state.timezone,
            },
          ),
        );
        state.setFirstCircleSkipped(Boolean(state.firstCircleSkipped));
        if (
          state.hasPendingStarterCircleSetup === true &&
          !state.starterCircleSetupId
        ) {
          state.clearStarterCircleSetup();
        }
        state.setHasHydrated(true);
      },
      partialize: state => ({
        currentStep: state.currentStep,
        displayName: state.displayName,
        firstCircleSkipped: state.firstCircleSkipped,
        focusArea: state.focusArea,
        handle: state.handle,
        hasPendingStarterCircleSetup: state.hasPendingStarterCircleSetup,
        hasPendingProfileCompletion: state.hasPendingProfileCompletion,
        hasSeenOnboarding: state.hasSeenOnboarding,
        starterCircleDraft: state.starterCircleDraft,
        starterCircleSetupId: state.starterCircleSetupId,
        timezone: state.timezone,
      }),
      storage: createJSONStorage(() => AsyncStorage),
    },
  ),
);
