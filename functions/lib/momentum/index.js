"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.backfillMomentumOpportunities = exports.materializeMomentumOpportunities = void 0;
exports.recalculateMomentumSummaryForUser = recalculateMomentumSummaryForUser;
exports.recordTapInOpportunity = recordTapInOpportunity;
exports.removeTapInOpportunity = removeTapInOpportunity;
const firestore_1 = require("firebase-admin/firestore");
const https_1 = require("firebase-functions/v2/https");
const scheduler_1 = require("firebase-functions/v2/scheduler");
const firebase_1 = require("../firebase");
const schedule_1 = require("./schedule");
function asString(value, fallback = '') {
    return typeof value === 'string' && value.trim().length > 0
        ? value.trim()
        : fallback;
}
function asNumber(value, fallback) {
    return typeof value === 'number' && Number.isFinite(value) ? value : fallback;
}
function getOpportunityId(circleId, periodKey, slotIndex) {
    return `${circleId}_${periodKey}_${slotIndex}`;
}
function getCurrentSlots(circle, now = new Date()) {
    const timezone = asString(circle?.timezone, 'UTC');
    const schedule = (0, schedule_1.normalizeCommitmentSchedule)(circle, timezone);
    return (0, schedule_1.getOpportunitySlots)(schedule, now);
}
function getSlotForDate(circle, dateKey, existingStatuses) {
    const slots = getCurrentSlots(circle);
    const availableSlots = slots.filter(slot => slot.availableDateKey <= dateKey);
    const candidate = availableSlots.find(slot => {
        const status = existingStatuses.get(slot.slotIndex);
        return status !== 'completed' && status !== 'skipped';
    }) ??
        availableSlots[availableSlots.length - 1] ??
        slots[0];
    if (!candidate) {
        throw new https_1.HttpsError('failed-precondition', 'No opportunity is available for this commitment.');
    }
    return candidate;
}
function mapOpportunitySnapshot(snapshot) {
    const data = snapshot.data();
    const status = data?.status;
    if (status !== 'upcoming' &&
        status !== 'available' &&
        status !== 'completed' &&
        status !== 'missed' &&
        status !== 'expired' &&
        status !== 'skipped') {
        return undefined;
    }
    return {
        availableDateKey: asString(data?.availableDateKey),
        periodKey: asString(data?.periodKey),
        slotIndex: asNumber(data?.slotIndex, 0),
        status,
    };
}
async function recalculateMomentumSummaryForUser(uid) {
    const momentumRef = firebase_1.db
        .collection('userPrivate')
        .doc(uid)
        .collection('momentum')
        .doc('current');
    const [momentumSnapshot, opportunitySnapshots] = await Promise.all([
        momentumRef.get(),
        firebase_1.db
            .collection('userPrivate')
            .doc(uid)
            .collection('opportunities')
            .where('isCurrentPeriod', '==', true)
            .get(),
    ]);
    const opportunities = opportunitySnapshots.docs
        .map(mapOpportunitySnapshot)
        .filter((opportunity) => Boolean(opportunity));
    const summary = (0, schedule_1.calculateMomentumSummary)({
        opportunities,
        periodKey: 'current',
        priorBestStreak: asNumber(momentumSnapshot.data()?.bestStreak, 0),
    });
    await momentumRef.set({
        ...summary,
        updatedAt: firestore_1.FieldValue.serverTimestamp(),
    }, { merge: true });
    return summary;
}
function buildOpportunityPayload({ checkInId, circle, circleId, dateKey, profile, slot, status, uid, }) {
    return {
        availableDateKey: slot.availableDateKey,
        cadence: (0, schedule_1.normalizeCommitmentSchedule)(circle).cadence,
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
        updatedAt: firestore_1.FieldValue.serverTimestamp(),
        uid,
        ...(checkInId ? { linkedCheckInId: checkInId } : {}),
        ...(dateKey ? { completionDateKey: dateKey } : {}),
        ...(status === 'completed' || status === 'skipped'
            ? { completedAt: firestore_1.FieldValue.serverTimestamp() }
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
async function recordTapInOpportunity({ checkInId, circle, circleId, dateKey, memberCount, profile, status, transaction, uid, }) {
    const userPrivateRef = firebase_1.db.collection('userPrivate').doc(uid);
    const slots = getCurrentSlots(circle);
    const opportunityRefs = slots.map(slot => userPrivateRef
        .collection('opportunities')
        .doc(getOpportunityId(circleId, slot.periodKey, slot.slotIndex)));
    const opportunitySnapshots = await Promise.all(opportunityRefs.map(ref => transaction.get(ref)));
    const existingStatuses = new Map(opportunitySnapshots.map(snapshot => [
        asNumber(snapshot.data()?.slotIndex, 0),
        snapshot.data()?.status,
    ]));
    const slot = getSlotForDate(circle, dateKey, existingStatuses);
    const opportunityRef = userPrivateRef
        .collection('opportunities')
        .doc(getOpportunityId(circleId, slot.periodKey, slot.slotIndex));
    const priorOpportunitySnapshot = await transaction.get(opportunityRef);
    const priorStatus = priorOpportunitySnapshot.data()?.status;
    const opportunityStatus = status === 'done' ? 'completed' : 'skipped';
    const circleOpportunityRef = firebase_1.db
        .collection('circles')
        .doc(circleId)
        .collection('opportunities')
        .doc(slot.periodKey);
    transaction.set(opportunityRef, buildOpportunityPayload({
        checkInId,
        circle,
        circleId,
        dateKey,
        profile,
        slot,
        status: opportunityStatus,
        uid,
    }), { merge: true });
    transaction.set(circleOpportunityRef, {
        completedMembers: opportunityStatus === 'completed' && priorStatus !== 'completed'
            ? firestore_1.FieldValue.increment(1)
            : firestore_1.FieldValue.increment(0),
        expectedMembers: memberCount ?? asNumber(circle?.memberCount, 0),
        periodKey: slot.periodKey,
        progressPercent: 0,
        riskState: 'active',
        updatedAt: firestore_1.FieldValue.serverTimestamp(),
    }, { merge: true });
}
async function removeTapInOpportunity({ circle, circleId, dateKey, transaction, uid, }) {
    const userPrivateRef = firebase_1.db.collection('userPrivate').doc(uid);
    const slots = getCurrentSlots(circle);
    const opportunityRefs = slots.map(slot => userPrivateRef
        .collection('opportunities')
        .doc(getOpportunityId(circleId, slot.periodKey, slot.slotIndex)));
    const opportunitySnapshots = await Promise.all(opportunityRefs.map(ref => transaction.get(ref)));
    const matchedIndex = opportunitySnapshots.findIndex(snapshot => {
        const data = snapshot.data();
        return (data?.completionDateKey === dateKey &&
            (data.status === 'completed' || data.status === 'skipped'));
    });
    if (matchedIndex < 0) {
        return;
    }
    const slot = slots[matchedIndex];
    const opportunityRef = opportunityRefs[matchedIndex];
    const priorStatus = opportunitySnapshots[matchedIndex].data()?.status;
    const nextStatus = (0, schedule_1.getOpportunityStatusForSlot)({
        slot,
        timezone: asString(circle?.timezone, 'UTC'),
    });
    const circleOpportunityRef = firebase_1.db
        .collection('circles')
        .doc(circleId)
        .collection('opportunities')
        .doc(slot.periodKey);
    transaction.set(opportunityRef, {
        completedAt: firestore_1.FieldValue.delete(),
        completionDateKey: firestore_1.FieldValue.delete(),
        linkedCheckInId: firestore_1.FieldValue.delete(),
        status: nextStatus,
        updatedAt: firestore_1.FieldValue.serverTimestamp(),
    }, { merge: true });
    if (priorStatus === 'completed') {
        transaction.set(circleOpportunityRef, {
            completedMembers: firestore_1.FieldValue.increment(-1),
            updatedAt: firestore_1.FieldValue.serverTimestamp(),
        }, { merge: true });
    }
}
exports.materializeMomentumOpportunities = (0, scheduler_1.onSchedule)({ schedule: '0 * * * *' }, async () => {
    const now = new Date();
    const circleSnapshots = await firebase_1.db.collection('circles').get();
    const affectedUids = new Set();
    for (const circleSnapshot of circleSnapshots.docs) {
        const circle = circleSnapshot.data();
        const slots = getCurrentSlots(circle, now);
        const memberSnapshots = await circleSnapshot.ref
            .collection('members')
            .where('status', '==', 'active')
            .get();
        const batch = firebase_1.db.batch();
        memberSnapshots.docs.forEach(memberSnapshot => {
            const member = memberSnapshot.data();
            const uid = asString(member.uid, memberSnapshot.id);
            if (!uid) {
                return;
            }
            affectedUids.add(uid);
            slots.forEach(slot => {
                const opportunityRef = firebase_1.db
                    .collection('userPrivate')
                    .doc(uid)
                    .collection('opportunities')
                    .doc(getOpportunityId(circleSnapshot.id, slot.periodKey, slot.slotIndex));
                const status = (0, schedule_1.getOpportunityStatusForSlot)({
                    slot,
                    timezone: asString(circle.timezone, 'UTC'),
                });
                batch.set(opportunityRef, buildOpportunityPayload({
                    circle,
                    circleId: circleSnapshot.id,
                    slot,
                    status,
                    uid,
                }), { merge: true });
            });
            const periodKey = slots[0]?.periodKey;
            if (periodKey) {
                batch.set(circleSnapshot.ref.collection('opportunities').doc(periodKey), {
                    expectedMembers: memberSnapshots.size,
                    periodKey,
                    updatedAt: firestore_1.FieldValue.serverTimestamp(),
                }, { merge: true });
            }
        });
        await batch.commit();
    }
    await Promise.all(Array.from(affectedUids).map(uid => recalculateMomentumSummaryForUser(uid)));
});
exports.backfillMomentumOpportunities = (0, https_1.onCall)(async (request) => {
    if (!request.auth?.uid) {
        throw new https_1.HttpsError('unauthenticated', 'Sign in is required.');
    }
    const uid = request.auth.uid;
    const membershipsSnapshot = await firebase_1.db
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
        const batch = firebase_1.db.batch();
        slots.forEach(slot => {
            batch.set(firebase_1.db
                .collection('userPrivate')
                .doc(uid)
                .collection('opportunities')
                .doc(getOpportunityId(circleRef.id, slot.periodKey, slot.slotIndex)), buildOpportunityPayload({
                circle,
                circleId: circleRef.id,
                slot,
                status: (0, schedule_1.getOpportunityStatusForSlot)({
                    slot,
                    timezone: asString(circle?.timezone, 'UTC'),
                }),
                uid,
            }), { merge: true });
        });
        await batch.commit();
    }
    return recalculateMomentumSummaryForUser(uid);
});
