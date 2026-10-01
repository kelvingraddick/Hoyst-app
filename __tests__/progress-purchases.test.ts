const mockState = {user: {uid: 'owner'} as {uid: string} | undefined};
const mockPurchase = jest.fn();
const mockSync = jest.fn();
const mockEnsure = jest.fn();
const mockLogout = jest.fn();
const mockLogin = jest.fn();
const mockConfigure = jest.fn();
const mockReceiptSync = jest.fn();
jest.mock('react-native-config', () => ({
  REVENUECAT_IOS_API_KEY: 'public-test-key',
  REVENUECAT_ANDROID_API_KEY: 'public-test-key',
}));
jest.mock('react-native-purchases', () => ({
  __esModule: true,
  default: {
    configure: (...args: unknown[]) => mockConfigure(...args),
    logIn: (...args: unknown[]) => mockLogin(...args),
    logOut: (...args: unknown[]) => mockLogout(...args),
    syncPurchases: () => mockReceiptSync(),
    getProducts: jest.fn().mockResolvedValue([]),
    purchaseStoreProduct: (...args: unknown[]) => mockPurchase(...args),
  },
  PRODUCT_CATEGORY: {NON_SUBSCRIPTION: 'NON_SUBSCRIPTION'},
  PURCHASES_ERROR_CODE: {PAYMENT_PENDING_ERROR: '20'},
}));
jest.mock('../src/store/session-store', () => ({
  useSessionStore: {getState: () => mockState, subscribe: jest.fn()},
}));
jest.mock('../src/features/progress/services/progress-service', () => ({
  ensureProgress: () => mockEnsure(),
  syncProgressPurchases: () => mockSync(),
}));
import {
  buyRewardProduct,
  getRewardProducts,
  recoverRewardPurchases,
} from '../src/features/progress/services/purchase-service';
import type {PurchasesStoreProduct} from 'react-native-purchases';
const product = {
  identifier: 'hoyst_skips_3',
  priceString: '$0.99',
} as PurchasesStoreProduct;
beforeEach(() => {
  jest.clearAllMocks();
  mockState.user = {uid: 'owner'};
  mockEnsure.mockResolvedValue({flags: {buying: true}});
  mockSync.mockResolvedValue({
    delivered: 1,
    verifiedTransactionIds: ['new-transaction'],
  });
  mockPurchase.mockResolvedValue({
    transaction: {transactionIdentifier: 'new-transaction'},
  });
});
it('uses the Hoyst identity and waits for verified server delivery', async () => {
  await getRewardProducts('owner');
  expect(mockConfigure).toHaveBeenCalledWith({
    apiKey: 'public-test-key',
    appUserID: 'owner',
  });
  expect(await buyRewardProduct('owner', product)).toBe('complete');
  expect(mockSync).toHaveBeenCalledTimes(1);
});
it('does not sync or grant inventory for cancellation', async () => {
  mockPurchase.mockRejectedValue({userCancelled: true});
  expect(await buyRewardProduct('owner', product)).toBe('cancelled');
  expect(mockSync).not.toHaveBeenCalled();
});
it('keeps pending payments separate from delivered purchases', async () => {
  mockPurchase.mockRejectedValue({code: '20'});
  expect(await buyRewardProduct('owner', product)).toBe('pending');
  expect(mockSync).not.toHaveBeenCalled();
});
it('reports interrupted delivery for later recovery', async () => {
  mockSync.mockResolvedValue({delivered: 0});
  expect(await buyRewardProduct('owner', product)).toBe('delivering');
});
it('rejects purchasing for a previous account', async () => {
  mockState.user = {uid: 'other'};
  await expect(buyRewardProduct('owner', product)).rejects.toThrow('Sign in');
  expect(mockPurchase).not.toHaveBeenCalled();
});
it('honors the server pause before opening the store', async () => {
  mockEnsure.mockResolvedValue({flags: {buying: false}});
  await expect(buyRewardProduct('owner', product)).rejects.toThrow(
    'unavailable',
  );
  expect(mockPurchase).not.toHaveBeenCalled();
});
it('does not reconcile under a new account after payment', async () => {
  mockPurchase.mockImplementation(async () => {
    mockState.user = {uid: 'other'};
    return {};
  });
  expect(await buyRewardProduct('owner', product)).toBe('delivering');
  expect(mockSync).not.toHaveBeenCalled();
});

it('does not report an older verified purchase as delivery of the new transaction', async () => {
  mockSync.mockResolvedValue({
    delivered: 1,
    verifiedTransactionIds: ['old-transaction'],
  });
  expect(await buyRewardProduct('owner', product)).toBe('delivering');
});
it('keeps a successful payment in delivery recovery when server verification is interrupted', async () => {
  mockSync.mockRejectedValue(new Error('unavailable'));
  expect(await buyRewardProduct('owner', product)).toBe('delivering');
});

it('reconciles interrupted native receipt delivery only for the same signed-in account', async () => {
  mockReceiptSync.mockResolvedValue(undefined);
  await recoverRewardPurchases('owner');
  expect(mockReceiptSync).toHaveBeenCalledTimes(1);
  expect(mockSync).toHaveBeenCalledTimes(1);
  mockState.user = {uid: 'other'};
  await recoverRewardPurchases('owner');
  expect(mockReceiptSync).toHaveBeenCalledTimes(1);
});
