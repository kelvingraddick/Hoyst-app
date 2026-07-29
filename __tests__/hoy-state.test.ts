import {
  getHoyAccessibilityLabel,
  getNotificationAccessibilityLabel,
  getStableHoyDisplayState,
  getHoyState,
  type HoyStateInput,
} from '../src/features/home/services/hoy-state';

const baseInput: HoyStateInput = {
  activeCircleCount: 0,
  hasDeadlineRisk: false,
  hasUnrecoveredMiss: false,
  isAuthenticatedHome: true,
  isCelebrating: false,
  isGreetingLoading: false,
  isIncompleteProfile: false,
  isLoadingHomeData: false,
  pendingCount: 0,
  rollingMomentumStatus: 'building_momentum',
};

describe('getHoyState', () => {
  it.each([
    ['locked', {isAuthenticatedHome: false}],
    ['thinking', {isLoadingHomeData: true}],
    ['celebrating', {isCelebrating: true}],
    ['risk_attention', {hasUnrecoveredMiss: true}],
    ['tap_in_needed', {hasDeadlineRisk: true}],
    ['momentum_peak', {rollingMomentumStatus: 'peak_momentum'}],
    ['momentum_strong', {rollingMomentumStatus: 'strong_momentum'}],
    ['momentum_building', {}],
  ] as const)('resolves %s from live Home data', (expected, overrides) => {
    expect(getHoyState({...baseInput, ...overrides})).toBe(expected);
  });

  it('uses the documented priority when multiple conditions conflict', () => {
    expect(
      getHoyState({
        ...baseInput,
        activeCircleCount: 1,
        hasDeadlineRisk: true,
        hasUnrecoveredMiss: true,
        isCelebrating: true,
        isGreetingLoading: true,
        isLoadingHomeData: true,
        rollingMomentumStatus: 'peak_momentum',
      }),
    ).toBe('thinking');

    expect(
      getHoyState({
        ...baseInput,
        activeCircleCount: 1,
        hasDeadlineRisk: true,
        hasUnrecoveredMiss: true,
        isCelebrating: true,
        rollingMomentumStatus: 'peak_momentum',
      }),
    ).toBe('celebrating');

    expect(
      getHoyState({
        ...baseInput,
        activeCircleCount: 1,
        hasDeadlineRisk: true,
        hasUnrecoveredMiss: true,
        rollingMomentumStatus: 'peak_momentum',
      }),
    ).toBe('risk_attention');
  });

  it('locks guests, incomplete profiles, and pending-only memberships', () => {
    expect(getHoyState({...baseInput, isAuthenticatedHome: false})).toBe(
      'locked',
    );
    expect(getHoyState({...baseInput, isIncompleteProfile: true})).toBe(
      'locked',
    );
    expect(getHoyState({...baseInput, pendingCount: 2})).toBe('locked');
  });

  it('keeps an authenticated zero-Circle Home in the calm building state', () => {
    expect(getHoyState(baseInput)).toBe('momentum_building');
  });
});

describe('getStableHoyDisplayState', () => {
  it('uses no face before the first resolved state', () => {
    expect(
      getStableHoyDisplayState({
        candidateState: 'thinking',
        isSessionResolving: false,
      }),
    ).toBeUndefined();
    expect(
      getStableHoyDisplayState({
        candidateState: 'locked',
        isSessionResolving: true,
      }),
    ).toBeUndefined();
  });

  it('retains the last resolved face during later refreshes', () => {
    expect(
      getStableHoyDisplayState({
        candidateState: 'thinking',
        isSessionResolving: false,
        previousResolvedState: 'risk_attention',
      }),
    ).toBe('risk_attention');
    expect(
      getStableHoyDisplayState({
        candidateState: 'locked',
        isSessionResolving: true,
        previousResolvedState: 'momentum_strong',
      }),
    ).toBe('momentum_strong');
  });

  it('uses a newly resolved final state immediately', () => {
    expect(
      getStableHoyDisplayState({
        candidateState: 'momentum_peak',
        isSessionResolving: false,
        previousResolvedState: 'risk_attention',
      }),
    ).toBe('momentum_peak');
  });
});

describe('getHoyAccessibilityLabel', () => {
  it('announces Hoy state and contextual action', () => {
    expect(
      getHoyAccessibilityLabel({
        headline: 'Kelvin, Workout Circle needs your Tap In.',
        isDisabled: false,
        state: 'tap_in_needed',
      }),
    ).toBe(
      'Hoy, Tap In deadline approaching. Kelvin, Workout Circle needs your Tap In. Open this action.',
    );
    expect(
      getHoyAccessibilityLabel({
        headline: 'Kelvin, Workout Circle is at risk. Tap In now.',
        isDisabled: false,
        state: 'risk_attention',
      }),
    ).toContain('Workout Circle is at risk');
  });

  it('uses a neutral loading label until the action is resolved', () => {
    expect(
      getHoyAccessibilityLabel({
        isDisabled: true,
        state: undefined,
      }),
    ).toBe('Hoy is getting your next action ready.');
  });
});

describe('getNotificationAccessibilityLabel', () => {
  it('announces the unread count separately from Hoy', () => {
    expect(getNotificationAccessibilityLabel(0)).toBe(
      'Notifications, no unread updates',
    );
    expect(getNotificationAccessibilityLabel(1)).toBe(
      'Notifications, 1 unread update',
    );
    expect(getNotificationAccessibilityLabel(13)).toBe(
      'Notifications, 9 or more unread updates',
    );
  });
});
