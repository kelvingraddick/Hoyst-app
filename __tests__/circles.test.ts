jest.mock('@react-native-firebase/firestore', () => jest.fn());

import {mapPublicCircleIndexSnapshot} from '../src/features/circles/services/public-circle-service';

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
