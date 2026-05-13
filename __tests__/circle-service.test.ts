const mockCallable = jest.fn();
const mockHttpsCallable = jest.fn(() => mockCallable);

jest.mock('../src/lib/firebase/functions', () => ({
  firebaseFunctions: jest.fn(() => ({
    httpsCallable: mockHttpsCallable,
  })),
}));

import {deleteCircle} from '../src/features/circles/services/circle-service';

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
});
