import {randomUUID} from 'node:crypto';

import {getAuth} from 'firebase-admin/auth';
import {
  FieldValue,
  type DocumentData,
  type DocumentReference,
} from 'firebase-admin/firestore';
import {getStorage} from 'firebase-admin/storage';
import {HttpsError, onCall} from 'firebase-functions/v2/https';
import {z} from 'zod';

import {db} from '../firebase';
import {
  notifyJoinRequestReview,
  notifyOwnerJoinRequest,
  notifyOwnerNewJoin,
  notifyNudge,
  oneSignalRestApiKey,
} from '../notifications';
import {
  getCommitmentCadence,
  getInputCommitmentCadence,
  getRequiredTapIns,
  getStoredCommitmentFrequency,
} from '../shared/commitments';

const graceRuleSchema = z.object({
  allowance: z.number().int().min(0).max(30),
  windowDays: z.number().int().min(1).max(365),
});
const commitmentFrequencySchema = z.object({
  tapInsPerWeek: z.number().int().min(1).max(7),
});
const createCircleSchema = z.object({
  category: z.string().trim().min(1).max(40),
  commitment: z.string().trim().min(1).max(160),
  commitmentCadence: z.enum(['daily', 'weekly']).optional(),
  commitmentFrequency: commitmentFrequencySchema,
  graceRules: z
    .object({
      skip: graceRuleSchema,
    })
    .optional(),
  joinMode: z.enum(['open', 'request_to_join', 'invite_only']),
  maxSize: z.number().int().min(2).max(100),
  privacy: z.enum(['public', 'private']),
  timezone: z.string().trim().min(1).max(80).optional(),
  title: z.string().trim().min(1).max(80),
});
const joinCircleSchema = z.object({
  circleId: z.string().trim().min(1),
  inviteCode: z.string().trim().optional(),
});
const reviewJoinRequestSchema = z.object({
  approved: z.boolean(),
  circleId: z.string().trim().min(1),
  requesterId: z.string().trim().min(1),
});
const nudgeCircleMembersSchema = z.object({
  circleId: z.string().trim().min(1),
});
const leaveCircleSchema = z.object({
  circleId: z.string().trim().min(1),
});
const deleteCircleSchema = z.object({
  circleId: z.string().trim().min(1),
});
const updateCircleSchema = createCircleSchema.extend({
  circleId: z.string().trim().min(1),
  idToken: z.string().trim().min(1).optional(),
});

async function getAuthenticatedUid(uid?: string, idToken?: string) {
  if (uid) {
    return uid;
  }

  if (!idToken) {
    throw new HttpsError('unauthenticated', 'Sign in is required.');
  }

  try {
    const decodedToken = await getAuth().verifyIdToken(idToken);
    return decodedToken.uid;
  } catch {
    throw new HttpsError('unauthenticated', 'Sign in is required.');
  }
}

async function requireCompletedProfile(uid?: string, idToken?: string) {
  const authenticatedUid = await getAuthenticatedUid(uid, idToken);

  const snapshot = await db.collection('users').doc(authenticatedUid).get();
  const profile = snapshot.data();

  if (!profile || profile.onboardingStatus !== 'complete') {
    throw new HttpsError('failed-precondition', 'Complete your profile first.');
  }

  return {profile, uid: authenticatedUid};
}

function createInviteCode() {
  return Math.random().toString(36).slice(2, 10);
}

function asOptionalString(value: unknown) {
  return typeof value === 'string' && value.trim().length > 0
    ? value.trim()
    : undefined;
}

function getDateKeyForTimezone(timezone: string, now = new Date()) {
  const formatter = new Intl.DateTimeFormat('en-US', {
    day: '2-digit',
    month: '2-digit',
    timeZone: timezone,
    year: 'numeric',
  });
  const parts = formatter.formatToParts(now);
  const year = parts.find(part => part.type === 'year')?.value ?? '1970';
  const month = parts.find(part => part.type === 'month')?.value ?? '01';
  const day = parts.find(part => part.type === 'day')?.value ?? '01';

  return `${year}-${month}-${day}`;
}

function getCommitmentWeekDateKeys(timezone: string, now = new Date()) {
  const parts = new Intl.DateTimeFormat('en-US', {
    day: '2-digit',
    month: '2-digit',
    timeZone: timezone,
    weekday: 'short',
    year: 'numeric',
  }).formatToParts(now);
  const weekday = parts.find(part => part.type === 'weekday')?.value ?? 'Mon';
  const dayOffsetByWeekday: Record<string, number> = {
    Fri: 4,
    Mon: 0,
    Sat: 5,
    Sun: 6,
    Thu: 3,
    Tue: 1,
    Wed: 2,
  };
  const localDate = new Date(
    Number(parts.find(part => part.type === 'year')?.value ?? '1970'),
    Number(parts.find(part => part.type === 'month')?.value ?? '1') - 1,
    Number(parts.find(part => part.type === 'day')?.value ?? '1'),
  );
  const monday = new Date(localDate);
  monday.setDate(localDate.getDate() - (dayOffsetByWeekday[weekday] ?? 0));

  return Array.from({length: 7}, (_, index) => {
    const date = new Date(monday);
    date.setDate(monday.getDate() + index);

    return [
      String(date.getFullYear()),
      String(date.getMonth() + 1).padStart(2, '0'),
      String(date.getDate()).padStart(2, '0'),
    ].join('-');
  });
}

function buildMemberPublicPreview(profile: DocumentData, uid: string) {
  return {
    avatarUrl: profile.avatarUrl ?? null,
    displayName: profile.displayName,
    handle: profile.handle,
    uid,
  };
}

function buildPublicPreviewFromMember(member: DocumentData, uid: string) {
  return {
    avatarUrl: member.avatarUrl ?? null,
    displayName:
      asOptionalString(member.displayName) ??
      asOptionalString(member.name) ??
      asOptionalString(member.handle) ??
      'Hoyst member',
    handle: asOptionalString(member.handle) ?? null,
    uid,
  };
}

async function deleteCircleServerMetadata(circleId: string) {
  const publicIndexRef = db.collection('publicCircleIndex').doc(circleId);

  await Promise.all([
    publicIndexRef.delete(),
    deleteStoragePrefix(`circles/${circleId}/`),
  ]);
}

function getParentDocument(
  ref: DocumentReference<DocumentData>,
  label: string,
) {
  const parent = ref.parent.parent;

  if (!parent) {
    throw new Error(`Could not resolve parent document for ${label}.`);
  }

  return parent;
}

function getCircleRefFromCheckInRef(ref: DocumentReference<DocumentData>) {
  const dayRef = getParentDocument(ref, 'check-in');
  const circleRef = getParentDocument(dayRef, 'check-in day');

  return {circleRef, dayRef};
}

function isCoveredCheckInStatus(value: unknown) {
  return value === 'done' || value === 'skip';
}

function withoutPublicMemberPreview(members: unknown, uid: string) {
  return Array.isArray(members)
    ? members.filter(
        memberPreview =>
          !(
            typeof memberPreview === 'object' &&
            memberPreview !== null &&
            'uid' in memberPreview &&
            memberPreview.uid === uid
          ),
      )
    : undefined;
}

async function deleteStoragePrefix(prefix: string) {
  await getStorage().bucket().deleteFiles({
    force: true,
    prefix,
  });
}

async function deleteCircleCheckInsForMember(circleId: string, uid: string) {
  const checkInSnapshots = await db
    .collectionGroup('checkIns')
    .where('uid', '==', uid)
    .get();

  for (const checkInSnapshot of checkInSnapshots.docs) {
    const {circleRef, dayRef} = getCircleRefFromCheckInRef(
      checkInSnapshot.ref,
    );

    if (circleRef.id !== circleId) {
      continue;
    }

    const status = checkInSnapshot.data().status;
    const batch = db.batch();

    batch.delete(checkInSnapshot.ref);

    if (isCoveredCheckInStatus(status)) {
      batch.set(
        dayRef,
        {
          checkInCount: FieldValue.increment(-1),
          updatedAt: FieldValue.serverTimestamp(),
        },
        {merge: true},
      );
    }

    await batch.commit();
    await deleteStoragePrefix(
      `circles/${circleRef.id}/check-ins/${dayRef.id}/${uid}/`,
    );
  }
}

export const createCircle = onCall(async request => {
  const {profile, uid} = await requireCompletedProfile(request.auth?.uid);
  const input = createCircleSchema.parse(request.data);
  const circleRef = db.collection('circles').doc();
  const memberRef = circleRef.collection('members').doc(uid);
  const publicIndexRef = db.collection('publicCircleIndex').doc(circleRef.id);
  const now = FieldValue.serverTimestamp();
  const inviteCode = createInviteCode();
  const commitmentCadence = getInputCommitmentCadence(
    input.commitmentCadence,
    input.commitmentFrequency,
  );
  const commitmentFrequency = getStoredCommitmentFrequency(
    commitmentCadence,
    input.commitmentFrequency,
  );
  const circle = {
    category: input.category,
    createdAt: now,
    commitment: input.commitment,
    commitmentCadence,
    commitmentFrequency,
    graceRules: input.graceRules ?? {
      skip: {
        allowance: 2,
        windowDays: 7,
      },
    },
    inviteCode,
    joinMode: input.joinMode,
    maxSize: input.maxSize,
    memberCount: 1,
    ownerId: uid,
    privacy: input.privacy,
    title: input.title,
    timezone: input.timezone ?? profile.timezone ?? 'UTC',
    updatedAt: now,
  };

  const batch = db.batch();
  batch.set(circleRef, circle);
  batch.set(memberRef, {
    avatarUrl: profile.avatarUrl ?? null,
    displayName: profile.displayName,
    handle: profile.handle,
    joinedAt: now,
    role: 'owner',
    status: 'active',
    uid,
  });

  if (input.privacy === 'public') {
    batch.set(publicIndexRef, {
      category: input.category,
      commitment: input.commitment,
      commitmentCadence,
      commitmentFrequency,
      joinMode: input.joinMode,
      maxSize: input.maxSize,
      memberCount: 1,
      members: [buildMemberPublicPreview(profile, uid)],
      title: input.title,
      updatedAt: now,
    });
  }

  await batch.commit();

  return {circleId: circleRef.id, inviteCode};
});

export const joinCircle = onCall(
  {secrets: [oneSignalRestApiKey]},
  async request => {
    const {profile, uid} = await requireCompletedProfile(request.auth?.uid);
    const input = joinCircleSchema.parse(request.data);
    const circleRef = db.collection('circles').doc(input.circleId);
    const memberRef = circleRef.collection('members').doc(uid);
    const joinRequestRef = circleRef.collection('joinRequests').doc(uid);
    const publicIndexRef = db
      .collection('publicCircleIndex')
      .doc(input.circleId);
    const now = FieldValue.serverTimestamp();
    const requestToken = randomUUID();

    const result = await db.runTransaction(async transaction => {
      const [circleSnapshot, memberSnapshot, joinRequestSnapshot] =
        await Promise.all([
          transaction.get(circleRef),
          transaction.get(memberRef),
          transaction.get(joinRequestRef),
        ]);

      if (!circleSnapshot.exists) {
        throw new HttpsError('not-found', 'Circle not found.');
      }

      const circle = circleSnapshot.data();
      const member = memberSnapshot.data();
      const joinRequest = joinRequestSnapshot.data();

      if (member?.status === 'active') {
        return {shouldNotifyOwner: false, status: 'active' as const};
      }

      if ((circle?.memberCount ?? 0) >= (circle?.maxSize ?? 0)) {
        throw new HttpsError('resource-exhausted', 'This circle is full.');
      }

      if (
        circle?.privacy === 'private' &&
        input.inviteCode !== circle.inviteCode
      ) {
        throw new HttpsError(
          'permission-denied',
          'A valid invite is required.',
        );
      }

      if (circle?.joinMode === 'request_to_join') {
        if (member?.status === 'pending' || joinRequest?.status === 'pending') {
          const existingRequestToken =
            asOptionalString(joinRequest?.notificationToken) ??
            asOptionalString(member?.notificationToken);

          if (!existingRequestToken && joinRequestSnapshot.exists) {
            transaction.set(
              joinRequestRef,
              {notificationToken: requestToken},
              {merge: true},
            );

            if (memberSnapshot.exists) {
              transaction.set(
                memberRef,
                {notificationToken: requestToken},
                {merge: true},
              );
            }

            return {
              requestToken,
              shouldNotifyOwner: true,
              status: 'pending' as const,
            };
          }

          return {shouldNotifyOwner: false, status: 'pending' as const};
        }

        transaction.set(
          joinRequestRef,
          {
            avatarUrl: profile.avatarUrl ?? null,
            createdAt: now,
            displayName: profile.displayName,
            handle: profile.handle,
            notificationToken: requestToken,
            status: 'pending',
            uid,
          },
          {merge: true},
        );
        transaction.set(
          memberRef,
          {
            avatarUrl: profile.avatarUrl ?? null,
            displayName: profile.displayName,
            handle: profile.handle,
            notificationToken: requestToken,
            requestedAt: now,
            role: 'member',
            status: 'pending',
            uid,
          },
          {merge: true},
        );
        return {
          requestToken,
          shouldNotifyOwner: true,
          status: 'pending' as const,
        };
      }

      const memberPreview = {
        avatarUrl: profile.avatarUrl ?? null,
        displayName: profile.displayName,
        handle: profile.handle,
        joinedAt: now,
        role: 'member',
        status: 'active',
        uid,
      };

      transaction.set(memberRef, memberPreview);
      transaction.update(circleRef, {memberCount: FieldValue.increment(1)});
      if (circle?.privacy === 'public') {
        transaction.set(
          publicIndexRef,
          {
            memberCount: FieldValue.increment(1),
            members: FieldValue.arrayUnion(
              buildMemberPublicPreview(profile, uid),
            ),
            updatedAt: now,
          },
          {merge: true},
        );
      }

      return {shouldNotifyOwner: true, status: 'active' as const};
    });

    const circleSnapshot = await circleRef.get();
    const circle = circleSnapshot.data();
    const ownerId = asOptionalString(circle?.ownerId);
    const circleTitle = asOptionalString(circle?.title) ?? 'your circle';

    if (ownerId && result.status === 'pending' && result.shouldNotifyOwner) {
      await notifyOwnerJoinRequest({
        circleId: input.circleId,
        circleTitle,
        ownerId,
        requestToken: result.requestToken,
        requester: {
          avatarUrl: profile.avatarUrl ?? null,
          displayName: profile.displayName,
          handle: profile.handle,
          uid,
        },
      }).catch(error =>
        console.error('notify_owner_join_request_failed', error),
      );
    } else if (
      ownerId &&
      result.status === 'active' &&
      result.shouldNotifyOwner
    ) {
      await notifyOwnerNewJoin({
        circleId: input.circleId,
        circleTitle,
        joinedMember: {
          avatarUrl: profile.avatarUrl ?? null,
          displayName: profile.displayName,
          handle: profile.handle,
          uid,
        },
        ownerId,
      }).catch(error => console.error('notify_owner_new_join_failed', error));
    }

    return {status: result.status};
  },
);

export const reviewJoinRequest = onCall(
  {secrets: [oneSignalRestApiKey]},
  async request => {
    const {profile, uid} = await requireCompletedProfile(request.auth?.uid);
    const input = reviewJoinRequestSchema.parse(request.data);
    const circleRef = db.collection('circles').doc(input.circleId);
    const memberRef = circleRef.collection('members').doc(uid);
    const requesterMemberRef = circleRef
      .collection('members')
      .doc(input.requesterId);
    const joinRequestRef = circleRef
      .collection('joinRequests')
      .doc(input.requesterId);
    const publicIndexRef = db
      .collection('publicCircleIndex')
      .doc(input.circleId);
    const now = FieldValue.serverTimestamp();

    const result = await db.runTransaction(async transaction => {
      const [
        circleSnapshot,
        memberSnapshot,
        requesterMemberSnapshot,
        joinRequestSnapshot,
      ] = await Promise.all([
        transaction.get(circleRef),
        transaction.get(memberRef),
        transaction.get(requesterMemberRef),
        transaction.get(joinRequestRef),
      ]);

      if (!circleSnapshot.exists) {
        throw new HttpsError('not-found', 'Circle not found.');
      }

      const circle = circleSnapshot.data();
      const ownerMember = memberSnapshot.data();

      if (
        circle?.ownerId !== uid ||
        ownerMember?.role !== 'owner' ||
        ownerMember?.status !== 'active'
      ) {
        throw new HttpsError(
          'permission-denied',
          'Only the circle owner can review requests.',
        );
      }

      const requesterMember = requesterMemberSnapshot.data();

      if (
        requesterMember?.status !== 'pending' &&
        joinRequestSnapshot.data()?.status !== 'pending'
      ) {
        throw new HttpsError('not-found', 'Join request not found.');
      }

      if (
        (circle?.memberCount ?? 0) >= (circle?.maxSize ?? 0) &&
        input.approved
      ) {
        throw new HttpsError('resource-exhausted', 'This circle is full.');
      }

      if (input.approved) {
        const approvedMember = {
          avatarUrl: requesterMember?.avatarUrl ?? null,
          displayName: requesterMember?.displayName ?? 'Hoyst member',
          handle: requesterMember?.handle ?? null,
          joinedAt: now,
          role: 'member',
          status: 'active',
          uid: input.requesterId,
        };

        transaction.set(requesterMemberRef, approvedMember, {merge: true});
        transaction.set(
          joinRequestRef,
          {
            reviewedAt: now,
            reviewedBy: uid,
            status: 'approved',
          },
          {merge: true},
        );
        transaction.update(circleRef, {memberCount: FieldValue.increment(1)});
        if (circle?.privacy === 'public') {
          transaction.set(
            publicIndexRef,
            {
              memberCount: FieldValue.increment(1),
              members: FieldValue.arrayUnion(
                buildMemberPublicPreview(approvedMember, input.requesterId),
              ),
              updatedAt: now,
            },
            {merge: true},
          );
        }
      } else {
        transaction.delete(requesterMemberRef);
        transaction.set(
          joinRequestRef,
          {
            reviewedAt: now,
            reviewedBy: uid,
            status: 'declined',
          },
          {merge: true},
        );
      }

      return {
        circleTitle: asOptionalString(circle?.title) ?? 'your circle',
        requesterMember,
        status: input.approved ? ('approved' as const) : ('declined' as const),
      };
    });

    await notifyJoinRequestReview({
      approved: input.approved,
      circleId: input.circleId,
      circleTitle: result.circleTitle,
      owner: {
        avatarUrl: profile.avatarUrl ?? null,
        displayName: profile.displayName,
        handle: profile.handle,
        uid,
      },
      requesterId: input.requesterId,
    }).catch(error => console.error('notify_join_review_failed', error));

    if (input.approved) {
      const circleSnapshot = await circleRef.get();
      const circle = circleSnapshot.data();
      const ownerId = asOptionalString(circle?.ownerId);

      if (ownerId) {
        await notifyOwnerNewJoin({
          circleId: input.circleId,
          circleTitle: result.circleTitle,
          joinedMember: result.requesterMember,
          ownerId,
        }).catch(error =>
          console.error('notify_owner_approved_join_failed', error),
        );
      }
    }

    return {status: result.status};
  },
);

export const nudgeCircleMembers = onCall(
  {secrets: [oneSignalRestApiKey]},
  async request => {
    const {profile, uid} = await requireCompletedProfile(request.auth?.uid);
    const input = nudgeCircleMembersSchema.parse(request.data);
    const circleRef = db.collection('circles').doc(input.circleId);
    const memberRef = circleRef.collection('members').doc(uid);
    const now = new Date();

    const [circleSnapshot, memberSnapshot] = await Promise.all([
      circleRef.get(),
      memberRef.get(),
    ]);

    if (!circleSnapshot.exists) {
      throw new HttpsError('not-found', 'Circle not found.');
    }

    const member = memberSnapshot.data();

    if (member?.status !== 'active') {
      throw new HttpsError('permission-denied', 'Join this circle first.');
    }

    const circle = circleSnapshot.data();
    const timezone = asOptionalString(circle?.timezone) ?? 'UTC';
    const dateKey = getDateKeyForTimezone(timezone, now);
    const weekDateKeys = getCommitmentWeekDateKeys(timezone, now);
    const commitmentCadence = getCommitmentCadence(circle);
    const requiredTapIns = getRequiredTapIns(circle);
    const [
      activeMemberSnapshots,
      todayCheckInSnapshots,
      ...weeklyCheckInSnapshots
    ] = await Promise.all([
      circleRef.collection('members').where('status', '==', 'active').get(),
      circleRef.collection('days').doc(dateKey).collection('checkIns').get(),
      ...weekDateKeys.map(weekDateKey =>
        circleRef
          .collection('days')
          .doc(weekDateKey)
          .collection('checkIns')
          .get(),
      ),
    ]);
    const coveredCounts = new Map<string, number>();
    const todayCoveredUids = new Set<string>();

    todayCheckInSnapshots.docs.forEach(doc => {
      if (['done', 'skip'].includes(doc.data().status)) {
        todayCoveredUids.add(asOptionalString(doc.data().uid) ?? doc.id);
      }
    });

    const scoringSnapshots =
      commitmentCadence === 'daily'
        ? [todayCheckInSnapshots]
        : weeklyCheckInSnapshots;

    scoringSnapshots.forEach(snapshot => {
      snapshot.docs.forEach(doc => {
        if (['done', 'skip'].includes(doc.data().status)) {
          const targetUid = asOptionalString(doc.data().uid) ?? doc.id;
          coveredCounts.set(targetUid, (coveredCounts.get(targetUid) ?? 0) + 1);
        }
      });
    });
    const targets = activeMemberSnapshots.docs
      .map(snapshot => snapshot.data())
      .filter(memberData => {
        const targetUid = asOptionalString(memberData.uid);
        return Boolean(
          targetUid &&
            targetUid !== uid &&
            !todayCoveredUids.has(targetUid) &&
            (coveredCounts.get(targetUid) ?? 0) < requiredTapIns,
        );
      });

    await Promise.all(
      targets.map(memberData =>
        notifyNudge({
          actor: {
            avatarUrl: profile.avatarUrl ?? null,
            displayName: profile.displayName,
            handle: profile.handle,
            uid,
          },
          circleId: input.circleId,
          circleTitle: asOptionalString(circle?.title) ?? 'your circle',
          dateKey,
          targetUid: asOptionalString(memberData.uid) ?? '',
        }),
      ),
    );

    return {nudged: targets.length};
  },
);

export const leaveCircle = onCall(async request => {
  const {uid} = await requireCompletedProfile(request.auth?.uid);
  const input = leaveCircleSchema.parse(request.data);
  const circleRef = db.collection('circles').doc(input.circleId);
  const memberRef = circleRef.collection('members').doc(uid);
  const joinRequestRef = circleRef.collection('joinRequests').doc(uid);
  const publicIndexRef = db.collection('publicCircleIndex').doc(input.circleId);
  const now = FieldValue.serverTimestamp();

  const status = await db.runTransaction(async transaction => {
    const [
      circleSnapshot,
      memberSnapshot,
      joinRequestSnapshot,
      publicIndexSnapshot,
    ] = await Promise.all([
      transaction.get(circleRef),
      transaction.get(memberRef),
      transaction.get(joinRequestRef),
      transaction.get(publicIndexRef),
    ]);

    if (!circleSnapshot.exists) {
      throw new HttpsError('not-found', 'Circle not found.');
    }

    const circle = circleSnapshot.data();
    const member = memberSnapshot.data();
    const joinRequest = joinRequestSnapshot.data();

    if (circle?.ownerId === uid || member?.role === 'owner') {
      throw new HttpsError(
        'failed-precondition',
        'Circle owners cannot leave their own circle yet. Delete the circle instead.',
      );
    }

    const isActiveMember = member?.status === 'active';
    const isPendingMember =
      member?.status === 'pending' || joinRequest?.status === 'pending';
    const leaveStatus = isActiveMember
      ? ('left' as const)
      : ('cancelled' as const);
    const filteredMembers = withoutPublicMemberPreview(
      publicIndexSnapshot.data()?.members,
      uid,
    );

    if (!isActiveMember && !isPendingMember) {
      return 'cancelled' as const;
    }

    if (memberSnapshot.exists) {
      transaction.delete(memberRef);
    }

    if (joinRequestSnapshot.exists) {
      transaction.delete(joinRequestRef);
    }

    if (isActiveMember) {
      transaction.update(circleRef, {
        memberCount: FieldValue.increment(-1),
        updatedAt: now,
      });
    }

    if (publicIndexSnapshot.exists) {
      transaction.set(
        publicIndexRef,
        {
          ...(isActiveMember
            ? {memberCount: FieldValue.increment(-1)}
            : {}),
          ...(filteredMembers ? {members: filteredMembers} : {}),
          updatedAt: now,
        },
        {merge: true},
      );
    }

    return leaveStatus;
  });

  await deleteCircleCheckInsForMember(input.circleId, uid);

  return {status};
});

export const updateCircle = onCall(async request => {
  const input = updateCircleSchema.parse(request.data);
  const {uid} = await requireCompletedProfile(request.auth?.uid, input.idToken);
  const circleRef = db.collection('circles').doc(input.circleId);
  const memberRef = circleRef.collection('members').doc(uid);
  const publicIndexRef = db.collection('publicCircleIndex').doc(input.circleId);

  const [circleSnapshot, memberSnapshot, activeMemberSnapshots] =
    await Promise.all([
      circleRef.get(),
      memberRef.get(),
      circleRef.collection('members').where('status', '==', 'active').get(),
    ]);

  if (!circleSnapshot.exists) {
    throw new HttpsError('not-found', 'Circle not found.');
  }

  const circle = circleSnapshot.data();
  const member = memberSnapshot.data();

  if (
    circle?.ownerId !== uid ||
    member?.role !== 'owner' ||
    member?.status !== 'active'
  ) {
    throw new HttpsError(
      'permission-denied',
      'Only the circle owner can edit this circle.',
    );
  }

  const storedMemberCount =
    typeof circle?.memberCount === 'number' && Number.isFinite(circle.memberCount)
      ? circle.memberCount
      : 0;
  const memberCount = Math.max(storedMemberCount, activeMemberSnapshots.size);

  if (input.maxSize < memberCount) {
    throw new HttpsError(
      'failed-precondition',
      'Max size cannot be below the current member count.',
    );
  }

  const now = FieldValue.serverTimestamp();
  const commitmentCadence = getInputCommitmentCadence(
    input.commitmentCadence,
    input.commitmentFrequency,
  );
  const commitmentFrequency = getStoredCommitmentFrequency(
    commitmentCadence,
    input.commitmentFrequency,
  );
  const circleUpdate = {
    category: input.category,
    commitment: input.commitment,
    commitmentCadence,
    commitmentFrequency,
    graceRules: input.graceRules ?? {
      skip: {
        allowance: 2,
        windowDays: 7,
      },
    },
    joinMode: input.joinMode,
    maxSize: input.maxSize,
    privacy: input.privacy,
    title: input.title,
    timezone: input.timezone ?? circle?.timezone ?? 'UTC',
    updatedAt: now,
  };
  const batch = db.batch();

  batch.update(circleRef, circleUpdate);

  if (input.privacy === 'public') {
    batch.set(publicIndexRef, {
      category: input.category,
      commitment: input.commitment,
      commitmentCadence,
      commitmentFrequency,
      joinMode: input.joinMode,
      maxSize: input.maxSize,
      memberCount,
      members: activeMemberSnapshots.docs.map(snapshot =>
        buildPublicPreviewFromMember(snapshot.data(), snapshot.id),
      ),
      title: input.title,
      updatedAt: now,
    });
  } else {
    batch.delete(publicIndexRef);
  }

  await batch.commit();

  return {updated: true as const};
});

export const deleteCircle = onCall(async request => {
  const {uid} = await requireCompletedProfile(request.auth?.uid);
  const input = deleteCircleSchema.parse(request.data);
  const circleRef = db.collection('circles').doc(input.circleId);
  const memberRef = circleRef.collection('members').doc(uid);

  const [circleSnapshot, memberSnapshot] = await Promise.all([
    circleRef.get(),
    memberRef.get(),
  ]);

  if (!circleSnapshot.exists) {
    throw new HttpsError('not-found', 'Circle not found.');
  }

  const circle = circleSnapshot.data();
  const member = memberSnapshot.data();

  if (
    circle?.ownerId !== uid ||
    member?.role !== 'owner' ||
    member?.status !== 'active'
  ) {
    throw new HttpsError(
      'permission-denied',
      'Only the circle owner can delete this circle.',
    );
  }

  await deleteCircleServerMetadata(input.circleId);
  await db.recursiveDelete(circleRef);

  return {deleted: true as const};
});
