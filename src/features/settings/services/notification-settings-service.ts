import type {FirebaseFirestoreTypes} from '@react-native-firebase/firestore';
import firestore from '@react-native-firebase/firestore';

import {firebaseAuth} from '../../../lib/firebase/auth';
import {firebaseFirestore} from '../../../lib/firebase/firestore';
import {firebaseFunctions} from '../../../lib/firebase/functions';
import type {InboxEvent, InboxEventType} from '../../../types/models';

export type NotificationSettings = {
  circleActivity: boolean;
  productUpdates: boolean;
  tapInReminders: boolean;
};

const defaultNotificationSettings: NotificationSettings = {
  circleActivity: true,
  productUpdates: true,
  tapInReminders: true,
};
const inboxReadBatchLimit = 500;

function toListenerError(error: unknown, fallbackMessage: string) {
  return error instanceof Error ? error : new Error(fallbackMessage);
}

function asString(value: unknown, fallback = '') {
  return typeof value === 'string' && value.trim().length > 0
    ? value.trim()
    : fallback;
}

function asOptionalString(value: unknown) {
  return typeof value === 'string' && value.trim().length > 0
    ? value.trim()
    : undefined;
}

function asBoolean(value: unknown, fallback: boolean) {
  return typeof value === 'boolean' ? value : fallback;
}

function getTimestampLabel(value: unknown) {
  const date =
    value &&
    typeof value === 'object' &&
    'toDate' in value &&
    typeof value.toDate === 'function'
      ? (value as FirebaseFirestoreTypes.Timestamp).toDate()
      : undefined;

  if (!date) {
    return 'Just now';
  }

  const elapsedMs = Date.now() - date.getTime();
  const elapsedMinutes = Math.max(0, Math.round(elapsedMs / 60_000));

  if (elapsedMinutes < 1) {
    return 'Just now';
  }

  if (elapsedMinutes < 60) {
    return `${elapsedMinutes}m ago`;
  }

  const elapsedHours = Math.round(elapsedMinutes / 60);

  if (elapsedHours < 24) {
    return `${elapsedHours}h ago`;
  }

  return date.toLocaleDateString(undefined, {
    day: 'numeric',
    month: 'short',
  });
}

function normalizeNotificationSettings(value: unknown): NotificationSettings {
  const data =
    value && typeof value === 'object'
      ? (value as Record<string, unknown>)
      : {};

  return {
    circleActivity: asBoolean(
      data.circleActivity,
      defaultNotificationSettings.circleActivity,
    ),
    productUpdates: asBoolean(
      data.productUpdates,
      defaultNotificationSettings.productUpdates,
    ),
    tapInReminders: asBoolean(
      data.tapInReminders,
      defaultNotificationSettings.tapInReminders,
    ),
  };
}

function mapInboxEventSnapshot(
  snapshot: FirebaseFirestoreTypes.QueryDocumentSnapshot,
): InboxEvent | undefined {
  const data = snapshot.data();
  const type = asString(data.type) as InboxEventType;
  const title = asString(data.title);
  const body = asString(data.body);
  const deeplink =
    data.deeplink && typeof data.deeplink === 'object'
      ? (data.deeplink as InboxEvent['deeplink'])
      : {screen: 'Inbox' as const};

  if (!type || !title || !body) {
    return undefined;
  }

  const actor =
    data.actor && typeof data.actor === 'object'
      ? (data.actor as Record<string, unknown>)
      : undefined;

  return {
    ...(actor
      ? {
          actor: {
            avatarUrl: asOptionalString(actor.avatarUrl),
            displayName: asOptionalString(actor.displayName),
            handle: asOptionalString(actor.handle),
            uid: asOptionalString(actor.uid),
          },
        }
      : {}),
    body,
    circleId: asOptionalString(data.circleId),
    createdAtLabel: getTimestampLabel(data.createdAt),
    deeplink,
    id: snapshot.id,
    isRead: Boolean(data.readAt),
    title,
    type,
  };
}

export function subscribeToNotificationSettings({
  onError,
  onSettings,
  uid,
}: {
  onError?: (error: Error) => void;
  onSettings: (settings: NotificationSettings) => void;
  uid: string;
}) {
  return firebaseFirestore()
    .collection('userPrivate')
    .doc(uid)
    .onSnapshot(
      (
        snapshot:
          | FirebaseFirestoreTypes.DocumentSnapshot
          | null
          | undefined,
      ) => {
        if (!snapshot) {
          onSettings(defaultNotificationSettings);
          onError?.(
            new Error('Notification settings listener returned no snapshot.'),
          );
          return;
        }

        onSettings(
          normalizeNotificationSettings(snapshot.data()?.notificationSettings),
        );
      },
      error =>
        onError?.(
          toListenerError(
            error,
            'Notification settings listener could not load.',
          ),
        ),
    );
}

export function subscribeToInboxEvents({
  onError,
  onEvents,
  uid,
}: {
  onError?: (error: Error) => void;
  onEvents: (events: InboxEvent[]) => void;
  uid: string;
}) {
  return firebaseFirestore()
    .collection('userPrivate')
    .doc(uid)
    .collection('inbox')
    .orderBy('createdAt', 'desc')
    .limit(50)
    .onSnapshot(
      (
        snapshot: FirebaseFirestoreTypes.QuerySnapshot | null | undefined,
      ) => {
        if (!snapshot) {
          onEvents([]);
          onError?.(new Error('Inbox listener returned no snapshot.'));
          return;
        }

        onEvents(
          snapshot.docs
            .map(mapInboxEventSnapshot)
            .filter((event): event is InboxEvent => Boolean(event)),
        );
      },
      error =>
        onError?.(
          toListenerError(error, 'Inbox listener could not load updates.'),
        ),
    );
}

export function subscribeToInboxUnreadCount({
  onCount,
  onError,
  uid,
}: {
  onCount: (count: number) => void;
  onError?: (error: Error) => void;
  uid: string;
}) {
  return firebaseFirestore()
    .collection('userPrivate')
    .doc(uid)
    .collection('inbox')
    .where('readAt', '==', null)
    .limit(10)
    .onSnapshot(
      (
        snapshot: FirebaseFirestoreTypes.QuerySnapshot | null | undefined,
      ) => {
        if (!snapshot) {
          onCount(0);
          onError?.(new Error('Inbox unread listener returned no snapshot.'));
          return;
        }

        onCount(snapshot.docs.length);
      },
      error =>
        onError?.(
          toListenerError(
            error,
            'Inbox unread listener could not load updates.',
          ),
        ),
    );
}

export async function updateNotificationSettings(
  notificationSettings: Partial<NotificationSettings>,
) {
  const callable = firebaseFunctions().httpsCallable(
    'updateNotificationSettings',
  );
  const result = await callable({notificationSettings});
  return result.data as {notificationSettings: Partial<NotificationSettings>};
}

export async function markInboxEventRead(eventId: string) {
  const callable = firebaseFunctions().httpsCallable('markInboxEventRead');

  try {
    const result = await callable({eventId});
    return result.data as {read: true};
  } catch (error) {
    const uid = firebaseAuth().currentUser?.uid;

    if (!uid) {
      throw error;
    }

    await firebaseFirestore()
      .collection('userPrivate')
      .doc(uid)
      .collection('inbox')
      .doc(eventId)
      .set(
        {readAt: firestore.FieldValue.serverTimestamp()},
        {merge: true},
      );

    return {read: true as const};
  }
}

export async function markAllInboxEventsRead() {
  const callable = firebaseFunctions().httpsCallable('markInboxEventsRead');

  try {
    const result = await callable();
    return result.data as {read: number};
  } catch (error) {
    const uid = firebaseAuth().currentUser?.uid;

    if (!uid) {
      throw error;
    }

    const snapshot = await firebaseFirestore()
      .collection('userPrivate')
      .doc(uid)
      .collection('inbox')
      .where('readAt', '==', null)
      .get();

    if (snapshot.empty) {
      return {read: 0};
    }

    const readAt = firestore.FieldValue.serverTimestamp();
    let batch = firebaseFirestore().batch();
    let pendingWrites = 0;
    let read = 0;

    for (const doc of snapshot.docs) {
      batch.set(doc.ref, {readAt}, {merge: true});
      pendingWrites += 1;
      read += 1;

      if (pendingWrites === inboxReadBatchLimit) {
        await batch.commit();
        batch = firebaseFirestore().batch();
        pendingWrites = 0;
      }
    }

    if (pendingWrites > 0) {
      await batch.commit();
    }

    return {read};
  }
}
