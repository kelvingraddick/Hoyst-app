jest.mock('@react-native-firebase/firestore', () => jest.fn());

import {mapPublicCircleIndexSnapshot} from '../src/features/circles/services/public-circle-service';
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

describe('public circle discovery mapping', () => {
  it('maps publicCircleIndex documents into explore circles', () => {
    const snapshot = {
      data: () => ({
        category: 'Deep Work',
        completionRate: 84,
        commitment: 'Ship one focused block',
        commitmentFrequency: {tapInsPerWeek: 4},
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

describe('circle detail mock lookup', () => {
  it('does not fall back to a mock circle for unknown ids', () => {
    expect(getCircleDetail('unknown-real-circle')).toBeUndefined();
  });
});

describe('create circle payload mapping', () => {
  it('uses real creation defaults for size, timezone, and grace rules', () => {
    const draft = createInitialCircleDraft('America/New_York');

    expect(draft).toMatchObject({
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

  it('derives edit drafts from existing circle settings', () => {
    const draft = buildCircleEditDraft(
      {
        category: 'Deep Work',
        commitment: 'Ship one focused block',
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

  it('builds starter circle payloads with create-circle defaults', () => {
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
      graceRules: {
        skip: {
          allowance: 2,
          windowDays: 7,
        },
      },
      maxSize: 10,
      title: 'Calm Crew',
    });
  });
});
