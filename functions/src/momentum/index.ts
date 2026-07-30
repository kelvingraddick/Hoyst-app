import {
  FieldValue,
  type DocumentData,
  type DocumentReference,
  type DocumentSnapshot,
  type Transaction,
} from 'firebase-admin/firestore';
import {HttpsError, onCall} from 'firebase-functions/v2/https';
import {onSchedule} from 'firebase-functions/v2/scheduler';

import {db} from '../firebase';
import {
  calculateRollingMomentumSummary,
  calculateMomentumSummary,
  calculateMomentumStreaks,
  getDateKey,
  getOpportunitySlots,
  getOpportunityStatusForSlot,
  isExpiredExpectedOpenOpportunity,
  normalizeCommitmentSchedule,
  type MomentumOpportunity,
  type OpportunitySlot,
  type OpportunityStatus,
} from './schedule';
import {getEligibleOpenSlot, isMemberExpectedForSlot} from './eligibility';

type RecordTapInOpportunityInput = {
  checkInId: string;
  circle: DocumentData | undefined;
  circleId: string;
  dateKey: string;
  memberCount?: number;
  member?: DocumentData;
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

function asTimestampMs(value: unknown) {
  if (!value || typeof value !== 'object') {
    return undefined;
  }

  if (
    'toMillis' in value &&
    typeof (value as {toMillis?: unknown}).toMillis === 'function'
  ) {
    return (value as {toMillis: () => number}).toMillis();
  }

  if (
    'toDate' in value &&
    typeof (value as {toDate?: unknown}).toDate === 'function'
  ) {
    return (value as {toDate: () => Date}).toDate().getTime();
  }

  if (
    'seconds' in value &&
    typeof (value as {seconds?: unknown}).seconds === 'number'
  ) {
    return (value as {seconds: number}).seconds * 1000;
  }

  return undefined;
}

function asStringArray(value: unknown) {
  return Array.isArray(value)
    ? value.filter(
        (item): item is string =>
          typeof item === 'string' && item.trim().length > 0,
      )
    : [];
}

function withUid(values: unknown, uid: string) {
  return Array.from(new Set([...asStringArray(values), uid]));
}

function withoutUid(values: unknown, uid: string) {
  return asStringArray(values).filter(value => value !== uid);
}

export function removeUidFromCircleSlotAggregate(
  data: DocumentData | undefined,
  uid: string,
) {
  const completedMemberUids = withoutUid(data?.completedMemberUids, uid);
  const coveredMemberUids = withoutUid(data?.coveredMemberUids, uid);
  const expectedMemberUids = withoutUid(data?.expectedMemberUids, uid);
  const skippedMemberUids = withoutUid(data?.skippedMemberUids, uid);

  return {
    completedMemberCount: completedMemberUids.length,
    completedMemberUids,
    coveredMemberCount: coveredMemberUids.length,
    coveredMemberUids,
    expectedMemberCount: expectedMemberUids.length,
    expectedMemberUids,
    skippedMemberCount: skippedMemberUids.length,
    skippedMemberUids,
  };
}

function summarizeCircleSlotAggregates(
  aggregates: Array<ReturnType<typeof removeUidFromCircleSlotAggregate>>,
) {
  const expectedOpportunityCount = aggregates.reduce(
    (total, aggregate) => total + aggregate.expectedMemberUids.length,
    0,
  );
  const coveredOpportunityCount = aggregates.reduce(
    (total, aggregate) => total + aggregate.coveredMemberUids.length,
    0,
  );

  return {
    completedMembers: coveredOpportunityCount,
    completedOpportunityCount: aggregates.reduce(
      (total, aggregate) => total + aggregate.completedMemberUids.length,
      0,
    ),
    coveredOpportunityCount,
    expectedMembers: new Set(
      aggregates.flatMap(aggregate => aggregate.expectedMemberUids),
    ).size,
    expectedOpportunityCount,
    progressPercent:
      expectedOpportunityCount > 0
        ? Math.round((coveredOpportunityCount / expectedOpportunityCount) * 100)
        : 0,
    skippedOpportunityCount: aggregates.reduce(
      (total, aggregate) => total + aggregate.skippedMemberUids.length,
      0,
    ),
  };
}

type SetWrite = {
  data: DocumentData;
  merge?: boolean;
  ref: DocumentReference;
};

async function commitSetWrites(writes: SetWrite[]) {
  for (let index = 0; index < writes.length; index += 400) {
    const batch = db.batch();

    writes.slice(index, index + 400).forEach(write => {
      if (write.merge) {
        batch.set(write.ref, write.data, {merge: true});
      } else {
        batch.set(write.ref, write.data);
      }
    });
    await batch.commit();
  }
}

function getOpportunityId(
  circleId: string,
  periodKey: string,
  slotIndex: number,
) {
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
  member?: DocumentData,
) {
  const slots = getCurrentSlots(circle);
  const timezone = asString(circle?.timezone, 'UTC');

  return getEligibleOpenSlot({
    dateKey,
    existingStatuses,
    member,
    slots,
    timezone,
  });
}

function mapOpportunitySnapshot(
  snapshot: DocumentSnapshot,
): MomentumOpportunity | undefined {
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
    expectedForCircle:
      typeof data?.expectedForCircle === 'boolean'
        ? data.expectedForCircle
        : undefined,
    expiresDateKey: asString(data?.expiresDateKey) || undefined,
    periodKey: asString(data?.periodKey),
    resolvedAtMs:
      asTimestampMs(data?.resolvedAt) ??
      asTimestampMs(data?.completedAt) ??
      asTimestampMs(data?.updatedAt),
    resolvedDateKey:
      asString(data?.completionDateKey) ||
      asString(data?.expiresDateKey) ||
      undefined,
    slotIndex: asNumber(data?.slotIndex, 0),
    status,
    timezone: asString(data?.timezone, 'UTC'),
  };
}

export async function recalculateMomentumSummaryForUser(uid: string) {
  const momentumRef = db
    .collection('userPrivate')
    .doc(uid)
    .collection('momentum')
    .doc('current');
  const opportunitySnapshots = await db
    .collection('userPrivate')
    .doc(uid)
    .collection('opportunities')
    .get();
  const allOpportunities = opportunitySnapshots.docs
    .map(mapOpportunitySnapshot)
    .filter((opportunity): opportunity is MomentumOpportunity =>
      Boolean(opportunity),
    );
  const currentOpportunities = opportunitySnapshots.docs
    .filter(snapshot => snapshot.data()?.isCurrentPeriod !== false)
    .map(mapOpportunitySnapshot)
    .filter((opportunity): opportunity is MomentumOpportunity =>
      Boolean(opportunity),
    );
  const streaks = calculateMomentumStreaks({
    opportunities: allOpportunities,
  });
  const summary = calculateMomentumSummary({
    opportunities: currentOpportunities,
    periodKey: 'current',
  });
  const rollingMomentum = calculateRollingMomentumSummary({
    opportunities: allOpportunities,
  });
  const reconciledSummary = {...summary, ...streaks, rollingMomentum};

  await momentumRef.set(
    {
      ...reconciledSummary,
      updatedAt: FieldValue.serverTimestamp(),
    },
    {merge: true},
  );

  return reconciledSummary;
}

function buildOpportunityPayload({
  checkInId,
  circle,
  circleId,
  dateKey,
  profile,
  stampResolution = true,
  slot,
  status,
  uid,
}: {
  checkInId?: string;
  circle: DocumentData | undefined;
  circleId: string;
  dateKey?: string;
  profile?: DocumentData;
  stampResolution?: boolean;
  slot: OpportunitySlot;
  status: OpportunityStatus;
  uid: string;
}) {
  const isResolved =
    status === 'completed' ||
    status === 'skipped' ||
    status === 'missed' ||
    status === 'expired';

  return {
    availableDateKey: slot.availableDateKey,
    cadence: normalizeCommitmentSchedule(circle).cadence,
    circleId,
    commitment: asString(circle?.commitment),
    countsTowardCircle: true,
    expiresDateKey: slot.expiresDateKey,
    expectedForCircle: true,
    id: getOpportunityId(circleId, slot.periodKey, slot.slotIndex),
    isCurrentPeriod: status !== 'missed' && status !== 'expired',
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
    ...(stampResolution && isResolved
      ? {resolvedAt: FieldValue.serverTimestamp()}
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
  member,
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
  const creditedOpportunityIndex = opportunitySnapshots.findIndex(snapshot => {
    const data = snapshot.data();

    return (
      data?.completionDateKey === dateKey &&
      (data.status === 'completed' || data.status === 'skipped')
    );
  });
  const slot =
    creditedOpportunityIndex >= 0
      ? slots[creditedOpportunityIndex]
      : getSlotForDate(circle, dateKey, existingStatuses, member);

  if (!slot) {
    const timezone = asString(circle?.timezone, 'UTC');
    const hasSatisfiedEligibleOpportunity = slots.some(candidate => {
      const candidateStatus = existingStatuses.get(candidate.slotIndex);
      return (
        isMemberExpectedForSlot({member, slot: candidate, timezone}) &&
        candidate.availableDateKey <= dateKey &&
        (candidateStatus === 'completed' || candidateStatus === 'skipped')
      );
    });

    if (hasSatisfiedEligibleOpportunity) {
      return;
    }

    throw new HttpsError(
      'failed-precondition',
      'No opportunity is open for this commitment yet.',
    );
  }

  const opportunityRef = userPrivateRef
    .collection('opportunities')
    .doc(getOpportunityId(circleId, slot.periodKey, slot.slotIndex));
  const opportunityIndex = slots.findIndex(
    candidate => candidate.slotIndex === slot.slotIndex,
  );
  const priorOpportunitySnapshot =
    opportunityIndex >= 0
      ? opportunitySnapshots[opportunityIndex]
      : await transaction.get(opportunityRef);
  const priorStatus = priorOpportunitySnapshot.data()?.status;
  const opportunityStatus = status === 'done' ? 'completed' : 'skipped';
  const circleOpportunityRef = db
    .collection('circles')
    .doc(circleId)
    .collection('opportunities')
    .doc(slot.periodKey);
  const circleSlotRef = circleOpportunityRef
    .collection('slots')
    .doc(String(slot.slotIndex));
  const [circleOpportunitySnapshot, circleSlotSnapshot] = await Promise.all([
    transaction.get(circleOpportunityRef),
    transaction.get(circleSlotRef),
  ]);
  const slotData = circleSlotSnapshot.data();
  const periodData = circleOpportunitySnapshot.data();
  const expectedMemberUids = withUid(slotData?.expectedMemberUids, uid);
  const coveredMemberUids = withUid(slotData?.coveredMemberUids, uid);
  const completedMemberUids =
    opportunityStatus === 'completed'
      ? withUid(slotData?.completedMemberUids, uid)
      : withoutUid(slotData?.completedMemberUids, uid);
  const skippedMemberUids =
    opportunityStatus === 'skipped'
      ? withUid(slotData?.skippedMemberUids, uid)
      : withoutUid(slotData?.skippedMemberUids, uid);
  const wasCredited = priorStatus === 'completed' || priorStatus === 'skipped';
  const expectedDelta = asStringArray(slotData?.expectedMemberUids).includes(
    uid,
  )
    ? 0
    : 1;
  const coveredDelta = wasCredited ? 0 : 1;
  const completedDelta =
    (opportunityStatus === 'completed' ? 1 : 0) -
    (priorStatus === 'completed' ? 1 : 0);
  const skippedDelta =
    (opportunityStatus === 'skipped' ? 1 : 0) -
    (priorStatus === 'skipped' ? 1 : 0);
  const expectedOpportunityCount = Math.max(
    0,
    asNumber(periodData?.expectedOpportunityCount, 0) + expectedDelta,
  );
  const coveredOpportunityCount = Math.max(
    0,
    asNumber(periodData?.coveredOpportunityCount, 0) + coveredDelta,
  );

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
    circleSlotRef,
    {
      availableDateKey: slot.availableDateKey,
      completedMemberCount: completedMemberUids.length,
      completedMemberUids,
      coveredMemberCount: coveredMemberUids.length,
      coveredMemberUids,
      expectedMemberCount: expectedMemberUids.length,
      expectedMemberUids,
      expiresDateKey: slot.expiresDateKey,
      periodKey: slot.periodKey,
      skippedMemberCount: skippedMemberUids.length,
      skippedMemberUids,
      slotIndex: slot.slotIndex,
      updatedAt: FieldValue.serverTimestamp(),
    },
    {merge: true},
  );
  transaction.set(
    circleOpportunityRef,
    {
      completedMembers: FieldValue.increment(coveredDelta),
      completedOpportunityCount: Math.max(
        0,
        asNumber(periodData?.completedOpportunityCount, 0) + completedDelta,
      ),
      coveredOpportunityCount,
      expectedMembers: memberCount ?? asNumber(circle?.memberCount, 0),
      expectedOpportunityCount,
      periodKey: slot.periodKey,
      progressPercent:
        expectedOpportunityCount > 0
          ? Math.round(
              (coveredOpportunityCount / expectedOpportunityCount) * 100,
            )
          : 0,
      riskState: 'active',
      skippedOpportunityCount: Math.max(
        0,
        asNumber(periodData?.skippedOpportunityCount, 0) + skippedDelta,
      ),
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
  const circleSlotRef = circleOpportunityRef
    .collection('slots')
    .doc(String(slot.slotIndex));
  const [circleOpportunitySnapshot, circleSlotSnapshot] = await Promise.all([
    transaction.get(circleOpportunityRef),
    transaction.get(circleSlotRef),
  ]);
  const periodData = circleOpportunitySnapshot.data();
  const slotData = circleSlotSnapshot.data();
  const coveredMemberUids = withoutUid(slotData?.coveredMemberUids, uid);
  const completedMemberUids = withoutUid(slotData?.completedMemberUids, uid);
  const skippedMemberUids = withoutUid(slotData?.skippedMemberUids, uid);
  const coveredDelta =
    priorStatus === 'completed' || priorStatus === 'skipped' ? -1 : 0;
  const completedDelta = priorStatus === 'completed' ? -1 : 0;
  const skippedDelta = priorStatus === 'skipped' ? -1 : 0;
  const expectedOpportunityCount = asNumber(
    periodData?.expectedOpportunityCount,
    0,
  );
  const coveredOpportunityCount = Math.max(
    0,
    asNumber(periodData?.coveredOpportunityCount, 0) + coveredDelta,
  );

  transaction.set(
    opportunityRef,
    {
      completedAt: FieldValue.delete(),
      completionDateKey: FieldValue.delete(),
      linkedCheckInId: FieldValue.delete(),
      resolvedAt: FieldValue.delete(),
      status: nextStatus,
      updatedAt: FieldValue.serverTimestamp(),
    },
    {merge: true},
  );

  transaction.set(
    circleSlotRef,
    {
      completedMemberCount: completedMemberUids.length,
      completedMemberUids,
      coveredMemberCount: coveredMemberUids.length,
      coveredMemberUids,
      skippedMemberCount: skippedMemberUids.length,
      skippedMemberUids,
      updatedAt: FieldValue.serverTimestamp(),
    },
    {merge: true},
  );

  transaction.set(
    circleOpportunityRef,
    {
      completedMembers: FieldValue.increment(coveredDelta),
      completedOpportunityCount: Math.max(
        0,
        asNumber(periodData?.completedOpportunityCount, 0) + completedDelta,
      ),
      coveredOpportunityCount,
      progressPercent:
        expectedOpportunityCount > 0
          ? Math.round(
              (coveredOpportunityCount / expectedOpportunityCount) * 100,
            )
          : 0,
      skippedOpportunityCount: Math.max(
        0,
        asNumber(periodData?.skippedOpportunityCount, 0) + skippedDelta,
      ),
      updatedAt: FieldValue.serverTimestamp(),
    },
    {merge: true},
  );
}

export async function removeMemberFromOpenCircleOpportunities({
  circleId,
  leftAt,
  uid,
}: {
  circleId: string;
  leftAt: Date;
  uid: string;
}) {
  const circleRef = db.collection('circles').doc(circleId);
  const circleSnapshot = await circleRef.get();

  if (!circleSnapshot.exists) {
    return;
  }

  const circle = circleSnapshot.data();
  const timezone = asString(circle?.timezone, 'UTC');
  const leftDateKey = getDateKey(timezone, leftAt);
  const slots = getCurrentSlots(circle, leftAt);
  const periodKey = slots[0]?.periodKey;

  if (!periodKey) {
    return;
  }

  const periodRef = circleRef.collection('opportunities').doc(periodKey);
  const slotRefs = slots.map(slot =>
    periodRef.collection('slots').doc(String(slot.slotIndex)),
  );
  const opportunityRefs = slots.map(slot =>
    db
      .collection('userPrivate')
      .doc(uid)
      .collection('opportunities')
      .doc(getOpportunityId(circleId, slot.periodKey, slot.slotIndex)),
  );
  const [slotSnapshots, opportunitySnapshots] = await Promise.all([
    Promise.all(slotRefs.map(ref => ref.get())),
    Promise.all(opportunityRefs.map(ref => ref.get())),
  ]);
  const writes: SetWrite[] = [];
  const deleteRefs: DocumentReference[] = [];
  const nextSlots = slotSnapshots.map((snapshot, index) => {
    const slot = slots[index];
    const data = snapshot.data() ?? {};

    if (slot.expiresDateKey < leftDateKey) {
      const completedMemberUids = asStringArray(data.completedMemberUids);
      const coveredMemberUids = asStringArray(data.coveredMemberUids);
      const expectedMemberUids = asStringArray(data.expectedMemberUids);
      const skippedMemberUids = asStringArray(data.skippedMemberUids);

      return {
        completedMemberCount: completedMemberUids.length,
        completedMemberUids,
        coveredMemberCount: coveredMemberUids.length,
        coveredMemberUids,
        expectedMemberCount: expectedMemberUids.length,
        expectedMemberUids,
        skippedMemberCount: skippedMemberUids.length,
        skippedMemberUids,
      };
    }

    const aggregate = removeUidFromCircleSlotAggregate(data, uid);
    const opportunityData = opportunitySnapshots[index].data();

    writes.push({
      data: {
        ...aggregate,
        updatedAt: FieldValue.serverTimestamp(),
      },
      merge: true,
      ref: slotRefs[index],
    });

    if (
      opportunityData?.status === 'completed' ||
      opportunityData?.status === 'skipped'
    ) {
      writes.push({
        data: {
          countsTowardCircle: false,
          expectedForCircle: false,
          updatedAt: FieldValue.serverTimestamp(),
        },
        merge: true,
        ref: opportunityRefs[index],
      });
    } else if (opportunitySnapshots[index].exists) {
      deleteRefs.push(opportunityRefs[index]);
    }

    return aggregate;
  });
  const summary = summarizeCircleSlotAggregates(nextSlots);

  writes.push({
    data: {
      ...summary,
      periodKey,
      updatedAt: FieldValue.serverTimestamp(),
    },
    merge: true,
    ref: periodRef,
  });

  await commitSetWrites(writes);
  for (let index = 0; index < deleteRefs.length; index += 400) {
    const batch = db.batch();
    deleteRefs.slice(index, index + 400).forEach(ref => batch.delete(ref));
    await batch.commit();
  }
  await recalculateMomentumSummaryForUser(uid);
}

export async function removeMemberFromAllCircleOpportunities({
  circleId,
  uid,
}: {
  circleId: string;
  uid: string;
}) {
  const circleRef = db.collection('circles').doc(circleId);
  const periodSnapshots = await circleRef.collection('opportunities').get();
  const periodSlotSnapshots = await Promise.all(
    periodSnapshots.docs.map(periodSnapshot =>
      periodSnapshot.ref.collection('slots').get(),
    ),
  );
  const writes: SetWrite[] = [];

  periodSnapshots.docs.forEach((periodSnapshot, periodIndex) => {
    const slotSnapshots = periodSlotSnapshots[periodIndex];

    if (slotSnapshots.empty) {
      return;
    }

    const aggregates = slotSnapshots.docs.map(slotSnapshot => {
      const aggregate = removeUidFromCircleSlotAggregate(
        slotSnapshot.data(),
        uid,
      );

      writes.push({
        data: {
          ...aggregate,
          updatedAt: FieldValue.serverTimestamp(),
        },
        merge: true,
        ref: slotSnapshot.ref,
      });

      return aggregate;
    });

    writes.push({
      data: {
        ...summarizeCircleSlotAggregates(aggregates),
        periodKey: asString(periodSnapshot.data().periodKey, periodSnapshot.id),
        updatedAt: FieldValue.serverTimestamp(),
      },
      merge: true,
      ref: periodSnapshot.ref,
    });
  });

  await commitSetWrites(writes);
}

export async function materializeCurrentCircleOpportunities(
  circleId: string,
  now = new Date(),
) {
  const circleRef = db.collection('circles').doc(circleId);
  const circleSnapshot = await circleRef.get();

  if (!circleSnapshot.exists) {
    return {affectedUids: [], periodKey: undefined};
  }

  const circle = circleSnapshot.data();
  const timezone = asString(circle?.timezone, 'UTC');
  const slots = getCurrentSlots(circle, now);
  const periodKey = slots[0]?.periodKey;

  if (!periodKey) {
    return {affectedUids: [], periodKey: undefined};
  }

  const memberSnapshots = await circleRef
    .collection('members')
    .where('status', '==', 'active')
    .get();
  const affectedUids = new Set<string>();
  const eligibleEntries = memberSnapshots.docs.flatMap(memberSnapshot => {
    const member = memberSnapshot.data();
    const uid = asString(member.uid, memberSnapshot.id);

    if (!uid) {
      return [];
    }

    affectedUids.add(uid);

    return slots
      .filter(slot => isMemberExpectedForSlot({member, slot, timezone}))
      .map(slot => ({
        opportunityRef: db
          .collection('userPrivate')
          .doc(uid)
          .collection('opportunities')
          .doc(getOpportunityId(circleId, slot.periodKey, slot.slotIndex)),
        slot,
        uid,
      }));
  });
  const existingOpportunitySnapshots = await Promise.all(
    eligibleEntries.map(entry => entry.opportunityRef.get()),
  );
  const writes: SetWrite[] = [];
  const priorCircleOpportunitySnapshots = await Promise.all(
    Array.from(affectedUids).map(uid =>
      db
        .collection('userPrivate')
        .doc(uid)
        .collection('opportunities')
        .where('circleId', '==', circleId)
        .get(),
    ),
  );

  priorCircleOpportunitySnapshots.forEach(snapshot => {
    snapshot.docs.forEach(doc => {
      const opportunity = doc.data();
      const isExpired = isExpiredExpectedOpenOpportunity({
        now,
        opportunity: {
          expectedForCircle:
            typeof opportunity.expectedForCircle === 'boolean'
              ? opportunity.expectedForCircle
              : undefined,
          expiresDateKey: asString(opportunity.expiresDateKey) || undefined,
          status: opportunity.status,
          timezone: asString(opportunity.timezone, timezone),
        },
      });

      if (isExpired) {
        writes.push({
          data: {
            isCurrentPeriod: false,
            resolvedAt: FieldValue.serverTimestamp(),
            status: 'missed',
            updatedAt: FieldValue.serverTimestamp(),
          },
          merge: true,
          ref: doc.ref,
        });
      } else if (
        opportunity.periodKey !== periodKey &&
        opportunity.isCurrentPeriod !== false
      ) {
        writes.push({
          data: {
            isCurrentPeriod: false,
            updatedAt: FieldValue.serverTimestamp(),
          },
          merge: true,
          ref: doc.ref,
        });
      }
    });
  });
  const periodRef = circleRef.collection('opportunities').doc(periodKey);
  const slotAggregates = new Map<
    number,
    {
      completedMemberUids: string[];
      coveredMemberUids: string[];
      expectedMemberUids: string[];
      skippedMemberUids: string[];
    }
  >();

  eligibleEntries.forEach((entry, index) => {
    const existingOpportunityData = existingOpportunitySnapshots[index].data();
    const existingStatus = existingOpportunityData?.status;
    const status = getOpportunityStatusForSlot({
      completionStatus: existingStatus,
      now,
      slot: entry.slot,
      timezone,
    });
    const aggregate = slotAggregates.get(entry.slot.slotIndex) ?? {
      completedMemberUids: [],
      coveredMemberUids: [],
      expectedMemberUids: [],
      skippedMemberUids: [],
    };

    aggregate.expectedMemberUids.push(entry.uid);
    if (status === 'completed' || status === 'skipped') {
      aggregate.coveredMemberUids.push(entry.uid);
    }
    if (status === 'completed') {
      aggregate.completedMemberUids.push(entry.uid);
    }
    if (status === 'skipped') {
      aggregate.skippedMemberUids.push(entry.uid);
    }
    slotAggregates.set(entry.slot.slotIndex, aggregate);
    writes.push({
      data: buildOpportunityPayload({
        circle,
        circleId,
        stampResolution: !existingOpportunityData?.resolvedAt,
        slot: entry.slot,
        status,
        uid: entry.uid,
      }),
      merge: true,
      ref: entry.opportunityRef,
    });
  });

  slots.forEach(slot => {
    const aggregate = slotAggregates.get(slot.slotIndex) ?? {
      completedMemberUids: [],
      coveredMemberUids: [],
      expectedMemberUids: [],
      skippedMemberUids: [],
    };

    writes.push({
      data: {
        availableDateKey: slot.availableDateKey,
        completedMemberCount: aggregate.completedMemberUids.length,
        completedMemberUids: aggregate.completedMemberUids,
        coveredMemberCount: aggregate.coveredMemberUids.length,
        coveredMemberUids: aggregate.coveredMemberUids,
        expectedMemberCount: aggregate.expectedMemberUids.length,
        expectedMemberUids: aggregate.expectedMemberUids,
        expiresDateKey: slot.expiresDateKey,
        periodKey,
        skippedMemberCount: aggregate.skippedMemberUids.length,
        skippedMemberUids: aggregate.skippedMemberUids,
        slotIndex: slot.slotIndex,
        updatedAt: FieldValue.serverTimestamp(),
      },
      merge: true,
      ref: periodRef.collection('slots').doc(String(slot.slotIndex)),
    });
  });
  const aggregates = Array.from(slotAggregates.values());
  const expectedOpportunityCount = aggregates.reduce(
    (total, aggregate) => total + aggregate.expectedMemberUids.length,
    0,
  );
  const coveredOpportunityCount = aggregates.reduce(
    (total, aggregate) => total + aggregate.coveredMemberUids.length,
    0,
  );
  const completedOpportunityCount = aggregates.reduce(
    (total, aggregate) => total + aggregate.completedMemberUids.length,
    0,
  );
  const skippedOpportunityCount = aggregates.reduce(
    (total, aggregate) => total + aggregate.skippedMemberUids.length,
    0,
  );

  writes.push({
    data: {
      completedMembers: coveredOpportunityCount,
      completedOpportunityCount,
      coveredOpportunityCount,
      expectedMembers: new Set(
        aggregates.flatMap(aggregate => aggregate.expectedMemberUids),
      ).size,
      expectedOpportunityCount,
      periodKey,
      progressPercent:
        expectedOpportunityCount > 0
          ? Math.round(
              (coveredOpportunityCount / expectedOpportunityCount) * 100,
            )
          : 0,
      skippedOpportunityCount,
      updatedAt: FieldValue.serverTimestamp(),
    },
    merge: true,
    ref: periodRef,
  });

  await commitSetWrites(writes);
  await Promise.all(
    Array.from(affectedUids).map(uid => recalculateMomentumSummaryForUser(uid)),
  );

  return {affectedUids: Array.from(affectedUids), periodKey};
}

export const materializeMomentumOpportunities = onSchedule(
  {schedule: '0 * * * *'},
  async () => {
    const now = new Date();
    const circleSnapshots = await db.collection('circles').get();

    for (const circleSnapshot of circleSnapshots.docs) {
      await materializeCurrentCircleOpportunities(circleSnapshot.id, now);
    }
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
          stampResolution: false,
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
