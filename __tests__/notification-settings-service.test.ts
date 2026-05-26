const mockSettingsOnSnapshot = jest.fn();
const mockInboxOnSnapshot = jest.fn();
const mockUnreadOnSnapshot = jest.fn();
const mockUnreadGet = jest.fn();
const mockCallable = jest.fn();
const mockServerTimestamp = {type: 'serverTimestamp'};
const mockBatchSet = jest.fn();
const mockBatchCommit = jest.fn();
const mockInboxEventSet = jest.fn();
const mockLimit = jest.fn(() => ({
  onSnapshot: mockInboxOnSnapshot,
}));
const mockOrderBy = jest.fn(() => ({
  limit: mockLimit,
}));
const mockUnreadLimit = jest.fn(() => ({
  onSnapshot: mockUnreadOnSnapshot,
}));
const mockUnreadQuery = {
  get: mockUnreadGet,
  limit: mockUnreadLimit,
};
const mockWhere = jest.fn(() => mockUnreadQuery);
const mockInboxEventDoc = jest.fn(() => ({
  set: mockInboxEventSet,
}));
const mockInboxCollection = {
  doc: mockInboxEventDoc,
  orderBy: mockOrderBy,
  where: mockWhere,
};
const mockUserDoc = {
  collection: jest.fn(() => mockInboxCollection),
  onSnapshot: mockSettingsOnSnapshot,
};
const mockUserPrivateCollection = {
  doc: jest.fn(() => mockUserDoc),
};
const mockFirestore = {
  batch: jest.fn(() => ({
    commit: mockBatchCommit,
    set: mockBatchSet,
  })),
  collection: jest.fn(() => mockUserPrivateCollection),
};
const mockHttpsCallable = jest.fn(() => mockCallable);

jest.mock('@react-native-firebase/firestore', () => ({
  __esModule: true,
  default: {
    FieldValue: {
      serverTimestamp: jest.fn(() => mockServerTimestamp),
    },
  },
}));

jest.mock('../src/lib/firebase/auth', () => ({
  firebaseAuth: jest.fn(() => ({
    currentUser: {uid: 'user-1'},
  })),
}));

jest.mock('../src/lib/firebase/firestore', () => ({
  firebaseFirestore: jest.fn(),
}));

jest.mock('../src/lib/firebase/functions', () => ({
  firebaseFunctions: jest.fn(() => ({
    httpsCallable: mockHttpsCallable,
  })),
}));

import {firebaseFirestore} from '../src/lib/firebase/firestore';
import {
  markAllInboxEventsRead,
  markInboxEventRead,
  subscribeToInboxEvents,
  subscribeToInboxUnreadCount,
  subscribeToNotificationSettings,
} from '../src/features/settings/services/notification-settings-service';

describe('notification settings service listeners', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockBatchCommit.mockResolvedValue(undefined);
    mockInboxEventSet.mockResolvedValue(undefined);
    (firebaseFirestore as unknown as jest.Mock).mockReturnValue(mockFirestore);
  });

  it('maps inbox events from Firestore snapshots', () => {
    const onEvents = jest.fn();
    const unsubscribe = jest.fn();
    mockInboxOnSnapshot.mockReturnValueOnce(unsubscribe);

    const result = subscribeToInboxEvents({
      onEvents,
      uid: 'user-1',
    });

    const handleSnapshot = mockInboxOnSnapshot.mock.calls[0][0];
    handleSnapshot({
      docs: [
        {
          data: () => ({
            body: 'Ava tapped in.',
            title: 'Circle update',
            type: 'member_joined',
          }),
          id: 'event-1',
        },
      ],
    });

    expect(result).toBe(unsubscribe);
    expect(mockFirestore.collection).toHaveBeenCalledWith('userPrivate');
    expect(mockUserPrivateCollection.doc).toHaveBeenCalledWith('user-1');
    expect(mockUserDoc.collection).toHaveBeenCalledWith('inbox');
    expect(mockOrderBy).toHaveBeenCalledWith('createdAt', 'desc');
    expect(mockLimit).toHaveBeenCalledWith(50);
    expect(onEvents).toHaveBeenCalledWith([
      expect.objectContaining({
        body: 'Ava tapped in.',
        createdAtLabel: 'Just now',
        id: 'event-1',
        title: 'Circle update',
        type: 'member_joined',
      }),
    ]);
  });

  it('returns an empty inbox and reports an error when Firestore sends no query snapshot', () => {
    const onError = jest.fn();
    const onEvents = jest.fn();

    subscribeToInboxEvents({
      onError,
      onEvents,
      uid: 'user-1',
    });

    const handleSnapshot = mockInboxOnSnapshot.mock.calls[0][0];
    expect(() => handleSnapshot(null)).not.toThrow();

    expect(onEvents).toHaveBeenCalledWith([]);
    expect(onError).toHaveBeenCalledWith(
      expect.objectContaining({
        message: 'Inbox listener returned no snapshot.',
      }),
    );
  });

  it('counts unread inbox events from the capped unread query', () => {
    const onCount = jest.fn();
    const unsubscribe = jest.fn();
    mockUnreadOnSnapshot.mockReturnValueOnce(unsubscribe);

    const result = subscribeToInboxUnreadCount({
      onCount,
      uid: 'user-1',
    });

    const handleSnapshot = mockUnreadOnSnapshot.mock.calls[0][0];
    handleSnapshot({
      docs: [{id: 'event-1'}, {id: 'event-2'}],
    });

    expect(result).toBe(unsubscribe);
    expect(mockUserDoc.collection).toHaveBeenCalledWith('inbox');
    expect(mockWhere).toHaveBeenCalledWith('readAt', '==', null);
    expect(mockUnreadLimit).toHaveBeenCalledWith(10);
    expect(onCount).toHaveBeenCalledWith(2);
  });

  it('returns zero unread events and reports an error when Firestore sends no unread snapshot', () => {
    const onCount = jest.fn();
    const onError = jest.fn();

    subscribeToInboxUnreadCount({
      onCount,
      onError,
      uid: 'user-1',
    });

    const handleSnapshot = mockUnreadOnSnapshot.mock.calls[0][0];
    expect(() => handleSnapshot(null)).not.toThrow();

    expect(onCount).toHaveBeenCalledWith(0);
    expect(onError).toHaveBeenCalledWith(
      expect.objectContaining({
        message: 'Inbox unread listener returned no snapshot.',
      }),
    );
  });

  it('uses default settings and reports an error when Firestore sends no settings snapshot', () => {
    const onError = jest.fn();
    const onSettings = jest.fn();

    subscribeToNotificationSettings({
      onError,
      onSettings,
      uid: 'user-1',
    });

    const handleSnapshot = mockSettingsOnSnapshot.mock.calls[0][0];
    expect(() => handleSnapshot(null)).not.toThrow();

    expect(onSettings).toHaveBeenCalledWith({
      circleActivity: true,
      productUpdates: true,
      tapInReminders: true,
    });
    expect(onError).toHaveBeenCalledWith(
      expect.objectContaining({
        message: 'Notification settings listener returned no snapshot.',
      }),
    );
  });

  it('marks one inbox event read through the callable', async () => {
    mockCallable.mockResolvedValueOnce({data: {read: true}});

    await expect(markInboxEventRead('event-1')).resolves.toEqual({read: true});

    expect(mockHttpsCallable).toHaveBeenCalledWith('markInboxEventRead');
    expect(mockCallable).toHaveBeenCalledWith({eventId: 'event-1'});
  });

  it('falls back to a direct read marker when the single-event callable is unavailable', async () => {
    mockCallable.mockRejectedValueOnce(new Error('Callable not deployed.'));

    await expect(markInboxEventRead('event-1')).resolves.toEqual({read: true});

    expect(mockInboxEventDoc).toHaveBeenCalledWith('event-1');
    expect(mockInboxEventSet).toHaveBeenCalledWith(
      {readAt: mockServerTimestamp},
      {merge: true},
    );
  });

  it('marks all inbox events read through the bulk callable', async () => {
    mockCallable.mockResolvedValueOnce({data: {read: 3}});

    await expect(markAllInboxEventsRead()).resolves.toEqual({read: 3});

    expect(mockHttpsCallable).toHaveBeenCalledWith('markInboxEventsRead');
    expect(mockCallable).toHaveBeenCalledWith();
  });

  it('falls back to directly marking unread inbox events read when the bulk callable is unavailable', async () => {
    mockCallable.mockRejectedValueOnce(new Error('Callable not deployed.'));
    mockUnreadGet.mockResolvedValueOnce({
      docs: [{ref: 'event-1-ref'}, {ref: 'event-2-ref'}],
      empty: false,
    });

    await expect(markAllInboxEventsRead()).resolves.toEqual({read: 2});

    expect(mockWhere).toHaveBeenCalledWith('readAt', '==', null);
    expect(mockBatchSet).toHaveBeenNthCalledWith(
      1,
      'event-1-ref',
      {readAt: mockServerTimestamp},
      {merge: true},
    );
    expect(mockBatchSet).toHaveBeenNthCalledWith(
      2,
      'event-2-ref',
      {readAt: mockServerTimestamp},
      {merge: true},
    );
    expect(mockBatchCommit).toHaveBeenCalledTimes(1);
  });
});
