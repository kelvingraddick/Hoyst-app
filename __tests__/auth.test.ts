jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest/async-storage-mock'),
);

import {useSessionStore} from '../src/store/session-store';
import {useOnboardingStore} from '../src/store/onboarding-store';
import {buildOnboardingPreferences} from '../src/features/auth/services/onboarding-payload';
import {
  normalizeHandle,
  validateHandle,
} from '../src/features/auth/services/profile-validation';

describe('auth profile validation', () => {
  it('normalizes handles before reservation', () => {
    expect(normalizeHandle('  @Kelvin_Code  ')).toBe('kelvin_code');
  });

  it('rejects handles Firebase should not reserve', () => {
    expect(validateHandle('ab').isValid).toBe(false);
    expect(validateHandle('bad-handle').isValid).toBe(false);
  });

  it('accepts account handles used by profile completion', () => {
    expect(validateHandle('daily_runner_7')).toEqual({
      isValid: true,
      normalizedHandle: 'daily_runner_7',
    });
  });
});

describe('session pending actions', () => {
  beforeEach(() => {
    useSessionStore.setState({
      pendingAction: undefined,
      status: 'guest',
      user: undefined,
    });
  });

  it('stores protected actions while moving guests to auth', () => {
    useSessionStore
      .getState()
      .beginAuthFlow({circleId: 'circle-1', type: 'joinCircle'});

    expect(useSessionStore.getState().status).toBe('authenticating');
    expect(useSessionStore.getState().pendingAction).toEqual({
      circleId: 'circle-1',
      type: 'joinCircle',
    });
  });

  it('consumes pending actions once after profile completion', () => {
    useSessionStore
      .getState()
      .setPendingAction({circleId: 'circle-2', source: 'home', type: 'tapIn'});

    expect(useSessionStore.getState().consumePendingAction()).toEqual({
      circleId: 'circle-2',
      source: 'home',
      type: 'tapIn',
    });
    expect(useSessionStore.getState().consumePendingAction()).toBeUndefined();
  });
});

describe('onboarding store', () => {
  beforeEach(() => {
    useOnboardingStore.getState().reset();
    useOnboardingStore.setState({hasHydrated: true});
  });

  it('moves through the Duolingo-style stepper', () => {
    const store = useOnboardingStore.getState();

    store.setCurrentStep('goal');
    store.nextStep();
    expect(useOnboardingStore.getState().currentStep).toBe('categories');

    useOnboardingStore.getState().previousStep();
    expect(useOnboardingStore.getState().currentStep).toBe('goal');
  });

  it('tracks selections and builds onboarding preferences', () => {
    const store = useOnboardingStore.getState();

    store.setGoal('fitness');
    store.setCategory('fitness');
    store.setCategory('deep_work');
    store.setReminderPreference('morning');
    store.setSocialComfort('trusted_circle');
    store.setPace('daily');

    expect(useOnboardingStore.getState().getPreferences()).toEqual({
      categories: ['fitness', 'deep_work'],
      goal: 'fitness',
      pace: 'daily',
      reminderPreference: 'morning',
      socialComfort: 'trusted_circle',
    });
  });

  it('does not repeat first-run onboarding after guest continuation', () => {
    useOnboardingStore.getState().markSeen();
    useSessionStore.getState().setGuest();

    expect(useOnboardingStore.getState().hasSeenOnboarding).toBe(true);
    expect(useSessionStore.getState().status).toBe('guest');
    expect(useSessionStore.getState().user).toBeUndefined();
  });

  it('preserves pending protected action while starting onboarding', () => {
    useSessionStore
      .getState()
      .beginAuthFlow({circleId: 'circle-3', type: 'joinCircle'});
    useOnboardingStore.getState().startForProtectedAction();

    expect(useOnboardingStore.getState().currentStep).toBe('coach');
    expect(useSessionStore.getState().pendingAction).toEqual({
      circleId: 'circle-3',
      type: 'joinCircle',
    });
  });

  it('sends returning protected-action guests straight to auth choice', () => {
    useOnboardingStore.getState().markSeen();
    useOnboardingStore.getState().startForProtectedAction();

    expect(useOnboardingStore.getState().currentStep).toBe('auth');
  });
});

describe('onboarding complete profile payload', () => {
  it('includes onboarding preferences when present', () => {
    expect(
      buildOnboardingPreferences({
        categories: ['wellness', 'learning'],
        goal: 'wellness',
        pace: 'three_weekly',
        reminderPreference: 'evening',
        socialComfort: 'invite_later',
      }),
    ).toEqual({
      categories: ['wellness', 'learning'],
      goal: 'wellness',
      pace: 'three_weekly',
      reminderPreference: 'evening',
      socialComfort: 'invite_later',
    });
  });

  it('omits onboarding preferences when there is no intake data', () => {
    expect(buildOnboardingPreferences({categories: []})).toBeUndefined();
  });
});
