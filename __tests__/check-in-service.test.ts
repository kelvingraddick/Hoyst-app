const mockPutFile = jest.fn();
const mockGetDownloadURL = jest.fn();
const mockStorageRef = jest.fn(() => ({
  getDownloadURL: mockGetDownloadURL,
  putFile: mockPutFile,
}));
const mockCallable = jest.fn();
const mockHttpsCallable = jest.fn(() => mockCallable);

jest.mock('../src/lib/firebase/storage', () => ({
  firebaseStorage: () => ({ref: mockStorageRef}),
}));

jest.mock('../src/lib/firebase/functions', () => ({
  firebaseFunctions: () => ({httpsCallable: mockHttpsCallable}),
}));

jest.mock('../src/lib/firebase/auth', () => ({
  firebaseAuth: () => ({currentUser: undefined}),
}));

jest.mock('../src/lib/firebase/app', () => ({
  getFirebaseApp: () => ({options: {projectId: 'hoyst-test'}}),
}));

import {
  updateTapInDetails,
  uploadTapInPhoto,
} from '../src/features/check-in/services/check-in-service';

describe('check-in service details', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockGetDownloadURL.mockResolvedValue('https://example.com/proof.jpg');
    mockCallable.mockResolvedValue({
      data: {
        dateKey: '2026-07-19',
        note: 'Proof saved.',
        photoUrl: 'https://example.com/proof.jpg',
      },
    });
  });

  it('uploads proof to the deterministic Tap In path', async () => {
    await expect(
      uploadTapInPhoto({
        circleId: 'circle-1',
        dateKey: '2026-07-19',
        uid: 'user-1',
        uri: 'file:///proof.jpg',
      }),
    ).resolves.toBe('https://example.com/proof.jpg');

    expect(mockStorageRef).toHaveBeenCalledWith(
      'circles/circle-1/check-ins/2026-07-19/user-1/proof.jpg',
    );
    expect(mockPutFile).toHaveBeenCalledWith('file:///proof.jpg');
  });

  it('sends explicit nullable detail fields to the callable', async () => {
    await updateTapInDetails({
      circleId: 'circle-1',
      note: null,
      photoUrl: null,
    });

    expect(mockHttpsCallable).toHaveBeenCalledWith('updateTapInDetails');
    expect(mockCallable).toHaveBeenCalledWith({
      circleId: 'circle-1',
      note: null,
      photoUrl: null,
    });
  });

  it('surfaces upload and callable errors so the editor can retry', async () => {
    mockPutFile.mockRejectedValueOnce(new Error('upload unavailable'));

    await expect(
      uploadTapInPhoto({
        circleId: 'circle-1',
        dateKey: '2026-07-19',
        uid: 'user-1',
        uri: 'file:///proof.jpg',
      }),
    ).rejects.toThrow('upload unavailable');

    mockCallable.mockRejectedValueOnce(new Error('callable unavailable'));

    await expect(
      updateTapInDetails({
        circleId: 'circle-1',
        note: 'Retry this proof.',
        photoUrl: null,
      }),
    ).rejects.toThrow('callable unavailable');
  });
});
