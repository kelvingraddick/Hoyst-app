import AsyncStorage from '@react-native-async-storage/async-storage';
import {create} from 'zustand';
import {createJSONStorage, persist} from 'zustand/middleware';

import {
  buildOnboardingPreferences,
  type OnboardingIntentDraft,
} from '../features/auth/services/onboarding-payload';
import {
  onboardingSteps,
  type OnboardingCategory,
  type OnboardingGoal,
  type OnboardingPace,
  type OnboardingPreferences,
  type OnboardingStep,
  type ReminderPreference,
  type SocialComfort,
} from '../features/auth/services/onboarding-options';

type OnboardingStoreState = OnboardingIntentDraft & {
  currentStep: OnboardingStep;
  displayName: string;
  handle: string;
  hasHydrated: boolean;
  hasSeenOnboarding: boolean;
  timezone: string;
  getPreferences: () => OnboardingPreferences | undefined;
  markSeen: () => void;
  nextStep: () => void;
  previousStep: () => void;
  reset: () => void;
  setCategory: (category: OnboardingCategory) => void;
  setCurrentStep: (step: OnboardingStep) => void;
  setDisplayName: (displayName: string) => void;
  setGoal: (goal: OnboardingGoal) => void;
  setHandle: (handle: string) => void;
  setHasHydrated: (hasHydrated: boolean) => void;
  setPace: (pace: OnboardingPace) => void;
  setReminderPreference: (preference: ReminderPreference) => void;
  setSocialComfort: (comfort: SocialComfort) => void;
  setTimezone: (timezone: string) => void;
  startForProtectedAction: () => void;
};

const initialState = {
  categories: [],
  currentStep: 'welcome' as OnboardingStep,
  displayName: '',
  goal: undefined,
  handle: '',
  hasHydrated: false,
  hasSeenOnboarding: false,
  pace: undefined,
  reminderPreference: undefined,
  socialComfort: undefined,
  timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC',
};

function getNextStep(currentStep: OnboardingStep, direction: 1 | -1) {
  const currentIndex = onboardingSteps.indexOf(currentStep);
  const nextIndex = Math.max(
    0,
    Math.min(onboardingSteps.length - 1, currentIndex + direction),
  );

  return onboardingSteps[nextIndex];
}

export const useOnboardingStore = create<OnboardingStoreState>()(
  persist(
    (set, get) => ({
      ...initialState,
      getPreferences: () =>
        buildOnboardingPreferences({
          categories: get().categories,
          goal: get().goal,
          pace: get().pace,
          reminderPreference: get().reminderPreference,
          socialComfort: get().socialComfort,
        }),
      markSeen: () =>
        set({
          currentStep: 'welcome',
          hasSeenOnboarding: true,
        }),
      nextStep: () =>
        set(state => ({
          currentStep: getNextStep(state.currentStep, 1),
        })),
      previousStep: () =>
        set(state => ({
          currentStep: getNextStep(state.currentStep, -1),
        })),
      reset: () =>
        set({
          ...initialState,
          hasHydrated: get().hasHydrated,
        }),
      setCategory: category =>
        set(state => ({
          categories: state.categories.includes(category)
            ? state.categories.filter(item => item !== category)
            : [...state.categories, category],
        })),
      setCurrentStep: currentStep => set({currentStep}),
      setDisplayName: displayName => set({displayName}),
      setGoal: goal => set({goal}),
      setHandle: handle => set({handle}),
      setHasHydrated: hasHydrated => set({hasHydrated}),
      setPace: pace => set({pace}),
      setReminderPreference: reminderPreference => set({reminderPreference}),
      setSocialComfort: socialComfort => set({socialComfort}),
      setTimezone: timezone => set({timezone}),
      startForProtectedAction: () =>
        set(state => ({
          currentStep: state.hasSeenOnboarding ? 'auth' : 'coach',
        })),
    }),
    {
      name: 'hoyst-onboarding-v1',
      onRehydrateStorage: () => state => {
        state?.setHasHydrated(true);
      },
      partialize: state => ({
        categories: state.categories,
        currentStep: state.currentStep,
        goal: state.goal,
        hasSeenOnboarding: state.hasSeenOnboarding,
        pace: state.pace,
        reminderPreference: state.reminderPreference,
        socialComfort: state.socialComfort,
        timezone: state.timezone,
      }),
      storage: createJSONStorage(() => AsyncStorage),
    },
  ),
);
