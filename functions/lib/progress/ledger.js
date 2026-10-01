"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ledgerRef = exports.walletRef = exports.key = void 0;
exports.readEconomy = readEconomy;
exports.credit = credit;
exports.creditTask = creditTask;
exports.summary = summary;
exports.writeEconomy = writeEconomy;
exports.requireInventoryVersion = requireInventoryVersion;
exports.prepareSuccessfulOpportunity = prepareSuccessfulOpportunity;
const node_crypto_1 = require("node:crypto");
const firestore_1 = require("firebase-admin/firestore");
const https_1 = require("firebase-functions/v2/https");
const firebase_1 = require("../firebase");
const model_1 = require("./model");
const key = (value) => (0, node_crypto_1.createHash)('sha256').update(value).digest('hex');
exports.key = key;
const walletRef = (uid) => firebase_1.db.collection('userPrivate').doc(uid).collection('progress').doc('current');
exports.walletRef = walletRef;
const ledgerRef = (uid, id) => firebase_1.db.collection('userPrivate').doc(uid).collection('progressLedger').doc(id);
exports.ledgerRef = ledgerRef;
async function readEconomy(transaction, uid, timezone) {
    const [snapshot, config] = await Promise.all([
        transaction.get((0, exports.walletRef)(uid)),
        transaction.get(firebase_1.db.collection('serverConfig').doc('progress')),
    ]);
    const flags = {
        earning: config.data()?.earningEnabled === true,
        inventory: config.data()?.inventoryEnforced === true,
        buying: config.data()?.buyingEnabled === true,
        restoring: config.data()?.restoringEnabled === true,
    };
    const now = Date.now();
    const wallet = snapshot.exists
        ? snapshot.data()
        : (0, model_1.starterWallet)(now);
    if (flags.inventory)
        wallet.inventoryEnforcedAt ??= now;
    flags.inventory ||= Boolean(wallet.inventoryEnforcedAt);
    if (flags.earning &&
        !wallet.earningActivatedAt) {
        wallet.earningActivatedAt = now;
    }
    wallet.window = (0, model_1.earningWindow)(now, timezone, wallet.window);
    const records = [];
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
    return { wallet, flags, uid, records, now };
}
function credit(economy, id, xp, reason) {
    const rewards = (0, model_1.awardXP)(economy.wallet, id, xp);
    economy.records.push({ id, data: { kind: 'xp', reason, xp, ...rewards } });
    return rewards;
}
function creditTask(economy, task) {
    economy.wallet.provenTasks ??= {};
    economy.wallet.provenTasks[task] = true;
    if (!economy.flags.earning || economy.wallet.tasks[task]) {
        return;
    }
    economy.wallet.tasks[task] = true;
    credit(economy, 'task_' + task, 10, 'Checklist: ' + task.replaceAll('_', ' '));
}
function summary(economy) {
    const { wallet, flags } = economy;
    const visible = { ...wallet };
    delete visible.lots;
    return {
        ...visible,
        tasks: { ...wallet.provenTasks, ...wallet.tasks },
        awardedTasks: wallet.tasks,
        ...(0, model_1.levelProgress)(wallet.totalXP),
        checklist: model_1.TASKS.map(id => ({
            id,
            complete: wallet.provenTasks?.[id] === true || wallet.tasks[id] === true,
            awarded: wallet.tasks[id] === true,
            xp: 10,
        })),
        routineRemainingXP: flags.earning ? 30 - (wallet.window?.earned ?? 0) : 0,
        flags,
        upcomingRewards: [1, 2].map(offset => ({
            level: (0, model_1.levelProgress)(wallet.totalXP).level + offset,
            skips: 1,
            restores: ((0, model_1.levelProgress)(wallet.totalXP).level + offset - 1) % 3 === 0 ? 1 : 0,
        })),
    };
}
function writeEconomy(transaction, economy) {
    transaction.set((0, exports.walletRef)(economy.uid), {
        ...economy.wallet,
        ...(0, model_1.levelProgress)(economy.wallet.totalXP),
        flags: economy.flags,
        routineRemainingXP: economy.flags.earning
            ? Math.max(0, 30 - (economy.wallet.window?.earned ?? 0))
            : 0,
        updatedAt: firestore_1.FieldValue.serverTimestamp(),
    });
    for (const record of economy.records) {
        transaction.set((0, exports.ledgerRef)(economy.uid, record.id), {
            ...record.data,
            createdAt: firestore_1.FieldValue.serverTimestamp(),
        });
    }
}
function requireInventoryVersion(enforced, version) {
    if (enforced && version !== 1) {
        throw new https_1.HttpsError('failed-precondition', 'Update Hoyst to use your shared rewards.');
    }
}
async function prepareSuccessfulOpportunity(transaction, economy, opportunityId, timezone) {
    const id = 'opportunity_' + (0, exports.key)(opportunityId);
    const record = await transaction.get((0, exports.ledgerRef)(economy.uid, id));
    const before = economy.wallet.totalXP;
    if (!record.exists && economy.flags.earning) {
        const window = economy.wallet.window;
        const xp = Math.max(0, Math.min(10, 30 - window.earned));
        window.earned += xp;
        credit(economy, id, xp, 'Successful Tap In');
        const day = window.dateKey;
        const wallet = economy.wallet;
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
            restores: Math.floor(economy.wallet.totalXP / 210) - Math.floor(before / 210),
        },
    };
}
