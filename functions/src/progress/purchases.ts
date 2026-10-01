import {onCall, onRequest, HttpsError} from 'firebase-functions/v2/https';
import {defineSecret} from 'firebase-functions/params';
import {FieldValue} from 'firebase-admin/firestore';
import {db} from '../firebase';
import {eligibleProfile} from './index';
import {CATALOG, grant, refundPurchase} from './model';
import {key, readEconomy, summary, writeEconomy} from './ledger';
import {verifyWebhook} from './purchases-model';
const configured = process.env.PROGRESS_PURCHASES_CONFIGURED === 'true';
const apiKey = configured
  ? defineSecret('REVENUECAT_SECRET_API_KEY')
  : undefined;
const signingSecret = configured
  ? defineSecret('REVENUECAT_WEBHOOK_SIGNING_SECRET')
  : undefined;
type VerifiedPurchase = {
  uid: string;
  transactionId: string;
  productId: string;
  store: string;
  environment: string;
  refunded?: boolean;
};
export async function applyVerifiedPurchase(purchase: VerifiedPurchase) {
  if (
    !CATALOG[purchase.productId] ||
    !['APP_STORE', 'PLAY_STORE'].includes(purchase.store) ||
    !['PRODUCTION', 'SANDBOX'].includes(purchase.environment)
  ) {
    return;
  }
  const {uid, profile} = await eligibleProfile(purchase.uid);
  const id =
    'purchase_' +
    key(
      purchase.store +
        ':' +
        purchase.environment +
        ':' +
        purchase.transactionId,
    );
  return db.runTransaction(async transaction => {
    const economy = await readEconomy(
      transaction,
      uid,
      profile.timezone || 'UTC',
    );
    const claimRef = db.collection('progressTransactions').doc(id);
    const claim = await transaction.get(claimRef);
    if (claim.exists && claim.data()?.ownerHash !== key(uid)) {
      throw new HttpsError(
        'permission-denied',
        'This purchase belongs to a different Hoyst account.',
      );
    }
    if (claim.data()?.refunded) {
      return {...summary(economy), purchaseRefunded: true};
    }
    if (purchase.refunded) {
      const removed = refundPurchase(economy.wallet, id);
      economy.records.push({
        id: 'refund_' + id,
        data: {
          kind: 'refund',
          reason: 'Store purchase refunded',
          xp: 0,
          skips: -removed.skips,
          restores: -removed.restores,
          productId: purchase.productId,
        },
      });
    } else if (!claim.exists) {
      const units = CATALOG[purchase.productId];
      grant(economy.wallet, id, units, true);
      economy.records.push({
        id,
        data: {
          kind: 'purchase',
          reason: 'Reward pack purchased',
          productId: purchase.productId,
          xp: 0,
          ...units,
        },
      });
    } else {
      return summary(economy);
    }
    transaction.set(claimRef, {
      ownerHash: key(uid),
      refunded: purchase.refunded === true,
      productId: purchase.productId,
      store: purchase.store,
      environment: purchase.environment,
      updatedAt: FieldValue.serverTimestamp(),
    });
    writeEconomy(transaction, economy);
    return summary(economy);
  });
}
export const progressPurchaseWebhook = onRequest(
  {secrets: signingSecret ? [signingSecret] : []},
  async (request, response) => {
    if (!configured) {
      response.status(503).send('Purchases are not configured');
      return;
    }
    if (request.method !== 'POST') {
      response.status(405).send('POST required');
      return;
    }
    if (
      !verifyWebhook(
        request.rawBody,
        request.get('X-RevenueCat-Webhook-Signature') || '',
        signingSecret?.value() || '',
      )
    ) {
      response.status(401).send('Invalid signature');
      return;
    }
    const event = request.body?.event;
    if (!event || typeof event.id !== 'string') {
      response.status(400).send('Invalid event');
      return;
    }
    if (
      event.type !== 'NON_RENEWING_PURCHASE' &&
      event.type !== 'CANCELLATION'
    ) {
      response.sendStatus(200);
      return;
    }
    if (!CATALOG[event.product_id]) {
      response.sendStatus(200);
      return;
    }
    if (
      typeof event.app_user_id !== 'string' ||
      event.app_user_id.startsWith('$RCAnonymousID:') ||
      typeof event.transaction_id !== 'string'
    ) {
      response.status(400).send('Named Hoyst identity required');
      return;
    }
    try {
      await applyVerifiedPurchase({
        uid: event.app_user_id,
        transactionId: event.transaction_id,
        productId: event.product_id,
        store: event.store,
        environment: event.environment,
        refunded: event.type === 'CANCELLATION',
      });
      response.sendStatus(200);
    } catch (error) {
      if (error instanceof HttpsError && error.code === 'failed-precondition') {
        // Deleted accounts cannot regain inventory through a delayed provider event.
        response.sendStatus(200);
        return;
      }
      console.error('progress_purchase_delivery_failed', {eventId: event.id});
      response.sendStatus(503);
    }
  },
);
export const syncProgressPurchases = onCall(
  {secrets: apiKey ? [apiKey] : []},
  async request => {
    if (!configured)
      throw new HttpsError('unavailable', 'Purchases are not configured yet.');
    const {uid} = await eligibleProfile(
      request.auth?.uid,
      request.data?.idToken,
    );
    const response = await fetch(
      'https://api.revenuecat.com/v1/subscribers/' + encodeURIComponent(uid),
      {
        headers: {Authorization: 'Bearer ' + (apiKey?.value() || '')},
        signal: AbortSignal.timeout(15000),
      },
    );
    if (!response.ok) {
      throw new HttpsError(
        'unavailable',
        'Could not verify purchases. Please try again.',
      );
    }
    const body = (await response.json()) as {
      subscriber?: {
        non_subscriptions?: Record<
          string,
          Array<{
            id: string;
            store_transaction_id?: string;
            store: string;
            is_sandbox: boolean;
            refunded_at?: string | null;
          }>
        >;
      };
    };
    let delivered = 0;
    const verifiedTransactionIds: string[] = [];
    for (const [productId, transactions] of Object.entries(
      body.subscriber?.non_subscriptions || {},
    )) {
      if (!CATALOG[productId]) {
        continue;
      }
      for (const purchase of transactions) {
        // RevenueCat's internal id is not a store transaction identifier. Do not grant against it.
        if (!purchase.store_transaction_id) {
          continue;
        }
        const verified = await applyVerifiedPurchase({
          uid,
          transactionId: purchase.store_transaction_id,
          productId,
          store: purchase.store.toUpperCase(),
          environment: purchase.is_sandbox ? 'SANDBOX' : 'PRODUCTION',
          refunded: Boolean(purchase.refunded_at),
        });
        if (
          verified &&
          !purchase.refunded_at &&
          !('purchaseRefunded' in verified)
        )
          verifiedTransactionIds.push(purchase.store_transaction_id);
        delivered++;
      }
    }
    const wallet = await db.runTransaction(async transaction =>
      summary(
        await readEconomy(
          transaction,
          uid,
          (await db.collection('users').doc(uid).get()).data()?.timezone ||
            'UTC',
        ),
      ),
    );
    return {delivered, verifiedTransactionIds, summary: wallet};
  },
);
