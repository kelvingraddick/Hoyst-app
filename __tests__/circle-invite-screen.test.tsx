import React from 'react';
import renderer, {act} from 'react-test-renderer';
import {Pressable, Text} from 'react-native';
import {HoystButton} from '../src/design/components/HoystButton';
import {CircleInviteScreen} from '../src/features/circle-invites/screens/CircleInviteScreen';
import {createSetupJourney} from '../src/features/create-circle/services/setup-journey';
import {useSetupJourneyStore} from '../src/store/setup-journey-store';
import {useCircleInviteStore} from '../src/store/circle-invite-store';
import {useOnboardingStore} from '../src/store/onboarding-store';
import {useSessionStore} from '../src/store/session-store';
import {useUserProfileStore} from '../src/store/profile-store';
import {joinCircle} from '../src/features/circles/services/circle-service';
let mockTapInAvailable = true;
jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest/async-storage-mock'),
);
jest.mock('@react-navigation/native', () => ({
  useFocusEffect: (effect: () => void) =>
    require('react').useEffect(effect, []),
  CommonActions: {reset: (payload: unknown) => ({type: 'RESET', payload})},
}));
jest.mock('react-native-linear-gradient', () => {
  const ReactMock = require('react');
  const {View} = require('react-native');
  return ({children, ...props}: React.PropsWithChildren) =>
    ReactMock.createElement(View, props, children);
});
jest.mock('react-native-safe-area-context', () => {
  const ReactMock = require('react');
  const {View} = require('react-native');
  return {
    SafeAreaProvider: ({children, ...props}: React.PropsWithChildren) =>
      ReactMock.createElement(View, props, children),
    SafeAreaView: ({children, ...props}: React.PropsWithChildren) =>
      ReactMock.createElement(View, props, children),
    useSafeAreaInsets: () => ({top: 0, bottom: 0, left: 0, right: 0}),
  };
});
jest.mock('react-native-image-picker', () => ({
  launchImageLibrary: jest.fn().mockResolvedValue({didCancel: true}),
}));
jest.mock('../src/lib/firebase/auth', () => ({
  firebaseAuth: () => ({
    currentUser: {uid: 'setup-test-user', displayName: 'Jamie'},
  }),
}));
jest.mock('../src/lib/firebase/firestore', () => ({
  firebaseFirestore: () => {
    const chain: any = {};
    for (const key of ['collection', 'doc', 'where']) chain[key] = () => chain;
    chain.get = async () => ({
      data: () => ({status: 'active'}),
      docs: mockTapInAvailable
        ? [
            {
              data: () => ({
                availableDateKey: '2000-01-01',
                expiresDateKey: '2099-01-01',
                status: 'available',
              }),
            },
          ]
        : [],
    });
    return chain;
  },
}));
jest.mock('../src/lib/notifications', () => ({
  requestPushNotificationPermission: jest.fn().mockResolvedValue(true),
}));
jest.mock('../src/features/auth/services/auth-service', () => ({
  registerWithEmail: jest.fn(),
  signInWithEmail: jest.fn(),
  signInWithApple: jest.fn(),
  signInWithGoogle: jest.fn(),
  sendPasswordReset: jest.fn(),
  startPhoneSignIn: jest.fn(),
  confirmPhoneSignIn: jest.fn(),
}));
jest.mock('../src/features/auth/services/account-service', () => ({
  completeProfile: jest.fn(),
  checkProfileUsername: jest
    .fn()
    .mockResolvedValue({available: true, handle: 'jamie'}),
  uploadProfileAvatar: jest
    .fn()
    .mockResolvedValue('https://example.com/photo.jpg'),
}));
jest.mock('../src/features/circles/services/circle-service', () => ({
  createCircle: jest.fn(),
  joinCircle: jest.fn(),
}));
jest.mock('../src/features/explore/services/explore-service', () => ({
  suggestPublicCircles: jest.fn().mockResolvedValue([]),
}));

const code = 'abc123xy';
const key = `invite:${code}`;
const originalUpdate = useSetupJourneyStore.getState().update;
const navigation = {
  navigate: jest.fn(),
  replace: jest.fn(),
  dispatch: jest.fn(),
};
const circle = {
  id: 'invited-circle',
  title: 'Small steps club',
  commitment: 'Walk for 20 minutes',
  category: 'Fitness',
  memberCount: 6,
  maxSize: 10,
  groupStreakDays: 0,
  joinMode: 'open' as const,
  commitmentCadence: 'weekly' as const,
  commitmentFrequency: {tapInsPerWeek: 4},
  commitmentType: 'build' as const,
  buildTrackingMode: 'quantity' as const,
  targetValue: 20,
  unitLabel: 'minutes',
  timezone: 'UTC',
};
let tree: renderer.ReactTestRenderer | undefined;
async function render() {
  await act(async () => {
    tree = renderer.create(
      <CircleInviteScreen
        navigation={navigation as never}
        route={{params: {inviteCode: code}} as never}
      />,
    );
  });
  return tree!;
}
async function press(label: string) {
  const button = tree!.root
    .findAllByType(HoystButton)
    .find(node => node.props.label === label);
  if (!button) throw new Error(`Missing ${label}`);
  await act(async () => button.props.onPress());
}
beforeEach(() => {
  useSetupJourneyStore.setState({update: originalUpdate});
  jest.clearAllMocks();
  mockTapInAvailable = true;
  useSessionStore.setState({
    status: 'authenticatedReady',
    user: {uid: 'setup-test-user', providerIds: []},
    pendingAction: undefined,
  });
  useUserProfileStore.setState({
    profile: {
      id: 'setup-test-user',
      name: 'Jamie',
      handle: 'jamie',
      timezone: 'UTC',
      onboardingStatus: 'complete',
    },
  });
  useCircleInviteStore.getState().clearInvite();
  useOnboardingStore.getState().reset();
  const record = createSetupJourney('joinPreview', 'UTC');
  record.selection = {kind: 'circle', circle, inviteCode: code};
  useSetupJourneyStore.setState({hydrated: true, records: {[key]: record}});
  (joinCircle as jest.Mock).mockResolvedValue({status: 'active'});
});
afterEach(async () => {
  if (tree) await act(async () => tree!.unmount());
  tree = undefined;
});
describe('shared invite journey', () => {
  it('settles an unavailable invite once and retains its recovery screen across remounts', async () => {
    const record = createSetupJourney('joinPreview', 'UTC');
    useSetupJourneyStore.setState({records: {[key]: record}});
    useCircleInviteStore.getState().setInviteCode(code);
    useCircleInviteStore.getState().setResolutionUnavailable();
    const update = jest.spyOn(useSetupJourneyStore.getState(), 'update');
    await render();
    expect(useSetupJourneyStore.getState().records[key].step).toBe(
      'unavailable',
    );
    expect(
      update.mock.calls.filter(
        ([, patch]) =>
          typeof patch !== 'function' && patch.step === 'unavailable',
      ),
    ).toHaveLength(1);
    await act(async () => tree!.unmount());
    await render();
    expect(useSetupJourneyStore.getState().records[key].step).toBe(
      'unavailable',
    );
    expect(
      update.mock.calls.filter(
        ([, patch]) =>
          typeof patch !== 'function' && patch.step === 'unavailable',
      ),
    ).toHaveLength(1);
    update.mockRestore();
  });
  it.each(['active', 'pending'] as const)(
    'recognizes %s membership before rejecting a full invite',
    async membership => {
      useSetupJourneyStore.setState({
        records: {[key]: createSetupJourney('joinPreview', 'UTC')},
      });
      useCircleInviteStore.getState().setInviteCode(code);
      useCircleInviteStore.getState().setResolvedPreview(code, {
        ...circle,
        circleId: circle.id,
        isFull: true,
        cadenceLabel: 'Weekly',
        viewerMembershipStatus: membership,
        viewerUid: 'setup-test-user',
      });
      await render();
      expect(useSetupJourneyStore.getState().records[key].step).toBe(
        'joinPreview',
      );
      expect(useSetupJourneyStore.getState().records[key].selection?.kind).toBe(
        'circle',
      );
      expect(joinCircle).not.toHaveBeenCalled();
    },
  );
  it.each([
    {
      membership: 'active',
      eligible: true,
      action: 'Tap In now',
      destination: 'TapInComposer',
    },
    {
      membership: 'active',
      eligible: false,
      action: 'Go to Home',
      destination: 'MainTabs',
    },
    {
      membership: 'pending',
      eligible: false,
      action: 'View Circle',
      destination: 'CircleDetail',
    },
  ] as const)(
    'clears a completed $membership invite after $action without removing another draft',
    async ({membership, eligible, action, destination}) => {
      const normal = createSetupJourney('goal', 'UTC');
      normal.draft.commitment = 'Read 10 pages';
      normal.deferred = true;
      useSetupJourneyStore.setState(state => ({
        records: {...state.records, onboarding: normal},
      }));
      useCircleInviteStore.getState().setInviteCode(code);
      mockTapInAvailable = eligible;
      (joinCircle as jest.Mock).mockResolvedValue({status: membership});
      await render();
      await press('Join Circle');
      expect(useSetupJourneyStore.getState().records[key]).toMatchObject({
        status: 'saved',
        step: 'finish',
        result: {membership},
      });
      await press(action);
      expect(useSetupJourneyStore.getState().records[key]).toBeUndefined();
      expect(useSetupJourneyStore.getState().records.onboarding).toEqual(
        normal,
      );
      expect(useCircleInviteStore.getState().inviteCode).toBeUndefined();
      expect(useOnboardingStore.getState()).toMatchObject({
        hasSeenOnboarding: true,
        starterCircleSetupId: undefined,
        hasPendingStarterCircleSetup: false,
      });
      const routes = (
        navigation.dispatch.mock.calls[0][0] as {
          payload: {routes: {name: string; params?: object}[]};
        }
      ).payload.routes;
      expect(routes[routes.length - 1]).toEqual(
        destination === 'MainTabs'
          ? {name: 'MainTabs', params: {screen: 'Home'}}
          : {
              name: destination,
              params:
                destination === 'TapInComposer'
                  ? {circleId: circle.id, source: 'tap_in'}
                  : {circleId: circle.id},
            },
      );
      expect(joinCircle).toHaveBeenCalledTimes(1);
    },
  );
  it('shows the actual Circle rules before accepting an invite', async () => {
    const rendered = await render();
    const text = rendered.root
      .findAllByType(Text)
      .map(node => node.props.children)
      .flat()
      .join(' ');
    expect(text).toContain('You’re invited');
    expect(text).toContain('4 Tap Ins per week');
    expect(joinCircle).not.toHaveBeenCalled();
  });
  it('joins once with the invitation code and proceeds to the first Tap In check', async () => {
    await render();
    await press('Join Circle');
    expect(joinCircle).toHaveBeenCalledTimes(1);
    expect(joinCircle).toHaveBeenCalledWith(circle.id, code);
    expect(
      useSetupJourneyStore.getState().records[key].result?.membership,
    ).toBe('active');
    expect(useSetupJourneyStore.getState().records[key].step).toBe('finish');
  });
  it('retains the accepted invite through signup', async () => {
    useSessionStore.setState({status: 'guest', user: undefined});
    useUserProfileStore.setState({profile: undefined});
    await render();
    await press('Accept invite');
    expect(useSetupJourneyStore.getState().records[key].step).toBe('account');
    expect(useCircleInviteStore.getState().consented).toBe(true);
    expect(joinCircle).not.toHaveBeenCalled();
  });
  it('uses pending approval completion when joining requires approval', async () => {
    useSetupJourneyStore.getState().update(key, {
      selection: {
        kind: 'circle',
        circle: {...circle, joinMode: 'request_to_join'},
        inviteCode: code,
      },
    });
    (joinCircle as jest.Mock).mockResolvedValue({status: 'pending'});
    await render();
    await press('Request to join');
    expect(
      useSetupJourneyStore.getState().records[key].result?.membership,
    ).toBe('pending');
    expect(
      tree!.root
        .findAllByType(HoystButton)
        .some(node => node.props.label === 'Tap In now'),
    ).toBe(false);
  });
  it('preserves a separate normal draft when the invitation is saved for later', async () => {
    const normal = createSetupJourney('goal', 'UTC');
    normal.draft.commitment = 'Read 10 pages';
    useSetupJourneyStore.setState(state => ({
      records: {...state.records, onboarding: normal},
    }));
    await render();
    const later = tree!.root
      .findAllByType(Pressable)
      .find(node =>
        node
          .findAllByType(Text)
          .some(text => text.props.children === 'Save for later'),
      );
    await act(async () => later!.props.onPress());
    expect(useSetupJourneyStore.getState().records.onboarding).toEqual(normal);
    expect(useSetupJourneyStore.getState().records[key].deferred).toBe(true);
  });
});
