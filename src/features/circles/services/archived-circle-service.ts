import type {FirebaseFirestoreTypes} from '@react-native-firebase/firestore';

import {firebaseFirestore} from '../../../lib/firebase/firestore';
import type {
  CircleLifecycleStatus,
  CircleMode,
  MemberRole,
} from '../../../types/models';
import {getCircleLifecycleStatus} from './circle-lifecycle';

type PlainData = Record<string, unknown>;

export type ArchivedCircleSummary = {
  archivedAt?: Date;
  category: string;
  circleMode: CircleMode;
  commitment: string;
  id: string;
  lifecycleStatus: Extract<CircleLifecycleStatus, 'archived'>;
  memberCount: number;
  title: string;
  viewerRole: MemberRole;
};

function asString(value: unknown, fallback = '') {
  return typeof value === 'string' && value.trim().length > 0
    ? value.trim()
    : fallback;
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

function getCircleId(
  snapshot: FirebaseFirestoreTypes.QueryDocumentSnapshot,
) {
  return snapshot.ref.parent.parent?.id;
}

function getRole(value: unknown): MemberRole {
  return value === 'owner' || value === 'admin' ? value : 'member';
}

export function mapArchivedCircle({
  circleData,
  circleId,
  membershipData,
}: {
  circleData?: PlainData;
  circleId: string;
  membershipData?: PlainData;
}): ArchivedCircleSummary | undefined {
  if (
    !circleData ||
    membershipData?.status !== 'active' ||
    getCircleLifecycleStatus(circleData) !== 'archived'
  ) {
    return undefined;
  }

  const title = asString(circleData.title);
  const commitment = asString(circleData.commitment);

  if (!title || !commitment) {
    return undefined;
  }

  return {
    archivedAt: asDate(circleData.archivedAt),
    category: asString(circleData.category, 'Custom'),
    circleMode: circleData.circleMode === 'personal' ? 'personal' : 'group',
    commitment,
    id: circleId,
    lifecycleStatus: 'archived',
    memberCount: Math.max(1, asNumber(circleData.memberCount, 1)),
    title,
    viewerRole: getRole(membershipData.role),
  };
}

export function subscribeToArchivedCircles({
  onCircles,
  onError,
  uid,
}: {
  onCircles: (circles: ArchivedCircleSummary[]) => void;
  onError?: (error: Error) => void;
  uid: string;
}) {
  const firestore = firebaseFirestore();
  const memberships = new Map<string, PlainData>();
  const circleData = new Map<string, PlainData | undefined>();
  let circleUnsubscribes: Array<() => void> = [];

  const emit = () => {
    const circles = Array.from(memberships.entries())
      .map(([circleId, membershipData]) =>
        mapArchivedCircle({
          circleData: circleData.get(circleId),
          circleId,
          membershipData,
        }),
      )
      .filter((circle): circle is ArchivedCircleSummary => Boolean(circle))
      .sort((left, right) => {
        const archivedDelta =
          (right.archivedAt?.getTime() ?? 0) -
          (left.archivedAt?.getTime() ?? 0);

        return archivedDelta || left.title.localeCompare(right.title);
      });

    onCircles(circles);
  };

  const startCircleListeners = () => {
    circleUnsubscribes.forEach(unsubscribe => unsubscribe());
    circleUnsubscribes = [];
    circleData.clear();

    memberships.forEach((_, circleId) => {
      circleUnsubscribes.push(
        firestore
          .collection('circles')
          .doc(circleId)
          .onSnapshot(
            snapshot => {
              circleData.set(circleId, snapshot.data() as PlainData | undefined);
              emit();
            },
            error => onError?.(error),
          ),
      );
    });
    emit();
  };

  const unsubscribeMemberships = firestore
    .collectionGroup('members')
    .where('uid', '==', uid)
    .onSnapshot(
      snapshot => {
        memberships.clear();
        snapshot.docs.forEach(doc => {
          const circleId = getCircleId(doc);
          const data = doc.data() as PlainData;

          if (circleId && data.status === 'active') {
            memberships.set(circleId, data);
          }
        });
        startCircleListeners();
      },
      error => onError?.(error),
    );

  return () => {
    unsubscribeMemberships();
    circleUnsubscribes.forEach(unsubscribe => unsubscribe());
  };
}
