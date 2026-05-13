jest.mock('@react-native-firebase/firestore', () => jest.fn());

import {mapPublicCircleIndexSnapshot} from '../src/features/circles/services/public-circle-service';
import {getCircleDetail} from '../src/features/circles/mockData';
import {
  buildCreateCirclePayload,
  clampCircleMaxSize,
  createInitialCircleDraft,
  getPrivacyChoiceFields,
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
        dailyTask: 'Ship one focused block',
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
      dailyTask: 'Ship one focused block',
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
        }),
      ],
      privacy: 'public',
      title: 'Maker Mornings',
    });
  });

  it('ignores incomplete publicCircleIndex documents', () => {
    const snapshot = {
      data: () => ({title: 'Missing daily task'}),
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
      dailyTask: ' Move for 30 minutes ',
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
      dailyTask: 'Move for 30 minutes',
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

  it('derives starter circle defaults from onboarding goals', () => {
    expect(getStarterCircleCategory('fitness')).toBe('Fitness');
    expect(getStarterCircleCategory('focus')).toBe('Deep Work');
    expect(getStarterCircleCategory('wellness')).toBe('Wellness');
    expect(getStarterCircleCategory('sobriety')).toBe('Sobriety');
    expect(getStarterCircleCategory('learning')).toBe('Custom');
    expect(getStarterCircleCategory('creative')).toBe('Custom');

    expect(
      createInitialStarterCircleDraft({
        goal: 'focus',
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
      ...createInitialStarterCircleDraft({goal: 'wellness'}),
      dailyTask: ' Meditate for ten minutes ',
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
      dailyTask: 'Meditate for ten minutes',
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
