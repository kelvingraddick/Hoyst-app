const mockSettingsOnSnapshot = jest.fn();
const mockInboxOnSnapshot = jest.fn();
const mockLimit = jest.fn(() => ({
  onSnapshot: mockInboxOnSnapshot,
}));
const mockOrderBy = jest.fn(() => ({
  limit: mockLimit,
}));
const mockInboxCollection = {
  orderBy: mockOrderBy,
};
const mockUserDoc = {
  collection: jest.fn(() => mockInboxCollection),
  onSnapshot: mockSettingsOnSnapshot,
};
const mockUserPrivateCollection = {
  doc: jest.fn(() => mockUserDoc),
};
const mockFirestore = {
  collection: jest.fn(() => mockUserPrivateCollection),
};
const mockHttpsCallable = jest.fn();

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
  subscribeToInboxEvents,
  subscribeToNotificationSettings,
} from '../src/features/settings/services/notification-settings-service';

describe('notification settings service listeners', () => {
  beforeEach(() => {
    jest.clearAllMocks();
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
});
