const mockCallable = jest.fn();
const mockHttpsCallable = jest.fn(() => mockCallable);

jest.mock('../src/lib/firebase/functions', () => ({
  firebaseFunctions: jest.fn(() => ({
    httpsCallable: mockHttpsCallable,
  })),
}));

import {
  deleteCircle,
  pokeCircleMembers,
  reviewJoinRequest,
} from '../src/features/circles/services/circle-service';

describe('circle service', () => {
  beforeEach(() => {
    mockCallable.mockReset();
    mockHttpsCallable.mockClear();
  });

  it('calls the deleteCircle callable with the circle id', async () => {
    mockCallable.mockResolvedValueOnce({data: {deleted: true}});

    await expect(deleteCircle('circle-1')).resolves.toEqual({deleted: true});

    expect(mockHttpsCallable).toHaveBeenCalledWith('deleteCircle');
    expect(mockCallable).toHaveBeenCalledWith({circleId: 'circle-1'});
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

  it('calls the pokeCircleMembers callable with the circle id', async () => {
    mockCallable.mockResolvedValueOnce({data: {poked: 2}});

    await expect(pokeCircleMembers('circle-1')).resolves.toEqual({poked: 2});

    expect(mockHttpsCallable).toHaveBeenCalledWith('pokeCircleMembers');
    expect(mockCallable).toHaveBeenCalledWith({circleId: 'circle-1'});
  });
});
