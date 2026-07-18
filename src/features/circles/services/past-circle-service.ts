import type {FirebaseFirestoreTypes} from '@react-native-firebase/firestore';

import {firebaseFirestore} from '../../../lib/firebase/firestore';
import type {
  CheckInCoverageStatus,
  CheckInStatus,
  CircleMode,
  CirclePrivacy,
} from '../../../types/models';

export type PastCircleSummary = {
  category: string;
  circleId: string;
  circleMode: CircleMode;
  commitment: string;
  id: string;
  joinedAt?: Date;
  leftAt?: Date;
  privacy: CirclePrivacy;
  title: string;
};

export type PastCircleTapIn = {
  coverageStatus?: CheckInCoverageStatus;
  currentValue?: number;
  dateKey: string;
  id: string;
  note?: string;
  photoUrl?: string;
  status: Exclude<CheckInStatus, 'rest'>;
  unitLabel?: string;
};

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

function asDate(value: unknown) {
  if (
    value &&
    typeof value === 'object' &&
    'toDate' in value &&
    typeof value.toDate === 'function'
  ) {
    return value.toDate() as Date;
  }

  return undefined;
}

function mapPastCircle(
  snapshot: FirebaseFirestoreTypes.QueryDocumentSnapshot,
): PastCircleSummary | undefined {
  const data = snapshot.data();
  const circleId = asString(data.circleId, snapshot.id);
  const title = asString(data.title);
  const commitment = asString(data.commitment);

  if (!circleId || !title || !commitment) {
    return undefined;
  }

  return {
    category: asString(data.category, 'Custom'),
    circleId,
    circleMode: data.circleMode === 'personal' ? 'personal' : 'group',
    commitment,
    id: snapshot.id,
    joinedAt: asDate(data.joinedAt),
    leftAt: asDate(data.leftAt),
    privacy: data.privacy === 'public' ? 'public' : 'private',
    title,
  };
}

function getCheckInDateKey(
  snapshot: FirebaseFirestoreTypes.QueryDocumentSnapshot,
) {
  return snapshot.ref.parent.parent?.id ?? '';
}

function mapPastTapIn(
  snapshot: FirebaseFirestoreTypes.QueryDocumentSnapshot,
): PastCircleTapIn | undefined {
  const data = snapshot.data();
  const status = data.status;
  const dateKey = getCheckInDateKey(snapshot);

  if (
    !dateKey ||
    (status !== 'done' &&
      status !== 'skip' &&
      status !== 'partial' &&
      status !== 'failed')
  ) {
    return undefined;
  }

  return {
    coverageStatus:
      data.coverageStatus === 'covered' ||
      data.coverageStatus === 'skipped' ||
      data.coverageStatus === 'partial' ||
      data.coverageStatus === 'failed'
        ? data.coverageStatus
        : undefined,
    currentValue:
      typeof data.currentValue === 'number' ? data.currentValue : undefined,
    dateKey,
    id: snapshot.id,
    note: asOptionalString(data.note),
    photoUrl: asOptionalString(data.photoUrl),
    status,
    unitLabel: asOptionalString(data.unitLabel),
  };
}

export function subscribeToPastCircles({
  onCircles,
  onError,
  uid,
}: {
  onCircles: (circles: PastCircleSummary[]) => void;
  onError?: (error: Error) => void;
  uid: string;
}) {
  return firebaseFirestore()
    .collection('userPrivate')
    .doc(uid)
    .collection('pastCircles')
    .orderBy('leftAt', 'desc')
    .onSnapshot(
      snapshot => {
        onCircles(
          snapshot.docs
            .map(mapPastCircle)
            .filter((circle): circle is PastCircleSummary => Boolean(circle)),
        );
      },
      error => onError?.(error),
    );
}

export function subscribeToPastCircleTapIns({
  circleId,
  onError,
  onTapIns,
  uid,
}: {
  circleId: string;
  onError?: (error: Error) => void;
  onTapIns: (tapIns: PastCircleTapIn[]) => void;
  uid: string;
}) {
  return firebaseFirestore()
    .collectionGroup('checkIns')
    .where('uid', '==', uid)
    .onSnapshot(
      snapshot => {
        onTapIns(
          snapshot.docs
            .filter(doc => {
              const documentCircleId =
                asOptionalString(doc.data().circleId) ??
                doc.ref.parent.parent?.parent.parent?.id;
              return documentCircleId === circleId;
            })
            .map(mapPastTapIn)
            .filter((tapIn): tapIn is PastCircleTapIn => Boolean(tapIn))
            .sort((left, right) => right.dateKey.localeCompare(left.dateKey)),
        );
      },
      error => onError?.(error),
    );
}
