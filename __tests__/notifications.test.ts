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
      onCall: (optionsOrHandler: unknown, maybeHandler?: unknown) =>
        maybeHandler ?? optionsOrHandler,
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
  buildEveningSummaryCopy,
  buildOneSignalPushPayload,
  buildTapInReminderNotification,
  canShareCircleOutsideMembers,
  formatNotificationCircleTitle,
  getCompanionFeedTargetsFromMemberships,
  getCompanionMilestoneEvents,
  getCircleAtRiskNotificationBody,
  getDiscoveryInactivityEligibility,
  getJoinRequestNotificationDedupeKey,
  getNudgeNotificationDedupeKey,
  getNotificationPreferenceEnabled,
  getReminderEligibility,
  getRoutineNotificationEligibility,
  getSameDayImmediateCoverageCircleIds,
  markInboxEventsRead,
  repairPushSubscription,
  resolveNotificationCopy,
  shouldIncludeInEveningSummary,
} from '../functions/src/notifications';

describe('notification copy', () => {
  it('uses stable label-like copy for repeated notification types', () => {
    const first = resolveNotificationCopy({
      context: {actorName: 'Ava', circleTitle: 'Hydration Circle'},
      dedupeKey: 'nudge_circle-1_2026-05-29_user-1',
      type: 'nudge',
    });
    const second = resolveNotificationCopy({
      context: {actorName: 'Ava', circleTitle: 'Hydration Circle'},
      dedupeKey: 'different_dedupe_key',
      type: 'nudge',
    });

    expect(second).toEqual(first);
    expect(first.body).toContain('Ava');
    expect(first.title).toBe('Nudge');
    expect(first.copyVariant).toBe('nudge');
  });

  it('quotes and truncates long circle names for notification copy', () => {
    expect(formatNotificationCircleTitle('STOP eating heavy after 9PM')).toBe(
      '"STOP eating heavy a..."',
    );

    expect(
      resolveNotificationCopy({
        context: {
          circleTitle: 'STOP eating heavy after 9PM',
          periodCopy: 'today',
        },
        dedupeKey: 'tap_in_final_circle-1_2026-06-30_user-1',
        type: 'tap_in_final_warning',
      }),
    ).toMatchObject({
      body: '2 hours left for "STOP eating heavy a...".',
      title: 'Final Tap In warning',
    });
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
      'evening_summary',
    ] as const;

    newTypes.forEach(type => {
      const copy = resolveNotificationCopy({
        context: {
          actorName: 'Ava',
          circleTitle: 'Maker Mornings',
          discoveryCategory: 'Fitness',
          discoveryCircleTitle: 'Morning Miles',
          periodCopy: 'this week',
          summaryBody: '3 updates across 2 circles: 2 Tap Ins, 1 completion.',
          targetCount: 2,
        },
        dedupeKey: `${type}_example`,
        type,
      });

      expect(copy.title.length).toBeGreaterThan(0);
      expect(copy.body.length).toBeGreaterThan(0);
      expect(copy.copyVariant).toBe(type);
    });
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

describe('evening activity recap', () => {
  const dateKey = '2026-06-30';
  const timezone = 'UTC';

  it('summarizes deferred non-urgent activity with predictable copy', () => {
    expect(
      buildEveningSummaryCopy([
        {
          circleId: 'circle-1',
          createdAt: new Date('2026-06-30T18:00:00.000Z'),
          push: {status: 'deferred'},
          type: 'companion_tapped_in',
        },
        {
          circleId: 'circle-1',
          createdAt: new Date('2026-06-30T18:05:00.000Z'),
          push: {status: 'deferred'},
          type: 'companion_tapped_in',
        },
        {
          circleId: 'circle-2',
          createdAt: new Date('2026-06-30T18:10:00.000Z'),
          push: {status: 'deferred'},
          type: 'circle_complete',
        },
      ]),
    ).toEqual({
      body: '3 updates across 2 circles: 2 Tap Ins, 1 completion.',
      title: 'Hoyst evening recap',
    });
  });

  it('includes deferred social activity unless an urgent same-day push covered that circle', () => {
    const urgentCoverage = getSameDayImmediateCoverageCircleIds({
      dateKey,
      events: [
        {
          circleId: 'circle-1',
          createdAt: new Date('2026-06-30T22:00:00.000Z'),
          push: {status: 'sent'},
          type: 'tap_in_final_warning',
        },
        {
          circleId: 'circle-2',
          createdAt: new Date('2026-06-30T17:00:00.000Z'),
          push: {status: 'deferred'},
          type: 'companion_tapped_in',
        },
      ],
      timezone,
    });

    expect(
      shouldIncludeInEveningSummary({
        coveredCircleIds: urgentCoverage,
        dateKey,
        event: {
          circleId: 'circle-1',
          createdAt: new Date('2026-06-30T18:00:00.000Z'),
          push: {status: 'deferred'},
          type: 'companion_tapped_in',
        },
        timezone,
      }),
    ).toBe(false);
    expect(
      shouldIncludeInEveningSummary({
        coveredCircleIds: urgentCoverage,
        dateKey,
        event: {
          circleId: 'circle-2',
          createdAt: new Date('2026-06-30T18:00:00.000Z'),
          push: {status: 'deferred'},
          type: 'circle_complete',
        },
        timezone,
      }),
    ).toBe(true);
  });
});

describe('notification reminder eligibility', () => {
  it('keeps one due circle pointed at the Tap In composer', () => {
    expect(
      buildTapInReminderNotification({
        dateKey: '2026-07-02',
        kind: 'midday',
        reminders: [
          {
            circleId: 'circle-1',
            circleTitle: 'Hydration Circle',
          },
        ],
        uid: 'user-1',
      }),
    ).toMatchObject({
      body: 'Tap In today for "Hydration Circle".',
      circleId: 'circle-1',
      dedupeKey: 'tap_in_midday_circle-1_2026-07-02_user-1',
      deeplink: {
        circleId: 'circle-1',
        screen: 'TapInComposer',
        source: 'notification',
      },
      title: 'Tap In reminder',
      type: 'tap_in_midday_reminder',
    });
  });

  it('consolidates multiple due circles into one Tap In picker reminder', () => {
    expect(
      buildTapInReminderNotification({
        dateKey: '2026-07-02',
        kind: 'final',
        reminders: [
          {
            circleId: 'circle-1',
            circleTitle: 'STOP eating heavy after 9PM',
          },
          {
            circleId: 'circle-2',
            circleTitle: '3 Day Healthy Activity Tracker',
          },
          {
            circleId: 'circle-3',
            circleTitle: 'Morning Walks',
          },
        ],
        uid: 'user-1',
      }),
    ).toMatchObject({
      body: '2 hours left for 3 circles, including "STOP eating heavy a..." and "3 Day Healthy Activ...".',
      dedupeKey: 'tap_in_final_summary_2026-07-02_user-1',
      deeplink: {screen: 'TapInPicker'},
      pushData: {screen: 'TapInPicker'},
      title: 'Final Tap In warning',
      type: 'tap_in_final_warning',
    });
  });

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
    ).toBe('"Hydration Circle" needs 1 more Tap In today.');
    expect(
      getCircleAtRiskNotificationBody({
        circleTitle: 'Maker Mornings',
        commitmentCadence: 'weekly',
        remainingCount: 2,
      }),
    ).toBe('"Maker Mornings" needs 2 more Tap Ins this week.');
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

describe('repair push subscription callable', () => {
  const invokeRepairPushSubscription =
    repairPushSubscription as unknown as (request: {
      auth?: {uid: string};
      data?: unknown;
    }) => Promise<{repaired: boolean; status: string}>;
  const originalFetch = global.fetch;
  const originalOneSignalAppId = process.env.ONESIGNAL_APP_ID;
  const originalOneSignalRestApiKey = process.env.ONESIGNAL_REST_API_KEY;

  beforeEach(() => {
    global.fetch = jest.fn();
    process.env.ONESIGNAL_APP_ID = 'onesignal-app-id';
    process.env.ONESIGNAL_REST_API_KEY = 'onesignal-rest-key';
  });

  afterEach(() => {
    global.fetch = originalFetch;

    if (originalOneSignalAppId === undefined) {
      delete process.env.ONESIGNAL_APP_ID;
    } else {
      process.env.ONESIGNAL_APP_ID = originalOneSignalAppId;
    }

    if (originalOneSignalRestApiKey === undefined) {
      delete process.env.ONESIGNAL_REST_API_KEY;
    } else {
      process.env.ONESIGNAL_REST_API_KEY = originalOneSignalRestApiKey;
    }
  });

  it('patches a disabled OneSignal subscription linked to the signed-in user', async () => {
    (global.fetch as jest.Mock)
      .mockResolvedValueOnce({
        json: async () => ({
          subscriptions: [
            {
              app_version: '1.0',
              device_os: '26.5.1',
              enabled: false,
              id: 'subscription-1',
              notification_types: -19,
              sdk: '050213',
              token: 'token-1',
              type: 'iOSPush',
            },
          ],
        }),
        ok: true,
        status: 200,
      })
      .mockResolvedValueOnce({
        json: async () => ({}),
        ok: true,
        status: 200,
      });

    await expect(
      invokeRepairPushSubscription({
        auth: {uid: 'user-1'},
        data: {subscriptionId: 'subscription-1', token: 'token-1'},
      }),
    ).resolves.toEqual({repaired: true, status: 'repaired'});

    expect(global.fetch).toHaveBeenNthCalledWith(
      1,
      'https://api.onesignal.com/apps/onesignal-app-id/users/by/external_id/user-1',
      {
        headers: {
          Authorization: 'Key onesignal-rest-key',
          'Content-Type': 'application/json',
        },
        method: 'GET',
      },
    );
    expect(global.fetch).toHaveBeenNthCalledWith(
      2,
      'https://api.onesignal.com/apps/onesignal-app-id/subscriptions/subscription-1',
      expect.objectContaining({
        headers: {
          Authorization: 'Key onesignal-rest-key',
          'Content-Type': 'application/json',
        },
        method: 'PATCH',
      }),
    );
    expect(
      JSON.parse((global.fetch as jest.Mock).mock.calls[1][1].body),
    ).toEqual({
      subscription: {
        app_version: '1.0',
        device_os: '26.5.1',
        enabled: true,
        notification_types: 31,
        sdk: '050213',
        token: 'token-1',
      },
    });
  });

  it('rejects a subscription id that is not linked to the signed-in user', async () => {
    (global.fetch as jest.Mock).mockResolvedValueOnce({
      json: async () => ({
        subscriptions: [{id: 'other-subscription', token: 'token-1'}],
      }),
      ok: true,
      status: 200,
    });

    await expect(
      invokeRepairPushSubscription({
        auth: {uid: 'user-1'},
        data: {subscriptionId: 'subscription-1', token: 'token-1'},
      }),
    ).rejects.toMatchObject({
      code: 'permission-denied',
      message: 'Push subscription is not linked to this user.',
    });
    expect(global.fetch).toHaveBeenCalledTimes(1);
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
