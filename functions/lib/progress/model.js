"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.CATALOG = exports.TASKS = exports.XP_PER_LEVEL = void 0;
exports.levelProgress = levelProgress;
exports.levelRewards = levelRewards;
exports.starterWallet = starterWallet;
exports.grant = grant;
exports.awardXP = awardXP;
exports.spend = spend;
exports.refundSpend = refundSpend;
exports.refundPurchase = refundPurchase;
exports.dateKey = dateKey;
exports.earningWindow = earningWindow;
exports.availableMilestones = availableMilestones;
exports.localNoon = localNoon;
exports.XP_PER_LEVEL = 70;
exports.TASKS = [
    'profile',
    'commitment',
    'first_tap_in',
    'second_day',
    'circle',
    'share_invite',
    'reminders',
];
exports.CATALOG = {
    hoyst_skips_3: { skips: 3, restores: 0 },
    hoyst_restore_1: { skips: 0, restores: 1 },
    hoyst_protection_pack: { skips: 5, restores: 2 },
};
function levelProgress(totalXP) {
    return {
        level: 1 + Math.floor(totalXP / exports.XP_PER_LEVEL),
        levelXP: totalXP % exports.XP_PER_LEVEL,
        requiredXP: exports.XP_PER_LEVEL,
        remainingXP: exports.XP_PER_LEVEL - (totalXP % exports.XP_PER_LEVEL),
    };
}
function levelRewards(before, after) {
    const old = Math.floor(before / exports.XP_PER_LEVEL), next = Math.floor(after / exports.XP_PER_LEVEL);
    return {
        skips: next - old,
        restores: Math.floor(next / 3) - Math.floor(old / 3),
    };
}
function starterWallet(now) {
    return {
        totalXP: 0,
        inventory: { skips: 3, restores: 1 },
        lots: { starter: { skips: 3, restores: 1 } },
        tasks: {},
        milestones: {},
        activatedAt: now,
    };
}
function grant(wallet, id, units, purchase = false) {
    wallet.inventory.skips += units.skips;
    wallet.inventory.restores += units.restores;
    if (units.skips || units.restores) {
        wallet.lots[id] = { ...units, purchase };
    }
}
function awardXP(wallet, id, xp) {
    const rewards = levelRewards(wallet.totalXP, wallet.totalXP + xp);
    wallet.totalXP += xp;
    grant(wallet, id, rewards);
    return rewards;
}
function spend(wallet, item) {
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
function refundSpend(wallet, lotId, item, revoked = false) {
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
function refundPurchase(wallet, lotId) {
    const lot = wallet.lots[lotId];
    const units = lot
        ? { skips: lot.skips, restores: lot.restores }
        : { skips: 0, restores: 0 };
    wallet.inventory.skips -= units.skips;
    wallet.inventory.restores -= units.restores;
    if (lot) {
        lot.skips = 0;
        lot.restores = 0;
        lot.revoked = true;
    }
    return units;
}
function dateKey(now, timezone) {
    const parts = new Intl.DateTimeFormat('en-CA', {
        timeZone: timezone,
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
    }).formatToParts(new Date(now));
    return ['year', 'month', 'day']
        .map(key => parts.find(part => part.type === key).value)
        .join('-');
}
function earningWindow(now, timezone, current) {
    if (current && now < current.closesAt) {
        return current;
    }
    const day = dateKey(now, timezone);
    let low = now, high = now + 36 * 60 * 60 * 1000;
    while (high - low > 1) {
        const middle = Math.floor((low + high) / 2);
        if (dateKey(middle, timezone) === day) {
            low = middle;
        }
        else {
            high = middle;
        }
    }
    return { dateKey: day, timezone, closesAt: high, earned: 0 };
}
function availableMilestones(streak, tapIns, momentum) {
    const milestones = [];
    [
        [3, 10],
        [7, 20],
        [14, 30],
        [30, 50],
    ].forEach(([days, xp]) => {
        if (streak >= days) {
            milestones.push({ id: 'streak_' + days, xp });
        }
    });
    const status = momentum.replace(/_momentum$/, '');
    if (status === 'strong' || status === 'peak') {
        milestones.push({ id: 'momentum_strong', xp: 20 });
    }
    if (status === 'peak') {
        milestones.push({ id: 'momentum_peak', xp: 30 });
    }
    if (tapIns >= 50) {
        milestones.push({ id: 'tap_ins_50', xp: 50 });
    }
    return milestones;
}
/** Interpret a historical local date without using the device's or server's local timezone. */
function localNoon(date, timezone) {
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
        const part = (name) => Number(parts.find(item => item.type === name).value);
        const represented = Date.UTC(part('year'), part('month') - 1, part('day'), part('hour'), part('minute'), part('second'));
        instant += nominal - represented;
    }
    return instant;
}
