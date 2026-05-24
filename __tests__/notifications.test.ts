import {
  getCircleAtRiskNotificationBody,
  getJoinRequestNotificationDedupeKey,
  getReminderEligibility,
} from '../functions/src/notifications';

describe('notification reminder eligibility', () => {
  it('allows active members with due Tap Ins and enabled reminders', () => {
    expect(
      getReminderEligibility({
        circleId: 'circle-1',
        dateKey: '2026-05-13',
        kind: 'midday',
        memberStatus: 'active',
        notificationSettings: {tapInReminders: true},
        uid: 'user-1',
      }),
    ).toEqual({
      dedupeKey: 'tap_in_midday_circle-1_2026-05-13_user-1',
      eligible: true,
      reason: 'eligible',
    });
  });

  it('dedupes final warnings separately from midday reminders', () => {
    expect(
      getReminderEligibility({
        circleId: 'circle-1',
        dateKey: '2026-05-13',
        kind: 'final',
        memberStatus: 'active',
        notificationSettings: {tapInReminders: true},
        uid: 'user-1',
      }),
    ).toMatchObject({
      dedupeKey: 'tap_in_final_circle-1_2026-05-13_user-1',
      eligible: true,
    });
  });

  it('skips pending members and already covered members', () => {
    expect(
      getReminderEligibility({
        circleId: 'circle-1',
        dateKey: '2026-05-13',
        kind: 'midday',
        memberStatus: 'pending',
        uid: 'user-1',
      }),
    ).toMatchObject({eligible: false, reason: 'inactive-member'});

    expect(
      getReminderEligibility({
        circleId: 'circle-1',
        dateKey: '2026-05-13',
        kind: 'midday',
        memberStatus: 'active',
        todayStatus: 'skip',
        uid: 'user-1',
      }),
    ).toMatchObject({eligible: false, reason: 'already-covered'});
  });

  it('skips weekly reminders after the quota is complete', () => {
    expect(
      getReminderEligibility({
        circleId: 'circle-1',
        dateKey: '2026-05-13',
        kind: 'midday',
        memberStatus: 'active',
        notificationSettings: {tapInReminders: true},
        remainingTapIns: 0,
        uid: 'user-1',
      }),
    ).toMatchObject({eligible: false, reason: 'frequency-complete'});
  });

  it('respects disabled reminder preferences', () => {
    expect(
      getReminderEligibility({
        circleId: 'circle-1',
        dateKey: '2026-05-13',
        kind: 'midday',
        memberStatus: 'active',
        notificationSettings: {tapInReminders: false},
        uid: 'user-1',
      }),
    ).toMatchObject({eligible: false, reason: 'preference-disabled'});
  });
});

describe('circle at-risk notification copy', () => {
  it('labels daily and weekly risk periods clearly', () => {
    expect(
      getCircleAtRiskNotificationBody({
        circleTitle: 'Hydration Circle',
        commitmentCadence: 'daily',
        remainingCount: 1,
      }),
    ).toBe('Hydration Circle needs 1 more Tap In today.');
    expect(
      getCircleAtRiskNotificationBody({
        circleTitle: 'Maker Mornings',
        commitmentCadence: 'weekly',
        remainingCount: 2,
      }),
    ).toBe('Maker Mornings needs 2 more Tap Ins this week.');
  });
});

describe('join request notification dedupe keys', () => {
  it('dedupes the same pending request with its request token', () => {
    expect(
      getJoinRequestNotificationDedupeKey({
        circleId: 'circle-1',
        requesterId: 'user-1',
        requestToken: 'request-a',
      }),
    ).toBe('join_request_circle-1_user-1_request-a');
  });

  it('allows a later request from the same user to create a new event', () => {
    const firstRequest = getJoinRequestNotificationDedupeKey({
      circleId: 'circle-1',
      requesterId: 'user-1',
      requestToken: 'request-a',
    });
    const secondRequest = getJoinRequestNotificationDedupeKey({
      circleId: 'circle-1',
      requesterId: 'user-1',
      requestToken: 'request-b',
    });

    expect(secondRequest).not.toBe(firstRequest);
  });
});
