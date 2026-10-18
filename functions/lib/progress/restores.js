"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.restoreStreak = exports.getRestoreOptions = void 0;
exports.reconcileRestoreEffects = reconcileRestoreEffects;
const progress_1 = require("../circles/progress");
const circle_progress_1 = require("../shared/circle-progress");
const firestore_1 = require("firebase-admin/firestore");
const https_1 = require("firebase-functions/v2/https");
const zod_1 = require("zod");
const firebase_1 = require("../firebase");
const index_1 = require("./index");
const model_1 = require("./model");
const ledger_1 = require("./ledger");
const restores_model_1 = require("./restores-model");
const notifications_1 = require("../notifications");
const circle_mode_1 = require("../shared/circle-mode");
const circle_lifecycle_1 = require("../shared/circle-lifecycle");
const eligibility_1 = require("../momentum/eligibility");
const momentum_1 = require("../momentum");
const group_streak_1 = require("../circles/group-streak");
const streak_1 = require("../profile/streak");
const commitments_1 = require("../shared/commitments");
const schema = zod_1.z.object({
    opportunityId: zod_1.z
        .string()
        .min(1)
        .max(512)
        .refine(id => !id.includes('/')),
    requestId: zod_1.z.string().uuid(),
});
async function options(transaction, uid, profile) {
    const [opportunities, checks] = await Promise.all([
        transaction.get(firebase_1.db.collection('userPrivate').doc(uid).collection('opportunities')),
        transaction.get(firebase_1.db.collectionGroup('checkIns').where('uid', '==', uid)),
    ]);
    const slots = opportunities.docs.map(doc => ({ ...doc.data(), id: doc.id }));
    // Earlier clients omitted the frequency field. A canonical final slot ending at
    // its original period boundary proves that period's slot count without consulting today's schedule.
    for (const slot of slots) {
        if (slot.opportunitiesPerPeriod ||
            !['weekly', 'monthly'].includes(slot.cadence || '')) {
            continue;
        }
        const periodSlots = slots.filter(other => other.circleId === slot.circleId && other.periodKey === slot.periodKey);
        const last = periodSlots.reduce((left, right) => left.slotIndex > right.slotIndex ? left : right);
        const boundary = new Date(slot.cadence === 'monthly' ? slot.periodKey + '-01' : slot.periodKey);
        if (!Number.isFinite(boundary.getTime())) {
            continue;
        }
        if (slot.cadence === 'monthly') {
            boundary.setUTCMonth(boundary.getUTCMonth() + 1);
        }
        else {
            boundary.setUTCDate(boundary.getUTCDate() + 7);
        }
        boundary.setUTCDate(boundary.getUTCDate() - 1);
        if (last.expiresDateKey === boundary.toISOString().slice(0, 10)) {
            slot.opportunitiesPerPeriod = last.slotIndex + 1;
        }
    }
    const circleIds = Array.from(new Set(slots.map(slot => slot.circleId)));
    const result = [];
    for (const circleId of circleIds) {
        const ref = firebase_1.db.collection('circles').doc(circleId);
        const [circle, member, history, lifecycle] = await Promise.all([
            transaction.get(ref),
            transaction.get(ref.collection('members').doc(uid)),
            transaction.get(ref.collection('membershipHistory').doc(uid).collection('periods')),
            transaction.get(ref.collection('lifecycleHistory').orderBy('at')),
        ]);
        if (!circle.exists ||
            (0, circle_lifecycle_1.getCircleLifecycleStatus)(circle.data()) !== 'active' ||
            member.data()?.status !== 'active') {
            continue;
        }
        const timezone = circle.data()?.timezone || 'UTC';
        const candidate = (0, restores_model_1.restoreCandidate)(slots.filter(slot => slot.circleId === circleId), (0, model_1.dateKey)(Date.now(), timezone));
        if (!candidate) {
            continue;
        }
        const periods = history.empty
            ? [member.data()]
            : history.docs
                .map(doc => doc.data())
                .filter(period => period.joinedAt?.toMillis?.() ===
                member.data()?.joinedAt?.toMillis?.());
        if (!periods.some(period => period.joinedAt &&
            (0, eligibility_1.isMemberExpectedForSlot)({
                member: { ...period, status: 'active' },
                slot: candidate.slot,
                timezone: candidate.slot.timezone,
            }))) {
            continue;
        }
        // A quota restore repairs exactly one missing eligible day, never a whole deficient period.
        if (candidate.slot.cadence === 'weekly' ||
            candidate.slot.cadence === 'monthly') {
            if ((lifecycle.empty && circle.data()?.lastArchivedAt) ||
                lifecycle.docs.some(doc => doc.data().historyKnownBefore === false)) {
                continue;
            }
            const config = (0, circle_progress_1.circleProgressConfiguration)(circle.data());
            const shape = (0, circle_progress_1.circlePeriodForDate)(candidate.slot.expiresDateKey, config.cadence);
            if (shape.key !== candidate.slot.periodKey) {
                continue;
            }
            const eligibleDates = (0, circle_progress_1.circleDates)(shape.start, shape.end).filter(day => {
                let active = true;
                for (const event of lifecycle.docs) {
                    const data = event.data();
                    const at = data.at?.toMillis?.();
                    if (!at) {
                        continue;
                    }
                    const boundary = (0, model_1.dateKey)(at, timezone);
                    if (day >= boundary) {
                        active = data.status === 'active' && day > boundary;
                    }
                }
                return (active &&
                    periods.some(period => {
                        const joined = period.joinedAt?.toDate?.();
                        if (!joined) {
                            return false;
                        }
                        const joinedKey = (0, model_1.dateKey)(joined.getTime(), timezone);
                        const first = period.opportunityEligibility === 'include_current'
                            ? joinedKey
                            : (0, circle_progress_1.shiftCircleDate)(joinedKey, 1);
                        const left = period.leftAt?.toDate?.();
                        return (day >= first && (!left || day < (0, model_1.dateKey)(left.getTime(), timezone)));
                    }));
            });
            const coveredDates = new Set(checks.docs
                .filter(check => check.ref.path.startsWith(`circles/${circleId}/days/`) &&
                (0, commitments_1.isCoveredCheckInData)(check.data()))
                .map(check => check.ref.parent.parent.id));
            const target = Math.min(config.target, eligibleDates.length);
            const count = eligibleDates.filter(day => coveredDates.has(day)).length;
            if (target - count !== 1) {
                continue;
            }
            const repairDate = eligibleDates
                .slice()
                .reverse()
                .find(day => !coveredDates.has(day));
            if (!repairDate) {
                continue;
            }
            candidate.slot.restoreDateKey = repairDate;
        }
        const effectiveDate = candidate.slot.restoreDateKey ?? candidate.slot.expiresDateKey;
        const targetCheck = checks.docs.find(check => check.ref.path ===
            `circles/${circleId}/days/${effectiveDate}/checkIns/${uid}`);
        if (targetCheck && (0, commitments_1.isCoveredCheckInData)(targetCheck.data())) {
            continue;
        }
        const personalDates = checks.docs
            .filter(check => (0, commitments_1.isCoveredCheckInData)(check.data()))
            .map(check => check.data().restoration?.personalEffectiveDateKey ||
            check.data().effectiveDateKey ||
            (check.data().createdAt?.toMillis?.()
                ? (0, model_1.dateKey)(check.data().createdAt.toMillis(), profile.timezone || 'UTC')
                : check.ref.parent.parent.id));
        const personalDateKey = (0, model_1.dateKey)((0, model_1.localNoon)(effectiveDate, candidate.slot.timezone), profile.timezone || 'UTC');
        const repairedDates = [...personalDates, personalDateKey];
        result.push({
            ...candidate,
            personalDateKey,
            title: circle.data()?.title || circle.data()?.commitment || 'Commitment',
            personalStreakBefore: (0, streak_1.calculatePersonalDailyStreak)({
                checkInDateKeys: personalDates,
                timezone: profile.timezone || 'UTC',
            }).personalStreakDays,
            personalStreakAfter: (0, streak_1.calculatePersonalDailyStreak)({
                checkInDateKeys: repairedDates,
                timezone: profile.timezone || 'UTC',
            }).personalStreakDays,
        });
    }
    return result;
}
exports.getRestoreOptions = (0, https_1.onCall)(async (request) => {
    const { uid, profile } = await (0, index_1.eligibleProfile)(request.auth?.uid, request.data?.idToken);
    return firebase_1.db.runTransaction(async (transaction) => {
        const economy = await (0, ledger_1.readEconomy)(transaction, uid, profile.timezone || 'UTC');
        return {
            options: economy.flags.restoring
                ? await options(transaction, uid, profile)
                : [],
            enabled: economy.flags.restoring,
            inventory: economy.wallet.inventory.restores,
        };
    });
});
exports.restoreStreak = (0, https_1.onCall)(async (request) => {
    const { uid, profile } = await (0, index_1.eligibleProfile)(request.auth?.uid, request.data?.idToken);
    const input = schema.parse(request.data);
    await (0, index_1.initializeXPBeforeProtection)(uid);
    const result = await firebase_1.db.runTransaction(async (transaction) => {
        const economy = await (0, ledger_1.readEconomy)(transaction, uid, profile.timezone || 'UTC');
        const confirmationRef = (0, ledger_1.ledgerRef)(uid, 'restore_' + (0, ledger_1.key)(input.opportunityId));
        const previous = await transaction.get(confirmationRef);
        if (previous.exists) {
            return {
                restored: true,
                duplicate: true,
                circleId: previous.data().circleId,
                dateKey: previous.data().dateKey,
                summary: (0, ledger_1.summary)(economy),
            };
        }
        if (!economy.flags.restoring || !economy.flags.inventory) {
            throw new https_1.HttpsError('failed-precondition', 'Streak restores are not available yet.');
        }
        const choice = (await options(transaction, uid, profile)).find(option => option.slot.id === input.opportunityId);
        if (!choice) {
            throw new https_1.HttpsError('failed-precondition', 'This gap can no longer reconnect your streak. Refresh your restore options.');
        }
        const { slot } = choice;
        const effectiveDate = slot.restoreDateKey ?? slot.expiresDateKey;
        const circleRef = firebase_1.db.collection('circles').doc(slot.circleId);
        const periodRef = circleRef.collection('opportunities').doc(slot.periodKey);
        const slotRef = periodRef
            .collection('slots')
            .doc(slot.policyVersion === 2
            ? `v2_${slot.slotIndex}`
            : String(slot.slotIndex));
        const checkRef = circleRef
            .collection('days')
            .doc(effectiveDate)
            .collection('checkIns')
            .doc(uid);
        const [period, aggregate, check] = await Promise.all([
            transaction.get(periodRef),
            transaction.get(slotRef),
            transaction.get(checkRef),
        ]);
        if ((0, commitments_1.isCoveredCheckInData)(check.data())) {
            throw new https_1.HttpsError('already-exists', 'This day already has protected coverage.');
        }
        let funding;
        try {
            funding = (0, model_1.spend)(economy.wallet, 'restores');
        }
        catch (error) {
            throw new https_1.HttpsError('resource-exhausted', String(error));
        }
        const restoration = {
            opportunityId: slot.id,
            requestId: input.requestId,
            restoredAt: firestore_1.Timestamp.now(),
            originalDateKey: effectiveDate,
            originalPeriodKey: slot.periodKey,
            originalSlotIndex: slot.slotIndex,
            personalEffectiveDateKey: choice.personalDateKey,
        };
        const coveredUids = Array.from(new Set([...(aggregate.data()?.coveredMemberUids || []), uid]));
        const skippedUids = Array.from(new Set([...(aggregate.data()?.skippedMemberUids || []), uid]));
        const expectedUids = Array.from(new Set([...(aggregate.data()?.expectedMemberUids || []), uid]));
        const delta = (aggregate.data()?.coveredMemberUids || []).includes(uid)
            ? 0
            : 1;
        const expectedDelta = (aggregate.data()?.expectedMemberUids || []).includes(uid)
            ? 0
            : 1;
        const count = (period.data()?.coveredOpportunityCount || 0) + delta;
        const expected = (period.data()?.expectedOpportunityCount || 0) + expectedDelta;
        transaction.set(firebase_1.db
            .collection('userPrivate')
            .doc(uid)
            .collection('opportunities')
            .doc(slot.id), {
            status: 'skipped',
            protectionKind: 'restore',
            restoration,
            completionDateKey: effectiveDate,
            resolvedAt: firestore_1.Timestamp.now(),
            updatedAt: firestore_1.FieldValue.serverTimestamp(),
        }, { merge: true });
        transaction.set(checkRef, {
            uid,
            circleId: slot.circleId,
            status: 'skip',
            coverageStatus: 'skipped',
            protectionKind: 'restore',
            restoration,
            effectiveDateKey: effectiveDate,
            displayName: profile.displayName,
            handle: profile.handle,
            avatarUrl: profile.avatarUrl || null,
            createdAt: firestore_1.Timestamp.fromDate(new Date((0, model_1.localNoon)(effectiveDate, slot.timezone))),
            updatedAt: firestore_1.FieldValue.serverTimestamp(),
        }, { merge: true });
        transaction.set(slotRef, {
            coveredMemberUids: coveredUids,
            coveredMemberCount: coveredUids.length,
            skippedMemberUids: skippedUids,
            skippedMemberCount: skippedUids.length,
            expectedMemberUids: expectedUids,
            expectedMemberCount: expectedUids.length,
            updatedAt: firestore_1.FieldValue.serverTimestamp(),
        }, { merge: true });
        transaction.set(periodRef, {
            coveredOpportunityCount: count,
            expectedOpportunityCount: expected,
            completedMembers: firestore_1.FieldValue.increment(delta),
            skippedOpportunityCount: firestore_1.FieldValue.increment(delta),
            progressPercent: expected ? Math.round((100 * count) / expected) : 0,
            updatedAt: firestore_1.FieldValue.serverTimestamp(),
        }, { merge: true });
        transaction.set(circleRef.collection('days').doc(effectiveDate), {
            checkInCount: firestore_1.FieldValue.increment(1),
            dateKey: effectiveDate,
            updatedAt: firestore_1.FieldValue.serverTimestamp(),
        }, { merge: true });
        economy.records.push({
            id: confirmationRef.id,
            data: {
                kind: 'spend',
                reason: 'Streak restored',
                funding,
                opportunityId: slot.id,
                circleId: slot.circleId,
                dateKey: effectiveDate,
                requestId: input.requestId,
                restores: -1,
                skips: 0,
                xp: 0,
            },
        });
        (0, ledger_1.writeEconomy)(transaction, economy);
        return {
            restored: true,
            duplicate: false,
            circleId: slot.circleId,
            dateKey: effectiveDate,
            summary: (0, ledger_1.summary)(economy),
        };
    });
    try {
        await reconcileRestoreEffects(uid, result.circleId, result.dateKey);
    }
    catch (error) {
        console.error('restore_reconciliation_pending', {
            circleId: result.circleId,
            error,
        });
    }
    return result;
});
async function reconcileRestoreEffects(uid, circleId, restoredDate) {
    const [circle, user, check] = await Promise.all([
        firebase_1.db.doc('circles/' + circleId).get(),
        firebase_1.db.doc('users/' + uid).get(),
        firebase_1.db.doc(`circles/${circleId}/days/${restoredDate}/checkIns/${uid}`).get(),
    ]);
    if (!user.exists ||
        !circle.exists ||
        check.data()?.protectionKind !== 'restore') {
        return;
    }
    await Promise.all([
        (0, momentum_1.recalculateMomentumSummaryForUser)(uid),
        (0, group_streak_1.reconcileCircleGroupStreak)({ circleId, dateKey: restoredDate }),
        (0, progress_1.reconcileCircleProgress)({ circleId, uid }),
    ]);
    const actor = {
        uid,
        displayName: user.data()?.displayName || 'Someone',
        avatarUrl: user.data()?.avatarUrl || null,
        handle: user.data()?.handle || null,
    };
    const id = 'restore_' +
        (0, ledger_1.key)(check.data()?.restoration?.opportunityId || circleId + ':' + restoredDate);
    if ((0, circle_mode_1.getCircleMode)(circle.data()) === 'group') {
        const itemRef = circle.ref.collection('feedItems').doc(id);
        await firebase_1.db.runTransaction(async (transaction) => {
            if ((await transaction.get(itemRef)).exists) {
                return;
            }
            transaction.create(itemRef, {
                actor,
                kind: 'activity',
                type: 'tap_in',
                tone: 'success',
                text: `${actor.displayName} restored protected coverage for the missed opportunity ending ${restoredDate}.`,
                protectionKind: 'restore',
                originalDateKey: restoredDate,
                createdAt: firestore_1.FieldValue.serverTimestamp(),
                updatedAt: firestore_1.FieldValue.serverTimestamp(),
                likeCount: 0,
                likedBy: {},
                note: null,
                mediaImageUrl: null,
                targetActor: null,
            });
        });
    }
    await (0, notifications_1.createInboxEvent)({
        uid,
        circleId,
        type: 'streak_restored',
        title: 'Streak restored',
        body: `Your missed opportunity ending ${restoredDate} in ${circle.data()?.title || 'your commitment'} now has protected coverage. This does not count as an actual Tap In.`,
        dedupeKey: id,
        deeplink: { screen: 'CircleDetail', circleId },
        preferenceKey: 'socialActivity',
        deliveryPriority: 'suppressed',
    });
}
