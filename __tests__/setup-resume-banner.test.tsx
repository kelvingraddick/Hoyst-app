import React from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {Alert, Pressable} from 'react-native';
import renderer, {act} from 'react-test-renderer';
import {SetupResumeBanner} from '../src/features/create-circle/components/SetupResumeBanner';
import {createSetupJourney} from '../src/features/create-circle/services/setup-journey';
import {useSetupJourneyStore} from '../src/store/setup-journey-store';
import {useSessionStore} from '../src/store/session-store';
import {useOnboardingStore} from '../src/store/onboarding-store';
import {useCircleInviteStore} from '../src/store/circle-invite-store';

jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest/async-storage-mock'),
);
jest.mock('../src/design/theme/useHoystTheme', () => ({
  useHoystTheme: () =>
    require('../src/design/tokens/colors').getHoystThemeColors('dark'),
}));

const uid = 'setup-user';
const key = `create:${uid}`;
const navigation = {navigate: jest.fn()};
let tree: renderer.ReactTestRenderer;
let alertSpy: jest.SpyInstance;

async function render() {
  await act(async () => {
    tree = renderer.create(
      <SetupResumeBanner navigation={navigation as never} />,
    );
  });
}

function press(testID: string) {
  act(() => tree.root.findByProps({testID}).props.onPress());
}

function choose(text: string) {
  const buttons = alertSpy.mock.calls.at(-1)?.[2] as {
    text: string;
    onPress?: () => void;
  }[];
  act(() => buttons.find(button => button.text === text)?.onPress?.());
}

beforeEach(async () => {
  jest.clearAllMocks();
  await AsyncStorage.clear();
  useSessionStore.setState({
    user: {uid, providerIds: []},
    status: 'authenticatedReady',
    pendingAction: undefined,
  });
  useOnboardingStore.getState().reset();
  useCircleInviteStore.getState().clearInvite();
  useSetupJourneyStore.setState({
    hydrated: true,
    records: {[key]: {...createSetupJourney('proof'), ownerUid: uid}},
  });
  alertSpy = jest.spyOn(Alert, 'alert').mockImplementation(() => undefined);
});

afterEach(() => {
  if (tree) {
    act(() => tree.unmount());
  }
  alertSpy.mockRestore();
});

it('opens a confirmation from a separate dismiss target and keeps the setup on cancel', async () => {
  const records = useSetupJourneyStore.getState().records;
  await render();
  expect(tree.root.findAllByType(Pressable)).toHaveLength(2);
  press('discard-commitment-setup');
  expect(navigation.navigate).not.toHaveBeenCalled();
  expect(alertSpy).toHaveBeenCalledWith(
    'Discard this setup?',
    "Your saved setup will be removed. Circles you've already created or joined won't be affected.",
    [
      {text: 'Keep setup', style: 'cancel'},
      {
        text: 'Discard setup',
        style: 'destructive',
        onPress: expect.any(Function),
      },
    ],
  );
  expect(useSetupJourneyStore.getState().records).toBe(records);
  choose('Keep setup');
  expect(useSetupJourneyStore.getState().records).toBe(records);
  press('resume-commitment-setup');
  expect(navigation.navigate).toHaveBeenCalledWith('CreateCircle');
});

it('discards only the displayed setup, persists removal, and reveals the next draft', async () => {
  const other = createSetupJourney('name');
  other.draft.title = 'Another saved setup';
  useSetupJourneyStore.setState(state => ({
    records: {...state.records, other},
  }));
  const legacy = createSetupJourney('review');
  useOnboardingStore.setState({
    starterCircleSetupId: legacy.requestId,
    starterCircleDraft: legacy.draft,
    hasPendingStarterCircleSetup: true,
  });
  useCircleInviteStore.getState().setInviteCode('another-invite');
  useSessionStore.getState().setPendingAction({type: 'tapInPicker'});
  const onboarding = useOnboardingStore.getState();
  const invite = useCircleInviteStore.getState();
  const session = useSessionStore.getState();
  await render();
  press('discard-commitment-setup');
  choose('Discard setup');
  expect(useSetupJourneyStore.getState().records).toEqual({other});
  expect(JSON.stringify(tree.toJSON())).toContain(other.draft.title);
  expect(useOnboardingStore.getState()).toBe(onboarding);
  expect(useCircleInviteStore.getState()).toBe(invite);
  expect(useSessionStore.getState()).toBe(session);
  expect(navigation.navigate).not.toHaveBeenCalled();
  const stored = await AsyncStorage.getItem('hoyst-setup-journeys-v1');
  act(() => {
    useSetupJourneyStore.setState({records: {}});
  });
  await AsyncStorage.setItem('hoyst-setup-journeys-v1', stored!);
  await act(async () => useSetupJourneyStore.persist.rehydrate());
  expect(useSetupJourneyStore.getState().records).toEqual({other});
});

it('hides the prompt after discarding the final draft, including a locally saved success', async () => {
  const saved = {
    ...createSetupJourney('finish'),
    status: 'saved' as const,
    result: {circleId: 'existing-circle', membership: 'active' as const},
  };
  useSetupJourneyStore.setState({records: {[key]: saved}});
  await render();
  press('discard-commitment-setup');
  choose('Discard setup');
  expect(useSetupJourneyStore.getState().records).toEqual({});
  expect(tree.toJSON()).toBeNull();
  expect(navigation.navigate).not.toHaveBeenCalled();
});

it('clears only a matching legacy resume marker so the discarded draft cannot be migrated back', async () => {
  const draft = createSetupJourney('review');
  const pendingAction = {type: 'createCircle' as const};
  draft.pendingAction = pendingAction;
  useSetupJourneyStore.setState({records: {onboarding: draft}});
  useOnboardingStore.setState({
    starterCircleSetupId: draft.requestId,
    starterCircleDraft: draft.draft,
    hasPendingStarterCircleSetup: true,
    hasPendingProfileCompletion: true,
    displayName: 'Jamie',
  });
  useSessionStore.getState().setPendingAction(pendingAction);
  await render();
  press('discard-commitment-setup');
  choose('Discard setup');
  expect(useOnboardingStore.getState()).toMatchObject({
    hasPendingStarterCircleSetup: false,
    starterCircleSetupId: undefined,
    hasPendingProfileCompletion: true,
    displayName: 'Jamie',
  });
  expect(useSessionStore.getState().pendingAction).toBeUndefined();
  await useOnboardingStore.persist.rehydrate();
  expect(useOnboardingStore.getState().hasPendingStarterCircleSetup).toBe(
    false,
  );
});

it.each([true, false])(
  'clears a pending invite only when it belongs to this setup (matching: %s)',
  async matching => {
    useSetupJourneyStore.setState({
      records: {'invite:saved-invite': createSetupJourney('joinPreview')},
    });
    useCircleInviteStore
      .getState()
      .setInviteCode(matching ? 'saved-invite' : 'another-invite');
    useCircleInviteStore.getState().consentToJoin();
    await render();
    press('discard-commitment-setup');
    choose('Discard setup');
    expect(useCircleInviteStore.getState().inviteCode).toBe(
      matching ? undefined : 'another-invite',
    );
    expect(useCircleInviteStore.getState().consented).toBe(!matching);
  },
);

it('does not discard a replacement draft created while confirmation was open', async () => {
  await render();
  press('discard-commitment-setup');
  const replacement = createSetupJourney('name');
  act(() => {
    useSetupJourneyStore.setState({records: {[key]: replacement}});
  });
  choose('Discard setup');
  expect(useSetupJourneyStore.getState().records[key]).toBe(replacement);
});

it('does not discard anything after the signed-in account changes', async () => {
  const records = useSetupJourneyStore.getState().records;
  await render();
  press('discard-commitment-setup');
  act(() =>
    useSessionStore.setState({user: {uid: 'another-user', providerIds: []}}),
  );
  choose('Discard setup');
  expect(useSetupJourneyStore.getState().records).toBe(records);
});
