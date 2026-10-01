import {onCall, HttpsError} from 'firebase-functions/v2/https';
import {db} from '../firebase';
import {getAuth} from 'firebase-admin/auth';
import {calculateLongestPersonalDailyStreak} from '../profile/streak';
import {getCircleLifecycleStatus} from '../shared/circle-lifecycle';
import {getCircleMode} from '../shared/circle-mode';
import {isCoveredCheckInData} from '../shared/commitments';
import {availableMilestones, dateKey, levelRewards, type Task} from './model';
import {credit, creditTask, readEconomy, summary, writeEconomy} from './ledger';
export async function eligibleProfile(uid?: string, idToken?: unknown) {
  if (!uid && typeof idToken === 'string') {
    try {
      uid = (await getAuth().verifyIdToken(idToken)).uid;
    } catch {
      throw new HttpsError(
        'unauthenticated',
        'Sign in to earn and use rewards.',
      );
    }
  }
  if (!uid) {
    throw new HttpsError('unauthenticated', 'Sign in to earn and use rewards.');
  }
  const snapshot = await db.collection('users').doc(uid).get();
  if (!snapshot.exists || snapshot.data()?.onboardingStatus !== 'complete') {
    throw new HttpsError('failed-precondition', 'Complete your profile first.');
  }
  return {uid, profile: snapshot.data()!};
}
export async function reconcileProgress(
  uid: string,
  successfulEvent = false,
  sourceEventId?: string,
) {
  const {profile} = await eligibleProfile(uid);
  return db.runTransaction(async transaction => {
    const economy = await readEconomy(
      transaction,
      uid,
      profile.timezone || 'UTC',
    );
    const beforeXP = economy.wallet.totalXP;
    const [members, checks, privateData, momentum, historicalNotifications] =
      await Promise.all([
        transaction.get(db.collectionGroup('members').where('uid', '==', uid)),
        transaction.get(db.collectionGroup('checkIns').where('uid', '==', uid)),
        transaction.get(db.collection('userPrivate').doc(uid)),
        transaction.get(
          db
            .collection('userPrivate')
            .doc(uid)
            .collection('momentum')
            .doc('current'),
        ),
        economy.flags.earning && !economy.wallet.historicalMilestonesReconciled
          ? transaction.get(
              db
                .collection('userPrivate')
                .doc(uid)
                .collection('inbox')
                .where('type', 'in', [
                  'companion_momentum_level_up',
                  'companion_streak_milestone',
                  'companion_achievement_unlocked',
                ]),
            )
          : Promise.resolve(undefined),
      ]);
    const circles = await Promise.all(
      members.docs.map(member => transaction.get(member.ref.parent.parent!)),
    );
    const active = circles.filter(
      (circle, index) =>
        circle.exists &&
        members.docs[index].data().status === 'active' &&
        getCircleLifecycleStatus(circle.data()) === 'active',
    );
    const successful = checks.docs.filter(
      check =>
        check.data().status === 'done' && isCoveredCheckInData(check.data()),
    );
    const days = new Set(
      successful.map(check => {
        const at = check.data().createdAt?.toMillis?.();
        return at
          ? dateKey(at, profile.timezone || 'UTC')
          : check.ref.parent.parent!.id;
      }),
    );
    const tasks: Task[] = [
      'profile',
      ...(Object.keys(economy.wallet.provenTasks || {}) as Task[]),
    ];
    const created = circles.filter(
      circle => circle.exists && circle.data()?.ownerId === uid,
    );
    if (active.length || created.length) {
      tasks.push('commitment');
    }
    if (
      [...active, ...created].some(
        circle => getCircleMode(circle.data()) === 'group',
      )
    ) {
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
    tasks.forEach(task => creditTask(economy, task));
    if (days.size) {
      (
        economy.wallet as typeof economy.wallet & {firstSuccessDay?: string}
      ).firstSuccessDay ??= Array.from(days).sort()[0];
    }
    if (
      economy.flags.earning &&
      (successfulEvent || !economy.wallet.historicalMilestonesReconciled)
    ) {
      let historicalStreak = 0;
      let historicalMomentum = '';
      let historicalTapIns = 0;
      const prove = (type: string, milestone: string) =>
        historicalNotifications?.docs.some(doc => {
          const data = doc.data();
          return (
            data.actor?.uid === uid &&
            data.type === type &&
            doc.id.startsWith('self_' + type + '_') &&
            doc.id.replace(/_r\d+$/, '').endsWith('_' + uid + '_' + milestone)
          );
        });
      for (const days of [3, 7, 14, 30])
        if (prove('companion_streak_milestone', days + '-day-streak'))
          historicalStreak = days;
      for (const [key, days] of [
        ['7-days-straight', 7],
        ['10-day-streak', 10],
        ['20-day-streak', 20],
        ['30-day-streak', 30],
      ] as const)
        if (prove('companion_achievement_unlocked', key))
          historicalStreak = Math.max(historicalStreak, days);
      if (prove('companion_momentum_level_up', 'strong_momentum'))
        historicalMomentum = 'strong_momentum';
      if (prove('companion_momentum_level_up', 'peak_momentum'))
        historicalMomentum = 'peak_momentum';
      if (prove('companion_achievement_unlocked', '50-taps'))
        historicalTapIns = 50;
      const streak = calculateLongestPersonalDailyStreak({
        checkInDateKeys: successfulEvent
          ? checks.docs
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
              )
          : days,
      });
      for (const milestone of availableMilestones(
        Math.max(streak, historicalStreak),
        Math.max(successful.length, historicalTapIns),
        historicalMomentum === 'peak_momentum'
          ? historicalMomentum
          : momentum.data()?.rollingMomentum?.status === 'peak_momentum'
          ? 'peak_momentum'
          : historicalMomentum ||
            momentum.data()?.rollingMomentum?.status ||
            '',
      )) {
        if (!economy.wallet.milestones[milestone.id]) {
          economy.wallet.milestones[milestone.id] = true;
          credit(
            economy,
            milestone.id,
            milestone.xp,
            milestone.id.replaceAll('_', ' '),
          );
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
    writeEconomy(transaction, economy);
    return {
      ...summary(economy),
      earnedXP: economy.wallet.totalXP - beforeXP,
      earnedRewards: levelRewards(beforeXP, economy.wallet.totalXP),
    };
  });
}
export const ensureProgress = onCall(async request => {
  const {uid} = await eligibleProfile(request.auth?.uid, request.data?.idToken);
  return reconcileProgress(uid);
});
export const completeProgressTask = onCall(async request => {
  const {uid, profile} = await eligibleProfile(
    request.auth?.uid,
    request.data?.idToken,
  );
  const {circleId, task} = request.data || {};
  if (
    task !== 'share_invite' ||
    typeof circleId !== 'string' ||
    circleId.includes('/')
  ) {
    throw new HttpsError(
      'invalid-argument',
      'A completed Circle invitation share is required.',
    );
  }
  return db.runTransaction(async transaction => {
    const economy = await readEconomy(
      transaction,
      uid,
      profile.timezone || 'UTC',
    );
    const [circle, member] = await Promise.all([
      transaction.get(db.collection('circles').doc(circleId)),
      transaction.get(
        db.collection('circles').doc(circleId).collection('members').doc(uid),
      ),
    ]);
    if (
      !circle.exists ||
      member.data()?.status !== 'active' ||
      getCircleMode(circle.data()) !== 'group' ||
      getCircleLifecycleStatus(circle.data()) !== 'active' ||
      !circle.data()?.inviteCode ||
      (!['owner', 'admin'].includes(member.data()?.role) &&
        circle.data()?.ownerId !== uid)
    ) {
      throw new HttpsError(
        'permission-denied',
        'You cannot share this Circle invitation.',
      );
    }
    creditTask(economy, 'share_invite');
    writeEconomy(transaction, economy);
    return summary(economy);
  });
});
export {getRestoreOptions, restoreStreak} from './restores';
export {syncProgressPurchases, progressPurchaseWebhook} from './purchases';

/** Initialize historical earning evidence before a protection event can change any summaries. */
export async function initializeXPBeforeProtection(uid: string) {
  const [wallet, config] = await Promise.all([
    db.doc(`userPrivate/${uid}/progress/current`).get(),
    db.doc('serverConfig/progress').get(),
  ]);
  if (
    config.data()?.earningEnabled === true &&
    !wallet.data()?.historicalMilestonesReconciled
  )
    await reconcileProgress(uid);
}
