const mockNativeShare = jest.fn();
const mockShare = jest.fn();
const mockCall = jest.fn();
let mockPlatform = 'ios';
let mockNativeAvailable = true;
jest.mock('react-native', () => ({
  Share: {
    share: (...args: unknown[]) => mockShare(...args),
    sharedAction: 'sharedAction',
  },
  Platform: {
    get OS() {
      return mockPlatform;
    },
  },
  NativeModules: {
    get HoystShareCompletion() {
      return mockNativeAvailable
        ? {share: (...args: unknown[]) => mockNativeShare(...args)}
        : undefined;
    },
  },
}));
jest.mock('../src/lib/firebase/authenticated-callable', () => ({
  authenticatedCallable: (...args: unknown[]) => mockCall(...args),
}));
jest.mock('../src/lib/firebase/auth', () => ({
  firebaseAuth: () => ({currentUser: {uid: 'owner'}}),
}));
jest.mock('../src/lib/firebase/firestore', () => ({
  firebaseFirestore: jest.fn(),
}));
import {shareCircleInvitation} from '../src/features/progress/services/progress-service';
beforeEach(() => {
  jest.clearAllMocks();
  mockPlatform = 'ios';
  mockNativeAvailable = true;
  mockCall.mockResolvedValue({});
});
it('does not credit a dismissed iOS sheet', async () => {
  mockShare.mockResolvedValue({action: 'dismissedAction'});
  await shareCircleInvitation('circle', {message: 'invite'});
  expect(mockCall).not.toHaveBeenCalled();
});
it('acknowledges completed iOS sharing for server access validation', async () => {
  mockShare.mockResolvedValue({action: 'sharedAction'});
  await shareCircleInvitation('circle', {message: 'invite'});
  expect(mockCall).toHaveBeenCalledWith('completeProgressTask', {
    task: 'share_invite',
    circleId: 'circle',
  });
});
it('does not mistake RN Android sheet opening for completion', async () => {
  mockPlatform = 'android';
  mockNativeAvailable = false;
  mockShare.mockResolvedValue({action: 'sharedAction'});
  await shareCircleInvitation('circle', {message: 'invite'});
  expect(mockCall).not.toHaveBeenCalled();
});
it('does not credit Android chooser dismissal', async () => {
  mockPlatform = 'android';
  mockNativeShare.mockResolvedValue({action: 'dismissedAction'});
  await shareCircleInvitation('circle', {message: 'invite'});
  expect(mockCall).not.toHaveBeenCalled();
});
it('credits Android only after the native chosen-target callback', async () => {
  mockPlatform = 'android';
  mockNativeShare.mockResolvedValue({action: 'sharedAction'});
  await shareCircleInvitation('circle', {message: 'invite'});
  expect(mockShare).not.toHaveBeenCalled();
  expect(mockCall).toHaveBeenCalledTimes(1);
});
