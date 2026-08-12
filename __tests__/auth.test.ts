jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest/async-storage-mock'),
);
jest.mock('@react-navigation/native', () => ({
  CommonActions: {
    reset: jest.fn(payload => ({payload, type: 'RESET'})),
  },
}));

import type {CreateCircleDraft} from '../src/types/models';
import {useSessionStore} from '../src/store/session-store';
import {useSettingsStore} from '../src/store/settings-store';
import {resolveHoystThemeScheme} from '../src/design/theme/useHoystTheme';
import {
  migratePersistedOnboardingState,
  normalizeOnboardingStep,
  normalizeOnboardingStepForMode,
  useOnboardingStore,
} from '../src/store/onboarding-store';
import {continueAsGuestFromAuth} from '../src/features/auth/services/auth-dismiss';
import {finalizeReadyProfileOnboardingSetup} from '../src/features/auth/services/onboarding-finalizer';
import {
  applyStarterCircleHiddenDefaults,
  buildStarterCirclePayload,
  isStarterCircleDraftReady,
} from '../src/features/auth/services/onboarding-circle';
import {buildOnboardingPreferences} from '../src/features/auth/services/onboarding-payload';
import {getOnboardingStepCopy} from '../src/features/auth/services/onboarding-copy';
import {
  getOnboardingProgressSteps,
  getOnboardingSteps,
} from '../src/features/auth/services/onboarding-options';
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
  getRootAuthPresentation,
  getRootNavigatorMode,
  shouldDismissAuthModal,
  shouldRegisterAuthModal,
  shouldRegisterAccountRoutes,
} from '../src/navigation/root-mode';
import {resolveStarterCircleDecision} from '../functions/src/auth/starter-circle-plan';
import {
  getInputCommitmentCadence,
  getStoredCommitmentFrequency,
} from '../functions/src/shared/commitments';

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

  it('publishes guest mode before sign-out can keep auth visible', async () => {
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
      'setGuest',
      'dismissAuth',
      'signOut',
      'markOnboardingSeen',
      'setGuest',
      'dismissAuth',
    ]);
  });

  it('continues as guest even when sign-out cleanup fails', async () => {
    const events: string[] = [];

    await expect(
      continueAsGuestFromAuth({
        clearPendingAction: () => events.push('clearPendingAction'),
        dismissAuth: () => events.push('dismissAuth'),
        hasAuthenticatedUser: () => true,
        markOnboardingSeen: () => events.push('markOnboardingSeen'),
        setGuest: () => events.push('setGuest'),
        signOut: async () => {
          events.push('signOut');
          throw new Error('User was already deleted.');
        },
      }),
    ).resolves.toBeUndefined();

    expect(events).toEqual([
      'clearPendingAction',
      'markOnboardingSeen',
      'setGuest',
      'dismissAuth',
      'signOut',
      'markOnboardingSeen',
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

  it('starts with main tabs for first-run guests', () => {
    expect(
      getRootNavigatorMode({
        hasHydratedOnboarding: true,
        hasSeenOnboarding: false,
        status: 'guest',
      }),
    ).toBe('main');
  });

  it('starts with main tabs for incomplete authenticated profiles', () => {
    expect(
      getRootNavigatorMode({
        hasHydratedOnboarding: true,
        hasSeenOnboarding: true,
        status: 'authenticatedIncompleteProfile',
      }),
    ).toBe('main');
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

  it('keeps the root mounted while an authenticated user profile loads', () => {
    useSessionStore.getState().setAuthenticating({
      displayName: 'Kelvin',
      email: 'kelvin@example.com',
      providerIds: ['password'],
      uid: 'uid-1',
    });

    expect(useSessionStore.getState().status).toBe('authenticating');
    expect(useSessionStore.getState().user?.uid).toBe('uid-1');
    expect(
      getRootNavigatorMode({
        hasHydratedOnboarding: true,
        hasSeenOnboarding: false,
        status: useSessionStore.getState().status,
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

  it('keeps ready onboarding accounts in main while starter setup is pending', () => {
    expect(
      getRootNavigatorMode({
        currentStep: 'finishProfile',
        hasHydratedOnboarding: true,
        hasPendingStarterCircleSetup: true,
        hasSeenOnboarding: false,
        status: 'authenticatedReady',
      }),
    ).toBe('main');
  });

  it('keeps ready onboarding auth in main until the user finishes setup', () => {
    expect(
      getRootNavigatorMode({
        currentStep: 'auth',
        hasHydratedOnboarding: true,
        hasSeenOnboarding: false,
        status: 'authenticatedReady',
      }),
    ).toBe('main');
  });

  it('keeps ready onboarding notification opt-in in main until setup continues', () => {
    expect(
      getRootNavigatorMode({
        currentStep: 'notifications',
        hasHydratedOnboarding: true,
        hasSeenOnboarding: false,
        status: 'authenticatedReady',
      }),
    ).toBe('main');
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
        mode: 'loading',
        status: 'authenticatedReady',
      }),
    ).toBe(false);
  });
});

describe('root auth modal policy', () => {
  it('auto-presents onboarding for first-run guests without pending actions', () => {
    expect(
      getRootAuthPresentation({
        hasHydratedOnboarding: true,
        hasSeenOnboarding: false,
        status: 'guest',
      }),
    ).toBe('onboarding');
  });

  it('does not auto-present onboarding when a pending action exists', () => {
    expect(
      getRootAuthPresentation({
        hasHydratedOnboarding: true,
        hasSeenOnboarding: false,
        pendingAction: {type: 'createCircle'},
        status: 'guest',
      }),
    ).toBeUndefined();
  });

  it('does not auto-present onboarding for returning guests', () => {
    expect(
      getRootAuthPresentation({
        hasHydratedOnboarding: true,
        hasSeenOnboarding: true,
        status: 'guest',
      }),
    ).toBeUndefined();
  });

  it('auto-presents onboarding finish profile for incomplete authenticated profiles', () => {
    expect(
      getRootAuthPresentation({
        currentStep: 'welcome',
        hasHydratedOnboarding: true,
        hasSeenOnboarding: true,
        status: 'authenticatedIncompleteProfile',
      }),
    ).toBe('finishProfile');
  });

  it('keeps incomplete profile presentation inside onboarding registration', () => {
    expect(
      getRootAuthPresentation({
        currentStep: 'auth',
        hasHydratedOnboarding: true,
        hasSeenOnboarding: false,
        status: 'authenticatedIncompleteProfile',
      }),
    ).toBe('finishProfile');
    expect(
      getRootAuthPresentation({
        currentStep: 'finishProfile',
        hasHydratedOnboarding: true,
        hasSeenOnboarding: false,
        status: 'authenticatedIncompleteProfile',
      }),
    ).toBe('finishProfile');
  });

  it('re-presents active profile completion if ready auth briefly closes', () => {
    expect(
      getRootAuthPresentation({
        currentStep: 'finishProfile',
        hasHydratedOnboarding: true,
        hasPendingProfileCompletion: true,
        hasSeenOnboarding: false,
        status: 'authenticatedReady',
      }),
    ).toBe('finishProfile');
  });

  it('registers auth modal for active ready onboarding work', () => {
    expect(
      shouldRegisterAuthModal({
        currentStep: 'auth',
        hasPendingStarterCircleSetup: false,
        hasSeenOnboarding: false,
        mode: 'main',
        status: 'authenticatedReady',
      }),
    ).toBe(true);
  });

  it('keeps auth modal route registered throughout main mode', () => {
    expect(
      shouldRegisterAuthModal({
        currentStep: 'welcome',
        hasPendingStarterCircleSetup: false,
        hasSeenOnboarding: true,
        mode: 'main',
        status: 'authenticatedReady',
      }),
    ).toBe(true);
    expect(
      shouldRegisterAuthModal({
        currentStep: 'welcome',
        hasPendingStarterCircleSetup: false,
        hasSeenOnboarding: true,
        mode: 'loading',
        status: 'authenticatedReady',
      }),
    ).toBe(false);
  });

  it('keeps auth modal open while ready onboarding work is active', () => {
    expect(
      shouldDismissAuthModal({
        currentStep: 'notifications',
        hasPendingStarterCircleSetup: false,
        hasSeenOnboarding: false,
        status: 'authenticatedReady',
      }),
    ).toBe(false);
    expect(
      shouldDismissAuthModal({
        currentStep: 'welcome',
        hasPendingStarterCircleSetup: false,
        hasSeenOnboarding: true,
        status: 'authenticatedReady',
      }),
    ).toBe(true);
  });

  it('keeps active profile completion open during registration handoff', () => {
    expect(
      shouldDismissAuthModal({
        currentStep: 'finishProfile',
        hasPendingProfileCompletion: true,
        hasPendingStarterCircleSetup: false,
        hasSeenOnboarding: false,
        status: 'authenticatedReady',
      }),
    ).toBe(false);
    expect(
      shouldDismissAuthModal({
        currentStep: 'finishProfile',
        hasPendingProfileCompletion: false,
        hasPendingStarterCircleSetup: false,
        hasSeenOnboarding: false,
        status: 'authenticatedReady',
      }),
    ).toBe(true);
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

  it('keeps non-onboarding incomplete profiles inside the welcome wizard', () => {
    expect(
      getAuthInitialRouteName({
        currentStep: 'welcome',
        status: 'authenticatedIncompleteProfile',
      }),
    ).toBe('Welcome');
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
          {key: 'edit-profile', name: 'EditProfile'},
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

describe('onboarding store', () => {
  beforeEach(() => {
    useOnboardingStore.getState().reset();
    useOnboardingStore.setState({hasHydrated: true});
  });

  it('moves through the Duolingo-style stepper', () => {
    const store = useOnboardingStore.getState();

    store.setCurrentStep('circleCategory');
    store.nextStep();
    expect(useOnboardingStore.getState().currentStep).toBe('circleTitle');

    useOnboardingStore.getState().previousStep();
    expect(useOnboardingStore.getState().currentStep).toBe('circleCategory');
  });

  it('places the circle mode choice between commitment and group setup', () => {
    const store = useOnboardingStore.getState();

    store.setCurrentStep('circleCommitment');
    store.nextStep();
    expect(useOnboardingStore.getState().currentStep).toBe('circleMode');

    useOnboardingStore.getState().nextStep();
    expect(useOnboardingStore.getState().currentStep).toBe('circleCategory');

    useOnboardingStore.getState().previousStep();
    expect(useOnboardingStore.getState().currentStep).toBe('circleMode');
  });

  it('uses the complete personal path while skipping group-only steps', () => {
    const store = useOnboardingStore.getState();

    store.setStarterCircleField('circleMode', 'personal');
    store.setCurrentStep('circleMode');
    store.nextStep();
    expect(useOnboardingStore.getState().currentStep).toBe('circleCategory');

    useOnboardingStore.getState().nextStep();
    expect(useOnboardingStore.getState().currentStep).toBe('circleRules');

    useOnboardingStore.getState().setCurrentStep('circleGrace');
    useOnboardingStore.getState().nextStep();
    expect(useOnboardingStore.getState().currentStep).toBe('circleTimezone');
  });

  it('defines the complete Personal and group onboarding paths', () => {
    expect(getOnboardingSteps('personal')).toEqual([
      'welcome',
      'coach',
      'circleCommitment',
      'circleMode',
      'circleCategory',
      'circleRules',
      'circleGrace',
      'circleTimezone',
      'circleReview',
      'notifications',
      'auth',
      'finishProfile',
    ]);
    expect(getOnboardingSteps('group')).toEqual([
      'welcome',
      'coach',
      'circleCommitment',
      'circleMode',
      'circleCategory',
      'circleTitle',
      'circleRules',
      'circleGrace',
      'circlePrivacy',
      'circleCapacity',
      'circleTimezone',
      'circleReview',
      'notifications',
      'auth',
      'finishProfile',
    ]);
    expect(getOnboardingProgressSteps('personal')).toHaveLength(11);
    expect(getOnboardingProgressSteps('group')).toHaveLength(14);
  });

  it('uses exact mode-aware onboarding copy', () => {
    expect(getOnboardingStepCopy('circleCategory', true).prompt).toBe(
      'What kind of Commitment is this?',
    );
    expect(getOnboardingStepCopy('circleRules', true).body).toContain(
      'You Tap In',
    );
    expect(getOnboardingStepCopy('circleRules', false).body).toContain(
      'Each Member taps in',
    );
    expect(getOnboardingStepCopy('circleGrace', true).body).toContain(
      'your Progress',
    );
    expect(getOnboardingStepCopy('circleGrace', false).body).toContain(
      'Circle Progress',
    );
    expect(getOnboardingStepCopy('circleTimezone', true)).toMatchObject({
      body: expect.stringContaining('this Commitment'),
      prompt: 'Which timezone should this Commitment use?',
    });
    expect(getOnboardingStepCopy('notifications', true).prompt).not.toContain(
      'Member',
    );
    expect(getOnboardingStepCopy('notifications', false).prompt).toContain(
      'Circle activity updates',
    );
  });

  it('routes circle review through notification opt-in before auth', () => {
    const store = useOnboardingStore.getState();

    store.setCurrentStep('circleReview');
    store.nextStep();
    expect(useOnboardingStore.getState().currentStep).toBe('notifications');

    useOnboardingStore.getState().nextStep();
    expect(useOnboardingStore.getState().currentStep).toBe('auth');
  });

  it('tracks the focusArea and builds onboarding preferences', () => {
    const store = useOnboardingStore.getState();

    store.setFocusArea('fitness');

    expect(useOnboardingStore.getState().getPreferences()).toEqual({
      categories: ['Fitness'],
      focusArea: 'fitness',
    });
  });

  it('keeps account and Commitment timezones independent after selection', () => {
    const store = useOnboardingStore.getState();

    store.setStarterCircleField('timezone', 'Asia/Katmandu');
    store.setTimezone('America/New_York');

    expect(useOnboardingStore.getState()).toMatchObject({
      starterCircleDraft: {timezone: 'Asia/Katmandu'},
      timezone: 'America/New_York',
    });
  });

  it('preserves hidden group settings while switching modes', () => {
    const store = useOnboardingStore.getState();

    store.setStarterCircleField('title', 'Readers Together');
    store.setStarterCircleField('maxSize', 25);
    store.setStarterCircleField('privacyMode', 'private');
    store.setStarterCircleField('graceRules', {
      skip: {allowance: 4, windowDays: 14},
    });
    store.setStarterCircleField('circleMode', 'personal');
    store.setStarterCircleField('circleMode', 'group');

    expect(useOnboardingStore.getState().starterCircleDraft).toMatchObject({
      circleMode: 'group',
      graceRules: {skip: {allowance: 4, windowDays: 14}},
      maxSize: 25,
      privacyMode: 'private',
      title: 'Readers Together',
    });
  });

  it('persists starter circle fields and skip intent', () => {
    const store = useOnboardingStore.getState();

    store.setFocusArea('focus');
    store.setStarterCircleField('title', 'Maker Mornings');
    store.setStarterCircleField('commitment', 'Ship one focused block');
    store.setFirstCircleSkipped(true);

    expect(useOnboardingStore.getState().starterCircleDraft).toMatchObject({
      category: 'Deep Work',
      commitment: 'Ship one focused block',
      title: 'Maker Mornings',
    });
    expect(useOnboardingStore.getState().firstCircleSkipped).toBe(true);
  });

  it('prepares and clears a pending starter circle setup', () => {
    const store = useOnboardingStore.getState();

    store.setStarterCircleField('title', 'Maker Mornings');
    store.setStarterCircleField('commitment', 'Ship one focused block');

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
    store.setFocusArea('fitness');

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

  it('resets stale starter circle draft fields when starting a new attempt', () => {
    const store = useOnboardingStore.getState();

    store.setFocusArea('focus');
    store.setStarterCircleField('title', 'Stale Makers');
    store.setStarterCircleField('commitment', 'Ship a stale block');
    store.startOnboardingWizard();

    expect(useOnboardingStore.getState().starterCircleDraft).toMatchObject({
      category: 'Deep Work',
      commitmentCadence: 'daily',
      commitmentFrequency: {tapInsPerWeek: 7},
      commitment: '',
      title: '',
    });
  });

  it('preserves weekly starter cadence drafts during normalization', () => {
    const weeklyDraft = {
      ...useOnboardingStore.getState().starterCircleDraft,
      commitmentCadence: 'weekly' as const,
      commitmentFrequency: {tapInsPerWeek: 4},
    };

    expect(applyStarterCircleHiddenDefaults(weeklyDraft)).toMatchObject({
      commitmentCadence: 'weekly',
      commitmentFrequency: {tapInsPerWeek: 4},
    });
  });

  it('normalizes removed persisted steps to active onboarding steps', () => {
    expect(normalizeOnboardingStep('categories')).toBe('circleCategory');
    expect(normalizeOnboardingStep('focusArea')).toBe('circleCategory');
    expect(normalizeOnboardingStep('circleFrequency')).toBe('circleRules');
    expect(normalizeOnboardingStep('commitmentFrequency')).toBe(
      'circleRules',
    );
    expect(normalizeOnboardingStep('reminders')).toBe('circleTitle');
    expect(normalizeOnboardingStep('pace')).toBe('circleTitle');
    expect(normalizeOnboardingStep('profile')).toBe('circleTitle');
    expect(normalizeOnboardingStep('preview')).toBe('circleReview');
    expect(normalizeOnboardingStep('notifications')).toBe('notifications');
    expect(normalizeOnboardingStep('finishProfile')).toBe('finishProfile');
    expect(normalizeOnboardingStepForMode('circleTitle', 'personal')).toBe(
      'circleRules',
    );
    expect(normalizeOnboardingStepForMode('circlePrivacy', 'personal')).toBe(
      'circleTimezone',
    );
  });

  it('migrates legacy category and Rules steps without losing draft choices', () => {
    const migrated = migratePersistedOnboardingState({
      currentStep: 'circleCadence',
      focusArea: 'focus',
      starterCircleDraft: {
        ...useOnboardingStore.getState().starterCircleDraft,
        category: undefined,
        graceRules: {skip: {allowance: 3, windowDays: 10}},
        maxSize: 25,
        privacyMode: 'private',
        title: 'Maker Mornings',
      },
      timezone: 'America/New_York',
    });

    expect(migrated).toMatchObject({
      categories: ['Deep Work'],
      currentStep: 'circleRules',
      starterCircleDraft: {
        category: 'Deep Work',
        graceRules: {skip: {allowance: 3, windowDays: 10}},
        maxSize: 25,
        privacyMode: 'private',
        title: 'Maker Mornings',
      },
    });
  });

  it('moves a Personal draft off persisted group-only steps', () => {
    const migrated = migratePersistedOnboardingState({
      currentStep: 'circleCapacity',
      starterCircleDraft: {
        ...useOnboardingStore.getState().starterCircleDraft,
        circleMode: 'personal',
      },
    });

    expect(migrated.currentStep).toBe('circleTimezone');
  });

  it('does not repeat first-run onboarding after guest continuation', () => {
    useOnboardingStore.getState().markSeen();
    useSessionStore.getState().setGuest();

    expect(useOnboardingStore.getState().hasSeenOnboarding).toBe(true);
    expect(useSessionStore.getState().status).toBe('guest');
    expect(useSessionStore.getState().user).toBeUndefined();
  });

  it('keeps guests in main mode after account deletion resets onboarding', () => {
    useOnboardingStore.getState().setCurrentStep('auth');
    useOnboardingStore.getState().reset();
    useOnboardingStore.getState().markSeen();
    useSessionStore.getState().setGuest();

    expect(useOnboardingStore.getState()).toMatchObject({
      currentStep: 'welcome',
      hasSeenOnboarding: true,
    });
    expect(
      getRootNavigatorMode({
        currentStep: useOnboardingStore.getState().currentStep,
        hasHydratedOnboarding: true,
        hasSeenOnboarding: useOnboardingStore.getState().hasSeenOnboarding,
        status: useSessionStore.getState().status,
      }),
    ).toBe('main');
  });

  it('does not rewind the wizard when continuing as guest from auth', async () => {
    useOnboardingStore.getState().setCurrentStep('auth');

    await continueAsGuestFromAuth({
      clearPendingAction: useSessionStore.getState().clearPendingAction,
      dismissAuth: jest.fn(),
      hasAuthenticatedUser: () => false,
      markOnboardingSeen: useOnboardingStore.getState().markSeen,
      setGuest: useSessionStore.getState().setGuest,
      signOut: jest.fn(),
    });

    expect(useOnboardingStore.getState().currentStep).toBe('auth');
    expect(useOnboardingStore.getState().hasSeenOnboarding).toBe(true);
    expect(useSessionStore.getState().status).toBe('guest');
    expect(
      getRootNavigatorMode({
        currentStep: useOnboardingStore.getState().currentStep,
        hasHydratedOnboarding: true,
        hasSeenOnboarding: useOnboardingStore.getState().hasSeenOnboarding,
        status: useSessionStore.getState().status,
      }),
    ).toBe('main');
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

    store.setFocusArea('focus');
    store.setCurrentStep('auth');
    store.startOnboardingWizard();

    expect(useOnboardingStore.getState().currentStep).toBe('welcome');
    expect(useOnboardingStore.getState().focusArea).toBe('focus');
  });

  it('sends returning protected-action guests back through onboarding', () => {
    useOnboardingStore.getState().markSeen();
    useOnboardingStore.getState().startOnboardingWizard();

    expect(useOnboardingStore.getState().currentStep).toBe('welcome');
    expect(useOnboardingStore.getState().hasSeenOnboarding).toBe(false);
  });

  it('tracks profile completion handoff as active onboarding again', () => {
    useOnboardingStore.getState().markSeen();
    useOnboardingStore.getState().prepareProfileCompletion();
    useOnboardingStore.getState().setCurrentStep('finishProfile');

    expect(useOnboardingStore.getState()).toMatchObject({
      currentStep: 'finishProfile',
      hasPendingProfileCompletion: true,
      hasSeenOnboarding: false,
    });

    useOnboardingStore.getState().markSeen();

    expect(useOnboardingStore.getState()).toMatchObject({
      hasPendingProfileCompletion: false,
      hasSeenOnboarding: true,
    });
  });
});

describe('settings store', () => {
  beforeEach(() => {
    useSettingsStore.getState().reset();
  });

  it('defaults appearance to dark', () => {
    expect(useSettingsStore.getState().appearance).toBe('dark');
  });

  it('updates appearance preference', () => {
    useSettingsStore.getState().setAppearancePreference('system');

    expect(useSettingsStore.getState().appearance).toBe('system');

    useSettingsStore.getState().setAppearancePreference('light');

    expect(useSettingsStore.getState().appearance).toBe('light');
  });

  it('resets persisted account preferences to guest defaults', () => {
    useSettingsStore.getState().setAppearancePreference('light');
    useSettingsStore.getState().setNotificationSettings({
      discovery: false,
      nudgePrompts: false,
      nudges: false,
      productUpdates: false,
      socialActivity: false,
      tapInReminders: false,
    });

    useSettingsStore.getState().reset();

    expect(useSettingsStore.getState().appearance).toBe('dark');
    expect(useSettingsStore.getState().notifications).toEqual({
      discovery: true,
      nudgePrompts: true,
      nudges: true,
      productUpdates: true,
      socialActivity: true,
      tapInReminders: true,
    });
  });
});

describe('theme appearance resolution', () => {
  it('forces dark regardless of system setting', () => {
    expect(resolveHoystThemeScheme('dark', 'light')).toBe('dark');
  });

  it('forces light regardless of system setting', () => {
    expect(resolveHoystThemeScheme('light', 'dark')).toBe('light');
  });

  it('follows system setting when requested', () => {
    expect(resolveHoystThemeScheme('system', 'dark')).toBe('dark');
    expect(resolveHoystThemeScheme('system', 'light')).toBe('light');
  });
});

describe('onboarding complete profile payload', () => {
  it('includes onboarding preferences when present', () => {
    expect(
      buildOnboardingPreferences({
        focusArea: 'wellness',
      }),
    ).toEqual({
      focusArea: 'wellness',
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
      commitmentCadence: 'weekly' as const,
      commitmentFrequency: {tapInsPerWeek: 4},
      commitment: 'Read 20 pages',
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
          commitmentCadence: 'weekly',
          commitment: 'Read 20 pages',
          commitmentFrequency: {tapInsPerWeek: 4},
          graceRules: {
            skip: {
              allowance: 1,
              windowDays: 7,
            },
          },
          maxSize: 2,
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
      commitment: 'Read 20 pages',
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
      commitment: 'Read 20 pages',
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

  it('allows a personal starter Commitment without a Circle name', () => {
    const draft = {
      ...useOnboardingStore.getState().starterCircleDraft,
      circleMode: 'personal' as const,
      commitment: 'Read 20 pages',
      title: '',
    };

    expect(isStarterCircleDraftReady(draft)).toBe(true);
    expect(buildStarterCirclePayload(draft)).toMatchObject({
      circleMode: 'personal',
      joinMode: 'invite_only',
      maxSize: 1,
      privacy: 'private',
      title: 'Read 20 pages',
    });
  });

  it('treats legacy starter drafts without commitments as incomplete', () => {
    const legacyDraft = {
      ...useOnboardingStore.getState().starterCircleDraft,
      commitment: undefined,
      title: 'Legacy Circle',
    };

    expect(() =>
      isStarterCircleDraftReady(legacyDraft as unknown as CreateCircleDraft),
    ).not.toThrow();
    expect(
      isStarterCircleDraftReady(legacyDraft as unknown as CreateCircleDraft),
    ).toBe(false);
    expect(
      shouldCreateStarterCircle({
        firstCircleSkipped: false,
        starterCircleDraft: legacyDraft as unknown as CreateCircleDraft,
      }),
    ).toBe(false);
  });

  it('requires a setup id before creating a starter circle', async () => {
    const completeProfile = jest.fn();
    const starterCircleDraft = {
      ...useOnboardingStore.getState().starterCircleDraft,
      commitment: 'Read 20 pages',
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
      commitment: 'Read 20 pages',
      title: 'Readers',
    };

    await expect(
      finalizeReadyProfileOnboardingSetup(
        {
          firstCircleSkipped: false,
          onboardingPreferences: {focusArea: 'focus'},
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
        onboardingPreferences: {focusArea: 'focus'},
        starterCircle: expect.objectContaining({
          setupId: 'setup-2',
        }),
      }),
    );
  });
});

describe('starter circle callable decision', () => {
  it('normalizes weekly starter cadence for callable storage', () => {
    const weeklyCadence = getInputCommitmentCadence('weekly', {
      tapInsPerWeek: 4,
    });

    expect(weeklyCadence).toBe('weekly');
    expect(
      getStoredCommitmentFrequency(weeklyCadence, {tapInsPerWeek: 4}),
    ).toEqual({tapInsPerWeek: 4});

    const dailyCadence = getInputCommitmentCadence('daily', {
      tapInsPerWeek: 4,
    });

    expect(dailyCadence).toBe('daily');
    expect(
      getStoredCommitmentFrequency(dailyCadence, {tapInsPerWeek: 4}),
    ).toEqual({tapInsPerWeek: 7});
  });

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
