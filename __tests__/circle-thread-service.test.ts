const mockPutFile = jest.fn();
const mockGetDownloadURL = jest.fn();
const mockStorageRef = jest.fn(() => ({
  getDownloadURL: mockGetDownloadURL,
  putFile: mockPutFile,
}));
const mockFeedDoc = jest.fn(() => ({id: 'generated-message-id'}));
const mockCircleDoc = {
  collection: jest.fn(() => ({doc: mockFeedDoc})),
};
const mockFirestoreCollection = jest.fn(() => ({
  doc: jest.fn(() => mockCircleDoc),
}));

jest.mock('../src/lib/firebase/storage', () => ({
  firebaseStorage: () => ({
    ref: mockStorageRef,
  }),
}));

jest.mock('../src/lib/firebase/firestore', () => ({
  firebaseFirestore: () => ({
    collection: mockFirestoreCollection,
  }),
}));

jest.mock('../src/lib/firebase/functions', () => ({
  firebaseFunctions: () => ({
    httpsCallable: jest.fn(),
  }),
}));

import {
  createCircleThreadMessageId,
  getCircleThreadPreviewLabel,
  mapCircleThreadItemSnapshot,
  uploadCircleThreadImage,
} from '../src/features/circles/services/circle-thread-service';

function snapshot(data: Record<string, unknown>, id = 'item-1') {
  return {
    data: () => data,
    id,
  } as never;
}

describe('circle thread service', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockGetDownloadURL.mockResolvedValue('https://example.com/message.jpg');
  });

  it('maps message snapshots with image, like state, and actor fallback', () => {
    const item = mapCircleThreadItemSnapshot(
      snapshot({
        actor: {
          avatarUrl: 'https://example.com/maya.jpg',
          displayName: 'Maya Jones',
          uid: 'user-2',
        },
        createdAt: {toDate: () => new Date('2026-07-08T13:40:00.000Z')},
        kind: 'message',
        likedBy: {'user-1': true},
        likeCount: 2,
        mediaImageUrl: 'https://example.com/proof.jpg',
        text: 'Rough night but got it done',
      }),
      'user-1',
    );

    expect(item).toMatchObject({
      actor: {
        avatarUrl: 'https://example.com/maya.jpg',
        initials: 'MJ',
        name: 'Maya Jones',
        uid: 'user-2',
      },
      id: 'item-1',
      isLikedByViewer: true,
      kind: 'message',
      likeCount: 2,
      mediaImageUrl: 'https://example.com/proof.jpg',
      text: 'Rough night but got it done',
    });
  });

  it('builds viewer-aware preview labels', () => {
    const viewerItem = mapCircleThreadItemSnapshot(
      snapshot({
        actor: {displayName: 'Kelvin', uid: 'user-1'},
        createdAt: {toDate: () => new Date('2026-07-08T13:40:00.000Z')},
        kind: 'message',
        text: "Let's gooo",
      }),
      'user-1',
    );
    const companionItem = mapCircleThreadItemSnapshot(
      snapshot({
        actor: {displayName: 'Priya', uid: 'user-3'},
        createdAt: {toDate: () => new Date('2026-07-08T13:42:00.000Z')},
        kind: 'message',
        mediaImageUrl: 'https://example.com/image.jpg',
      }),
      'user-1',
    );

    expect(
      viewerItem && getCircleThreadPreviewLabel(viewerItem, 'user-1'),
    ).toBe("You: Let's gooo");
    expect(
      companionItem && getCircleThreadPreviewLabel(companionItem, 'user-1'),
    ).toBe('Priya: shared a photo');
  });

  it('marks converted history as read-only', () => {
    const item = mapCircleThreadItemSnapshot(
      snapshot({
        actor: {displayName: 'Kelvin', uid: 'user-1'},
        createdAt: {toDate: () => new Date('2026-07-08T13:40:00.000Z')},
        kind: 'activity',
        readOnly: true,
        text: 'Kelvin tapped in',
        type: 'tap_in',
      }),
      'user-2',
    );

    expect(item).toMatchObject({
      kind: 'activity',
      readOnly: true,
      text: 'Kelvin tapped in',
    });
  });

  it('creates deterministic message ids and uploads message images to the circle path', async () => {
    expect(createCircleThreadMessageId('circle-1')).toBe(
      'generated-message-id',
    );

    await expect(
      uploadCircleThreadImage({
        circleId: 'circle-1',
        messageId: 'message-1',
        uid: 'user-1',
        uri: 'file:///tmp/photo.jpg',
      }),
    ).resolves.toBe('https://example.com/message.jpg');
    expect(mockStorageRef).toHaveBeenCalledWith(
      'circles/circle-1/messages/user-1/message-1.jpg',
    );
    expect(mockPutFile).toHaveBeenCalledWith('file:///tmp/photo.jpg');
  });
});
