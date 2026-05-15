jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest/async-storage-mock'),
);
jest.mock('@react-navigation/native', () => ({
  CommonActions: {
    reset: jest.fn(payload => ({payload, type: 'RESET'})),
  },
}));

import {useSessionStore} from '../src/store/session-store';
import {useSettingsStore} from '../src/store/settings-store';
import {
  normalizeOnboardingStep,
  useOnboardingStore,
} from '../src/store/onboarding-store';
import {continueAsGuestFromAuth} from '../src/features/auth/services/auth-dismiss';
import {finalizeReadyProfileOnboardingSetup} from '../src/features/auth/services/onboarding-finalizer';
import {buildOnboardingPreferences} from '../src/features/auth/services/onboarding-payload';
import {
  completeOnboardingSetup,
  shouldCreateStarterCircle,
} from '../src/features/auth/services/onboarding-completion';
import {
  getProfileSignInParams,
  getWelcomeSignInParams,
  resolveSignInRouteIntent,
} from '../src/features/auth/services/auth-route-intent';
import {
  normalizeHandle,
  validateHandle,
} from '../src/features/auth/services/profile-validation';
import {dismissAuthModals} from '../src/navigation/auth-modal-dismiss';
import {getAuthInitialRouteName} from '../src/navigation/auth-stack-policy';
import {getStateWithoutAuthModal} from '../src/navigation/auth-modal-state';
import {canResumePendingAction} from '../src/navigation/pending-action-resume';
import {
  getRootNavigatorMode,
  shouldRegisterAccountRoutes,
} from '../src/navigation/root-mode';
import {
  getSettingsFallbackRoute,
  getSettingsResetRoute,
} from '../src/navigation/settings-fallback-route';
import {resolveStarterCircleDecision} from '../functions/src/auth/starter-circle-plan';

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

  it('clears stale protected actions when auth starts without an action', () => {
    useSessionStore.getState().setPendingAction({type: 'createCircle'});

    useSessionStore.getState().beginAuthFlow();

    expect(useSessionStore.getState().status).toBe('authenticating');
    expect(useSessionStore.getState().pendingAction).toBeUndefined();
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

  it('waits to resume pending actions while starter setup is pending', () => {
    expect(
      canResumePendingAction({
        hasPendingStarterCircleSetup: true,
        status: 'authenticatedReady',
      }),
    ).toBe(false);
    expect(
      canResumePendingAction({
        hasPendingStarterCircleSetup: false,
        status: 'authenticatedReady',
      }),
    ).toBe(true);
    expect(
      canResumePendingAction({
        hasPendingStarterCircleSetup: false,
        status: 'authenticating',
      }),
    ).toBe(false);
  });
});

describe('adaptive auth entry intent', () => {
  it('defaults direct sign-in routes to no selected method', () => {
    expect(resolveSignInRouteIntent()).toEqual({
      entryPoint: undefined,
      method: undefined,
    });
  });

  it('opens welcome sign-in action with social providers first', () => {
    expect(resolveSignInRouteIntent(getWelcomeSignInParams())).toEqual({
      entryPoint: 'welcome',
      method: undefined,
    });
  });

  it('opens profile auth with social providers first', () => {
    expect(resolveSignInRouteIntent(getProfileSignInParams())).toEqual({
      entryPoint: 'profile',
      method: undefined,
    });
  });

  it('preserves a selected returning-user sign-in method', () => {
    expect(
      resolveSignInRouteIntent({
        entryPoint: 'welcome',
        method: 'email',
      }),
    ).toEqual({
      entryPoint: 'welcome',
      method: 'email',
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

  it('signs out when continuing as guest with a user present', async () => {
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

  it('marks onboarding seen before sign-out can publish guest state', async () => {
    const events: string[] = [];

    await continueAsGuestFromAuth({
      clearPendingAction: () => events.push('clearPendingAction'),
      dismissAuth: () => events.push('dismissAuth'),
      hasAuthenticatedUser: () => true,
      markOnboardingSeen: () => events.push('markOnboardingSeen'),
      setGuest: () => events.push('setGuest'),
      signOut: async () => {
        events.push('signOut');
      },
    });

    expect(events).toEqual([
      'clearPendingAction',
      'markOnboardingSeen',
      'signOut',
      'setGuest',
      'dismissAuth',
    ]);
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

  it('keeps ready onboarding accounts in auth while starter setup is pending', () => {
    expect(
      getRootNavigatorMode({
        currentStep: 'finishProfile',
        hasHydratedOnboarding: true,
        hasPendingStarterCircleSetup: true,
        hasSeenOnboarding: false,
        status: 'authenticatedReady',
      }),
    ).toBe('authFirst');
  });

  it('keeps ready onboarding auth visible until the user finishes setup', () => {
    expect(
      getRootNavigatorMode({
        currentStep: 'auth',
        hasHydratedOnboarding: true,
        hasSeenOnboarding: false,
        status: 'authenticatedReady',
      }),
    ).toBe('authFirst');
  });

  it('keeps ready onboarding notification opt-in visible until setup continues', () => {
    expect(
      getRootNavigatorMode({
        currentStep: 'notifications',
        hasHydratedOnboarding: true,
        hasSeenOnboarding: false,
        status: 'authenticatedReady',
      }),
    ).toBe('authFirst');
  });

  it('does not restart ready users on stale profile completion', () => {
    expect(
      getRootNavigatorMode({
        currentStep: 'finishProfile',
        hasHydratedOnboarding: true,
        hasPendingStarterCircleSetup: false,
        hasSeenOnboarding: false,
        status: 'authenticatedReady',
      }),
    ).toBe('main');
  });

  it('only registers account routes for ready users in the main app', () => {
    expect(
      shouldRegisterAccountRoutes({
        mode: 'main',
        status: 'authenticatedReady',
      }),
    ).toBe(true);
    expect(
      shouldRegisterAccountRoutes({
        mode: 'main',
        status: 'guest',
      }),
    ).toBe(false);
    expect(
      shouldRegisterAccountRoutes({
        mode: 'authFirst',
        status: 'authenticatedReady',
      }),
    ).toBe(false);
  });
});

describe('auth stack route policy', () => {
  it('keeps onboarding profile completion inside the welcome wizard', () => {
    expect(
      getAuthInitialRouteName({
        currentStep: 'auth',
        status: 'authenticatedIncompleteProfile',
      }),
    ).toBe('Welcome');
    expect(
      getAuthInitialRouteName({
        currentStep: 'finishProfile',
        status: 'authenticatedIncompleteProfile',
      }),
    ).toBe('Welcome');
    expect(
      getAuthInitialRouteName({
        currentStep: 'notifications',
        status: 'authenticatedIncompleteProfile',
      }),
    ).toBe('Welcome');
  });

  it('keeps non-onboarding incomplete profiles on the standalone screen', () => {
    expect(
      getAuthInitialRouteName({
        currentStep: 'welcome',
        status: 'authenticatedIncompleteProfile',
      }),
    ).toBe('CompleteProfile');
  });

  it('starts complete authenticated sessions on the welcome stack until reset', () => {
    expect(
      getAuthInitialRouteName({
        currentStep: 'auth',
        status: 'authenticatedReady',
      }),
    ).toBe('Welcome');
  });
});

describe('auth modal dismissal state', () => {
  it('removes only the auth modal when main tabs are underneath', () => {
    expect(
      getStateWithoutAuthModal({
        index: 1,
        routes: [
          {key: 'main', name: 'MainTabs'},
          {key: 'auth', name: 'Auth'},
        ],
      }),
    ).toEqual({
      index: 0,
      routes: [{key: 'main', name: 'MainTabs'}],
    });
  });

  it('preserves a resumed protected action above auth', () => {
    expect(
      getStateWithoutAuthModal({
        index: 2,
        routes: [
          {key: 'main', name: 'MainTabs'},
          {key: 'auth', name: 'Auth'},
          {key: 'tap-in', name: 'TapInPicker'},
        ],
      }),
    ).toEqual({
      index: 1,
      routes: [
        {key: 'main', name: 'MainTabs'},
        {key: 'tap-in', name: 'TapInPicker'},
      ],
    });
  });

  it('drops stale account routes when auth closes', () => {
    expect(
      getStateWithoutAuthModal({
        index: 2,
        routes: [
          {key: 'main', name: 'MainTabs'},
          {key: 'settings', name: 'Settings'},
          {key: 'auth', name: 'Auth'},
        ],
      }),
    ).toEqual({
      index: 0,
      routes: [{key: 'main', name: 'MainTabs'}],
    });
  });

  it('removes duplicate auth modals in one reset', () => {
    expect(
      getStateWithoutAuthModal({
        index: 2,
        routes: [
          {key: 'main', name: 'MainTabs'},
          {key: 'auth-1', name: 'Auth'},
          {key: 'auth-2', name: 'Auth'},
        ],
      }),
    ).toEqual({
      index: 0,
      routes: [{key: 'main', name: 'MainTabs'}],
    });
  });

  it('leaves auth-first profile completion alone', () => {
    expect(
      getStateWithoutAuthModal({
        index: 0,
        routes: [{key: 'auth', name: 'Auth'}],
      }),
    ).toBeUndefined();
  });

  it('does not pop auth when no root reset is available', () => {
    const navigation = {
      dispatch: jest.fn(),
      getState: () => ({
        index: 1,
        routes: [
          {key: 'auth-1', name: 'Auth'},
          {key: 'auth-2', name: 'Auth'},
        ],
      }),
      goBack: jest.fn(),
    };

    dismissAuthModals(navigation as never);

    expect(navigation.dispatch).not.toHaveBeenCalled();
    expect(navigation.goBack).not.toHaveBeenCalled();
  });
});

describe('settings fallback routing', () => {
  it('returns Home tabs when the main navigator is active', () => {
    expect(getSettingsFallbackRoute(['MainTabs', 'Settings'])).toBe('MainTabs');
  });

  it('returns onboarding auth when tabs are not registered', () => {
    expect(getSettingsFallbackRoute(['Auth', 'Settings'])).toBe('Auth');
  });

  it('does not invent a route when no safe fallback exists', () => {
    expect(getSettingsFallbackRoute(['Settings'])).toBeUndefined();
  });

  it('builds a Home reset only when main tabs are registered', () => {
    expect(getSettingsResetRoute(['MainTabs', 'Settings'])).toEqual({
      name: 'MainTabs',
      params: {screen: 'Home'},
    });
  });

  it('builds an onboarding reset when auth is the active root', () => {
    expect(getSettingsResetRoute(['Auth', 'Settings'])).toEqual({
      name: 'Auth',
      params: {screen: 'Welcome'},
    });
  });
});

describe('settings auth entry', () => {
  it('starts onboarding without a Settings resume target', () => {
    useSessionStore.getState().setPendingAction({type: 'createCircle'});

    useSessionStore.getState().clearPendingAction();
    useSessionStore.getState().beginAuthFlow();
    useOnboardingStore.getState().startOnboardingWizard();

    expect(useSessionStore.getState()).toMatchObject({
      pendingAction: undefined,
      status: 'authenticating',
    });
    expect(useOnboardingStore.getState().currentStep).toBe('welcome');
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
    expect(useOnboardingStore.getState().currentStep).toBe('circleTitle');

    useOnboardingStore.getState().previousStep();
    expect(useOnboardingStore.getState().currentStep).toBe('goal');
  });

  it('routes circle review through notification opt-in before auth', () => {
    const store = useOnboardingStore.getState();

    store.setCurrentStep('circleReview');
    store.nextStep();
    expect(useOnboardingStore.getState().currentStep).toBe('notifications');

    useOnboardingStore.getState().nextStep();
    expect(useOnboardingStore.getState().currentStep).toBe('auth');
  });

  it('tracks the goal and builds onboarding preferences', () => {
    const store = useOnboardingStore.getState();

    store.setGoal('fitness');

    expect(useOnboardingStore.getState().getPreferences()).toEqual({
      goal: 'fitness',
    });
  });

  it('persists starter circle fields and skip intent', () => {
    const store = useOnboardingStore.getState();

    store.setGoal('focus');
    store.setStarterCircleField('title', 'Maker Mornings');
    store.setStarterCircleField('dailyTask', 'Ship one focused block');
    store.setFirstCircleSkipped(true);

    expect(useOnboardingStore.getState().starterCircleDraft).toMatchObject({
      category: 'Deep Work',
      dailyTask: 'Ship one focused block',
      title: 'Maker Mornings',
    });
    expect(useOnboardingStore.getState().firstCircleSkipped).toBe(true);
  });

  it('prepares and clears a pending starter circle setup', () => {
    const store = useOnboardingStore.getState();

    store.setStarterCircleField('title', 'Maker Mornings');
    store.setStarterCircleField('dailyTask', 'Ship one focused block');

    const setupId = store.prepareStarterCircleSetup();

    expect(setupId).toMatch(/^starter-/);
    expect(useOnboardingStore.getState()).toMatchObject({
      firstCircleSkipped: false,
      hasPendingStarterCircleSetup: true,
      starterCircleSetupId: setupId,
    });
    expect(useOnboardingStore.getState().prepareStarterCircleSetup()).toBe(
      setupId,
    );

    useOnboardingStore.getState().setFirstCircleSkipped(true);

    expect(useOnboardingStore.getState()).toMatchObject({
      firstCircleSkipped: true,
      hasPendingStarterCircleSetup: false,
      starterCircleSetupId: undefined,
    });
  });

  it('clears stale starter circle skip intent when starting a new attempt', () => {
    const store = useOnboardingStore.getState();

    store.setFirstCircleSkipped(true);
    store.setGoal('fitness');

    expect(useOnboardingStore.getState().firstCircleSkipped).toBe(false);

    const setupId = useOnboardingStore.getState().prepareStarterCircleSetup();

    useOnboardingStore.getState().setFirstCircleSkipped(true);
    useOnboardingStore.getState().startOnboardingWizard();

    expect(useOnboardingStore.getState()).toMatchObject({
      firstCircleSkipped: false,
      hasPendingStarterCircleSetup: false,
      starterCircleSetupId: undefined,
    });
    expect(useOnboardingStore.getState().starterCircleSetupId).not.toBe(
      setupId,
    );
  });

  it('normalizes removed persisted steps to active onboarding steps', () => {
    expect(normalizeOnboardingStep('categories')).toBe('circleTitle');
    expect(normalizeOnboardingStep('reminders')).toBe('circleTitle');
    expect(normalizeOnboardingStep('pace')).toBe('circleTitle');
    expect(normalizeOnboardingStep('profile')).toBe('circleTitle');
    expect(normalizeOnboardingStep('preview')).toBe('circleReview');
    expect(normalizeOnboardingStep('notifications')).toBe('notifications');
    expect(normalizeOnboardingStep('finishProfile')).toBe('finishProfile');
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
    useOnboardingStore.getState().startOnboardingWizard();

    expect(useOnboardingStore.getState().currentStep).toBe('welcome');
    expect(useSessionStore.getState().pendingAction).toEqual({
      circleId: 'circle-3',
      type: 'joinCircle',
    });
  });

  it('starts the onboarding wizard from the welcome step', () => {
    const store = useOnboardingStore.getState();

    store.setGoal('focus');
    store.setCurrentStep('auth');
    store.startOnboardingWizard();

    expect(useOnboardingStore.getState().currentStep).toBe('welcome');
    expect(useOnboardingStore.getState().goal).toBe('focus');
  });

  it('sends returning protected-action guests back through onboarding', () => {
    useOnboardingStore.getState().markSeen();
    useOnboardingStore.getState().startOnboardingWizard();

    expect(useOnboardingStore.getState().currentStep).toBe('welcome');
  });
});

describe('settings store', () => {
  it('resets persisted account preferences to guest defaults', () => {
    useSettingsStore.getState().setNotificationSettings({
      circleActivity: false,
      productUpdates: false,
      tapInReminders: false,
    });

    useSettingsStore.getState().reset();

    expect(useSettingsStore.getState().notifications).toEqual({
      circleActivity: true,
      productUpdates: true,
      tapInReminders: true,
    });
  });
});

describe('onboarding complete profile payload', () => {
  it('includes onboarding preferences when present', () => {
    expect(
      buildOnboardingPreferences({
        goal: 'wellness',
      }),
    ).toEqual({
      goal: 'wellness',
    });
  });

  it('omits onboarding preferences when there is no intake data', () => {
    expect(buildOnboardingPreferences({})).toBeUndefined();
  });
});

describe('onboarding completion finalizer', () => {
  const profile = {
    displayName: 'Kelvin North',
    handle: 'kelvin_north',
    timezone: 'America/New_York',
  };

  it('completes profile and creates the starter circle when ready', async () => {
    const completeProfile = jest.fn().mockResolvedValue({
      handle: 'kelvin_north',
      starterCircle: {circleId: 'circle-1'},
      uid: 'user-1',
    });
    const starterCircleDraft = {
      ...useOnboardingStore.getState().starterCircleDraft,
      dailyTask: 'Read 20 pages',
      graceRules: {
        skip: {
          allowance: 1,
          windowDays: 7,
        },
      },
      maxSize: 2,
      title: 'Readers',
    };

    await expect(
      completeOnboardingSetup(
        {
          firstCircleSkipped: false,
          profile,
          starterCircleDraft,
          starterCircleSetupId: 'setup-1',
        },
        {completeProfile},
      ),
    ).resolves.toEqual({
      circle: {circleId: 'circle-1'},
      circleCreated: true,
    });
    expect(completeProfile).toHaveBeenCalledWith(
      expect.objectContaining({
        ...profile,
        starterCircle: expect.objectContaining({
          dailyTask: 'Read 20 pages',
          graceRules: {
            skip: {
              allowance: 2,
              windowDays: 7,
            },
          },
          maxSize: 10,
          setupId: 'setup-1',
          title: 'Readers',
        }),
      }),
    );
  });

  it('skips circle creation when the user chose account only', async () => {
    const completeProfile = jest.fn().mockResolvedValue({
      handle: 'kelvin_north',
      uid: 'user-1',
    });
    const starterCircleDraft = {
      ...useOnboardingStore.getState().starterCircleDraft,
      dailyTask: 'Read 20 pages',
      title: 'Readers',
    };

    await expect(
      completeOnboardingSetup(
        {firstCircleSkipped: true, profile, starterCircleDraft},
        {completeProfile},
      ),
    ).resolves.toEqual({circleCreated: false});
    expect(completeProfile).toHaveBeenCalledWith(profile);
  });

  it('surfaces starter circle failures after profile completion starts', async () => {
    const completeProfile = jest
      .fn()
      .mockRejectedValue(new Error('Create failed'));
    const onProfileCompleted = jest.fn();
    const starterCircleDraft = {
      ...useOnboardingStore.getState().starterCircleDraft,
      dailyTask: 'Read 20 pages',
      title: 'Readers',
    };

    await expect(
      completeOnboardingSetup(
        {
          firstCircleSkipped: false,
          profile,
          starterCircleDraft,
          starterCircleSetupId: 'setup-1',
        },
        {completeProfile, onProfileCompleted},
      ),
    ).rejects.toThrow('Create failed');
    expect(onProfileCompleted).not.toHaveBeenCalled();
  });

  it('does not create an incomplete starter circle draft', () => {
    expect(
      shouldCreateStarterCircle({
        firstCircleSkipped: false,
        starterCircleDraft: useOnboardingStore.getState().starterCircleDraft,
      }),
    ).toBe(false);
  });

  it('requires a setup id before creating a starter circle', async () => {
    const completeProfile = jest.fn();
    const starterCircleDraft = {
      ...useOnboardingStore.getState().starterCircleDraft,
      dailyTask: 'Read 20 pages',
      title: 'Readers',
    };

    await expect(
      completeOnboardingSetup(
        {firstCircleSkipped: false, profile, starterCircleDraft},
        {completeProfile},
      ),
    ).rejects.toThrow('Starter circle setup is missing.');
    expect(completeProfile).not.toHaveBeenCalled();
  });
});

describe('ready profile onboarding finalizer', () => {
  it('finalizes a ready account with the pending starter setup id', async () => {
    const completeProfile = jest.fn().mockResolvedValue({
      handle: 'kelvin_north',
      starterCircle: {circleId: 'circle-1'},
      uid: 'user-1',
    });
    const starterCircleDraft = {
      ...useOnboardingStore.getState().starterCircleDraft,
      dailyTask: 'Read 20 pages',
      title: 'Readers',
    };

    await expect(
      finalizeReadyProfileOnboardingSetup(
        {
          firstCircleSkipped: false,
          onboardingPreferences: {goal: 'focus'},
          profile: {
            handle: 'kelvin_north',
            id: 'user-1',
            name: 'Kelvin North',
            timezone: 'America/New_York',
          },
          starterCircleDraft,
          starterCircleSetupId: 'setup-2',
          timezone: 'America/New_York',
        },
        {completeProfile},
      ),
    ).resolves.toMatchObject({
      circle: {circleId: 'circle-1'},
      circleCreated: true,
    });
    expect(completeProfile).toHaveBeenCalledWith(
      expect.objectContaining({
        displayName: 'Kelvin North',
        handle: 'kelvin_north',
        onboardingPreferences: {goal: 'focus'},
        starterCircle: expect.objectContaining({
          setupId: 'setup-2',
        }),
      }),
    );
  });
});

describe('starter circle callable decision', () => {
  it('creates, reuses, and repairs starter circles per setup id', () => {
    expect(
      resolveStarterCircleDecision({
        existingCircleIsValid: false,
        hasStarterCirclePayload: false,
      }),
    ).toBe('skip');
    expect(
      resolveStarterCircleDecision({
        existingCircleId: 'circle-1',
        existingCircleIsValid: true,
        existingSetupId: 'setup-1',
        hasStarterCirclePayload: true,
        setupId: 'setup-1',
      }),
    ).toBe('reuse');
    expect(
      resolveStarterCircleDecision({
        existingCircleId: 'circle-1',
        existingCircleIsValid: false,
        existingSetupId: 'setup-1',
        hasStarterCirclePayload: true,
        setupId: 'setup-1',
      }),
    ).toBe('repair');
    expect(
      resolveStarterCircleDecision({
        existingCircleId: 'circle-1',
        existingCircleIsValid: true,
        existingSetupId: 'setup-1',
        hasStarterCirclePayload: true,
        setupId: 'setup-2',
      }),
    ).toBe('create');
  });
});
