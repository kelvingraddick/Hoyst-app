import {defineSecret} from 'firebase-functions/params';
import {HttpsError} from 'firebase-functions/v2/https';
import {oneSignalAppId, oneSignalRestApiKey} from '../notifications';

const purchasesConfigured =
  process.env.PROGRESS_PURCHASES_CONFIGURED === 'true' ||
  process.env.REVENUECAT_DELETION_CONFIGURED === 'true';
const revenueCatKey = purchasesConfigured
  ? defineSecret('REVENUECAT_SECRET_API_KEY')
  : undefined;
export const deletionSecrets = [
  oneSignalRestApiKey,
  ...(revenueCatKey ? [revenueCatKey] : []),
];

type ProviderConfig = {
  oneSignalAppId?: string;
  oneSignalKey?: string;
  revenueCatKey?: string;
};
function getProviderConfig(): ProviderConfig {
  const appId =
    process.env.ONESIGNAL_APP_ID ??
    process.env.ONE_SIGNAL_APP_ID ??
    oneSignalAppId.value();
  const purchaseKey = revenueCatKey?.value();
  if (purchasesConfigured && !purchaseKey)
    throw new HttpsError(
      'unavailable',
      'Purchase account deletion is unavailable. Try again later.',
    );
  return {
    oneSignalAppId: appId,
    oneSignalKey: appId
      ? process.env.ONESIGNAL_REST_API_KEY ??
        process.env.ONE_SIGNAL_REST_API_KEY ??
        oneSignalRestApiKey.value()
      : undefined,
    revenueCatKey: purchaseKey,
  };
}
export async function deleteProviderAccounts(
  uid: string,
  config: ProviderConfig = getProviderConfig(),
  fetchImpl: typeof fetch = fetch,
) {
  const targets = [];
  if (config.oneSignalAppId) {
    if (!config.oneSignalKey)
      throw new HttpsError(
        'unavailable',
        'Notification account deletion is unavailable. Please try again later.',
      );
    targets.push({
      name: 'Notification',
      url: `https://api.onesignal.com/apps/${encodeURIComponent(
        config.oneSignalAppId,
      )}/users/by/external_id/${encodeURIComponent(uid)}`,
      authorization: `Key ${config.oneSignalKey}`,
    });
  }
  if (config.revenueCatKey)
    targets.push({
      name: 'Purchase',
      url: `https://api.revenuecat.com/v1/subscribers/${encodeURIComponent(
        uid,
      )}`,
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
    } catch {
      throw new HttpsError(
        'unavailable',
        `${target.name} account deletion could not finish. Please try again. Your Hoyst account is still available to retry deletion.`,
      );
    }
  }
}
