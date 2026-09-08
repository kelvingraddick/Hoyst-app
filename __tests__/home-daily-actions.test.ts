import {
  getHomeDailyAction,
  getHomeDailyActionProgressLabel,
  getHomeDailyProgress,
  hasNudgedOnCircleDay,
} from '../src/features/home/services/home-daily-actions';
import {getHomeCircleActionVariant} from '../src/features/home/services/home-circle-actions';
import type {CircleManagementCard} from '../src/types/models';
const card = (overrides: Partial<CircleManagementCard> = {}) =>
  ({
    id: 'a',
    viewerMembershipStatus: 'active',
    circleMode: 'group',
    viewerHasTappedInToday: false,
    nudgeTargetCount: 3,
    ...overrides,
  } as CircleManagementCard);
describe('Home daily progress', () => {
  it('adds a newly available Nudge after a saved Tap In and credits each only once', () => {
    expect(getHomeDailyProgress([card()])).toMatchObject({
      completed: 0,
      total: 1,
      remainingTapIns: 1,
    });
    expect(
      getHomeDailyProgress([card({viewerHasTappedInToday: true})]),
    ).toMatchObject({completed: 1, total: 2, remainingNudges: 1});
    expect(
      getHomeDailyProgress([
        card({viewerHasTappedInToday: true, viewerHasNudgedToday: true}),
      ]),
    ).toMatchObject({completed: 2, total: 2, remaining: 0});
  });
  it.each(['partial', 'failed', 'skip', 'done'] as const)(
    'credits any saved %s Tap In',
    viewerTodayStatus => {
      expect(
        getHomeDailyProgress([
          card({
            viewerHasTappedInToday: true,
            viewerTodayStatus,
            viewerCanUpdateTapIn: true,
          }),
        ]),
      ).toMatchObject({completed: 1, total: 2});
    },
  );
  it('keeps shared editing rules while Home advances past partial results', () => {
    const partial = card({
      viewerHasTappedInToday: true,
      viewerTodayStatus: 'partial',
      viewerCanUpdateTapIn: true,
    });
    expect(getHomeCircleActionVariant(partial)).toBe('check_in');
    expect(getHomeDailyAction(partial)).toBe('nudge');
  });
  it('removes obsolete unfinished nudges but retains sent nudge credit', () => {
    expect(
      getHomeDailyProgress([
        card({viewerHasTappedInToday: true, nudgeTargetCount: 0}),
      ]),
    ).toMatchObject({completed: 1, total: 1});
    expect(
      getHomeDailyProgress([
        card({
          viewerHasTappedInToday: true,
          viewerHasNudgedToday: true,
          nudgeTargetCount: 0,
        }),
      ]),
    ).toMatchObject({completed: 2, total: 2});
  });
  it('restores a Tap In action when its saved check-in is removed', () => {
    expect(
      getHomeDailyProgress([
        card({viewerHasTappedInToday: false, viewerHasNudgedToday: true}),
      ]),
    ).toMatchObject({completed: 1, total: 2, remainingTapIns: 1});
  });
  it('excludes pending and archived entries and never adds nudges for personal commitments', () => {
    expect(
      getHomeDailyProgress([
        card({viewerMembershipStatus: 'pending'}),
        card({lifecycleStatus: 'archived'}),
        card({
          circleMode: 'personal',
          viewerHasTappedInToday: true,
          viewerHasNudgedToday: true,
        }),
      ]),
    ).toMatchObject({completed: 1, total: 1});
  });
  it('has a real empty state', () =>
    expect(getHomeDailyProgress([])).toMatchObject({completed: 0, total: 0}));
  it('describes the number of actions still needed today', () => {
    expect(getHomeDailyActionProgressLabel(getHomeDailyProgress([]))).toBe(
      'No actions needed today',
    );
    expect(
      getHomeDailyActionProgressLabel(getHomeDailyProgress([card()])),
    ).toBe('1 action needed today');
    expect(
      getHomeDailyActionProgressLabel(
        getHomeDailyProgress([card({id: 'a'}), card({id: 'b'})]),
      ),
    ).toBe('2 actions needed today');
    expect(
      getHomeDailyActionProgressLabel(
        getHomeDailyProgress([
          card({viewerHasTappedInToday: true, nudgeTargetCount: 0}),
        ]),
      ),
    ).toBe('All actions complete');
  });
  it('restores persisted nudge credit only within each circle local day', () => {
    const sent = new Date('2026-09-07T23:50:00Z');
    const now = new Date('2026-09-08T00:10:00Z');
    expect(hasNudgedOnCircleDay(sent, 'UTC', now)).toBe(false);
    expect(hasNudgedOnCircleDay(sent, 'America/New_York', now)).toBe(true);
    expect(hasNudgedOnCircleDay(undefined, 'America/New_York', now)).toBe(
      false,
    );
  });
});
