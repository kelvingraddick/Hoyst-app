jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest/async-storage-mock'),
);

import {useSessionStore} from '../src/store/session-store';
import {useOnboardingStore} from '../src/store/onboarding-store';
import {continueAsGuestFromAuth} from '../src/features/auth/services/auth-dismiss';
import {buildOnboardingPreferences} from '../src/features/auth/services/onboarding-payload';
import {
  getOnboardingSignInParams,
  getWelcomeSignInParams,
  resolveSignInRouteIntent,
  switchSignInMode,
} from '../src/features/auth/services/auth-route-intent';
import {
  normalizeHandle,
  validateHandle,
} from '../src/features/auth/services/profile-validation';
import {getRootNavigatorMode} from '../src/navigation/root-mode';

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

describe('adaptive auth entry intent', () => {
  it('defaults direct sign-in routes to no selected method', () => {
    expect(resolveSignInRouteIntent()).toEqual({
      entryPoint: undefined,
      method: undefined,
      mode: 'signIn',
    });
  });

  it('opens onboarding email choice in registration mode', () => {
    expect(resolveSignInRouteIntent(getOnboardingSignInParams('email'))).toEqual({
      entryPoint: 'onboarding',
      method: 'email',
      mode: 'register',
    });
  });

  it('opens onboarding phone choice in registration mode', () => {
    expect(resolveSignInRouteIntent(getOnboardingSignInParams('phone'))).toEqual({
      entryPoint: 'onboarding',
      method: 'phone',
      mode: 'register',
    });
  });

  it('keeps protected action choices in registration mode', () => {
    expect(
      resolveSignInRouteIntent(
        getOnboardingSignInParams('email', 'protectedAction'),
      ),
    ).toEqual({
      entryPoint: 'protectedAction',
      method: 'email',
      mode: 'register',
    });
  });

  it('opens welcome sign-in action in email sign-in mode', () => {
    expect(resolveSignInRouteIntent(getWelcomeSignInParams())).toEqual({
      entryPoint: 'welcome',
      method: 'email',
      mode: 'signIn',
    });
  });

  it('preserves method when switching between sign in and register', () => {
    expect(
      switchSignInMode({
        entryPoint: 'onboarding',
        method: 'phone',
        mode: 'register',
      }),
    ).toEqual({
      entryPoint: 'onboarding',
      method: 'phone',
      mode: 'signIn',
    });
  });
});

describe('auth dismiss flow', () => {
  it('continues as guest after clearing pending auth state', async () => {
    const clearPendingAction = jest.fn();
    const dismissAuth = jest.fn();
    const markOnboardingSeen = jest.fn();
    const setGuest = jest.fn();
    const signOut = jest.fn();

    await continueAsGuestFromAuth({
      clearPendingAction,
      dismissAuth,
      hasAuthenticatedUser: () => false,
      markOnboardingSeen,
      setGuest,
      signOut,
    });

    expect(signOut).not.toHaveBeenCalled();
    expect(clearPendingAction).toHaveBeenCalledTimes(1);
    expect(markOnboardingSeen).toHaveBeenCalledTimes(1);
    expect(setGuest).toHaveBeenCalledTimes(1);
    expect(dismissAuth).toHaveBeenCalledTimes(1);
  });

  it('signs out before continuing as guest when a user is present', async () => {
    const signOut = jest.fn().mockResolvedValue(undefined);

    await continueAsGuestFromAuth({
      clearPendingAction: jest.fn(),
      dismissAuth: jest.fn(),
      hasAuthenticatedUser: () => true,
      markOnboardingSeen: jest.fn(),
      setGuest: jest.fn(),
      signOut,
    });

    expect(signOut).toHaveBeenCalledTimes(1);
  });
});

describe('root navigator mode policy', () => {
  it('shows loading while the session initializes', () => {
    expect(
      getRootNavigatorMode({
        hasHydratedOnboarding: true,
        hasSeenOnboarding: true,
        status: 'initializing',
      }),
    ).toBe('loading');
  });

  it('shows loading until onboarding state hydrates', () => {
    expect(
      getRootNavigatorMode({
        hasHydratedOnboarding: false,
        hasSeenOnboarding: true,
        status: 'guest',
      }),
    ).toBe('loading');
  });

  it('starts with auth for first-run guests', () => {
    expect(
      getRootNavigatorMode({
        hasHydratedOnboarding: true,
        hasSeenOnboarding: false,
        status: 'guest',
      }),
    ).toBe('authFirst');
  });

  it('starts with auth for incomplete authenticated profiles', () => {
    expect(
      getRootNavigatorMode({
        hasHydratedOnboarding: true,
        hasSeenOnboarding: true,
        status: 'authenticatedIncompleteProfile',
      }),
    ).toBe('authFirst');
  });

  it('starts with main tabs for returning guests', () => {
    expect(
      getRootNavigatorMode({
        hasHydratedOnboarding: true,
        hasSeenOnboarding: true,
        status: 'guest',
      }),
    ).toBe('main');
  });

  it('keeps authenticating users in main mode for auth modals', () => {
    expect(
      getRootNavigatorMode({
        hasHydratedOnboarding: true,
        hasSeenOnboarding: true,
        status: 'authenticating',
      }),
    ).toBe('main');
  });

  it('starts with main tabs for ready authenticated users', () => {
    expect(
      getRootNavigatorMode({
        hasHydratedOnboarding: true,
        hasSeenOnboarding: true,
        status: 'authenticatedReady',
      }),
    ).toBe('main');
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
