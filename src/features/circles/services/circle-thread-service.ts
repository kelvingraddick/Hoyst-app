import type {FirebaseFirestoreTypes} from '@react-native-firebase/firestore';

import {firebaseFirestore} from '../../../lib/firebase/firestore';
import {firebaseFunctions} from '../../../lib/firebase/functions';
import {firebaseStorage} from '../../../lib/firebase/storage';
import {collections} from '../../../types/firestore';
import type {
  CircleThreadActor,
  CircleThreadActivityType,
  CircleThreadItem,
  CircleThreadTone,
} from '../../../types/models';

type PlainData = Record<string, unknown>;

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

function asNumber(value: unknown, fallback = 0) {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback;
}

function asDate(value: unknown) {
  return value &&
    typeof value === 'object' &&
    'toDate' in value &&
    typeof value.toDate === 'function'
    ? (value as FirebaseFirestoreTypes.Timestamp).toDate()
    : undefined;
}

function getInitials(name: string) {
  const initials = name
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map(part => part[0]?.toUpperCase() ?? '')
    .join('');

  return initials || 'HO';
}

export function getCircleThreadTimestampLabel(value: unknown) {
  const date = asDate(value);

  if (!date) {
    return 'Just now';
  }

  return date.toLocaleTimeString(undefined, {
    hour: 'numeric',
    minute: '2-digit',
  });
}

function getCreatedAtMs(value: unknown) {
  return asDate(value)?.getTime() ?? Date.now();
}

function normalizeActor(value: unknown, fallbackName: string) {
  const data =
    value && typeof value === 'object' ? (value as PlainData) : undefined;
  const name = asString(data?.displayName, asString(data?.name, fallbackName));

  return {
    avatarUrl: asOptionalString(data?.avatarUrl),
    handle: asOptionalString(data?.handle),
    initials: getInitials(name),
    name,
    uid: asOptionalString(data?.uid),
  } satisfies CircleThreadActor;
}

function normalizeActivityType(value: unknown): CircleThreadActivityType {
  if (value === 'nudge' || value === 'streak_milestone' || value === 'tap_in') {
    return value;
  }

  return 'tap_in';
}

function normalizeTone(value: unknown): CircleThreadTone {
  if (value === 'alert' || value === 'pending' || value === 'success') {
    return value;
  }

  return 'success';
}

export function mapCircleThreadItemSnapshot(
  snapshot: FirebaseFirestoreTypes.QueryDocumentSnapshot,
  viewerUid?: string,
): CircleThreadItem | undefined {
  const data = snapshot.data();
  const kind = data.kind === 'activity' ? 'activity' : 'message';
  const text = asOptionalString(data.text);
  const note = asOptionalString(data.note);
  const mediaImageUrl = asOptionalString(data.mediaImageUrl);
  const actor = normalizeActor(data.actor, 'Hoyst member');
  const targetActor =
    data.targetActor && typeof data.targetActor === 'object'
      ? normalizeActor(data.targetActor, 'Hoyst member')
      : undefined;
  const likedBy =
    data.likedBy && typeof data.likedBy === 'object'
      ? (data.likedBy as PlainData)
      : {};

  if (kind === 'message' && !text && !mediaImageUrl) {
    return undefined;
  }

  if (kind === 'activity' && !text && !note && !mediaImageUrl) {
    return undefined;
  }

  return {
    ...(kind === 'activity'
      ? {
          activityType: normalizeActivityType(data.type),
          tone: normalizeTone(data.tone),
        }
      : {}),
    ...(mediaImageUrl ? {mediaImageUrl} : {}),
    ...(note ? {note} : {}),
    ...(targetActor ? {targetActor} : {}),
    ...(text ? {text} : {}),
    actor,
    createdAtLabel: getCircleThreadTimestampLabel(data.createdAt),
    createdAtMs: getCreatedAtMs(data.createdAt),
    id: snapshot.id,
    isLikedByViewer: Boolean(viewerUid && likedBy[viewerUid]),
    kind,
    likeCount: Math.max(0, Math.round(asNumber(data.likeCount, 0))),
    readOnly: data.readOnly === true,
  };
}

export function createCircleThreadMessageId(circleId: string) {
  return firebaseFirestore()
    .collection(collections.circles)
    .doc(circleId)
    .collection('feedItems')
    .doc().id;
}

export function subscribeToCircleThreadItems({
  circleId,
  itemLimit,
  onError,
  onItems,
  uid,
}: {
  circleId: string;
  itemLimit: number;
  onError?: (error: Error) => void;
  onItems: (result: {hasMore: boolean; items: CircleThreadItem[]}) => void;
  uid?: string;
}) {
  const safeItemLimit = Math.max(1, Math.round(itemLimit));

  return firebaseFirestore()
    .collection(collections.circles)
    .doc(circleId)
    .collection('feedItems')
    .orderBy('createdAt', 'desc')
    .limit(safeItemLimit + 1)
    .onSnapshot(
      snapshot => {
        onItems({
          hasMore: snapshot.docs.length > safeItemLimit,
          items: snapshot.docs
            .slice(0, safeItemLimit)
            .map(doc => mapCircleThreadItemSnapshot(doc, uid))
            .filter((item): item is CircleThreadItem => Boolean(item)),
        });
      },
      error => onError?.(error),
    );
}

export async function uploadCircleThreadImage({
  circleId,
  messageId,
  uid,
  uri,
}: {
  circleId: string;
  messageId: string;
  uid: string;
  uri: string;
}) {
  const reference = firebaseStorage().ref(
    `circles/${circleId}/messages/${uid}/${messageId}.jpg`,
  );

  await reference.putFile(uri);

  return reference.getDownloadURL();
}

export async function sendCircleThreadMessage({
  circleId,
  mediaImageUrl,
  messageId,
  text,
}: {
  circleId: string;
  mediaImageUrl?: string;
  messageId: string;
  text?: string;
}) {
  const callable = firebaseFunctions().httpsCallable('sendCircleThreadMessage');
  const result = await callable({
    circleId,
    mediaImageUrl,
    messageId,
    text,
  });

  return result.data as {itemId: string};
}

export async function toggleCircleThreadItemLike({
  circleId,
  itemId,
}: {
  circleId: string;
  itemId: string;
}) {
  const callable = firebaseFunctions().httpsCallable(
    'toggleCircleThreadItemLike',
  );
  const result = await callable({circleId, itemId});

  return result.data as {liked: boolean; likeCount: number};
}

export async function markCircleThreadRead(circleId: string) {
  const callable = firebaseFunctions().httpsCallable('markCircleThreadRead');
  const result = await callable({circleId});

  return result.data as {read: true};
}
