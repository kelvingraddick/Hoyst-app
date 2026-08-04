const mockPutFile = jest.fn();
const mockGetDownloadURL = jest.fn();
const mockStorageRef = jest.fn(() => ({
  getDownloadURL: mockGetDownloadURL,
  putFile: mockPutFile,
}));
const mockFeedDoc = jest.fn(() => ({id: 'generated-message-id'}));
const mockOnSnapshot = jest.fn();
const mockLimit = jest.fn(() => ({onSnapshot: mockOnSnapshot}));
const mockOrderBy = jest.fn(() => ({limit: mockLimit}));
const mockFeedCollection = {
  doc: mockFeedDoc,
  orderBy: mockOrderBy,
};
const mockCircleDoc = {
  collection: jest.fn(() => mockFeedCollection),
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
  mapCircleThreadItemSnapshot,
  subscribeToCircleThreadItems,
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

  it('subscribes to one extra item and returns newest-first pagination metadata', () => {
    const unsubscribe = jest.fn();
    const docs = Array.from({length: 21}, (_, index) =>
      snapshot(
        {
          actor: {displayName: `Member ${index}`, uid: `user-${index}`},
          createdAt: {
            toDate: () => new Date(Date.UTC(2026, 6, 30, 12, 0, -index)),
          },
          kind: 'message',
          text: `Message ${index}`,
        },
        `item-${index}`,
      ),
    );
    const onItems = jest.fn();
    mockOnSnapshot.mockImplementationOnce(
      (onSnapshot: (value: unknown) => void) => {
        onSnapshot({docs});
        return unsubscribe;
      },
    );

    const result = subscribeToCircleThreadItems({
      circleId: 'circle-1',
      itemLimit: 20,
      onItems,
      uid: 'user-1',
    });

    expect(mockOrderBy).toHaveBeenCalledWith('createdAt', 'desc');
    expect(mockLimit).toHaveBeenCalledWith(21);
    expect(onItems).toHaveBeenCalledWith({
      hasMore: true,
      items: expect.arrayContaining([
        expect.objectContaining({id: 'item-0'}),
        expect.objectContaining({id: 'item-19'}),
      ]),
    });
    const emittedItems = onItems.mock.calls[0][0].items;
    expect(emittedItems).toHaveLength(20);
    expect(emittedItems[0].id).toBe('item-0');
    expect(emittedItems[19].id).toBe('item-19');
    expect(result).toBe(unsubscribe);
  });
});
