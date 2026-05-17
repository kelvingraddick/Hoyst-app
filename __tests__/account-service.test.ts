const mockCallable = jest.fn();
const mockHttpsCallable = jest.fn(() => mockCallable);
const mockPutFile = jest.fn();
const mockGetDownloadURL = jest.fn();
const mockRef = jest.fn(() => ({
  getDownloadURL: mockGetDownloadURL,
  putFile: mockPutFile,
}));

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
jest.mock('../src/lib/firebase/storage', () => ({
  firebaseStorage: jest.fn(() => ({
    ref: mockRef,
  })),
}));

import {
  deleteAccount,
  uploadProfileAvatar,
} from '../src/features/auth/services/account-service';

describe('account service', () => {
  beforeEach(() => {
    mockCallable.mockReset();
    mockGetDownloadURL.mockReset();
    mockHttpsCallable.mockClear();
    mockPutFile.mockReset();
    mockRef.mockClear();
  });

  it('calls the deleteAccount callable', async () => {
    mockCallable.mockResolvedValueOnce({data: {deleted: true}});

    await expect(deleteAccount()).resolves.toEqual({deleted: true});

    expect(mockHttpsCallable).toHaveBeenCalledWith('deleteAccount');
    expect(mockCallable).toHaveBeenCalledWith();
  });

  it('uploads profile avatars to the deterministic account path', async () => {
    mockPutFile.mockResolvedValueOnce(undefined);
    mockGetDownloadURL.mockResolvedValueOnce('https://cdn.test/avatar.jpg');

    await expect(
      uploadProfileAvatar({
        uid: 'user-1',
        uri: 'file:///tmp/avatar.jpg',
      }),
    ).resolves.toBe('https://cdn.test/avatar.jpg');

    expect(mockRef).toHaveBeenCalledWith('users/user-1/avatar/profile.jpg');
    expect(mockPutFile).toHaveBeenCalledWith('file:///tmp/avatar.jpg');
    expect(mockGetDownloadURL).toHaveBeenCalledWith();
  });
});
