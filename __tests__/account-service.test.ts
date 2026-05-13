const mockCallable = jest.fn();
const mockHttpsCallable = jest.fn(() => mockCallable);

jest.mock('@react-native-firebase/firestore', () => ({
  FieldValue: {
    serverTimestamp: jest.fn(),
  },
}));
jest.mock('../src/lib/firebase/auth', () => ({
  firebaseAuth: jest.fn(),
}));
jest.mock('../src/lib/firebase/firestore', () => ({
  firebaseFirestore: jest.fn(),
}));
jest.mock('../src/lib/firebase/functions', () => ({
  firebaseFunctions: jest.fn(() => ({
    httpsCallable: mockHttpsCallable,
  })),
}));

import {deleteAccount} from '../src/features/auth/services/account-service';

describe('account service', () => {
  beforeEach(() => {
    mockCallable.mockReset();
    mockHttpsCallable.mockClear();
  });

  it('calls the deleteAccount callable', async () => {
    mockCallable.mockResolvedValueOnce({data: {deleted: true}});

    await expect(deleteAccount()).resolves.toEqual({deleted: true});

    expect(mockHttpsCallable).toHaveBeenCalledWith('deleteAccount');
    expect(mockCallable).toHaveBeenCalledWith();
  });
});
