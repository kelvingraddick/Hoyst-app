import AsyncStorage from '@react-native-async-storage/async-storage';
import {create} from 'zustand';
import {createJSONStorage, persist} from 'zustand/middleware';

import {
  buildOnboardingPreferences,
  type OnboardingIntentDraft,
} from '../features/auth/services/onboarding-payload';
import {
  getLegacyFocusAreaCategory,
  getOnboardingSteps,
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
  journey: 'invite' | 'standard';
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
  startInviteOnboarding: () => void;
  startInviteProfileCompletion: () => void;
  startInviteSignIn: () => void;
};

const initialState = {
  categories: undefined as string[] | undefined,
  currentStep: 'welcome' as OnboardingStep,
  displayName: '',
  firstCircleSkipped: false,
  focusArea: undefined,
  handle: '',
  hasPendingProfileCompletion: false,
  hasPendingStarterCircleSetup: false,
  hasHydrated: false,
  hasSeenOnboarding: false,
  journey: 'standard' as const,
  starterCircleDraft: createInitialStarterCircleDraft(),
  starterCircleSetupId: undefined as string | undefined,
  timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC',
};

const legacyStepFallbacks: Record<string, OnboardingStep> = {
  categories: 'circleCategory',
  comfort: 'circleTitle',
  circleCadence: 'circleRules',
  circleFrequency: 'circleRules',
  circleDailyTask: 'circleCommitment',
  commitmentFrequency: 'circleRules',
  focusArea: 'circleCategory',
  goal: 'circleCategory',
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

export function normalizeOnboardingStepForMode(
  value: unknown,
  circleMode: 'personal' | 'group',
): OnboardingStep {
  const normalizedStep = normalizeOnboardingStep(value);
  const availableSteps = getOnboardingSteps(circleMode);

  if (availableSteps.includes(normalizedStep)) {
    return normalizedStep;
  }

  const originalIndex = onboardingSteps.indexOf(normalizedStep);
  const nextAvailableStep = onboardingSteps
    .slice(originalIndex + 1)
    .find(step => availableSteps.includes(step));

  return nextAvailableStep ?? availableSteps.at(-1) ?? 'welcome';
}

function getNextStep(
  currentStep: OnboardingStep,
  direction: 1 | -1,
  circleMode: 'personal' | 'group',
) {
  const steps = getOnboardingSteps(circleMode);
  const currentIndex = steps.indexOf(currentStep);
  const nextIndex = Math.max(
    0,
    Math.min(steps.length - 1, currentIndex + direction),
  );

  return steps[nextIndex];
}

function createStarterCircleSetupId() {
  return `starter-${Date.now().toString(36)}-${Math.random()
    .toString(36)
    .slice(2, 10)}`;
}

export function migratePersistedOnboardingState(persistedState: unknown) {
  const state = (persistedState ?? {}) as Partial<OnboardingStoreState> & {
    currentStep?: unknown;
  };
  const focusArea = state.focusArea;
  const normalizedStarterCircleDraft = applyStarterCircleHiddenDefaults(
    state.starterCircleDraft ??
      createInitialStarterCircleDraft({
        focusArea,
        timezone: state.timezone,
      }),
    {timezone: state.timezone},
  );
  const starterCircleDraft = {
    ...normalizedStarterCircleDraft,
    category:
      normalizedStarterCircleDraft.category?.trim() ||
      getLegacyFocusAreaCategory(focusArea),
  };

  return {
    ...state,
    categories: state.categories?.length
      ? state.categories
      : focusArea
      ? [getLegacyFocusAreaCategory(focusArea)]
      : starterCircleDraft.category
      ? [starterCircleDraft.category]
      : undefined,
    currentStep: normalizeOnboardingStepForMode(
      state.currentStep,
      starterCircleDraft.circleMode,
    ),
    journey: state.journey === 'invite' ? 'invite' : 'standard',
    starterCircleDraft,
  };
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
          categories: [get().starterCircleDraft.category],
          focusArea: get().focusArea,
        }),
      markSeen: () =>
        set({
          hasPendingProfileCompletion: false,
          hasSeenOnboarding: true,
          journey: 'standard',
        }),
      nextStep: () =>
        set(state => ({
          currentStep: getNextStep(
            state.currentStep,
            1,
            state.starterCircleDraft.circleMode,
          ),
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
          currentStep: getNextStep(
            state.currentStep,
            -1,
            state.starterCircleDraft.circleMode,
          ),
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
          categories: [getLegacyFocusAreaCategory(focusArea)],
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
          ...(key === 'category' ? {categories: [String(value)]} : {}),
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
      setTimezone: timezone => set({timezone}),
      startOnboardingWizard: () =>
        set(state => ({
          currentStep: 'welcome',
          firstCircleSkipped: false,
          hasPendingProfileCompletion: false,
          hasPendingStarterCircleSetup: false,
          hasSeenOnboarding: false,
          journey: 'standard',
          starterCircleDraft: createInitialStarterCircleDraft({
            focusArea: state.focusArea,
            timezone: state.timezone,
          }),
          starterCircleSetupId: undefined,
        })),
      startInviteOnboarding: () =>
        set({
          currentStep: 'notifications',
          firstCircleSkipped: true,
          hasPendingProfileCompletion: false,
          hasPendingStarterCircleSetup: false,
          hasSeenOnboarding: false,
          journey: 'invite',
          starterCircleSetupId: undefined,
        }),
      startInviteProfileCompletion: () =>
        set({
          currentStep: 'finishProfile',
          firstCircleSkipped: true,
          hasPendingProfileCompletion: true,
          hasPendingStarterCircleSetup: false,
          hasSeenOnboarding: false,
          journey: 'invite',
          starterCircleSetupId: undefined,
        }),
      startInviteSignIn: () =>
        set({
          currentStep: 'auth',
          firstCircleSkipped: true,
          hasPendingProfileCompletion: false,
          hasPendingStarterCircleSetup: false,
          hasSeenOnboarding: false,
          journey: 'invite',
          starterCircleSetupId: undefined,
        }),
    }),
    {
      name: 'hoyst-onboarding-v1',
      migrate: migratePersistedOnboardingState,
      onRehydrateStorage: () => state => {
        if (!state) {
          return;
        }

        const starterCircleDraft = applyStarterCircleHiddenDefaults(
          state.starterCircleDraft ??
            createInitialStarterCircleDraft({
              focusArea: state.focusArea,
              timezone: state.timezone,
            }),
          {
            focusArea: state.focusArea,
            timezone: state.timezone,
          },
        );
        state.setStarterCircleDraft(starterCircleDraft);
        state.setCurrentStep(
          normalizeOnboardingStepForMode(
            state.currentStep,
            starterCircleDraft.circleMode,
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
        categories: state.categories,
        currentStep: state.currentStep,
        displayName: state.displayName,
        firstCircleSkipped: state.firstCircleSkipped,
        focusArea: state.focusArea,
        handle: state.handle,
        hasPendingStarterCircleSetup: state.hasPendingStarterCircleSetup,
        hasPendingProfileCompletion: state.hasPendingProfileCompletion,
        hasSeenOnboarding: state.hasSeenOnboarding,
        journey: state.journey,
        starterCircleDraft: state.starterCircleDraft,
        starterCircleSetupId: state.starterCircleSetupId,
        timezone: state.timezone,
      }),
      storage: createJSONStorage(() => AsyncStorage),
      version: 2,
    },
  ),
);
