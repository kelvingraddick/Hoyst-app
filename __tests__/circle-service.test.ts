const mockCallable = jest.fn();
const mockHttpsCallable = jest.fn(() => mockCallable);
const mockGetIdToken = jest.fn();

jest.mock('../src/lib/firebase/functions', () => ({
  firebaseFunctions: jest.fn(() => ({
    httpsCallable: mockHttpsCallable,
  })),
}));

jest.mock('../src/lib/firebase/auth', () => ({
  firebaseAuth: jest.fn(() => ({
    currentUser: {
      getIdToken: mockGetIdToken,
    },
  })),
}));

jest.mock('../src/lib/firebase/app', () => ({
  getFirebaseApp: jest.fn(() => ({
    options: {
      projectId: 'hoyst-firebase-app',
    },
  })),
}));

import {
  deleteCircle,
  leaveCircle,
  nudgeCircleMembers,
  reviewJoinRequest,
  updateCircle,
} from '../src/features/circles/services/circle-service';

describe('circle service', () => {
  beforeEach(() => {
    global.fetch = jest.fn();
    mockCallable.mockReset();
    mockGetIdToken.mockReset();
    mockHttpsCallable.mockClear();
  });

  it('calls the deleteCircle callable with the circle id', async () => {
    mockCallable.mockResolvedValueOnce({data: {deleted: true}});

    await expect(deleteCircle('circle-1')).resolves.toEqual({deleted: true});

    expect(mockHttpsCallable).toHaveBeenCalledWith('deleteCircle');
    expect(mockCallable).toHaveBeenCalledWith({circleId: 'circle-1'});
  });

  it('calls the leaveCircle callable with the circle id', async () => {
    mockCallable.mockResolvedValueOnce({data: {status: 'left'}});

    await expect(leaveCircle('circle-1')).resolves.toEqual({status: 'left'});

    expect(mockHttpsCallable).toHaveBeenCalledWith('leaveCircle');
    expect(mockCallable).toHaveBeenCalledWith({circleId: 'circle-1'});
  });

  it('calls the updateCircle callable with editable circle settings', async () => {
    const input = {
      category: 'Fitness',
      circleId: 'circle-1',
      commitment: 'Move for 30 minutes',
      commitmentCadence: 'weekly' as const,
      commitmentFrequency: {tapInsPerWeek: 4},
      graceRules: {
        skip: {
          allowance: 2,
          windowDays: 7,
        },
      },
      joinMode: 'open' as const,
      maxSize: 12,
      privacy: 'public' as const,
      timezone: 'America/New_York',
      title: 'Morning movers',
    };
    mockGetIdToken.mockResolvedValueOnce('id-token-1');
    (global.fetch as jest.Mock).mockResolvedValueOnce({
      json: async () => ({result: {updated: true}}),
      ok: true,
    });

    await expect(updateCircle(input)).resolves.toEqual({updated: true});

    expect(mockGetIdToken).toHaveBeenCalledWith(true);
    expect(global.fetch).toHaveBeenCalledWith(
      'https://us-central1-hoyst-firebase-app.cloudfunctions.net/updateCircle',
      {
        body: JSON.stringify({
          data: {
            ...input,
            idToken: 'id-token-1',
          },
        }),
        headers: {
          'Content-Type': 'application/json',
        },
        method: 'POST',
      },
    );
  });

  it('calls the reviewJoinRequest callable with the review decision', async () => {
    mockCallable.mockResolvedValueOnce({data: {status: 'approved'}});

    await expect(
      reviewJoinRequest({
        approved: true,
        circleId: 'circle-1',
        requesterId: 'user-2',
      }),
    ).resolves.toEqual({status: 'approved'});

    expect(mockHttpsCallable).toHaveBeenCalledWith('reviewJoinRequest');
    expect(mockCallable).toHaveBeenCalledWith({
      approved: true,
      circleId: 'circle-1',
      requesterId: 'user-2',
    });
  });

  it('calls the nudgeCircleMembers callable with the circle id', async () => {
    mockCallable.mockResolvedValueOnce({data: {nudged: 2}});

    await expect(nudgeCircleMembers('circle-1')).resolves.toEqual({nudged: 2});

    expect(mockHttpsCallable).toHaveBeenCalledWith('nudgeCircleMembers');
    expect(mockCallable).toHaveBeenCalledWith({circleId: 'circle-1'});
  });
});
