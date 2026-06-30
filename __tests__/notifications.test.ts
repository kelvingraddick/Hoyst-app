jest.mock('../functions/src/firebase', () => ({
  db: {
    batch: jest.fn(),
    collection: jest.fn(),
  },
}));

jest.mock(
  'firebase-admin/app',
  () => ({
    getApps: () => [{}],
    initializeApp: jest.fn(),
  }),
  {virtual: true},
);

jest.mock(
  'firebase-admin/firestore',
  () => ({
    FieldValue: {
      serverTimestamp: jest.fn(),
    },
    getFirestore: () => ({
      batch: jest.fn(),
      collection: jest.fn(),
    }),
  }),
  {virtual: true},
);

jest.mock(
  'firebase-functions/params',
  () => ({
    defineSecret: () => ({
      value: () => '',
    }),
    defineString: (_name: string, options?: {default?: string}) => ({
      value: () => options?.default ?? '',
    }),
  }),
  {virtual: true},
);

jest.mock(
  'firebase-functions/v2/https',
  () => {
    class MockHttpsError extends Error {
      code: string;

      constructor(code: string, message: string) {
        super(message);
        this.code = code;
      }
    }

    return {
      HttpsError: MockHttpsError,
      onCall: (handler: unknown) => handler,
    };
  },
  {virtual: true},
);

jest.mock(
  'firebase-functions/v2/scheduler',
  () => ({
    onSchedule: (_options: unknown, handler: unknown) => handler,
  }),
  {virtual: true},
);

import {
  buildOneSignalPushPayload,
  canShareCircleOutsideMembers,
  getCompanionFeedTargetsFromMemberships,
  getCompanionMilestoneEvents,
  getCircleAtRiskNotificationBody,
  getDiscoveryInactivityEligibility,
  getJoinRequestNotificationDedupeKey,
  getNudgeNotificationDedupeKey,
  getNotificationCopyVariantIndex,
  getNotificationPreferenceEnabled,
  getReminderEligibility,
  getRoutineNotificationEligibility,
  markInboxEventsRead,
  resolveNotificationCopy,
} from '../functions/src/notifications';

describe('notification copy rotation', () => {
  it('selects stable copy from the dedupe key', () => {
    const first = resolveNotificationCopy({
      context: {actorName: 'Ava', circleTitle: 'Hydration Circle'},
      dedupeKey: 'nudge_circle-1_2026-05-29_user-1',
      type: 'nudge',
    });
    const second = resolveNotificationCopy({
      context: {actorName: 'Ava', circleTitle: 'Hydration Circle'},
      dedupeKey: 'nudge_circle-1_2026-05-29_user-1',
      type: 'nudge',
    });

    expect(second).toEqual(first);
    expect(first.body).toContain('Ava');
    expect(first.copyVariant).toMatch(/^nudge_[0-4]$/);
  });

  it('supports the new notification purposes', () => {
    const newTypes = [
      'companion_tapped_in',
      'companion_skipped',
      'companion_circle_created',
      'companion_circle_joined',
      'companion_achievement_unlocked',
      'companion_streak_milestone',
      'companion_momentum_level_up',
      'circle_complete',
      'member_due_prompt',
      'circle_nudge_prompt',
      'circle_discovery_suggestion',
    ] as const;

    newTypes.forEach(type => {
      const copy = resolveNotificationCopy({
        context: {
          actorName: 'Ava',
          circleTitle: 'Maker Mornings',
          discoveryCategory: 'Fitness',
          discoveryCircleTitle: 'Morning Miles',
          periodCopy: 'this week',
          targetCount: 2,
        },
        dedupeKey: `${type}_example`,
        type,
      });

      expect(copy.title.length).toBeGreaterThan(0);
      expect(copy.body.length).toBeGreaterThan(0);
      expect(copy.copyVariant).toMatch(new RegExp(`^${type}_[0-4]$`));
    });
  });

  it('keeps variant indexes in range', () => {
    expect(
      getNotificationCopyVariantIndex({
        dedupeKey: 'event-1',
        type: 'circle_complete',
        variantCount: 5,
      }),
    ).toBeGreaterThanOrEqual(0);
    expect(
      getNotificationCopyVariantIndex({
        dedupeKey: 'event-1',
        type: 'circle_complete',
        variantCount: 5,
      }),
    ).toBeLessThan(5);
  });
});

describe('companion feed targeting', () => {
  it('keeps private or invite-only circle updates inside the source circle', () => {
    expect(canShareCircleOutsideMembers({privacy: 'private'})).toBe(false);
    expect(
      canShareCircleOutsideMembers({
        joinMode: 'invite_only',
        privacy: 'public',
      }),
    ).toBe(false);

    expect(
      getCompanionFeedTargetsFromMemberships({
        actorUid: 'actor-1',
        sharedMemberUids: ['outside-1', 'source-2'],
        sourceCircle: {privacy: 'private'},
        sourceMemberUids: ['actor-1', 'source-2'],
      }),
    ).toEqual([{canViewMedia: true, uid: 'source-2'}]);
  });

  it('allows shared companions to see public non-invite circle updates', () => {
    expect(
      canShareCircleOutsideMembers({
        joinMode: 'request_to_join',
        privacy: 'public',
      }),
    ).toBe(true);

    expect(
      getCompanionFeedTargetsFromMemberships({
        actorUid: 'actor-1',
        sharedMemberUids: ['outside-1', 'source-2', 'actor-1'],
        sourceCircle: {joinMode: 'open', privacy: 'public'},
        sourceMemberUids: ['actor-1', 'source-2'],
      }),
    ).toEqual([
      {canViewMedia: true, uid: 'source-2'},
      {canViewMedia: true, uid: 'outside-1'},
    ]);
  });
});

describe('companion milestone detection', () => {
  it('detects achievements, substantial streaks, and momentum upgrades', () => {
    expect(
      getCompanionMilestoneEvents({
        priorSummary: {
          bestStreak: 6,
          currentStreak: 2,
          status: 'building_momentum',
        },
        summary: {
          bestStreak: 10,
          currentStreak: 7,
          label: 'Strong',
          status: 'strong_momentum',
        },
      }),
    ).toEqual([
      {
        achievementTitle: '7 Days Straight',
        key: '7-days-straight',
        type: 'companion_achievement_unlocked',
      },
      {
        achievementTitle: '10 Day Streak',
        key: '10-day-streak',
        type: 'companion_achievement_unlocked',
      },
      {
        key: '3-day-streak',
        streakDays: 3,
        type: 'companion_streak_milestone',
      },
      {
        key: '7-day-streak',
        streakDays: 7,
        type: 'companion_streak_milestone',
      },
      {
        key: 'strong_momentum',
        momentumLabel: 'Strong',
        type: 'companion_momentum_level_up',
      },
    ]);
  });
});

describe('notification settings compatibility', () => {
  it('defaults new preferences on', () => {
    expect(getNotificationPreferenceEnabled(undefined, 'socialActivity')).toBe(
      true,
    );
    expect(getNotificationPreferenceEnabled(undefined, 'circleRisk')).toBe(
      true,
    );
    expect(getNotificationPreferenceEnabled(undefined, 'nudges')).toBe(true);
    expect(getNotificationPreferenceEnabled(undefined, 'discovery')).toBe(true);
  });

  it('maps legacy circle activity to new circle preferences', () => {
    const legacySettings = {
      circleActivity: false,
      productUpdates: false,
      tapInReminders: true,
    };

    expect(
      getNotificationPreferenceEnabled(legacySettings, 'socialActivity'),
    ).toBe(false);
    expect(getNotificationPreferenceEnabled(legacySettings, 'circleRisk')).toBe(
      false,
    );
    expect(getNotificationPreferenceEnabled(legacySettings, 'nudges')).toBe(
      false,
    );
    expect(getNotificationPreferenceEnabled(legacySettings, 'discovery')).toBe(
      false,
    );
  });
});

describe('routine notification cadence', () => {
  const now = new Date('2026-05-29T18:00:00.000Z');

  it('enforces routine spacing and daily caps', () => {
    expect(
      getRoutineNotificationEligibility({
        deliveryState: {
          routineLastSentAt: new Date('2026-05-29T14:30:00.000Z'),
        },
        now,
        timezone: 'UTC',
        type: 'member_due_prompt',
      }),
    ).toMatchObject({eligible: false, reason: 'routine-spacing'});

    expect(
      getRoutineNotificationEligibility({
        deliveryState: {
          routineDateKey: '2026-05-29',
          routineLastSentAt: new Date('2026-05-29T10:00:00.000Z'),
          routineSentCount: 2,
        },
        now,
        timezone: 'UTC',
        type: 'circle_nudge_prompt',
      }),
    ).toMatchObject({eligible: false, reason: 'routine-daily-limit'});
  });

  it('spaces discovery pushes weekly', () => {
    expect(
      getRoutineNotificationEligibility({
        deliveryState: {
          discoveryLastSentAt: new Date('2026-05-25T18:00:00.000Z'),
        },
        now,
        timezone: 'UTC',
        type: 'circle_discovery_suggestion',
      }),
    ).toMatchObject({eligible: false, reason: 'discovery-spacing'});
  });

  it('allows routine pushes after the spacing window', () => {
    expect(
      getRoutineNotificationEligibility({
        deliveryState: {
          routineDateKey: '2026-05-29',
          routineLastSentAt: new Date('2026-05-29T08:00:00.000Z'),
          routineSentCount: 1,
        },
        now,
        timezone: 'UTC',
        type: 'member_due_prompt',
      }),
    ).toMatchObject({eligible: true, reason: 'eligible'});
  });
});

describe('discovery inactivity eligibility', () => {
  it('requires three quiet Tap In days', () => {
    expect(
      getDiscoveryInactivityEligibility({
        lastTapInAt: new Date('2026-05-27T18:00:00.000Z'),
        now: new Date('2026-05-29T18:00:00.000Z'),
      }),
    ).toMatchObject({eligible: false, reason: 'recent-tap-in'});

    expect(
      getDiscoveryInactivityEligibility({
        lastTapInAt: new Date('2026-05-25T18:00:00.000Z'),
        now: new Date('2026-05-29T18:00:00.000Z'),
      }),
    ).toMatchObject({eligible: true, reason: 'eligible'});
  });
});

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

describe('nudge notification dedupe keys', () => {
  it('allows different actors to nudge the same target on the same day', () => {
    const philNudge = getNudgeNotificationDedupeKey({
      actorUid: 'phil-uid',
      circleId: 'building-hoyst',
      dateKey: '2026-05-31',
      targetUid: 'kelvin-uid',
    });
    const avaNudge = getNudgeNotificationDedupeKey({
      actorUid: 'ava-uid',
      circleId: 'building-hoyst',
      dateKey: '2026-05-31',
      targetUid: 'kelvin-uid',
    });

    expect(philNudge).toBe(
      'nudge_building-hoyst_2026-05-31_phil-uid_kelvin-uid',
    );
    expect(avaNudge).not.toBe(philNudge);
  });
});

describe('OneSignal push payload', () => {
  it('increments the iOS app badge for delivered pushes', () => {
    expect(
      buildOneSignalPushPayload({
        appId: 'app-1',
        body: 'Ava nudged you.',
        circleId: 'circle-1',
        eventId: 'event-1',
        title: 'Nudge',
        type: 'nudge',
        uid: 'user-1',
      }),
    ).toMatchObject({
      app_id: 'app-1',
      data: {
        circleId: 'circle-1',
        eventId: 'event-1',
        type: 'nudge',
      },
      include_aliases: {
        external_id: ['user-1'],
      },
      ios_badgeCount: 1,
      ios_badgeType: 'Increase',
      target_channel: 'push',
    });
  });
});

describe('mark inbox events read callable', () => {
  const invokeMarkInboxEventsRead =
    markInboxEventsRead as unknown as (request: {
      auth?: {uid: string};
    }) => Promise<{read: number}>;

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('requires an authenticated user', async () => {
    await expect(invokeMarkInboxEventsRead({})).rejects.toMatchObject({
      code: 'unauthenticated',
      message: 'Sign in is required.',
    });
  });
});
