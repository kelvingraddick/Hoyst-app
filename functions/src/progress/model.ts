export const XP_PER_LEVEL = 70;
export const TASKS = [
  'profile',
  'commitment',
  'first_tap_in',
  'second_day',
  'circle',
  'share_invite',
  'reminders',
] as const;
export type Task = (typeof TASKS)[number];
export type Units = {skips: number; restores: number};
export type Lot = Units & {purchase?: boolean; revoked?: boolean};
export type Wallet = {
  totalXP: number;
  inventory: Units;
  lots: Record<string, Lot>;
  tasks: Partial<Record<Task, boolean>>;
  provenTasks?: Partial<Record<Task, boolean>>;
  milestones: Record<string, boolean>;
  window?: {
    dateKey: string;
    timezone: string;
    closesAt: number;
    earned: number;
  };
  activatedAt: number;
  earningActivatedAt?: number;
  inventoryEnforcedAt?: number;
  historicalMilestonesReconciled?: boolean;
};
export const CATALOG: Record<string, Units> = {
  hoyst_skips_3: {skips: 3, restores: 0},
  hoyst_restore_1: {skips: 0, restores: 1},
  hoyst_protection_pack: {skips: 5, restores: 2},
};
export function levelProgress(totalXP: number) {
  return {
    level: 1 + Math.floor(totalXP / XP_PER_LEVEL),
    levelXP: totalXP % XP_PER_LEVEL,
    requiredXP: XP_PER_LEVEL,
    remainingXP: XP_PER_LEVEL - (totalXP % XP_PER_LEVEL),
  };
}
export function levelRewards(before: number, after: number): Units {
  const old = Math.floor(before / XP_PER_LEVEL),
    next = Math.floor(after / XP_PER_LEVEL);
  return {
    skips: next - old,
    restores: Math.floor(next / 3) - Math.floor(old / 3),
  };
}
export function starterWallet(now: number): Wallet {
  return {
    totalXP: 0,
    inventory: {skips: 3, restores: 1},
    lots: {starter: {skips: 3, restores: 1}},
    tasks: {},
    milestones: {},
    activatedAt: now,
  };
}
export function grant(
  wallet: Wallet,
  id: string,
  units: Units,
  purchase = false,
) {
  wallet.inventory.skips += units.skips;
  wallet.inventory.restores += units.restores;
  if (units.skips || units.restores) {
    wallet.lots[id] = {...units, purchase};
  }
}
export function awardXP(wallet: Wallet, id: string, xp: number) {
  const rewards = levelRewards(wallet.totalXP, wallet.totalXP + xp);
  wallet.totalXP += xp;
  grant(wallet, id, rewards);
  return rewards;
}
export function spend(wallet: Wallet, item: keyof Units) {
  if (wallet.inventory[item] < 1) {
    throw new Error('No ' + item + ' available.');
  }
  const funding = Object.entries(wallet.lots).find(([, lot]) => lot[item] > 0);
  if (!funding) {
    throw new Error('Inventory could not be verified.');
  }
  wallet.inventory[item] -= 1;
  wallet.lots[funding[0]][item] -= 1;
  // Retain depleted lot identities so a removed open skip can return its original unit.
  return funding[0];
}
export function refundSpend(
  wallet: Wallet,
  lotId: string,
  item: keyof Units,
  revoked = false,
) {
  if (revoked) {
    return false;
  }
  if (!wallet.lots[lotId]) {
    throw new Error('Protection grant could not be verified.');
  }
  wallet.lots[lotId][item] += 1;
  wallet.inventory[item] += 1;
  return true;
}
export function refundPurchase(wallet: Wallet, lotId: string) {
  const lot = wallet.lots[lotId];
  const units = lot
    ? {skips: lot.skips, restores: lot.restores}
    : {skips: 0, restores: 0};
  wallet.inventory.skips -= units.skips;
  wallet.inventory.restores -= units.restores;
  if (lot) {
    lot.skips = 0;
    lot.restores = 0;
    lot.revoked = true;
  }
  return units;
}
export function dateKey(now: number, timezone: string) {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: timezone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(new Date(now));
  return ['year', 'month', 'day']
    .map(key => parts.find(part => part.type === key)!.value)
    .join('-');
}
export function earningWindow(
  now: number,
  timezone: string,
  current?: Wallet['window'],
) {
  if (current && now < current.closesAt) {
    return current;
  }
  const day = dateKey(now, timezone);
  let low = now,
    high = now + 36 * 60 * 60 * 1000;
  while (high - low > 1) {
    const middle = Math.floor((low + high) / 2);
    if (dateKey(middle, timezone) === day) {
      low = middle;
    } else {
      high = middle;
    }
  }
  return {dateKey: day, timezone, closesAt: high, earned: 0};
}
export function availableMilestones(
  streak: number,
  tapIns: number,
  momentum: string,
) {
  const milestones: Array<{id: string; xp: number}> = [];
  [
    [3, 10],
    [7, 20],
    [14, 30],
    [30, 50],
  ].forEach(([days, xp]) => {
    if (streak >= days) {
      milestones.push({id: 'streak_' + days, xp});
    }
  });
  const status = momentum.replace(/_momentum$/, '');
  if (status === 'strong' || status === 'peak') {
    milestones.push({id: 'momentum_strong', xp: 20});
  }
  if (status === 'peak') {
    milestones.push({id: 'momentum_peak', xp: 30});
  }
  if (tapIns >= 50) {
    milestones.push({id: 'tap_ins_50', xp: 50});
  }
  return milestones;
}
/** Interpret a historical local date without using the device's or server's local timezone. */
export function localNoon(date: string, timezone: string) {
  const nominal = Date.parse(date + 'T12:00:00Z');
  let instant = nominal;
  for (let i = 0; i < 3; i++) {
    const parts = new Intl.DateTimeFormat('en-CA', {
      timeZone: timezone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hourCycle: 'h23',
    }).formatToParts(new Date(instant));
    const part = (name: string) =>
      Number(parts.find(item => item.type === name)!.value);
    const represented = Date.UTC(
      part('year'),
      part('month') - 1,
      part('day'),
      part('hour'),
      part('minute'),
      part('second'),
    );
    instant += nominal - represented;
  }
  return instant;
}
