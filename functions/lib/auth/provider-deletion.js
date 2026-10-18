"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.deletionSecrets = void 0;
exports.deleteProviderAccounts = deleteProviderAccounts;
const params_1 = require("firebase-functions/params");
const https_1 = require("firebase-functions/v2/https");
const notifications_1 = require("../notifications");
const purchasesConfigured = process.env.PROGRESS_PURCHASES_CONFIGURED === 'true' ||
    process.env.REVENUECAT_DELETION_CONFIGURED === 'true';
const revenueCatKey = purchasesConfigured
    ? (0, params_1.defineSecret)('REVENUECAT_SECRET_API_KEY')
    : undefined;
exports.deletionSecrets = [
    notifications_1.oneSignalRestApiKey,
    ...(revenueCatKey ? [revenueCatKey] : []),
];
function getProviderConfig() {
    const appId = process.env.ONESIGNAL_APP_ID ??
        process.env.ONE_SIGNAL_APP_ID ??
        notifications_1.oneSignalAppId.value();
    const purchaseKey = revenueCatKey?.value();
    if (purchasesConfigured && !purchaseKey)
        throw new https_1.HttpsError('unavailable', 'Purchase account deletion is unavailable. Try again later.');
    return {
        oneSignalAppId: appId,
        oneSignalKey: appId
            ? process.env.ONESIGNAL_REST_API_KEY ??
                process.env.ONE_SIGNAL_REST_API_KEY ??
                notifications_1.oneSignalRestApiKey.value()
            : undefined,
        revenueCatKey: purchaseKey,
    };
}
async function deleteProviderAccounts(uid, config = getProviderConfig(), fetchImpl = fetch) {
    const targets = [];
    if (config.oneSignalAppId) {
        if (!config.oneSignalKey)
            throw new https_1.HttpsError('unavailable', 'Notification account deletion is unavailable. Please try again later.');
        targets.push({
            name: 'Notification',
            url: `https://api.onesignal.com/apps/${encodeURIComponent(config.oneSignalAppId)}/users/by/external_id/${encodeURIComponent(uid)}`,
            authorization: `Key ${config.oneSignalKey}`,
        });
    }
    if (config.revenueCatKey)
        targets.push({
            name: 'Purchase',
            url: `https://api.revenuecat.com/v1/subscribers/${encodeURIComponent(uid)}`,
            authorization: `Bearer ${config.revenueCatKey}`,
        });
    for (const target of targets) {
        try {
            const response = await fetchImpl(target.url, {
                method: 'DELETE',
                headers: {
                    Authorization: target.authorization,
                    'Content-Type': 'application/json',
                },
                signal: AbortSignal.timeout(15000),
            });
            // Already absent is success on a retry. Authentication/rate-limit/server
            // failures must never be mistaken for a completed deletion.
            if (!response.ok && response.status !== 404)
                throw new Error(`HTTP ${response.status}`);
        }
        catch {
            throw new https_1.HttpsError('unavailable', `${target.name} account deletion could not finish. Please try again. Your Hoyst account is still available to retry deletion.`);
        }
    }
}
