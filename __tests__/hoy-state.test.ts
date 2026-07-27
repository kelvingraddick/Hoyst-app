import {
  getHoyAccessibilityLabel,
  getHoyCelebrationSnapshot,
  getHoyState,
  type HoyStateInput,
} from '../src/features/home/services/hoy-state';

const baseInput: HoyStateInput = {
  activeCircleCount: 0,
  atRiskCount: 0,
  doneCount: 0,
  hasHomeDataError: false,
  isAuthenticatedHome: true,
  isCelebrating: false,
  isGreetingLoading: false,
  isIncompleteProfile: false,
  isLoadingHomeData: false,
  needsYouCount: 0,
  pendingCount: 0,
  personalStreakDays: 0,
};

describe('getHoyState', () => {
  it.each([
    ['locked', {isAuthenticatedHome: false}],
    ['thinking', {isLoadingHomeData: true}],
    ['celebrating', {isCelebrating: true}],
    ['risk_attention', {atRiskCount: 1}],
    ['tap_in_needed', {needsYouCount: 1}],
    [
      'goal_completed',
      {activeCircleCount: 2, doneCount: 2, personalStreakDays: 4},
    ],
    ['streak_active', {personalStreakDays: 1}],
    ['default', {}],
  ] as const)('resolves %s from live Home data', (expected, overrides) => {
    expect(getHoyState({...baseInput, ...overrides})).toBe(expected);
  });

  it('uses the documented priority when multiple conditions conflict', () => {
    expect(
      getHoyState({
        ...baseInput,
        activeCircleCount: 1,
        atRiskCount: 1,
        doneCount: 1,
        hasHomeDataError: true,
        isCelebrating: true,
        isGreetingLoading: true,
        isLoadingHomeData: true,
        needsYouCount: 1,
        personalStreakDays: 12,
      }),
    ).toBe('thinking');

    expect(
      getHoyState({
        ...baseInput,
        activeCircleCount: 1,
        atRiskCount: 1,
        doneCount: 1,
        isCelebrating: true,
        needsYouCount: 1,
        personalStreakDays: 12,
      }),
    ).toBe('celebrating');

    expect(
      getHoyState({
        ...baseInput,
        activeCircleCount: 1,
        atRiskCount: 1,
        doneCount: 1,
        needsYouCount: 1,
        personalStreakDays: 12,
      }),
    ).toBe('risk_attention');
  });

  it('locks guests, incomplete profiles, and pending-only memberships', () => {
    expect(
      getHoyState({...baseInput, isAuthenticatedHome: false}),
    ).toBe('locked');
    expect(
      getHoyState({...baseInput, isIncompleteProfile: true}),
    ).toBe('locked');
    expect(
      getHoyState({...baseInput, pendingCount: 2}),
    ).toBe('locked');
  });

  it('keeps an authenticated zero-Circle Home in the default state', () => {
    expect(getHoyState(baseInput)).toBe('default');
  });

  it('treats a data error as risk and attention', () => {
    expect(getHoyState({...baseInput, hasHomeDataError: true})).toBe(
      'risk_attention',
    );
  });
});

describe('Hoy completion transitions', () => {
  it('seeds the initial loaded snapshot without celebrating', () => {
    expect(
      getHoyCelebrationSnapshot({
        currentDoneCount: 2,
        hasLoadedSnapshot: false,
        isLoaded: true,
        previousDoneCount: 0,
      }),
    ).toEqual({
      doneCount: 2,
      hasLoadedSnapshot: true,
      shouldCelebrate: false,
    });
  });

  it('celebrates only when completion increases after the first snapshot', () => {
    expect(
      getHoyCelebrationSnapshot({
        currentDoneCount: 3,
        hasLoadedSnapshot: true,
        isLoaded: true,
        previousDoneCount: 2,
      }),
    ).toEqual({
      doneCount: 3,
      hasLoadedSnapshot: true,
      shouldCelebrate: true,
    });
    expect(
      getHoyCelebrationSnapshot({
        currentDoneCount: 2,
        hasLoadedSnapshot: true,
        isLoaded: true,
        previousDoneCount: 2,
      }).shouldCelebrate,
    ).toBe(false);
  });

  it('does not mutate its baseline while Home is still loading', () => {
    expect(
      getHoyCelebrationSnapshot({
        currentDoneCount: 4,
        hasLoadedSnapshot: false,
        isLoaded: false,
        previousDoneCount: 1,
      }),
    ).toEqual({
      doneCount: 1,
      hasLoadedSnapshot: false,
      shouldCelebrate: false,
    });
  });
});

describe('getHoyAccessibilityLabel', () => {
  it('announces state, Inbox action, and unread count', () => {
    expect(
      getHoyAccessibilityLabel({state: 'tap_in_needed', unreadCount: 1}),
    ).toBe('Hoy, Tap In needed. Open Inbox, 1 unread update');
    expect(
      getHoyAccessibilityLabel({state: 'risk_attention', unreadCount: 13}),
    ).toBe('Hoy, Risk and attention. Open Inbox, 9 or more unread updates');
    expect(
      getHoyAccessibilityLabel({state: 'default', unreadCount: 0}),
    ).toBe('Hoy, Ready. Open Inbox');
  });
});
