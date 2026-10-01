"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.progressPurchaseWebhook = exports.syncProgressPurchases = exports.restoreStreak = exports.getRestoreOptions = exports.completeProgressTask = exports.ensureProgress = void 0;
exports.eligibleProfile = eligibleProfile;
exports.reconcileProgress = reconcileProgress;
exports.initializeXPBeforeProtection = initializeXPBeforeProtection;
const https_1 = require("firebase-functions/v2/https");
const firebase_1 = require("../firebase");
const auth_1 = require("firebase-admin/auth");
const streak_1 = require("../profile/streak");
const circle_lifecycle_1 = require("../shared/circle-lifecycle");
const circle_mode_1 = require("../shared/circle-mode");
const commitments_1 = require("../shared/commitments");
const model_1 = require("./model");
const ledger_1 = require("./ledger");
async function eligibleProfile(uid, idToken) {
    if (!uid && typeof idToken === 'string') {
        try {
            uid = (await (0, auth_1.getAuth)().verifyIdToken(idToken)).uid;
        }
        catch {
            throw new https_1.HttpsError('unauthenticated', 'Sign in to earn and use rewards.');
        }
    }
    if (!uid) {
        throw new https_1.HttpsError('unauthenticated', 'Sign in to earn and use rewards.');
    }
    const snapshot = await firebase_1.db.collection('users').doc(uid).get();
    if (!snapshot.exists || snapshot.data()?.onboardingStatus !== 'complete') {
        throw new https_1.HttpsError('failed-precondition', 'Complete your profile first.');
    }
    return { uid, profile: snapshot.data() };
}
async function reconcileProgress(uid, successfulEvent = false, sourceEventId) {
    const { profile } = await eligibleProfile(uid);
    return firebase_1.db.runTransaction(async (transaction) => {
        const economy = await (0, ledger_1.readEconomy)(transaction, uid, profile.timezone || 'UTC');
        const beforeXP = economy.wallet.totalXP;
        const [members, checks, privateData, momentum, historicalNotifications] = await Promise.all([
            transaction.get(firebase_1.db.collectionGroup('members').where('uid', '==', uid)),
            transaction.get(firebase_1.db.collectionGroup('checkIns').where('uid', '==', uid)),
            transaction.get(firebase_1.db.collection('userPrivate').doc(uid)),
            transaction.get(firebase_1.db
                .collection('userPrivate')
                .doc(uid)
                .collection('momentum')
                .doc('current')),
            economy.flags.earning && !economy.wallet.historicalMilestonesReconciled
                ? transaction.get(firebase_1.db
                    .collection('userPrivate')
                    .doc(uid)
                    .collection('inbox')
                    .where('type', 'in', [
                    'companion_momentum_level_up',
                    'companion_streak_milestone',
                    'companion_achievement_unlocked',
                ]))
                : Promise.resolve(undefined),
        ]);
        const circles = await Promise.all(members.docs.map(member => transaction.get(member.ref.parent.parent)));
        const active = circles.filter((circle, index) => circle.exists &&
            members.docs[index].data().status === 'active' &&
            (0, circle_lifecycle_1.getCircleLifecycleStatus)(circle.data()) === 'active');
        const successful = checks.docs.filter(check => check.data().status === 'done' && (0, commitments_1.isCoveredCheckInData)(check.data()));
        const days = new Set(successful.map(check => {
            const at = check.data().createdAt?.toMillis?.();
            return at
                ? (0, model_1.dateKey)(at, profile.timezone || 'UTC')
                : check.ref.parent.parent.id;
        }));
        const tasks = [
            'profile',
            ...Object.keys(economy.wallet.provenTasks || {}),
        ];
        const created = circles.filter(circle => circle.exists && circle.data()?.ownerId === uid);
        if (active.length || created.length) {
            tasks.push('commitment');
        }
        if ([...active, ...created].some(circle => (0, circle_mode_1.getCircleMode)(circle.data()) === 'group')) {
            tasks.push('circle');
        }
        if (successful.length) {
            tasks.push('first_tap_in');
        }
        if (days.size > 1) {
            tasks.push('second_day');
        }
        if (privateData.data()?.reminderPreferenceSavedAt) {
            tasks.push('reminders');
        }
        tasks.forEach(task => (0, ledger_1.creditTask)(economy, task));
        if (days.size) {
            economy.wallet.firstSuccessDay ??= Array.from(days).sort()[0];
        }
        if (economy.flags.earning &&
            (successfulEvent || !economy.wallet.historicalMilestonesReconciled)) {
            let historicalStreak = 0;
            let historicalMomentum = '';
            let historicalTapIns = 0;
            const prove = (type, milestone) => historicalNotifications?.docs.some(doc => {
                const data = doc.data();
                return (data.actor?.uid === uid &&
                    data.type === type &&
                    doc.id.startsWith('self_' + type + '_') &&
                    doc.id.replace(/_r\d+$/, '').endsWith('_' + uid + '_' + milestone));
            });
            for (const days of [3, 7, 14, 30])
                if (prove('companion_streak_milestone', days + '-day-streak'))
                    historicalStreak = days;
            for (const [key, days] of [
                ['7-days-straight', 7],
                ['10-day-streak', 10],
                ['20-day-streak', 20],
                ['30-day-streak', 30],
            ])
                if (prove('companion_achievement_unlocked', key))
                    historicalStreak = Math.max(historicalStreak, days);
            if (prove('companion_momentum_level_up', 'strong_momentum'))
                historicalMomentum = 'strong_momentum';
            if (prove('companion_momentum_level_up', 'peak_momentum'))
                historicalMomentum = 'peak_momentum';
            if (prove('companion_achievement_unlocked', '50-taps'))
                historicalTapIns = 50;
            const streak = (0, streak_1.calculateLongestPersonalDailyStreak)({
                checkInDateKeys: successfulEvent
                    ? checks.docs
                        .filter(check => (0, commitments_1.isCoveredCheckInData)(check.data()))
                        .map(check => check.data().restoration?.personalEffectiveDateKey ||
                        check.data().effectiveDateKey ||
                        (check.data().createdAt?.toMillis?.()
                            ? (0, model_1.dateKey)(check.data().createdAt.toMillis(), profile.timezone || 'UTC')
                            : check.ref.parent.parent.id))
                    : days,
            });
            for (const milestone of (0, model_1.availableMilestones)(Math.max(streak, historicalStreak), Math.max(successful.length, historicalTapIns), historicalMomentum === 'peak_momentum'
                ? historicalMomentum
                : momentum.data()?.rollingMomentum?.status === 'peak_momentum'
                    ? 'peak_momentum'
                    : historicalMomentum ||
                        momentum.data()?.rollingMomentum?.status ||
                        '')) {
                if (!economy.wallet.milestones[milestone.id]) {
                    economy.wallet.milestones[milestone.id] = true;
                    (0, ledger_1.credit)(economy, milestone.id, milestone.xp, milestone.id.replaceAll('_', ' '));
                }
            }
        }
        if (economy.flags.earning) {
            economy.wallet.historicalMilestonesReconciled = true;
        }
        if (sourceEventId)
            economy.records.forEach(record => {
                record.data.sourceEventId = sourceEventId;
            });
        (0, ledger_1.writeEconomy)(transaction, economy);
        return {
            ...(0, ledger_1.summary)(economy),
            earnedXP: economy.wallet.totalXP - beforeXP,
            earnedRewards: (0, model_1.levelRewards)(beforeXP, economy.wallet.totalXP),
        };
    });
}
exports.ensureProgress = (0, https_1.onCall)(async (request) => {
    const { uid } = await eligibleProfile(request.auth?.uid, request.data?.idToken);
    return reconcileProgress(uid);
});
exports.completeProgressTask = (0, https_1.onCall)(async (request) => {
    const { uid, profile } = await eligibleProfile(request.auth?.uid, request.data?.idToken);
    const { circleId, task } = request.data || {};
    if (task !== 'share_invite' ||
        typeof circleId !== 'string' ||
        circleId.includes('/')) {
        throw new https_1.HttpsError('invalid-argument', 'A completed Circle invitation share is required.');
    }
    return firebase_1.db.runTransaction(async (transaction) => {
        const economy = await (0, ledger_1.readEconomy)(transaction, uid, profile.timezone || 'UTC');
        const [circle, member] = await Promise.all([
            transaction.get(firebase_1.db.collection('circles').doc(circleId)),
            transaction.get(firebase_1.db.collection('circles').doc(circleId).collection('members').doc(uid)),
        ]);
        if (!circle.exists ||
            member.data()?.status !== 'active' ||
            (0, circle_mode_1.getCircleMode)(circle.data()) !== 'group' ||
            (0, circle_lifecycle_1.getCircleLifecycleStatus)(circle.data()) !== 'active' ||
            !circle.data()?.inviteCode ||
            (!['owner', 'admin'].includes(member.data()?.role) &&
                circle.data()?.ownerId !== uid)) {
            throw new https_1.HttpsError('permission-denied', 'You cannot share this Circle invitation.');
        }
        (0, ledger_1.creditTask)(economy, 'share_invite');
        (0, ledger_1.writeEconomy)(transaction, economy);
        return (0, ledger_1.summary)(economy);
    });
});
var restores_1 = require("./restores");
Object.defineProperty(exports, "getRestoreOptions", { enumerable: true, get: function () { return restores_1.getRestoreOptions; } });
Object.defineProperty(exports, "restoreStreak", { enumerable: true, get: function () { return restores_1.restoreStreak; } });
var purchases_1 = require("./purchases");
Object.defineProperty(exports, "syncProgressPurchases", { enumerable: true, get: function () { return purchases_1.syncProgressPurchases; } });
Object.defineProperty(exports, "progressPurchaseWebhook", { enumerable: true, get: function () { return purchases_1.progressPurchaseWebhook; } });
/** Initialize historical earning evidence before a protection event can change any summaries. */
async function initializeXPBeforeProtection(uid) {
    const [wallet, config] = await Promise.all([
        firebase_1.db.doc(`userPrivate/${uid}/progress/current`).get(),
        firebase_1.db.doc('serverConfig/progress').get(),
    ]);
    if (config.data()?.earningEnabled === true &&
        !wallet.data()?.historicalMilestonesReconciled)
        await reconcileProgress(uid);
}
