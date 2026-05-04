import type {FirebaseFirestoreTypes} from '@react-native-firebase/firestore';

import {firebaseFirestore} from '../../../lib/firebase/firestore';
import {collections} from '../../../types/firestore';
import type {ExploreCircle} from '../../../types/models';

function asString(value: unknown, fallback = '') {
  return typeof value === 'string' && value.trim().length > 0
    ? value.trim()
    : fallback;
}

function asNumber(value: unknown, fallback: number) {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback;
}

export function mapPublicCircleIndexSnapshot(
  snapshot: FirebaseFirestoreTypes.DocumentSnapshot,
): ExploreCircle | undefined {
  const data = snapshot.data();

  if (!snapshot.exists || !data) {
    return undefined;
  }

  const title = asString(data.title);
  const dailyTask = asString(data.dailyTask);

  if (!title || !dailyTask) {
    return undefined;
  }

  return {
    category: asString(data.category, 'General'),
    completionRate: asNumber(data.completionRate, 0),
    dailyTask,
    id: snapshot.id,
    joinLabel:
      data.joinMode === 'open' ? 'Open seats' : 'Request to join',
    joinMode:
      data.joinMode === 'request_to_join' ||
      data.joinMode === 'invite_only' ||
      data.joinMode === 'open'
        ? data.joinMode
        : 'request_to_join',
    matchCopy: asString(
      data.matchCopy,
      'Public circle preview from Hoyst discovery.',
    ),
    maxSize: asNumber(data.maxSize, 10),
    memberCount: asNumber(data.memberCount, 0),
    members: [],
    privacy: 'public',
    streakLabel: asString(data.streakLabel, 'New circle'),
    title,
  };
}

export function subscribeToPublicCircles(
  onCircles: (circles: ExploreCircle[]) => void,
  onError: (error: Error) => void,
) {
  return firebaseFirestore()
    .collection(collections.publicCircleIndex)
    .orderBy('updatedAt', 'desc')
    .limit(50)
    .onSnapshot(snapshot => {
      onCircles(
        snapshot.docs
          .map(mapPublicCircleIndexSnapshot)
          .filter((circle): circle is ExploreCircle => Boolean(circle)),
      );
    }, onError);
}

export function subscribeToPublicCircle(
  circleId: string,
  onCircle: (circle?: ExploreCircle) => void,
  onError: (error: Error) => void,
) {
  return firebaseFirestore()
    .collection(collections.publicCircleIndex)
    .doc(circleId)
    .onSnapshot(
      snapshot => onCircle(mapPublicCircleIndexSnapshot(snapshot)),
      onError,
    );
}
