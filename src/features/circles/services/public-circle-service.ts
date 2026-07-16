import type {FirebaseFirestoreTypes} from '@react-native-firebase/firestore';

import {firebaseFirestore} from '../../../lib/firebase/firestore';
import {collections} from '../../../types/firestore';
import type {
  CircleMemberState,
  CircleMemberStatus,
  CommitmentCadence,
  ExploreCircle,
} from '../../../types/models';

type PlainData = Record<string, unknown>;

function asString(value: unknown, fallback = '') {
  return typeof value === 'string' && value.trim().length > 0
    ? value.trim()
    : fallback;
}

function asNumber(value: unknown, fallback: number) {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback;
}

function clampTapInsPerWeek(value: number) {
  return Math.min(7, Math.max(1, Math.round(value)));
}

function normalizeCommitmentCadence(
  value: unknown,
  tapInsPerWeek: number,
): CommitmentCadence {
  if (value === 'daily' || value === 'weekly' || value === 'monthly') {
    return value;
  }

  return tapInsPerWeek >= 7 ? 'daily' : 'weekly';
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

function normalizePublicMemberState(
  value: unknown,
  fallback: CircleMemberState,
): CircleMemberState {
  if (
    value === 'done' ||
    value === 'pending' ||
    value === 'missed' ||
    value === 'skipped'
  ) {
    return value;
  }

  if (value === 'skip') {
    return 'skipped';
  }

  return fallback;
}

function mapPublicMemberPreview(
  value: unknown,
  index: number,
  fallbackState: CircleMemberState = 'pending',
): CircleMemberStatus | undefined {
  const data =
    value && typeof value === 'object' ? (value as PlainData) : undefined;

  if (!data) {
    return undefined;
  }

  const id = asString(data.uid, asString(data.id, `member-${index}`));
  const name = asString(
    data.displayName,
    asString(data.name, asString(data.handle, 'Hoyst member')),
  );
  const avatarUrl = asString(
    data.avatarUrl,
    asString(data.photoURL, asString(data.photoUrl)),
  );

  return {
    ...(avatarUrl ? {avatarUrl} : {}),
    id,
    initials: getInitials(name),
    name,
    state: normalizePublicMemberState(
      data.state ?? data.todayStatus ?? data.checkInStatus,
      fallbackState,
    ),
  };
}

function snapshotData(
  snapshot:
    | FirebaseFirestoreTypes.DocumentSnapshot
    | FirebaseFirestoreTypes.QueryDocumentSnapshot,
) {
  const data = snapshot.data();
  return data ? ({...data, id: snapshot.id} as PlainData) : undefined;
}

function mergeMemberProfileData(
  memberData: PlainData,
  profileData?: PlainData,
) {
  if (!profileData) {
    return memberData;
  }

  const avatarUrl = asString(
    memberData.avatarUrl,
    asString(
      memberData.photoURL,
      asString(
        memberData.photoUrl,
        asString(profileData.avatarUrl, asString(profileData.photoURL)),
      ),
    ),
  );
  const displayName = asString(
    memberData.displayName,
    asString(
      memberData.name,
      asString(profileData.displayName, asString(profileData.name)),
    ),
  );
  const handle = asString(memberData.handle, asString(profileData.handle));

  return {
    ...profileData,
    ...memberData,
    ...(avatarUrl ? {avatarUrl} : {}),
    ...(displayName ? {displayName} : {}),
    ...(handle ? {handle} : {}),
  };
}

function subscribeToReadableMemberPreviews(
  circleId: string,
  onMembers: (members: CircleMemberStatus[]) => void,
) {
  const firestore = firebaseFirestore();
  const memberProfiles = new Map<string, PlainData>();
  const profileUnsubscribes = new Map<string, () => void>();
  let memberRecords: PlainData[] = [];

  const emit = () => {
    onMembers(
      memberRecords
        .map((memberData, index) => {
          const uid = asString(memberData.uid, asString(memberData.id));
          return mapPublicMemberPreview(
            mergeMemberProfileData(memberData, memberProfiles.get(uid)),
            index,
          );
        })
        .filter((member): member is CircleMemberStatus => Boolean(member)),
    );
  };

  const syncProfileListeners = () => {
    const nextUids = new Set(
      memberRecords
        .map(memberData => asString(memberData.uid, asString(memberData.id)))
        .filter(Boolean),
    );

    profileUnsubscribes.forEach((unsubscribe, uid) => {
      if (!nextUids.has(uid)) {
        unsubscribe();
        profileUnsubscribes.delete(uid);
        memberProfiles.delete(uid);
      }
    });

    nextUids.forEach(uid => {
      if (profileUnsubscribes.has(uid)) {
        return;
      }

      const unsubscribe = firestore
        .collection(collections.users)
        .doc(uid)
        .onSnapshot(
          snapshot => {
            const profileData = snapshotData(snapshot);

            if (profileData) {
              memberProfiles.set(uid, profileData);
            } else {
              memberProfiles.delete(uid);
            }

            emit();
          },
          () => undefined,
        );

      profileUnsubscribes.set(uid, unsubscribe);
    });
  };

  const unsubscribeMembers = firestore
    .collection(collections.circles)
    .doc(circleId)
    .collection('members')
    .limit(3)
    .onSnapshot(
      snapshot => {
        memberRecords = snapshot.docs
          .map(snapshotData)
          .filter((memberData): memberData is PlainData =>
            Boolean(memberData && asString(memberData.status) === 'active'),
          );
        syncProfileListeners();
        emit();
      },
      () => undefined,
    );

  return () => {
    unsubscribeMembers();
    profileUnsubscribes.forEach(unsubscribe => unsubscribe());
    profileUnsubscribes.clear();
  };
}

export function mapPublicCircleIndexSnapshot(
  snapshot: FirebaseFirestoreTypes.DocumentSnapshot,
): ExploreCircle | undefined {
  const data = snapshot.data();

  if (!snapshot.exists || !data) {
    return undefined;
  }

  if (data.circleMode === 'personal') {
    return undefined;
  }

  const title = asString(data.title);
  const commitment = asString(data.commitment);
  const tapInsPerWeek = clampTapInsPerWeek(
    asNumber(data.commitmentFrequency?.tapInsPerWeek, 7),
  );
  const opportunitiesPerPeriod = Math.min(
    31,
    Math.max(
      1,
      Math.round(
        asNumber(
          data.commitmentFrequency?.opportunitiesPerPeriod,
          tapInsPerWeek,
        ),
      ),
    ),
  );
  const commitmentCadence = normalizeCommitmentCadence(
    data.commitmentCadence,
    tapInsPerWeek,
  );
  const completionRate = asNumber(data.completionRate, 0);
  const periodLabel =
    commitmentCadence === 'daily'
      ? 'Today'
      : commitmentCadence === 'monthly'
      ? 'Month'
      : 'Week';
  const progressLabel = asString(
    data.progressLabel,
    `${periodLabel} · ${completionRate}%`,
  );

  if (!title || !commitment) {
    return undefined;
  }

  const members = Array.isArray(data.members)
    ? data.members
        .map((member, index) =>
          mapPublicMemberPreview(
            member,
            index,
            completionRate > 0 ? 'done' : 'pending',
          ),
        )
        .filter((member): member is CircleMemberStatus => Boolean(member))
    : [];

  return {
    category: asString(data.category, 'General'),
    circleMode: 'group',
    completionLabel: progressLabel,
    completionRate,
    commitment,
    commitmentCadence,
    commitmentFrequency: {
      ...(commitmentCadence === 'monthly' ? {opportunitiesPerPeriod} : {}),
      tapInsPerWeek,
    },
    id: snapshot.id,
    joinLabel: data.joinMode === 'open' ? 'Open seats' : 'Request to join',
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
    members,
    privacy: 'public',
    progressLabel,
    streakLabel: asString(data.streakLabel, 'New circle'),
    title,
  };
}

export function subscribeToPublicCircles(
  onCircles: (circles: ExploreCircle[]) => void,
  onError: (error: Error) => void,
) {
  const memberPreviews = new Map<string, CircleMemberStatus[]>();
  const memberPreviewUnsubscribes = new Map<string, () => void>();
  let circles: ExploreCircle[] = [];

  const emit = () => {
    onCircles(
      circles.map(circle => ({
        ...circle,
        members:
          circle.members.length > 0
            ? circle.members
            : memberPreviews.get(circle.id) ?? [],
      })),
    );
  };

  const unsubscribePublicCircles = firebaseFirestore()
    .collection(collections.publicCircleIndex)
    .orderBy('updatedAt', 'desc')
    .limit(50)
    .onSnapshot(snapshot => {
      circles = snapshot.docs
        .map(mapPublicCircleIndexSnapshot)
        .filter((circle): circle is ExploreCircle => Boolean(circle));

      const circleIds = new Set(circles.map(circle => circle.id));

      memberPreviewUnsubscribes.forEach((unsubscribe, circleId) => {
        if (!circleIds.has(circleId)) {
          unsubscribe();
          memberPreviewUnsubscribes.delete(circleId);
          memberPreviews.delete(circleId);
        }
      });

      circles.forEach(circle => {
        if (
          circle.members.length > 0 ||
          circle.memberCount <= 0 ||
          memberPreviewUnsubscribes.has(circle.id)
        ) {
          return;
        }

        const unsubscribe = subscribeToReadableMemberPreviews(
          circle.id,
          members => {
            memberPreviews.set(circle.id, members);
            emit();
          },
        );
        memberPreviewUnsubscribes.set(circle.id, unsubscribe);
      });

      emit();
    }, onError);

  return () => {
    unsubscribePublicCircles();
    memberPreviewUnsubscribes.forEach(unsubscribe => unsubscribe());
    memberPreviewUnsubscribes.clear();
  };
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
