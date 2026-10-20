const mockOnSnapshot = jest.fn();
const mockFirestoreDoc = jest.fn(() => ({onSnapshot: mockOnSnapshot}));
const mockAuthenticatedCallable = jest.fn();
jest.mock('../src/lib/firebase/firestore', () => ({
  firebaseFirestore: () => ({doc: mockFirestoreDoc}),
}));
jest.mock('../src/lib/firebase/authenticated-callable', () => ({
  authenticatedCallable: (...args: unknown[]) =>
    mockAuthenticatedCallable(...args),
}));
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
  submitTapIn,
  subscribeTapInCompletion,
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

  it('opts into confirmed saves and subscribes to the owner-scoped completion', async () => {
    mockAuthenticatedCallable.mockResolvedValue({completionId: 'operation-1'});
    await expect(submitTapIn({circleId: 'circle-1'})).resolves.toEqual({
      completionId: 'operation-1',
    });
    expect(mockAuthenticatedCallable).toHaveBeenCalledWith('submitTapIn', {
      circleId: 'circle-1',
      progressVersion: 1,
      completionVersion: 2,
    });
    const receive = jest.fn();
    const onError = jest.fn();
    const unsubscribe = jest.fn();
    mockOnSnapshot.mockReturnValue(unsubscribe);
    expect(
      subscribeTapInCompletion('user-1', 'operation-1', receive, onError),
    ).toBe(unsubscribe);
    expect(mockFirestoreDoc).toHaveBeenCalledWith(
      'userPrivate/user-1/tapInCompletions/operation-1',
    );
    mockOnSnapshot.mock.calls[0][0]({
      exists: () => true,
      data: () => ({status: 'pending'}),
    });
    expect(receive).toHaveBeenCalledWith({status: 'pending'});
    expect(mockOnSnapshot.mock.calls[0][1]).toBe(onError);
  });

  it('uploads proof to a unique immutable Tap In path', async () => {
    await expect(
      uploadTapInPhoto({
        circleId: 'circle-1',
        dateKey: '2026-07-19',
        uid: 'user-1',
        uri: 'file:///proof.jpg',
      }),
    ).resolves.toBe('https://example.com/proof.jpg');

    expect(mockStorageRef).toHaveBeenCalledWith(
      expect.stringMatching(
        /^circles\/circle-1\/check-ins\/2026-07-19\/user-1\/proof-[a-zA-Z0-9_-]+\.jpg$/,
      ),
    );
    expect(mockPutFile).toHaveBeenCalledWith('file:///proof.jpg', {
      contentType: 'image/jpeg',
    });
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
