import {Platform} from 'react-native';
import Config from 'react-native-config';
import Purchases, {
  PRODUCT_CATEGORY,
  PURCHASES_ERROR_CODE,
  type PurchasesStoreProduct,
} from 'react-native-purchases';
import {useSessionStore} from '../../../store/session-store';
import {ensureProgress, syncProgressPurchases} from './progress-service';
export const PACKS = [
  {
    id: 'hoyst_skips_3',
    title: '3 skips',
    description: 'Protect three open opportunities.',
  },
  {
    id: 'hoyst_restore_1',
    title: '1 streak restore',
    description: 'Repair one eligible streak gap.',
  },
  {
    id: 'hoyst_protection_pack',
    title: '5 skips + 2 restores',
    description: 'A little extra room to keep going.',
  },
];
let configured = false;
let identity: string | undefined;
let serial: Promise<unknown> = Promise.resolve();
async function identify(uid: string) {
  const apiKey =
    Platform.OS === 'ios'
      ? Config.REVENUECAT_IOS_API_KEY
      : Config.REVENUECAT_ANDROID_API_KEY;
  if (!apiKey) {
    throw new Error('Reward purchases are not available yet.');
  }
  if (!configured) {
    Purchases.configure({apiKey, appUserID: uid});
    configured = true;
    identity = uid;
  } else if (identity !== uid) {
    await Purchases.logIn(uid);
    identity = uid;
  }
}
export async function getRewardProducts(uid: string) {
  serial = serial.catch(() => undefined).then(() => identify(uid));
  await serial;
  if (useSessionStore.getState().user?.uid !== uid) {
    throw new Error('Your account changed. Please reopen reward packs.');
  }
  return Purchases.getProducts(
    PACKS.map(pack => pack.id),
    PRODUCT_CATEGORY.NON_SUBSCRIPTION,
  );
}
export async function buyRewardProduct(
  uid: string,
  product: PurchasesStoreProduct,
) {
  serial = serial.catch(() => undefined).then(() => identify(uid));
  await serial;
  if (useSessionStore.getState().user?.uid !== uid) {
    throw new Error('Sign in to your Hoyst account first.');
  }
  const current = await ensureProgress();
  if (!current.flags.buying)
    throw new Error('Reward purchases are currently unavailable.');
  let transactionId: string | undefined;
  try {
    const purchase = serial
      .catch(() => undefined)
      .then(async () => {
        await identify(uid);
        if (useSessionStore.getState().user?.uid !== uid)
          throw new Error('Your account changed.');
        return Purchases.purchaseStoreProduct(product);
      });
    serial = purchase;
    transactionId = (await purchase).transaction?.transactionIdentifier;
  } catch (error) {
    const purchaseError = error as {userCancelled?: boolean; code?: string};
    if (purchaseError.userCancelled) {
      return 'cancelled' as const;
    }
    if (purchaseError.code === PURCHASES_ERROR_CODE.PAYMENT_PENDING_ERROR) {
      return 'pending' as const;
    }
    throw error;
  }
  if (useSessionStore.getState().user?.uid !== uid) {
    return 'delivering' as const;
  }
  try {
    const result = await syncProgressPurchases();
    return transactionId &&
      result.verifiedTransactionIds?.includes(transactionId)
      ? ('complete' as const)
      : ('delivering' as const);
  } catch {
    // Payment succeeded. Delivery can retry without sending the user through another purchase.
    return 'delivering' as const;
  }
}
export async function recoverRewardPurchases(uid: string) {
  const apiKey =
    Platform.OS === 'ios'
      ? Config.REVENUECAT_IOS_API_KEY
      : Config.REVENUECAT_ANDROID_API_KEY;
  if (!apiKey || useSessionStore.getState().user?.uid !== uid) return;
  const recovery = serial
    .catch(() => undefined)
    .then(async () => {
      if (useSessionStore.getState().user?.uid !== uid) return;
      await identify(uid);
      await Purchases.syncPurchases();
      if (useSessionStore.getState().user?.uid === uid)
        await syncProgressPurchases();
    });
  serial = recovery;
  await recovery;
}
// SDK identity is changed before any store access. Logout clears it without carrying balances across accounts.
useSessionStore.subscribe((state, prior) => {
  if (!state.user?.uid && prior.user?.uid && configured) {
    serial = serial
      .catch(() => undefined)
      .then(async () => {
        await Purchases.logOut();
        identity = undefined;
      })
      .catch(() => {
        identity = undefined;
      });
  }
});
