import {
  FieldValue,
  Timestamp,
  type Transaction,
  type DocumentData,
} from 'firebase-admin/firestore';
import {HttpsError, onCall} from 'firebase-functions/v2/https';
import {z} from 'zod';
import {db} from '../firebase';
import {eligibleProfile, initializeXPBeforeProtection} from './index';
import {dateKey, localNoon, spend} from './model';
import {key, ledgerRef, readEconomy, summary, writeEconomy} from './ledger';
import {restoreCandidate, type RestoreSlot} from './restores-model';
import {createInboxEvent} from '../notifications';
import {getCircleMode} from '../shared/circle-mode';
import {getCircleLifecycleStatus} from '../shared/circle-lifecycle';
import {isMemberExpectedForSlot} from '../momentum/eligibility';
import {recalculateMomentumSummaryForUser} from '../momentum';
import {reconcileCircleGroupStreak} from '../circles/group-streak';
import {calculatePersonalDailyStreak} from '../profile/streak';
import {isCoveredCheckInData} from '../shared/commitments';
const schema = z.object({
  opportunityId: z
    .string()
    .min(1)
    .max(512)
    .refine(id => !id.includes('/')),
  requestId: z.string().uuid(),
});
async function options(
  transaction: Transaction,
  uid: string,
  profile: DocumentData,
) {
  const [opportunities, checks] = await Promise.all([
    transaction.get(
      db.collection('userPrivate').doc(uid).collection('opportunities'),
    ),
    transaction.get(db.collectionGroup('checkIns').where('uid', '==', uid)),
  ]);
  const slots = opportunities.docs.map(
    doc => ({...doc.data(), id: doc.id} as RestoreSlot),
  );
  // Earlier clients omitted the frequency field. A canonical final slot ending at
  // its original period boundary proves that period's slot count without consulting today's schedule.
  for (const slot of slots) {
    if (
      slot.opportunitiesPerPeriod ||
      !['weekly', 'monthly'].includes(slot.cadence || '')
    )
      continue;
    const periodSlots = slots.filter(
      other =>
        other.circleId === slot.circleId && other.periodKey === slot.periodKey,
    );
    const last = periodSlots.reduce((left, right) =>
      left.slotIndex > right.slotIndex ? left : right,
    );
    const boundary = new Date(
      slot.cadence === 'monthly' ? slot.periodKey + '-01' : slot.periodKey,
    );
    if (!Number.isFinite(boundary.getTime())) continue;
    if (slot.cadence === 'monthly')
      boundary.setUTCMonth(boundary.getUTCMonth() + 1);
    else boundary.setUTCDate(boundary.getUTCDate() + 7);
    boundary.setUTCDate(boundary.getUTCDate() - 1);
    if (last.expiresDateKey === boundary.toISOString().slice(0, 10))
      slot.opportunitiesPerPeriod = last.slotIndex + 1;
  }
  const circleIds = Array.from(new Set(slots.map(slot => slot.circleId)));
  const result = [];
  for (const circleId of circleIds) {
    const ref = db.collection('circles').doc(circleId);
    const [circle, member, history] = await Promise.all([
      transaction.get(ref),
      transaction.get(ref.collection('members').doc(uid)),
      transaction.get(
        ref.collection('membershipHistory').doc(uid).collection('periods'),
      ),
    ]);
    if (
      !circle.exists ||
      getCircleLifecycleStatus(circle.data()) !== 'active' ||
      member.data()?.status !== 'active'
    ) {
      continue;
    }
    const timezone = circle.data()?.timezone || 'UTC';
    const candidate = restoreCandidate(
      slots.filter(slot => slot.circleId === circleId),
      dateKey(Date.now(), timezone),
    );
    if (!candidate) {
      continue;
    }
    const periods = history.empty
      ? [member.data()!]
      : history.docs.map(doc => doc.data());
    if (
      !periods.some(
        period =>
          period.joinedAt &&
          isMemberExpectedForSlot({
            member: {...period, status: 'active'},
            slot: candidate.slot,
            timezone: candidate.slot.timezone,
          }),
      )
    ) {
      continue;
    }
    // A stored canonical gap is required. Missing history is never invented from today's schedule.
    const targetCheck = checks.docs.find(
      check =>
        check.ref.path ===
        `circles/${circleId}/days/${candidate.slot.expiresDateKey}/checkIns/${uid}`,
    );
    if (targetCheck && isCoveredCheckInData(targetCheck.data())) {
      continue;
    }
    const personalDates = checks.docs
      .filter(check => isCoveredCheckInData(check.data()))
      .map(
        check =>
          check.data().restoration?.personalEffectiveDateKey ||
          check.data().effectiveDateKey ||
          (check.data().createdAt?.toMillis?.()
            ? dateKey(
                check.data().createdAt.toMillis(),
                profile.timezone || 'UTC',
              )
            : check.ref.parent.parent!.id),
      );
    const personalDateKey = dateKey(
      localNoon(candidate.slot.expiresDateKey, candidate.slot.timezone),
      profile.timezone || 'UTC',
    );
    const repairedDates = [...personalDates, personalDateKey];
    result.push({
      ...candidate,
      personalDateKey,
      title: circle.data()?.title || circle.data()?.commitment || 'Commitment',
      personalStreakBefore: calculatePersonalDailyStreak({
        checkInDateKeys: personalDates,
        timezone: profile.timezone || 'UTC',
      }).personalStreakDays,
      personalStreakAfter: calculatePersonalDailyStreak({
        checkInDateKeys: repairedDates,
        timezone: profile.timezone || 'UTC',
      }).personalStreakDays,
    });
  }
  return result;
}
export const getRestoreOptions = onCall(async request => {
  const {uid, profile} = await eligibleProfile(
    request.auth?.uid,
    request.data?.idToken,
  );
  return db.runTransaction(async transaction => {
    const economy = await readEconomy(
      transaction,
      uid,
      profile.timezone || 'UTC',
    );
    return {
      options: economy.flags.restoring
        ? await options(transaction, uid, profile)
        : [],
      enabled: economy.flags.restoring,
      inventory: economy.wallet.inventory.restores,
    };
  });
});
export const restoreStreak = onCall(async request => {
  const {uid, profile} = await eligibleProfile(
    request.auth?.uid,
    request.data?.idToken,
  );
  const input = schema.parse(request.data);
  await initializeXPBeforeProtection(uid);
  const result = await db.runTransaction(async transaction => {
    const economy = await readEconomy(
      transaction,
      uid,
      profile.timezone || 'UTC',
    );
    const confirmationRef = ledgerRef(
      uid,
      'restore_' + key(input.opportunityId),
    );
    const previous = await transaction.get(confirmationRef);
    if (previous.exists) {
      return {
        restored: true,
        duplicate: true,
        circleId: previous.data()!.circleId,
        dateKey: previous.data()!.dateKey,
        summary: summary(economy),
      };
    }
    if (!economy.flags.restoring || !economy.flags.inventory) {
      throw new HttpsError(
        'failed-precondition',
        'Streak restores are not available yet.',
      );
    }
    const choice = (await options(transaction, uid, profile)).find(
      option => option.slot.id === input.opportunityId,
    );
    if (!choice) {
      throw new HttpsError(
        'failed-precondition',
        'This gap can no longer reconnect your streak. Refresh your restore options.',
      );
    }
    const {slot} = choice;
    const circleRef = db.collection('circles').doc(slot.circleId);
    const periodRef = circleRef.collection('opportunities').doc(slot.periodKey);
    const slotRef = periodRef.collection('slots').doc(String(slot.slotIndex));
    const checkRef = circleRef
      .collection('days')
      .doc(slot.expiresDateKey)
      .collection('checkIns')
      .doc(uid);
    const [period, aggregate, check] = await Promise.all([
      transaction.get(periodRef),
      transaction.get(slotRef),
      transaction.get(checkRef),
    ]);
    if (isCoveredCheckInData(check.data())) {
      throw new HttpsError(
        'already-exists',
        'This day already has protected coverage.',
      );
    }
    let funding: string;
    try {
      funding = spend(economy.wallet, 'restores');
    } catch (error) {
      throw new HttpsError('resource-exhausted', String(error));
    }
    const restoration = {
      opportunityId: slot.id,
      requestId: input.requestId,
      restoredAt: Timestamp.now(),
      originalDateKey: slot.expiresDateKey,
      originalPeriodKey: slot.periodKey,
      originalSlotIndex: slot.slotIndex,
      personalEffectiveDateKey: choice.personalDateKey,
    };
    const coveredUids: string[] = Array.from(
      new Set([...(aggregate.data()?.coveredMemberUids || []), uid]),
    );
    const skippedUids: string[] = Array.from(
      new Set([...(aggregate.data()?.skippedMemberUids || []), uid]),
    );
    const expectedUids: string[] = Array.from(
      new Set([...(aggregate.data()?.expectedMemberUids || []), uid]),
    );
    const delta = (aggregate.data()?.coveredMemberUids || []).includes(uid)
      ? 0
      : 1;
    const expectedDelta = (aggregate.data()?.expectedMemberUids || []).includes(
      uid,
    )
      ? 0
      : 1;
    const count = (period.data()?.coveredOpportunityCount || 0) + delta;
    const expected =
      (period.data()?.expectedOpportunityCount || 0) + expectedDelta;
    transaction.set(
      db
        .collection('userPrivate')
        .doc(uid)
        .collection('opportunities')
        .doc(slot.id),
      {
        status: 'skipped',
        protectionKind: 'restore',
        restoration,
        completionDateKey: slot.expiresDateKey,
        resolvedAt: Timestamp.now(),
        updatedAt: FieldValue.serverTimestamp(),
      },
      {merge: true},
    );
    transaction.set(
      checkRef,
      {
        uid,
        circleId: slot.circleId,
        status: 'skip',
        coverageStatus: 'skipped',
        protectionKind: 'restore',
        restoration,
        effectiveDateKey: slot.expiresDateKey,
        displayName: profile.displayName,
        handle: profile.handle,
        avatarUrl: profile.avatarUrl || null,
        createdAt: Timestamp.fromDate(
          new Date(localNoon(slot.expiresDateKey, slot.timezone)),
        ),
        updatedAt: FieldValue.serverTimestamp(),
      },
      {merge: true},
    );
    transaction.set(
      slotRef,
      {
        coveredMemberUids: coveredUids,
        coveredMemberCount: coveredUids.length,
        skippedMemberUids: skippedUids,
        skippedMemberCount: skippedUids.length,
        expectedMemberUids: expectedUids,
        expectedMemberCount: expectedUids.length,
        updatedAt: FieldValue.serverTimestamp(),
      },
      {merge: true},
    );
    transaction.set(
      periodRef,
      {
        coveredOpportunityCount: count,
        expectedOpportunityCount: expected,
        completedMembers: FieldValue.increment(delta),
        skippedOpportunityCount: FieldValue.increment(delta),
        progressPercent: expected ? Math.round((100 * count) / expected) : 0,
        updatedAt: FieldValue.serverTimestamp(),
      },
      {merge: true},
    );
    transaction.set(
      circleRef.collection('days').doc(slot.expiresDateKey),
      {
        checkInCount: FieldValue.increment(1),
        dateKey: slot.expiresDateKey,
        updatedAt: FieldValue.serverTimestamp(),
      },
      {merge: true},
    );
    economy.records.push({
      id: confirmationRef.id,
      data: {
        kind: 'spend',
        reason: 'Streak restored',
        funding,
        opportunityId: slot.id,
        circleId: slot.circleId,
        dateKey: slot.expiresDateKey,
        requestId: input.requestId,
        restores: -1,
        skips: 0,
        xp: 0,
      },
    });
    writeEconomy(transaction, economy);
    return {
      restored: true,
      duplicate: false,
      circleId: slot.circleId,
      dateKey: slot.expiresDateKey,
      summary: summary(economy),
    };
  });
  try {
    await reconcileRestoreEffects(uid, result.circleId, result.dateKey);
  } catch (error) {
    console.error('restore_reconciliation_pending', {
      circleId: result.circleId,
      error,
    });
  }
  return result;
});

export async function reconcileRestoreEffects(
  uid: string,
  circleId: string,
  restoredDate: string,
) {
  const [circle, user, check] = await Promise.all([
    db.doc('circles/' + circleId).get(),
    db.doc('users/' + uid).get(),
    db.doc(`circles/${circleId}/days/${restoredDate}/checkIns/${uid}`).get(),
  ]);
  if (
    !user.exists ||
    !circle.exists ||
    check.data()?.protectionKind !== 'restore'
  )
    return;
  await Promise.all([
    recalculateMomentumSummaryForUser(uid),
    reconcileCircleGroupStreak({circleId, dateKey: restoredDate}),
  ]);
  const actor = {
    uid,
    displayName: user.data()?.displayName || 'Someone',
    avatarUrl: user.data()?.avatarUrl || null,
    handle: user.data()?.handle || null,
  };
  const id =
    'restore_' +
    key(
      check.data()?.restoration?.opportunityId || circleId + ':' + restoredDate,
    );
  if (getCircleMode(circle.data()) === 'group') {
    const itemRef = circle.ref.collection('feedItems').doc(id);
    await db.runTransaction(async transaction => {
      if ((await transaction.get(itemRef)).exists) return;
      transaction.create(itemRef, {
        actor,
        kind: 'activity',
        type: 'tap_in',
        tone: 'success',
        text: `${actor.displayName} restored protected coverage for the missed opportunity ending ${restoredDate}.`,
        protectionKind: 'restore',
        originalDateKey: restoredDate,
        createdAt: FieldValue.serverTimestamp(),
        updatedAt: FieldValue.serverTimestamp(),
        likeCount: 0,
        likedBy: {},
        note: null,
        mediaImageUrl: null,
        targetActor: null,
      });
    });
  }
  await createInboxEvent({
    uid,
    circleId,
    type: 'streak_restored',
    title: 'Streak restored',
    body: `Your missed opportunity ending ${restoredDate} in ${
      circle.data()?.title || 'your commitment'
    } now has protected coverage. This does not count as an actual Tap In.`,
    dedupeKey: id,
    deeplink: {screen: 'CircleDetail', circleId},
    preferenceKey: 'socialActivity',
    deliveryPriority: 'suppressed',
  });
}
