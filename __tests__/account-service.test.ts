const mockCallable = jest.fn();
const mockAuthenticatedCallable = jest.fn();
jest.mock('../src/lib/firebase/authenticated-callable', () => ({
  authenticatedCallable: (...args: unknown[]) =>
    mockAuthenticatedCallable(...args),
}));
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
  checkProfileUsername,
  updateProfileFields,
} from '../src/features/auth/services/account-service';

describe('account service', () => {
  beforeEach(() => {
    mockCallable.mockReset();
    mockGetDownloadURL.mockReset();
    mockHttpsCallable.mockClear();
    mockPutFile.mockReset();
    mockRef.mockClear();
    mockAuthenticatedCallable.mockReset();
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
  it('uploads edited avatars without replacing the published image', async () => {
    mockPutFile.mockResolvedValue(undefined);
    mockGetDownloadURL.mockResolvedValue('https://cdn.test/new-avatar.jpg');
    await uploadProfileAvatar({
      uid: 'user-1',
      uri: 'file:///new.jpg',
      versioned: true,
    });
    expect(mockRef).toHaveBeenCalledWith(
      expect.stringMatching(
        /^users\/user-1\/avatar\/profile-\d+-[a-z0-9]+\.jpg$/,
      ),
    );
    expect(mockRef).not.toHaveBeenCalledWith('users/user-1/avatar/profile.jpg');
  });
  it('uses authenticated availability and transactional profile updates', async () => {
    mockAuthenticatedCallable.mockResolvedValueOnce({
      handle: 'next_name',
      available: true,
    });
    await expect(checkProfileUsername('next_name')).resolves.toEqual({
      handle: 'next_name',
      available: true,
    });
    expect(mockAuthenticatedCallable).toHaveBeenLastCalledWith(
      'checkProfileUsername',
      {handle: 'next_name'},
    );
    const saved = {
      id: 'user-1',
      name: 'New Name',
      handle: 'next_name',
      bio: null,
      avatarUrl: null,
      profileTint: 'gold',
      timezone: 'Europe/London',
      onboardingStatus: 'complete',
    };
    mockAuthenticatedCallable.mockResolvedValueOnce({profile: saved});
    await expect(
      updateProfileFields({
        handle: 'next_name',
        profileTint: 'gold',
        timezone: 'Europe/London',
      }),
    ).resolves.toEqual({...saved, bio: undefined, avatarUrl: undefined});
    expect(mockAuthenticatedCallable).toHaveBeenLastCalledWith(
      'updateProfile',
      {handle: 'next_name', profileTint: 'gold', timezone: 'Europe/London'},
    );
  });
});
