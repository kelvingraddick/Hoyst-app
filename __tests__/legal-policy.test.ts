import {
  LEGAL_VERSION,
  hasCurrentLegalAcceptance,
  legalAcknowledgment,
} from '../src/features/legal/policy';
import {
  LEGAL_VERSION as serverVersion,
  hasCurrentLegalAcceptance as serverHasAcceptance,
} from '../functions/src/shared/legal';
import {
  acceptLegalTerms,
  subscribeToLegalAcceptance,
} from '../src/features/legal/policy-service';
const mockCall = jest.fn().mockResolvedValue({accepted: true});
const mockSnapshot = jest.fn();
const mockDoc = jest.fn(() => ({onSnapshot: mockSnapshot}));
const mockCollection = jest.fn(() => ({doc: mockDoc}));
let mockUid = 'a';
jest.mock('../src/lib/firebase/auth', () => ({
  firebaseAuth: () => ({currentUser: {uid: mockUid}}),
}));
jest.mock('../src/lib/firebase/firestore', () => ({
  firebaseFirestore: () => ({collection: mockCollection}),
}));
jest.mock('../src/lib/firebase/authenticated-callable', () => ({
  authenticatedCallable: (...args: unknown[]) => mockCall(...args),
}));
beforeEach(() => {
  jest.clearAllMocks();
  mockUid = 'a';
});
it('keeps client/server versions and acceptance rules aligned, without implying verified age', () => {
  expect(LEGAL_VERSION).toBe(serverVersion);
  const record = {...legalAcknowledgment, acceptedAt: {seconds: 1}};
  for (const input of [
    undefined,
    {},
    {...record, adult: false},
    {...record, termsVersion: 'old'},
    {...record, acceptedAt: undefined},
    record,
  ])
    expect(hasCurrentLegalAcceptance(input)).toBe(serverHasAcceptance(input));
  expect(hasCurrentLegalAcceptance(record)).toBe(true);
  expect(hasCurrentLegalAcceptance({...record, privacyVersion: 'old'})).toBe(
    false,
  );
});
it('listens only to the current member’s private acknowledgment', () => {
  const value = jest.fn();
  const error = jest.fn();
  const stop = jest.fn();
  mockSnapshot.mockReturnValue(stop);
  expect(subscribeToLegalAcceptance('a', value, error)).toBe(stop);
  expect(mockCollection).toHaveBeenCalledWith('userPrivate');
  expect(mockDoc).toHaveBeenCalledWith('a');
  mockSnapshot.mock.calls[0][0]({
    data: () => ({
      legalAcceptance: {...legalAcknowledgment, acceptedAt: {seconds: 1}},
    }),
  });
  expect(value).toHaveBeenLastCalledWith(true);
  mockSnapshot.mock.calls[0][0]({data: () => undefined});
  expect(value).toHaveBeenLastCalledWith(false);
});
it('does not acknowledge a different account after identity changes', async () => {
  await expect(acceptLegalTerms('b')).rejects.toThrow('account changed');
  expect(mockCall).not.toHaveBeenCalled();
  await acceptLegalTerms('a');
  expect(mockCall).toHaveBeenCalledWith(
    'acceptLegalTerms',
    legalAcknowledgment,
  );
});
