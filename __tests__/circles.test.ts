jest.mock('@react-native-firebase/firestore', () => jest.fn());

import {mapPublicCircleIndexSnapshot} from '../src/features/circles/services/public-circle-service';
import {
  filterPublicCircles,
  getPublicCircleCategories,
} from '../src/features/circles/services/circles-screen-selectors';
import {getCircleDetail} from '../src/features/circles/mockData';
import {
  buildCreateCirclePayload,
  buildCircleEditDraft,
  clampCircleMaxSize,
  createInitialCircleDraft,
  getCirclePrivacyMode,
  getPrivacyChoiceFields,
  isCircleMaxSizeBelowMemberCount,
} from '../src/features/create-circle/services/create-circle-draft';
import {
  buildStarterCirclePayload,
  createInitialStarterCircleDraft,
  getStarterCircleCategory,
} from '../src/features/auth/services/onboarding-circle';
import {getNudgeTargetUids} from '../functions/src/circles/nudge-targets';
import type {ExploreCircle} from '../src/types/models';

function publicCircle(overrides: Partial<ExploreCircle>): ExploreCircle {
  return {
    category: 'Fitness',
    commitment: 'Move for 30 minutes',
    commitmentCadence: 'daily',
    commitmentFrequency: {tapInsPerWeek: 7},
    completionRate: 86,
    id: 'circle-1',
    joinLabel: 'Open seats',
    matchCopy: 'A steady group for showing up.',
    maxSize: 8,
    memberCount: 4,
    members: [],
    streakLabel: 'Daily Pace',
    title: 'Morning Movers',
    ...overrides,
  };
}

describe('public circle discovery mapping', () => {
  it('does not expose personal commitments through Explore', () => {
    const snapshot = {
      data: () => ({
        circleMode: 'personal',
        commitment: 'Read 20 pages',
        title: 'Read 20 pages',
      }),
      exists: true,
      id: 'personal-1',
    };

    expect(mapPublicCircleIndexSnapshot(snapshot as never)).toBeUndefined();
  });

  it('maps publicCircleIndex documents into explore circles', () => {
    const snapshot = {
      data: () => ({
        category: 'Deep Work',
        completionRate: 84,
        commitment: 'Ship one focused block',
        commitmentCadence: 'weekly',
        commitmentFrequency: {tapInsPerWeek: 4},
        progressLabel: 'Week · 84%',
        joinMode: 'open',
        maxSize: 8,
        memberCount: 5,
        members: [
          {
            avatarUrl: 'https://example.com/kelvin.png',
            displayName: 'Kelvin North',
            uid: 'user-1',
          },
        ],
        title: 'Maker Mornings',
      }),
      exists: true,
      id: 'maker-mornings',
    };

    expect(mapPublicCircleIndexSnapshot(snapshot as never)).toMatchObject({
      category: 'Deep Work',
      completionRate: 84,
      commitment: 'Ship one focused block',
      commitmentCadence: 'weekly',
      commitmentFrequency: {tapInsPerWeek: 4},
      id: 'maker-mornings',
      joinLabel: 'Open seats',
      joinMode: 'open',
      maxSize: 8,
      memberCount: 5,
      members: [
        expect.objectContaining({
          avatarUrl: 'https://example.com/kelvin.png',
          id: 'user-1',
          initials: 'KN',
          name: 'Kelvin North',
          state: 'done',
        }),
      ],
      privacy: 'public',
      progressLabel: 'Week · 84%',
      title: 'Maker Mornings',
    });
  });

  it('maps zero-percent public previews as still needing Tap In', () => {
    const snapshot = {
      data: () => ({
        category: 'Fitness',
        completionRate: 0,
        commitment: 'Drink water',
        commitmentFrequency: {tapInsPerWeek: 7},
        memberCount: 2,
        members: [
          {
            displayName: 'Ava Stone',
            uid: 'user-2',
          },
        ],
        title: 'Hydration Circle',
      }),
      exists: true,
      id: 'hydration-circle',
    };

    expect(mapPublicCircleIndexSnapshot(snapshot as never)?.members).toEqual([
      expect.objectContaining({
        id: 'user-2',
        initials: 'AS',
        state: 'pending',
      }),
    ]);
    expect(mapPublicCircleIndexSnapshot(snapshot as never)).toMatchObject({
      commitmentCadence: 'daily',
      progressLabel: 'Today · 0%',
    });
  });

  it('defaults legacy public previews without frequency to daily', () => {
    const snapshot = {
      data: () => ({
        category: 'Fitness',
        completionRate: 12,
        commitment: 'Stretch',
        memberCount: 3,
        members: [],
        title: 'Stretch Circle',
      }),
      exists: true,
      id: 'stretch-circle',
    };

    expect(mapPublicCircleIndexSnapshot(snapshot as never)).toMatchObject({
      commitmentCadence: 'daily',
      commitmentFrequency: {tapInsPerWeek: 7},
      progressLabel: 'Today · 12%',
    });
  });

  it('ignores incomplete publicCircleIndex documents', () => {
    const snapshot = {
      data: () => ({title: 'Missing commitment'}),
      exists: true,
      id: 'incomplete',
    };

    expect(mapPublicCircleIndexSnapshot(snapshot as never)).toBeUndefined();
  });
});

describe('Circles screen selectors', () => {
  it('uses public categories as circle type filters', () => {
    expect(
      getPublicCircleCategories([
        publicCircle({category: 'Fitness'}),
        publicCircle({category: 'Deep Work', id: 'circle-2'}),
        publicCircle({category: 'Fitness', id: 'circle-3'}),
      ]),
    ).toEqual(['All', 'Fitness', 'Deep Work']);
  });

  it('filters public circles by category and search text', () => {
    const circles = [
      publicCircle({
        category: 'Fitness',
        id: 'fitness',
        title: 'Morning Movers',
      }),
      publicCircle({
        category: 'Deep Work',
        commitment: 'Ship one focus block',
        id: 'focus',
        matchCopy: 'Creators who protect the first hour.',
        title: 'Maker Mornings',
      }),
      publicCircle({
        category: 'Wellness',
        id: 'wellness',
        title: 'Evening Reset',
      }),
    ];

    expect(filterPublicCircles(circles, 'Deep Work', '')).toEqual([circles[1]]);
    expect(filterPublicCircles(circles, 'All', 'first hour')).toEqual([
      circles[1],
    ]);
    expect(filterPublicCircles(circles, 'Fitness', 'maker')).toEqual([]);
  });
});

describe('circle nudge targeting', () => {
  it('falls back to member document ids for legacy member docs', () => {
    expect(
      getNudgeTargetUids({
        coveredCounts: new Map(),
        members: [
          {
            data: {displayName: 'Kelvin North', status: 'active'},
            id: 'kelvin-uid',
          },
          {
            data: {displayName: 'Phil Stone', status: 'active'},
            id: 'phil-uid',
          },
        ],
        requiredTapIns: 1,
        todayCoveredUids: new Set(),
        viewerUid: 'phil-uid',
      }),
    ).toEqual(['kelvin-uid']);
  });

  it('skips members already covered today or complete for the period', () => {
    expect(
      getNudgeTargetUids({
        coveredCounts: new Map([
          ['kelvin-uid', 1],
          ['ava-uid', 0],
        ]),
        members: [
          {data: {uid: 'kelvin-uid'}, id: 'kelvin-uid'},
          {data: {uid: 'ava-uid'}, id: 'ava-uid'},
          {data: {uid: 'phil-uid'}, id: 'phil-uid'},
        ],
        requiredTapIns: 1,
        todayCoveredUids: new Set(['ava-uid']),
        viewerUid: 'phil-uid',
      }),
    ).toEqual([]);
  });

  it('narrows nudges to the requested eligible target uid', () => {
    expect(
      getNudgeTargetUids({
        coveredCounts: new Map([
          ['kelvin-uid', 0],
          ['ava-uid', 0],
        ]),
        members: [
          {data: {uid: 'kelvin-uid'}, id: 'kelvin-uid'},
          {data: {uid: 'ava-uid'}, id: 'ava-uid'},
          {data: {uid: 'phil-uid'}, id: 'phil-uid'},
        ],
        requiredTapIns: 1,
        targetUid: 'ava-uid',
        todayCoveredUids: new Set(),
        viewerUid: 'phil-uid',
      }),
    ).toEqual(['ava-uid']);
  });

  it('returns no target when the requested uid is not eligible', () => {
    expect(
      getNudgeTargetUids({
        coveredCounts: new Map([['ava-uid', 0]]),
        members: [
          {data: {uid: 'ava-uid'}, id: 'ava-uid'},
          {data: {uid: 'phil-uid'}, id: 'phil-uid'},
        ],
        requiredTapIns: 1,
        targetUid: 'ava-uid',
        todayCoveredUids: new Set(['ava-uid']),
        viewerUid: 'phil-uid',
      }),
    ).toEqual([]);
  });
});

describe('circle detail mock lookup', () => {
  it('does not fall back to a mock circle for unknown ids', () => {
    expect(getCircleDetail('unknown-real-circle')).toBeUndefined();
  });
});

describe('create circle payload mapping', () => {
  it('uses real creation defaults for size, timezone, and grace rules', () => {
    const draft = createInitialCircleDraft('America/New_York');

    expect(draft).toMatchObject({
      commitmentCadence: 'daily',
      commitmentFrequency: {tapInsPerWeek: 7},
      graceRules: {
        skip: {
          allowance: 2,
          windowDays: 7,
        },
      },
      maxSize: 10,
      timezone: 'America/New_York',
    });
  });

  it('maps privacy choices into backend privacy and join mode fields', () => {
    expect(getPrivacyChoiceFields('public', 'open')).toEqual({
      joinMode: 'open',
      privacy: 'public',
    });
    expect(getPrivacyChoiceFields('link_only', 'request_to_join')).toEqual({
      joinMode: 'invite_only',
      privacy: 'private',
    });
    expect(getPrivacyChoiceFields('private', 'open')).toEqual({
      joinMode: 'request_to_join',
      privacy: 'private',
    });
  });

  it('trims text and clamps create payload values', () => {
    const draft = {
      ...createInitialCircleDraft('America/New_York'),
      category: ' Fitness ',
      commitment: ' Move for 30 minutes ',
      graceRules: {
        skip: {
          allowance: 45,
          windowDays: 0,
        },
      },
      maxSize: 130,
      title: ' Morning movers ',
    };

    expect(buildCreateCirclePayload(draft)).toMatchObject({
      category: 'Fitness',
      commitment: 'Move for 30 minutes',
      commitmentCadence: 'daily',
      commitmentFrequency: {tapInsPerWeek: 7},
      graceRules: {
        skip: {
          allowance: 30,
          windowDays: 1,
        },
      },
      maxSize: 100,
      timezone: 'America/New_York',
      title: 'Morning movers',
    });
    expect(clampCircleMaxSize(-10)).toBe(2);
    expect(clampCircleMaxSize(52.7)).toBe(53);
  });

  it('builds a private single-member personal commitment payload', () => {
    const draft = {
      ...createInitialCircleDraft('America/New_York'),
      circleMode: 'personal' as const,
      commitment: 'Read 20 pages',
      joinMode: 'open' as const,
      maxSize: 25,
      privacy: 'public' as const,
      title: 'Ignored group name',
    };

    expect(buildCreateCirclePayload(draft)).toMatchObject({
      circleMode: 'personal',
      commitment: 'Read 20 pages',
      joinMode: 'invite_only',
      maxSize: 1,
      privacy: 'private',
      title: 'Read 20 pages',
    });
  });

  it('builds a Limit commitment payload with minimum and maximum values', () => {
    const draft = {
      ...createInitialCircleDraft('America/New_York'),
      category: 'Wellness',
      commitment: 'Stay between two and four coffees',
      commitmentType: 'limit' as const,
      maximumValue: 4,
      minimumValue: 2,
      stepValue: 5,
      title: 'Coffee guardrails',
      unitLabel: 'coffee',
    };

    expect(buildCreateCirclePayload(draft)).toMatchObject({
      commitmentType: 'limit',
      maximumValue: 4,
      minimumValue: 2,
      stepValue: 1,
      unitLabel: 'coffee',
    });
  });

  it('derives edit drafts from existing circle settings', () => {
    const draft = buildCircleEditDraft(
      {
        category: 'Deep Work',
        commitment: 'Ship one focused block',
        commitmentFrequency: {tapInsPerWeek: 4},
        graceRules: {
          skip: {
            allowance: 4,
            windowDays: 14,
          },
        },
        joinMode: 'invite_only',
        maxSize: 8,
        privacy: 'private',
        timezone: 'America/Chicago',
        title: 'Maker Mornings',
      },
      'America/New_York',
    );

    expect(draft).toMatchObject({
      category: 'Deep Work',
      commitment: 'Ship one focused block',
      commitmentCadence: 'weekly',
      commitmentFrequency: {tapInsPerWeek: 4},
      graceRules: {
        skip: {
          allowance: 4,
          windowDays: 14,
        },
      },
      joinMode: 'invite_only',
      maxSize: 8,
      privacy: 'private',
      privacyMode: 'link_only',
      timezone: 'America/Chicago',
      title: 'Maker Mornings',
    });
    expect(getCirclePrivacyMode({joinMode: 'open', privacy: 'public'})).toBe(
      'public',
    );
    expect(
      getCirclePrivacyMode({
        joinMode: 'request_to_join',
        privacy: 'private',
      }),
    ).toBe('private');
    expect(isCircleMaxSizeBelowMemberCount(4, 5)).toBe(true);
    expect(isCircleMaxSizeBelowMemberCount(5, 5)).toBe(false);
  });

  it('derives starter circle defaults from onboarding focus areas', () => {
    expect(getStarterCircleCategory('fitness')).toBe('Fitness');
    expect(getStarterCircleCategory('focus')).toBe('Deep Work');
    expect(getStarterCircleCategory('wellness')).toBe('Wellness');
    expect(getStarterCircleCategory('sobriety')).toBe('Sobriety');
    expect(getStarterCircleCategory('learning')).toBe('Custom');
    expect(getStarterCircleCategory('creative')).toBe('Custom');

    expect(
      createInitialStarterCircleDraft({
        focusArea: 'focus',
        timezone: 'America/New_York',
      }),
    ).toMatchObject({
      category: 'Deep Work',
      commitmentCadence: 'daily',
      commitmentFrequency: {tapInsPerWeek: 7},
      graceRules: {
        skip: {
          allowance: 2,
          windowDays: 7,
        },
      },
      maxSize: 10,
      timezone: 'America/New_York',
    });
  });

  it('builds starter circle payloads without resetting chosen values', () => {
    const draft = {
      ...createInitialStarterCircleDraft({focusArea: 'wellness'}),
      commitment: ' Meditate for ten minutes ',
      graceRules: {
        skip: {
          allowance: 1,
          windowDays: 7,
        },
      },
      maxSize: 2,
      title: ' Calm Crew ',
    };

    expect(buildStarterCirclePayload(draft)).toMatchObject({
      category: 'Wellness',
      commitment: 'Meditate for ten minutes',
      commitmentCadence: 'daily',
      commitmentFrequency: {tapInsPerWeek: 7},
      graceRules: {
        skip: {
          allowance: 1,
          windowDays: 7,
        },
      },
      maxSize: 2,
      title: 'Calm Crew',
    });
  });

  it('preserves weekly cadence and quota in starter circle payloads', () => {
    const draft = {
      ...createInitialStarterCircleDraft({focusArea: 'focus'}),
      commitment: ' Ship focused blocks ',
      commitmentCadence: 'weekly' as const,
      commitmentFrequency: {tapInsPerWeek: 4},
      maxSize: 2,
      title: ' Maker Mornings ',
    };

    expect(buildStarterCirclePayload(draft)).toMatchObject({
      category: 'Deep Work',
      commitment: 'Ship focused blocks',
      commitmentCadence: 'weekly',
      commitmentFrequency: {tapInsPerWeek: 4},
      maxSize: 2,
      title: 'Maker Mornings',
    });
  });
});
