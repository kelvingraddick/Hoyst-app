import {createHash} from 'node:crypto';
import {
  FieldValue,
  type Transaction,
  type DocumentData,
} from 'firebase-admin/firestore';
import {HttpsError} from 'firebase-functions/v2/https';
import {db} from '../firebase';
import {
  awardXP,
  earningWindow,
  levelProgress,
  starterWallet,
  TASKS,
  type Task,
  type Wallet,
  type Units,
} from './model';
export const key = (value: string) =>
  createHash('sha256').update(value).digest('hex');
export const walletRef = (uid: string) =>
  db.collection('userPrivate').doc(uid).collection('progress').doc('current');
export const ledgerRef = (uid: string, id: string) =>
  db.collection('userPrivate').doc(uid).collection('progressLedger').doc(id);
export type Economy = Awaited<ReturnType<typeof readEconomy>>;
export async function readEconomy(
  transaction: Transaction,
  uid: string,
  timezone: string,
) {
  const [snapshot, config] = await Promise.all([
    transaction.get(walletRef(uid)),
    transaction.get(db.collection('serverConfig').doc('progress')),
  ]);
  const flags = {
    earning: config.data()?.earningEnabled === true,
    inventory: config.data()?.inventoryEnforced === true,
    buying: config.data()?.buyingEnabled === true,
    restoring: config.data()?.restoringEnabled === true,
  };
  const now = Date.now();
  const wallet = snapshot.exists
    ? (snapshot.data() as Wallet)
    : starterWallet(now);
  if (flags.inventory) wallet.inventoryEnforcedAt ??= now;
  flags.inventory ||= Boolean(wallet.inventoryEnforcedAt);
  if (
    flags.earning &&
    !(wallet as Wallet & {earningActivatedAt?: number}).earningActivatedAt
  ) {
    (wallet as Wallet & {earningActivatedAt?: number}).earningActivatedAt = now;
  }
  wallet.window = earningWindow(now, timezone, wallet.window);
  const records: Array<{id: string; data: DocumentData}> = [];
  if (!snapshot.exists) {
    records.push({
      id: 'starter',
      data: {
        kind: 'grant',
        reason: 'Starter rewards',
        skips: 3,
        restores: 1,
        xp: 0,
      },
    });
  }
  return {wallet, flags, uid, records, now};
}
export function credit(
  economy: Economy,
  id: string,
  xp: number,
  reason: string,
) {
  const rewards = awardXP(economy.wallet, id, xp);
  economy.records.push({id, data: {kind: 'xp', reason, xp, ...rewards}});
  return rewards;
}
export function creditTask(economy: Economy, task: Task) {
  economy.wallet.provenTasks ??= {};
  economy.wallet.provenTasks[task] = true;
  if (!economy.flags.earning || economy.wallet.tasks[task]) {
    return;
  }
  economy.wallet.tasks[task] = true;
  credit(
    economy,
    'task_' + task,
    10,
    'Checklist: ' + task.replaceAll('_', ' '),
  );
}
export function summary(economy: Economy) {
  const {wallet, flags} = economy;
  const visible = {...wallet} as Partial<Wallet>;
  delete visible.lots;
  return {
    ...visible,
    tasks: {...wallet.provenTasks, ...wallet.tasks},
    awardedTasks: wallet.tasks,
    ...levelProgress(wallet.totalXP),
    checklist: TASKS.map(id => ({
      id,
      complete: wallet.provenTasks?.[id] === true || wallet.tasks[id] === true,
      awarded: wallet.tasks[id] === true,
      xp: 10,
    })),
    routineRemainingXP: flags.earning ? 30 - (wallet.window?.earned ?? 0) : 0,
    flags,
    upcomingRewards: [1, 2].map(offset => ({
      level: levelProgress(wallet.totalXP).level + offset,
      skips: 1,
      restores:
        (levelProgress(wallet.totalXP).level + offset - 1) % 3 === 0 ? 1 : 0,
    })),
  };
}
export function writeEconomy(transaction: Transaction, economy: Economy) {
  transaction.set(walletRef(economy.uid), {
    ...economy.wallet,
    ...levelProgress(economy.wallet.totalXP),
    flags: economy.flags,
    routineRemainingXP: economy.flags.earning
      ? Math.max(0, 30 - (economy.wallet.window?.earned ?? 0))
      : 0,
    updatedAt: FieldValue.serverTimestamp(),
  });
  for (const record of economy.records) {
    transaction.set(ledgerRef(economy.uid, record.id), {
      ...record.data,
      createdAt: FieldValue.serverTimestamp(),
    });
  }
}
export function requireInventoryVersion(enforced: boolean, version?: number) {
  if (enforced && version !== 1) {
    throw new HttpsError(
      'failed-precondition',
      'Update Hoyst to use your shared rewards.',
    );
  }
}
export async function prepareSuccessfulOpportunity(
  transaction: Transaction,
  economy: Economy,
  opportunityId: string,
  timezone: string,
) {
  const id = 'opportunity_' + key(opportunityId);
  const record = await transaction.get(ledgerRef(economy.uid, id));
  const before = economy.wallet.totalXP;
  if (!record.exists && economy.flags.earning) {
    const window = economy.wallet.window!;
    const xp = Math.max(0, Math.min(10, 30 - window.earned));
    window.earned += xp;
    credit(economy, id, xp, 'Successful Tap In');
    const day = window.dateKey;
    const wallet = economy.wallet as Wallet & {firstSuccessDay?: string};
    creditTask(economy, 'first_tap_in');
    if (wallet.firstSuccessDay && wallet.firstSuccessDay !== day) {
      creditTask(economy, 'second_day');
    }
    wallet.firstSuccessDay ??= day;
  }
  const xpEarned = economy.wallet.totalXP - before;
  return {
    xpEarned,
    rewards: {
      skips: Math.floor(economy.wallet.totalXP / 70) - Math.floor(before / 70),
      restores:
        Math.floor(economy.wallet.totalXP / 210) - Math.floor(before / 210),
    } satisfies Units,
  };
}
