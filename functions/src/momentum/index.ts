import {
  FieldValue,
  type DocumentData,
  type DocumentSnapshot,
  type Transaction,
} from 'firebase-admin/firestore';
import {HttpsError, onCall} from 'firebase-functions/v2/https';
import {onSchedule} from 'firebase-functions/v2/scheduler';

import {db} from '../firebase';
import {
  calculateMomentumSummary,
  getOpportunitySlots,
  getOpportunityStatusForSlot,
  normalizeCommitmentSchedule,
  type MomentumOpportunity,
  type OpportunitySlot,
  type OpportunityStatus,
} from './schedule';

type RecordTapInOpportunityInput = {
  checkInId: string;
  circle: DocumentData | undefined;
  circleId: string;
  dateKey: string;
  memberCount?: number;
  profile: DocumentData;
  status: 'done' | 'skip';
  transaction: Transaction;
  uid: string;
};

type RemoveTapInOpportunityInput = {
  circle: DocumentData | undefined;
  circleId: string;
  dateKey: string;
  transaction: Transaction;
  uid: string;
};

function asString(value: unknown, fallback = '') {
  return typeof value === 'string' && value.trim().length > 0
    ? value.trim()
    : fallback;
}

function asNumber(value: unknown, fallback: number) {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback;
}

function getOpportunityId(circleId: string, periodKey: string, slotIndex: number) {
  return `${circleId}_${periodKey}_${slotIndex}`;
}

function getCurrentSlots(circle: DocumentData | undefined, now = new Date()) {
  const timezone = asString(circle?.timezone, 'UTC');
  const schedule = normalizeCommitmentSchedule(circle, timezone);
  return getOpportunitySlots(schedule, now);
}

function getSlotForDate(
  circle: DocumentData | undefined,
  dateKey: string,
  existingStatuses: Map<number, unknown>,
) {
  const slots = getCurrentSlots(circle);
  const availableSlots = slots.filter(slot => slot.availableDateKey <= dateKey);
  const openSlot = availableSlots.find(slot => {
    const status = existingStatuses.get(slot.slotIndex);
    return status !== 'completed' && status !== 'skipped';
  });

  if (openSlot) {
    return openSlot;
  }

  if (availableSlots.length > 0) {
    return undefined;
  }

  const nextSlot = slots[0];

  if (!nextSlot) {
    throw new HttpsError(
      'failed-precondition',
      'No opportunity is available for this commitment.',
    );
  }

  return nextSlot;
}

function mapOpportunitySnapshot(snapshot: DocumentSnapshot): MomentumOpportunity | undefined {
  const data = snapshot.data();
  const status = data?.status;

  if (
    status !== 'upcoming' &&
    status !== 'available' &&
    status !== 'completed' &&
    status !== 'missed' &&
    status !== 'expired' &&
    status !== 'skipped'
  ) {
    return undefined;
  }

  return {
    availableDateKey: asString(data?.availableDateKey),
    periodKey: asString(data?.periodKey),
    slotIndex: asNumber(data?.slotIndex, 0),
    status,
  };
}

export async function recalculateMomentumSummaryForUser(uid: string) {
  const momentumRef = db
    .collection('userPrivate')
    .doc(uid)
    .collection('momentum')
    .doc('current');
  const [momentumSnapshot, opportunitySnapshots] = await Promise.all([
    momentumRef.get(),
    db
      .collection('userPrivate')
      .doc(uid)
      .collection('opportunities')
      .where('isCurrentPeriod', '==', true)
      .get(),
  ]);
  const opportunities = opportunitySnapshots.docs
    .map(mapOpportunitySnapshot)
    .filter((opportunity): opportunity is MomentumOpportunity =>
      Boolean(opportunity),
    );
  const summary = calculateMomentumSummary({
    opportunities,
    periodKey: 'current',
    priorBestStreak: asNumber(momentumSnapshot.data()?.bestStreak, 0),
  });

  await momentumRef.set(
    {
      ...summary,
      updatedAt: FieldValue.serverTimestamp(),
    },
    {merge: true},
  );

  return summary;
}

function buildOpportunityPayload({
  checkInId,
  circle,
  circleId,
  dateKey,
  profile,
  slot,
  status,
  uid,
}: {
  checkInId?: string;
  circle: DocumentData | undefined;
  circleId: string;
  dateKey?: string;
  profile?: DocumentData;
  slot: OpportunitySlot;
  status: OpportunityStatus;
  uid: string;
}) {
  return {
    availableDateKey: slot.availableDateKey,
    cadence: normalizeCommitmentSchedule(circle).cadence,
    circleId,
    commitment: asString(circle?.commitment),
    expiresDateKey: slot.expiresDateKey,
    id: getOpportunityId(circleId, slot.periodKey, slot.slotIndex),
    isCurrentPeriod: true,
    periodKey: slot.periodKey,
    slotIndex: slot.slotIndex,
    status,
    timezone: asString(circle?.timezone, 'UTC'),
    title: asString(circle?.title, 'Hoyst Circle'),
    updatedAt: FieldValue.serverTimestamp(),
    uid,
    ...(checkInId ? {linkedCheckInId: checkInId} : {}),
    ...(dateKey ? {completionDateKey: dateKey} : {}),
    ...(status === 'completed' || status === 'skipped'
      ? {completedAt: FieldValue.serverTimestamp()}
      : {}),
    ...(profile
      ? {
          memberPreview: {
            avatarUrl: profile.avatarUrl ?? null,
            displayName: profile.displayName,
            handle: profile.handle,
            uid,
          },
        }
      : {}),
  };
}

export async function recordTapInOpportunity({
  checkInId,
  circle,
  circleId,
  dateKey,
  memberCount,
  profile,
  status,
  transaction,
  uid,
}: RecordTapInOpportunityInput) {
  const userPrivateRef = db.collection('userPrivate').doc(uid);
  const slots = getCurrentSlots(circle);
  const opportunityRefs = slots.map(slot =>
    userPrivateRef
      .collection('opportunities')
      .doc(getOpportunityId(circleId, slot.periodKey, slot.slotIndex)),
  );
  const opportunitySnapshots = await Promise.all(
    opportunityRefs.map(ref => transaction.get(ref)),
  );
  const existingStatuses = new Map(
    opportunitySnapshots.map(snapshot => [
      asNumber(snapshot.data()?.slotIndex, 0),
      snapshot.data()?.status,
    ]),
  );
  const slot = getSlotForDate(circle, dateKey, existingStatuses);

  if (!slot) {
    return;
  }

  const opportunityRef = userPrivateRef
    .collection('opportunities')
    .doc(getOpportunityId(circleId, slot.periodKey, slot.slotIndex));
  const priorOpportunitySnapshot = await transaction.get(opportunityRef);
  const priorStatus = priorOpportunitySnapshot.data()?.status;
  const opportunityStatus = status === 'done' ? 'completed' : 'skipped';
  const circleOpportunityRef = db
    .collection('circles')
    .doc(circleId)
    .collection('opportunities')
    .doc(slot.periodKey);

  transaction.set(
    opportunityRef,
    buildOpportunityPayload({
      checkInId,
      circle,
      circleId,
      dateKey,
      profile,
      slot,
      status: opportunityStatus,
      uid,
    }),
    {merge: true},
  );
  transaction.set(
    circleOpportunityRef,
    {
      completedMembers:
        opportunityStatus === 'completed' && priorStatus !== 'completed'
          ? FieldValue.increment(1)
          : FieldValue.increment(0),
      expectedMembers: memberCount ?? asNumber(circle?.memberCount, 0),
      periodKey: slot.periodKey,
      progressPercent: 0,
      riskState: 'active',
      updatedAt: FieldValue.serverTimestamp(),
    },
    {merge: true},
  );
}

export async function removeTapInOpportunity({
  circle,
  circleId,
  dateKey,
  transaction,
  uid,
}: RemoveTapInOpportunityInput) {
  const userPrivateRef = db.collection('userPrivate').doc(uid);
  const slots = getCurrentSlots(circle);
  const opportunityRefs = slots.map(slot =>
    userPrivateRef
      .collection('opportunities')
      .doc(getOpportunityId(circleId, slot.periodKey, slot.slotIndex)),
  );
  const opportunitySnapshots = await Promise.all(
    opportunityRefs.map(ref => transaction.get(ref)),
  );
  const matchedIndex = opportunitySnapshots.findIndex(snapshot => {
    const data = snapshot.data();
    return (
      data?.completionDateKey === dateKey &&
      (data.status === 'completed' || data.status === 'skipped')
    );
  });

  if (matchedIndex < 0) {
    return;
  }

  const slot = slots[matchedIndex];
  const opportunityRef = opportunityRefs[matchedIndex];
  const priorStatus = opportunitySnapshots[matchedIndex].data()?.status;
  const nextStatus = getOpportunityStatusForSlot({
    slot,
    timezone: asString(circle?.timezone, 'UTC'),
  });
  const circleOpportunityRef = db
    .collection('circles')
    .doc(circleId)
    .collection('opportunities')
    .doc(slot.periodKey);

  transaction.set(
    opportunityRef,
    {
      completedAt: FieldValue.delete(),
      completionDateKey: FieldValue.delete(),
      linkedCheckInId: FieldValue.delete(),
      status: nextStatus,
      updatedAt: FieldValue.serverTimestamp(),
    },
    {merge: true},
  );

  if (priorStatus === 'completed') {
    transaction.set(
      circleOpportunityRef,
      {
        completedMembers: FieldValue.increment(-1),
        updatedAt: FieldValue.serverTimestamp(),
      },
      {merge: true},
    );
  }
}

export const materializeMomentumOpportunities = onSchedule(
  {schedule: '0 * * * *'},
  async () => {
    const now = new Date();
    const circleSnapshots = await db.collection('circles').get();
    const affectedUids = new Set<string>();

    for (const circleSnapshot of circleSnapshots.docs) {
      const circle = circleSnapshot.data();
      const slots = getCurrentSlots(circle, now);
      const memberSnapshots = await circleSnapshot.ref
        .collection('members')
        .where('status', '==', 'active')
        .get();
      const batch = db.batch();

      memberSnapshots.docs.forEach(memberSnapshot => {
        const member = memberSnapshot.data();
        const uid = asString(member.uid, memberSnapshot.id);

        if (!uid) {
          return;
        }

        affectedUids.add(uid);

        slots.forEach(slot => {
          const opportunityRef = db
            .collection('userPrivate')
            .doc(uid)
            .collection('opportunities')
            .doc(getOpportunityId(circleSnapshot.id, slot.periodKey, slot.slotIndex));
          const status = getOpportunityStatusForSlot({
            slot,
            timezone: asString(circle.timezone, 'UTC'),
          });

          batch.set(
            opportunityRef,
            buildOpportunityPayload({
              circle,
              circleId: circleSnapshot.id,
              slot,
              status,
              uid,
            }),
            {merge: true},
          );
        });

        const periodKey = slots[0]?.periodKey;
        if (periodKey) {
          batch.set(
            circleSnapshot.ref.collection('opportunities').doc(periodKey),
            {
              expectedMembers: memberSnapshots.size,
              periodKey,
              updatedAt: FieldValue.serverTimestamp(),
            },
            {merge: true},
          );
        }
      });

      await batch.commit();
    }

    await Promise.all(
      Array.from(affectedUids).map(uid => recalculateMomentumSummaryForUser(uid)),
    );
  },
);

export const backfillMomentumOpportunities = onCall(async request => {
  if (!request.auth?.uid) {
    throw new HttpsError('unauthenticated', 'Sign in is required.');
  }

  const uid = request.auth.uid;
  const membershipsSnapshot = await db
    .collectionGroup('members')
    .where('uid', '==', uid)
    .get();

  for (const membershipSnapshot of membershipsSnapshot.docs) {
    if (membershipSnapshot.data().status !== 'active') {
      continue;
    }

    const circleRef = membershipSnapshot.ref.parent.parent;

    if (!circleRef) {
      continue;
    }

    const circleSnapshot = await circleRef.get();
    const circle = circleSnapshot.data();
    const slots = getCurrentSlots(circle);
    const batch = db.batch();

    slots.forEach(slot => {
      batch.set(
        db
          .collection('userPrivate')
          .doc(uid)
          .collection('opportunities')
          .doc(getOpportunityId(circleRef.id, slot.periodKey, slot.slotIndex)),
        buildOpportunityPayload({
          circle,
          circleId: circleRef.id,
          slot,
          status: getOpportunityStatusForSlot({
            slot,
            timezone: asString(circle?.timezone, 'UTC'),
          }),
          uid,
        }),
        {merge: true},
      );
    });

    await batch.commit();
  }

  return recalculateMomentumSummaryForUser(uid);
});
