import React from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import renderer, {act} from 'react-test-renderer';
import {
  BackHandler,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View as NativeView,
} from 'react-native';
import {
  CircleCategoryIcon,
  getCircleCategoryVisual,
} from '../src/design/components/CircleCategoryIcon';
import {HoystButton} from '../src/design/components/HoystButton';
import {HoystInput} from '../src/design/components/HoystInput';
import {
  HoyMessageText,
  getHoyMessageParts,
} from '../src/design/components/HoyMessage';
import {CreateCircleScreen} from '../src/features/create-circle/screens/CreateCircleScreen';
import {CommitmentWizardScreen} from '../src/features/create-circle/screens/CommitmentWizardScreen';
import {SetupResumeBanner} from '../src/features/create-circle/components/SetupResumeBanner';
import {GoalEditor, SetupChoice} from '../src/features/create-circle/components/SetupStepContent';
import {CommitmentTypeIcon} from '../src/design/components/CommitmentTypeVisual';
import {palettes} from '../src/shared/commitment-appearance';
import {
  createSetupJourney,
  applyStarter,
  starters,
  type CircleSuggestion,
} from '../src/features/create-circle/services/setup-journey';
import {suggestPublicCircles} from '../src/features/explore/services/explore-service';
import {useSetupJourneyStore} from '../src/store/setup-journey-store';
import {useOnboardingStore} from '../src/store/onboarding-store';
import {useSessionStore} from '../src/store/session-store';
import {useSettingsStore} from '../src/store/settings-store';
import {useUserProfileStore} from '../src/store/profile-store';
import {
  createCircle,
  joinCircle,
} from '../src/features/circles/services/circle-service';
import {completeProfile} from '../src/features/auth/services/account-service';
import {requestPushNotificationPermission} from '../src/lib/notifications';

jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest/async-storage-mock'),
);
let mockWizardFocused = true;
jest.mock('@react-navigation/native', () => ({
  useFocusEffect: (effect: () => void) =>
    require('react').useEffect(
      () => (mockWizardFocused ? effect() : undefined),
      [effect, mockWizardFocused],
    ),
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
      docs: [
        {
          data: () => ({
            availableDateKey: '2000-01-01',
            expiresDateKey: '2099-01-01',
            status: 'available',
          }),
        },
      ],
    });
    return chain;
  },
}));
jest.mock('../src/features/legal/LegalAcceptanceContext', () => ({useHasLegalAcceptance: () => true, useLegalAcceptance: () => ({acknowledge: jest.fn().mockResolvedValue(undefined)})}));
jest.mock('../src/features/legal/policy-service', () => ({acceptLegalTerms: jest.fn().mockResolvedValue(undefined)}));
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

const navigation = {
  navigate: jest.fn(),
  replace: jest.fn(),
  dispatch: jest.fn(),
  goBack: jest.fn(),
};
const profile = {
  id: 'setup-test-user',
  name: 'Jamie',
  handle: 'jamie',
  timezone: 'UTC',
  onboardingStatus: 'complete' as const,
};
const key = 'create:setup-test-user';
const mounted: renderer.ReactTestRenderer[] = [];
function seed(step = 'suggestions') {
  const record = createSetupJourney(step as never, 'UTC');
  useSetupJourneyStore.setState({hydrated: true, records: {[key]: record}});
  return record;
}
async function render(entry: 'create' | 'onboarding' = 'create') {
  let tree!: renderer.ReactTestRenderer;
  await act(async () => {
    tree = renderer.create(
      entry === 'create' ? (
        <CreateCircleScreen
          navigation={navigation as never}
          route={{} as never}
        />
      ) : (
        <CommitmentWizardScreen
          entry="onboarding"
          setupKey={key}
          navigation={navigation as never}
        />
      ),
    );
  });
  mounted.push(tree);
  return tree;
}
async function press(tree: renderer.ReactTestRenderer, label: string) {
  const button = tree.root
    .findAllByType(HoystButton)
    .find(node => node.props.label === label);
  if (!button) throw new Error(`Missing action ${label}`);
  await act(async () => button.props.onPress());
}
async function choose(tree: renderer.ReactTestRenderer, title: string) {
  const choice = tree.root
    .findAllByType(SetupChoice)
    .find(node => node.props.title === title);
  if (!choice) throw new Error(`Missing choice ${title}`);
  await act(async () => choice.props.onPress());
}
async function input(
  tree: renderer.ReactTestRenderer,
  label: string,
  value: string,
) {
  const field = tree.root
    .findAllByType(HoystInput)
    .find(node => node.props.accessibilityLabel === label);
  if (!field) throw new Error(`Missing field ${label}`);
  await act(async () => field.props.onChangeText(value));
}
function currentRecord() {
  return useSetupJourneyStore.getState().records[key];
}
function expectChoicePalette(
  choice: renderer.ReactTestInstance,
  visual: ReturnType<typeof getCircleCategoryVisual>,
  appearance: 'light' | 'dark',
) {
  const dark = appearance === 'dark';
  expect(StyleSheet.flatten(choice.findByType(Pressable).props.style)).toMatchObject({
    backgroundColor: dark ? `${visual.accent}20` : visual.background,
    borderColor: choice.props.selected ? visual.accent : 'transparent',
  });
  const tag = choice.findAllByType(Text).find(
    node => node.props.children === choice.props.tag,
  );
  expect(StyleSheet.flatten(tag!.props.style)).toMatchObject({
    color: dark ? visual.darkForeground : visual.foreground,
    backgroundColor: `${visual.accent}18`,
  });
  if (choice.props.selected) {
    expect(choice.findAllByType(NativeView).some(node => {
      const style = StyleSheet.flatten(node.props.style);
      return style?.width === 26 &&
        style.backgroundColor === (dark ? visual.accent : visual.foreground);
    })).toBe(true);
  }
}

beforeEach(() => {
  jest.clearAllMocks();
  (suggestPublicCircles as jest.Mock).mockResolvedValue([]);
  mockWizardFocused = true;
  useSettingsStore.setState({appearance: 'dark'});
  useSessionStore.setState({
    status: 'authenticatedReady',
    user: {uid: 'setup-test-user', providerIds: []},
    pendingAction: undefined,
  });
  useUserProfileStore.setState({profile});
  useOnboardingStore.getState().reset();
  seed();
  (createCircle as jest.Mock).mockResolvedValue({
    circleId: 'created-circle',
    inviteCode: 'abcdef123456',
  });
  (completeProfile as jest.Mock).mockResolvedValue({
    uid: 'setup-test-user',
    handle: 'jamie',
    starterCircle: {circleId: 'created-circle'},
  });
});
afterEach(async () => {
  for (const tree of mounted.splice(0)) await act(async () => tree.unmount());
});

describe('shared approved wizard', () => {
  it.each(['light', 'dark'] as const)('uses blue for generic choices and preserves semantic choices in %s', async appearance => {
    useSettingsStore.setState({appearance});
    seed('mode');
    const tree = await render();
    expect(tree.root.findAllByType(SetupChoice).map(node => [node.props.title, node.props.tone])).toEqual([
      ['Shared Circle', 'green'], ['Personal commitment', 'blue'],
    ]);
    await act(async () => useSetupJourneyStore.getState().update(key, {step: 'joining'}));
    expect(tree.root.findAllByType(SetupChoice).map(node => node.props.tone)).toEqual([undefined, undefined]);
    for (const choice of tree.root.findAllByType(SetupChoice)) {
      expect(StyleSheet.flatten(choice.findByType(Pressable).props.style).backgroundColor).toBe(
        appearance === 'dark' ? palettes.blue.accent + '20' : palettes.blue.background,
      );
    }
    await act(async () => useSetupJourneyStore.getState().update(key, {step: 'privacy'}));
    expect(tree.root.findAllByType(SetupChoice).map(node => [node.props.title, node.props.tone])).toEqual([
      ['Public', 'green'], ['Link only', 'blue'], ['Private', 'blue'],
    ]);
  });
  it.each(['create', 'onboarding'] as const)(
    'removes the confirmed %s setup on exit and keeps unrelated saved drafts through restart',
    async entry => {
      const saved = seed('review');
      saved.draft = applyStarter(saved.draft, starters[0]);
      const other = createSetupJourney('goal', 'UTC');
      other.deferred = true;
      other.customText = 'Read a page';
      other.draft.commitment = 'Read a page';
      useSetupJourneyStore.setState({records: {[key]: saved, other}});
      const tree = await render(entry);
      await press(tree, 'Create commitment');
      expect(currentRecord()).toMatchObject({status: 'saved', step: 'finish'});
      expect(currentRecord().requestId).toBe(saved.requestId);
      await press(tree, 'Not now');
      expect(currentRecord()).toBeUndefined();
      expect(useSetupJourneyStore.getState().records.other).toEqual(other);
      expect(navigation.dispatch).toHaveBeenLastCalledWith({
        type: 'RESET',
        payload: {
          index: 0,
          routes: [{name: 'MainTabs', params: {screen: 'Home'}}],
        },
      });
      const stored = await AsyncStorage.getItem('hoyst-setup-journeys-v1');
      expect(JSON.parse(stored!).state.records[key]).toBeUndefined();
      await act(async () => tree.unmount());
      mounted.splice(mounted.indexOf(tree), 1);
      useSetupJourneyStore.setState({hydrated: false, records: {}});
      await AsyncStorage.setItem('hoyst-setup-journeys-v1', stored!);
      await act(async () => useSetupJourneyStore.persist.rehydrate());
      expect(useSetupJourneyStore.getState().records).toEqual({other});
    },
  );

  it('removes the Finish setup entry and starts fresh when reopening a completed wizard', async () => {
    const saved = seed('finish');
    saved.status = 'saved';
    saved.result = {circleId: 'created-circle', membership: 'active'};
    saved.draft = applyStarter(saved.draft, starters[0]);
    const tree = await render('onboarding');
    useOnboardingStore.setState({starterCircleDraft: saved.draft});
    let banner!: renderer.ReactTestRenderer;
    await act(async () => {
      banner = renderer.create(
        <SetupResumeBanner navigation={navigation as never} />,
      );
    });
    mounted.push(banner);
    expect(
      banner.root.findAllByProps({testID: 'resume-commitment-setup'}).length,
    ).toBeGreaterThan(0);
    const oldContinue = tree.root
      .findAllByType(HoystButton)
      .find(node => node.props.label === 'Not now')!.props.onPress;
    await press(tree, 'Not now');
    expect(banner.toJSON()).toBeNull();
    expect(useOnboardingStore.getState()).toMatchObject({
      hasSeenOnboarding: true,
      currentStep: 'welcome',
      starterCircleSetupId: undefined,
      starterCircleDraft: {commitment: ''},
      hasPendingStarterCircleSetup: false,
      hasPendingProfileCompletion: false,
    });
    await act(async () => oldContinue());
    expect(navigation.dispatch).toHaveBeenCalledTimes(1);
    await act(async () => tree.unmount());
    mounted.splice(mounted.indexOf(tree), 1);
    await render('onboarding');
    expect(currentRecord()).toMatchObject({
      step: 'welcome',
      draft: {commitment: ''},
    });
    expect(currentRecord().requestId).not.toBe(saved.requestId);
  });

  it('preserves another legacy draft and flags when regular creation completes', async () => {
    const saved = seed('review');
    saved.draft = applyStarter(saved.draft, starters[0]);
    const otherDraft = {...saved.draft, commitment: 'Practise guitar'};
    useOnboardingStore.setState({
      starterCircleSetupId: 'other-request',
      starterCircleDraft: otherDraft,
      hasPendingStarterCircleSetup: true,
      hasPendingProfileCompletion: true,
      currentStep: 'circleRules',
    });
    const tree = await render();
    await press(tree, 'Create commitment');
    await press(tree, 'Not now');
    expect(currentRecord()).toBeUndefined();
    expect(useOnboardingStore.getState()).toMatchObject({
      starterCircleSetupId: 'other-request',
      starterCircleDraft: otherDraft,
      hasPendingStarterCircleSetup: true,
      hasPendingProfileCompletion: true,
      currentStep: 'circleRules',
    });
  });

  it('clears a profile-only setup after its reminder choice and retains its pending destination', async () => {
    const saved = seed('account');
    saved.needsReminders = true;
    saved.pendingAction = {
      type: 'tapIn',
      circleId: 'existing-circle',
      source: 'tap_in',
    };
    const tree = await render('onboarding');
    expect(completeProfile).toHaveBeenCalledTimes(1);
    expect(currentRecord()).toMatchObject({step: 'reminders', status: 'saved'});
    expect(currentRecord().result).toBeUndefined();
    await press(tree, 'Not now');
    expect(currentRecord()).toBeUndefined();
    expect(navigation.dispatch).toHaveBeenCalledWith({
      type: 'RESET',
      payload: {
        index: 1,
        routes: [
          {name: 'MainTabs'},
          {
            name: 'TapInComposer',
            params: {circleId: 'existing-circle', source: 'tap_in'},
          },
        ],
      },
    });
  });

  it('ignores a late reminder result after the completed setup has been removed', async () => {
    const saved = seed('reminders');
    saved.status = 'saved';
    saved.result = {circleId: 'created-circle', membership: 'active'};
    let resolvePermission!: (enabled: boolean) => void;
    (requestPushNotificationPermission as jest.Mock).mockImplementationOnce(
      () =>
        new Promise<boolean>(resolve => {
          resolvePermission = resolve;
        }),
    );
    const tree = await render('onboarding');
    await press(tree, 'Enable reminders');
    await press(tree, 'Not now');
    await press(tree, 'Not now');
    expect(currentRecord()).toBeUndefined();
    await act(async () => resolvePermission(true));
    expect(currentRecord()).toBeUndefined();
    expect(navigation.dispatch).toHaveBeenCalledTimes(1);
  });

  it('does not migrate an already completed legacy mirror into another setup', async () => {
    useSetupJourneyStore.setState({records: {}});
    useOnboardingStore.setState({
      currentStep: 'auth',
      hasSeenOnboarding: true,
      hasPendingStarterCircleSetup: false,
      starterCircleDraft: {
        ...createSetupJourney().draft,
        commitment: 'Old finished setup',
      },
    });
    await render('onboarding');
    expect(currentRecord()).toMatchObject({
      step: 'welcome',
      draft: {commitment: ''},
    });
  });
  it.each(['create', 'onboarding'] as const)(
    'preselects Open seats for a new %s setup',
    async entry => {
      const saved = seed('joining');
      const tree = await render(entry);
      expect(
        tree.root
          .findAllByType(SetupChoice)
          .filter(choice => choice.props.selected)
          .map(choice => choice.props.title),
      ).toEqual(['Open seats']);
      await press(tree, 'Continue');
      expect(currentRecord()).toMatchObject({
        step: 'capacity',
        requestId: saved.requestId,
        draft: {joinMode: 'open'},
      });
    },
  );

  it.each(['create', 'onboarding'] as const)(
    'preserves saved Request approval when resuming %s setup',
    async entry => {
      const saved = seed('joining');
      saved.draft.joinMode = 'request_to_join';
      useSetupJourneyStore.setState({records: {[key]: saved}});
      const tree = await render(entry);
      expect(
        tree.root
          .findAllByType(SetupChoice)
          .filter(choice => choice.props.selected)
          .map(choice => choice.props.title),
      ).toEqual(['Request approval']);
      await press(tree, 'Continue');
      expect(currentRecord()).toMatchObject({
        step: 'capacity',
        requestId: saved.requestId,
        draft: {joinMode: 'request_to_join'},
      });
    },
  );

  it.each(['create', 'onboarding'] as const)(
    'preselects Daily and then Build for a new %s setup',
    async entry => {
      const saved = seed('pace');
      const tree = await render(entry);
      const choices = tree.root.findAllByType(SetupChoice);
      expect(choices.filter(choice => choice.props.selected).map(choice => choice.props.title)).toEqual(['Daily']);
      await press(tree, 'Continue');
      expect(currentRecord()).toMatchObject({
        step: 'type',
        requestId: saved.requestId,
        draft: {commitmentCadence: 'daily', commitmentType: 'build'},
      });
      expect(
        tree.root
          .findAllByType(SetupChoice)
          .filter(choice => choice.props.selected)
          .map(choice => choice.props.title),
      ).toEqual(['Build']);
    },
  );

  it.each(['weekly', 'monthly'] as const)(
    'preserves a saved %s pace when resuming',
    async cadence => {
      const saved = seed('pace');
      saved.draft.commitmentCadence = cadence;
      saved.draft.commitmentFrequency = {tapInsPerWeek: 5, opportunitiesPerPeriod: 19};
      useSetupJourneyStore.setState({records: {[key]: saved}});
      const tree = await render('onboarding');
      expect(tree.root.findAllByType(SetupChoice).filter(choice => choice.props.selected).map(choice => choice.props.title)).toEqual([
        cadence === 'weekly' ? 'Weekly' : 'Monthly',
      ]);
      await press(tree, 'Continue');
      expect(currentRecord()).toMatchObject({
        step: 'frequency', requestId: saved.requestId,
        draft: {commitmentCadence: cadence, commitmentFrequency: saved.draft.commitmentFrequency},
      });
    },
  );

  it('retains Weekly four and Monthly sixteen after starting Daily', async () => {
    seed('pace');
    const tree = await render();
    await choose(tree, 'Weekly');
    expect(currentRecord().draft.commitmentFrequency.tapInsPerWeek).toBe(4);
    await choose(tree, 'Monthly');
    expect(currentRecord().draft.commitmentFrequency.opportunitiesPerPeriod).toBe(16);
  });

  it.each(['light', 'dark'] as const)(
    'uses category palettes for starters in %s mode after selection and reordering',
    async appearance => {
      const saved = seed();
      saved.selection = {kind: 'template', id: 'walk'};
      saved.customText = 'My own idea';
      saved.draft.appearance = {emoji: '🌻', palette: 'purple'};
      useSettingsStore.setState({appearance});
      const tree = await render();
      let choices = tree.root.findAllByType(SetupChoice);
      for (const choice of choices) {
        const icon = choice.findByType(CircleCategoryIcon);
        expectChoicePalette(choice, getCircleCategoryVisual(icon.props.category), appearance);
      }
      await choose(tree, 'Take 5 mindful minutes');
      await act(async () => useSetupJourneyStore.getState().update(key, {
        interests: ['Wellness'],
      }));
      choices = tree.root.findAllByType(SetupChoice);
      expect(choices[0].props.title).toBe('Take 5 mindful minutes');
      expectChoicePalette(choices[0], getCircleCategoryVisual('Wellness'), appearance);
      expect(currentRecord()).toMatchObject({
        selection: {kind: 'template', id: 'mindful'},
        customText: 'My own idea',
        requestId: saved.requestId,
      });
    },
  );

  it.each([
    ['light', false], ['dark', false], ['light', true], ['dark', true],
  ] as const)(
    'uses the public Circle palette in %s mode (override: %s) and preserves join intent',
    async (appearance, override) => {
      jest.useFakeTimers();
      try {
        const saved = seed();
        saved.customText = 'My own idea';
        const circle: CircleSuggestion = {
          id: 'suggested-circle', title: 'Walk together', commitment: 'Walk',
          category: 'Fitness', memberCount: 2, maxSize: 10, groupStreakDays: 0,
          joinMode: 'open', commitmentCadence: 'weekly',
          commitmentFrequency: {tapInsPerWeek: 4}, commitmentType: 'build',
          unitLabel: 'Tap In', timezone: 'UTC',
          ...(override ? {appearance: {emoji: '🌻', palette: 'pink' as const}} : {}),
        };
        (suggestPublicCircles as jest.Mock).mockResolvedValue([circle]);
        useSettingsStore.setState({appearance});
        const tree = await render();
        await act(async () => jest.advanceTimersByTime(300));
        const choices = tree.root.findAllByType(SetupChoice);
        expect(choices.map(choice => choice.props.tag)).toEqual([
          'Create your own', 'Join a Circle', 'Create your own',
        ]);
        const publicChoice = choices[1];
        const visual = getCircleCategoryVisual(circle.category, circle.appearance);
        expectChoicePalette(publicChoice, visual, appearance);
        expect(publicChoice.findByType(CircleCategoryIcon).props.appearance).toEqual(circle.appearance);
        await choose(tree, circle.title);
        expectChoicePalette(publicChoice, visual, appearance);
        await press(tree, 'Make it mine');
        expect(currentRecord()).toMatchObject({
          step: 'joinPreview', selection: {kind: 'circle', circle},
          customText: 'My own idea', requestId: saved.requestId,
          draft: saved.draft,
        });
      } finally {
        jest.useRealTimers();
      }
    },
  );

  it('keeps the selected intent and stable identifiers when going back to suggestions', async () => {
    const saved = seed('mode');
    saved.customText = 'My own promise';
    saved.selection = {kind: 'custom'};
    saved.draft.title = 'Independent name';
    const tree = await render('onboarding');
    const back = tree.root
      .findAllByType(Pressable)
      .find(node => node.props.accessibilityLabel === 'Go back');
    await act(async () => back!.props.onPress());
    expect(currentRecord()).toMatchObject({
      step: 'suggestions',
      requestId: saved.requestId,
      customText: 'My own promise',
      selection: {kind: 'custom'},
      draft: {title: 'Independent name'},
    });
    expect(navigation.dispatch).not.toHaveBeenCalled();
  });

  it.each([
    {
      step: 'type',
      cadence: 'daily',
      mode: 'group',
      type: 'build',
      previous: 'pace',
    },
    {
      step: 'privacy',
      cadence: 'weekly',
      mode: 'group',
      type: 'avoid',
      previous: 'proof',
    },
    {
      step: 'timezone',
      cadence: 'weekly',
      mode: 'personal',
      type: 'build',
      previous: 'proof',
    },
  ])(
    'backs from $step to $previous while respecting skipped steps',
    async scenario => {
      const saved = seed(scenario.step);
      saved.draft.commitmentCadence = scenario.cadence as never;
      saved.draft.circleMode = scenario.mode as never;
      saved.draft.commitmentType = scenario.type as never;
      const tree = await render();
      const back = tree.root
        .findAllByType(Pressable)
        .find(node => node.props.accessibilityLabel === 'Go back');
      await act(async () => back!.props.onPress());
      expect(currentRecord().step).toBe(scenario.previous);
      expect(currentRecord().draft).toEqual(saved.draft);
      expect(currentRecord().requestId).toBe(saved.requestId);
    },
  );

  it('returns a Review edit to Review with the edited draft retained', async () => {
    const saved = seed('name');
    saved.reviewReturn = true;
    const tree = await render();
    await input(tree, 'Circle name', 'A new name');
    const back = tree.root
      .findAllByType(Pressable)
      .find(node => node.props.accessibilityLabel === 'Go back');
    await act(async () => back!.props.onPress());
    expect(currentRecord()).toMatchObject({
      step: 'review',
      reviewReturn: false,
      draft: {title: 'A new name'},
    });
  });

  it('only handles Android Back while focused and uses the current wizard step', async () => {
    const replace = jest.replaceProperty(Platform, 'OS', 'android');
    const remove = jest.fn();
    let hardwareBack: (() => boolean | null | undefined) | undefined;
    const listener = jest
      .spyOn(BackHandler, 'addEventListener')
      .mockImplementation((_event, callback) => {
        hardwareBack = callback;
        return {remove};
      });
    try {
      seed('mode');
      const tree = await render();
      expect(listener).toHaveBeenCalledTimes(1);
      await act(async () => {
        expect(hardwareBack?.()).toBe(true);
      });
      expect(currentRecord().step).toBe('suggestions');
      await act(async () => {
        mockWizardFocused = false;
        tree.update(
          <CreateCircleScreen
            navigation={navigation as never}
            route={{} as never}
          />,
        );
      });
      expect(remove).toHaveBeenCalledTimes(1);
      expect(listener).toHaveBeenCalledTimes(1);
      await act(async () => {
        mockWizardFocused = true;
        tree.update(
          <CreateCircleScreen
            navigation={navigation as never}
            route={{} as never}
          />,
        );
      });
      expect(listener).toHaveBeenCalledTimes(2);
    } finally {
      listener.mockRestore();
      replace.restore();
    }
  });

  it('uses the native personal emoji without changing the selectable card label', async () => {
    seed('mode');
    const tree = await render();
    const choice = tree.root
      .findAllByType(SetupChoice)
      .find(node => node.props.title === 'Personal commitment');
    expect(
      choice!.findAllByType(Text).some(node => node.props.children === '👤'),
    ).toBe(true);
    await choose(tree, 'Personal commitment');
    expect(currentRecord().draft.circleMode).toBe('personal');
  });

  it('keeps welcome links separate from the primary action and preserves their destinations', async () => {
    seed('welcome');
    useSessionStore.setState({status: 'guest', user: undefined});
    const tree = await render('onboarding');
    expect(
      tree.root.findAllByType(HoystButton).map(node => node.props.label),
    ).toEqual(['Get started']);
    const signIn = tree.root
      .findAllByType(Pressable)
      .find(
        node =>
          node.props.accessibilityLabel === 'Already have an account? Sign in',
      );
    expect(signIn?.props.accessibilityRole).toBe('button');
    await act(async () => signIn!.props.onPress());
    expect(navigation.navigate).toHaveBeenCalledWith('Auth', {
      screen: 'SignIn',
      params: {entryPoint: 'welcome'},
    });
    await press(tree, 'Get started');
    expect(currentRecord().step).toBe('interests');
  });

  it.each(['light', 'dark'] as const)(
    'uses the exact Welcome heading and default Fitness appearance in %s mode despite a saved custom appearance',
    async appearance => {
      const saved = seed('welcome');
      saved.draft.category = 'Mindfulness';
      saved.draft.appearance = {emoji: '🌻', palette: 'purple'};
      useSettingsStore.setState({appearance});
      useSessionStore.setState({status: 'guest', user: undefined});
      const tree = await render('onboarding');
      expect(
        tree.root.findAllByType(Text).some(
          node => node.props.children === "Let's get started!",
        ),
      ).toBe(true);
      const icon = tree.root.findByType(CircleCategoryIcon);
      const visual = getCircleCategoryVisual('Fitness');
      expect(icon.props.category).toBe('Fitness');
      expect(icon.props.appearance).toEqual({});
      expect(
        icon.findAllByType(Text).some(node => node.props.children === visual.emoji),
      ).toBe(true);
      expect(StyleSheet.flatten(icon.parent!.props.style).backgroundColor).toBe(
        appearance === 'dark' ? `${visual.accentColor}20` : visual.backplateColor,
      );
      expect(currentRecord().draft).toMatchObject({
        category: 'Mindfulness',
        appearance: {emoji: '🌻', palette: 'purple'},
      });
    },
  );

  it.each(['light', 'dark'] as const)(
    'uses a compact Skip link in %s mode and clears interests while retaining the draft',
    async appearance => {
      const saved = seed('interests');
      saved.interests = ['Fitness', 'Learning'];
      saved.customText = 'Keep my promise';
      useSettingsStore.setState({appearance});
      const tree = await render('onboarding');
      expect(
        tree.root.findAllByType(HoystButton).map(node => node.props.label),
      ).toEqual(['Find my starting point']);
      const skip = tree.root.findAllByType(Pressable).find(
        node => node.props.children?.props?.children === 'Skip for now',
      );
      expect(skip?.props.accessibilityRole).toBe('button');
      expect(StyleSheet.flatten(skip!.props.style).minHeight).toBe(44);
      expect(StyleSheet.flatten(skip!.props.children.props.style)).toMatchObject({
        fontSize: 13,
        lineHeight: 18,
        fontWeight: '600',
        textAlign: 'center',
      });
      await act(async () => skip!.props.onPress());
      expect(currentRecord()).toMatchObject({
        step: 'suggestions',
        interests: [],
        customText: 'Keep my promise',
        requestId: saved.requestId,
        draft: saved.draft,
      });
    },
  );

  it('keeps Browse for now reachable as a text action without discarding the setup', async () => {
    const saved = seed('welcome');
    saved.customText = 'Keep my idea';
    useSessionStore.setState({status: 'guest', user: undefined});
    const tree = await render('onboarding');
    const browse = tree.root
      .findAllByType(Pressable)
      .find(node => node.props.children?.props?.children === 'Browse for now');
    expect(browse?.props.accessibilityRole).toBe('button');
    await act(async () => browse!.props.onPress());
    expect(currentRecord()).toMatchObject({
      deferred: true,
      completed: false,
      requestId: saved.requestId,
      customText: 'Keep my idea',
    });
    expect(navigation.dispatch).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'RESET',
        payload: {
          index: 0,
          routes: [{name: 'MainTabs', params: {screen: 'Home'}}],
        },
      }),
    );
  });

  it('bolds the actual configured pace in the goal bubble while keeping the complete message', async () => {
    const saved = seed('goal');
    saved.draft.commitmentCadence = 'monthly';
    saved.draft.commitmentFrequency = {
      tapInsPerWeek: 4,
      opportunitiesPerPeriod: 19,
    };
    const tree = await render();
    const message = tree.root.findByType(HoyMessageText).props;
    const parts = getHoyMessageParts(message.message, message.emphasis);
    expect(parts.filter(part => part.bold).map(part => part.text)).toEqual([
      '19 tap ins per month',
    ]);
    expect(parts.map(part => part.text).join('')).toBe(
      'Your pace is 19 tap ins per month. What should each one cover?',
    );
  });

  it('migrates a saved legacy step without replacing entered values or its submission ID', async () => {
    useSetupJourneyStore.setState({records: {}});
    useOnboardingStore.setState({
      currentStep: 'circleRules',
      categories: ['Learning'],
      starterCircleSetupId: 'legacy-stable-id',
      hasPendingStarterCircleSetup: true,
      starterCircleDraft: {
        ...createSetupJourney().draft,
        title: 'My reading practice',
        commitment: 'Read a little each day',
        commitmentCadence: 'monthly',
        commitmentFrequency: {tapInsPerWeek: 4, opportunitiesPerPeriod: 9},
        buildTrackingMode: 'quantity',
        targetValue: 12,
        unitLabel: 'pages',
      },
    });
    await render('onboarding');
    expect(currentRecord()).toMatchObject({
      step: 'pace',
      requestId: 'legacy-stable-id',
      interests: ['Learning'],
      draft: {
        title: 'My reading practice',
        commitmentFrequency: {opportunitiesPerPeriod: 9},
        targetValue: 12,
        unitLabel: 'pages',
      },
    });
  });

  it('recovers a process interruption to explicit retry with the original submitted configuration', async () => {
    const saved = createSetupJourney('review', 'UTC');
    saved.draft = applyStarter(saved.draft, starters[0]);
    saved.status = 'saving';
    saved.submittedDraft = saved.draft;
    await AsyncStorage.setItem(
      'hoyst-setup-journeys-v1',
      JSON.stringify({state: {records: {[key]: saved}}, version: 1}),
    );
    await act(async () => useSetupJourneyStore.persist.rehydrate());
    const tree = await render();
    expect(currentRecord()).toMatchObject({
      status: 'error',
      step: 'saveError',
      requestId: saved.requestId,
      submittedDraft: saved.draft,
    });
    expect(createCircle).not.toHaveBeenCalled();
    await press(tree, 'Try again');
    expect(createCircle).toHaveBeenCalledWith(
      expect.objectContaining({requestId: saved.requestId}),
    );
  });

  it('returns from cancelled authentication with the custom intent intact', async () => {
    const saved = seed('account');
    saved.draft = {
      ...saved.draft,
      title: 'My practice',
      commitment: 'Keep practising',
    };
    saved.customText = 'Keep practising';
    saved.selection = {kind: 'custom'};
    useSessionStore.setState({status: 'guest', user: undefined});
    useUserProfileStore.setState({profile: undefined});
    const tree = await render('onboarding');
    const back = tree.root
      .findAllByType(Pressable)
      .find(node => node.props.accessibilityLabel === 'Go back');
    await act(async () => back!.props.onPress());
    expect(currentRecord()).toMatchObject({
      step: 'review',
      requestId: saved.requestId,
      customText: 'Keep practising',
      selection: {kind: 'custom'},
    });
    expect(createCircle).not.toHaveBeenCalled();
    expect(completeProfile).not.toHaveBeenCalled();
    expect(navigation.dispatch).not.toHaveBeenCalled();
  });

  it('preserves custom text when a starter is selected and restored', async () => {
    const tree = await render();
    await input(tree, 'Your commitment', 'Take a short walk');
    await choose(tree, 'Walk for 20 minutes');
    expect(currentRecord().customText).toBe('Take a short walk');
    expect(currentRecord().draft).toMatchObject({
      targetValue: 20,
      buildTrackingMode: 'quantity',
    });
    await input(tree, 'Your commitment', 'Take a short walk');
    expect(currentRecord().selection?.kind).toBe('custom');
    expect(currentRecord().draft.buildTrackingMode).toBe('confirmation');
  });
  it('puts name, pace, and frequency before type and per-Tap-In goal', async () => {
    const tree = await render();
    await choose(tree, 'Walk for 20 minutes');
    await press(tree, 'Make it mine');
    await press(tree, 'Continue');
    await press(tree, 'Continue');
    expect(currentRecord().step).toBe('name');
    await input(tree, 'Circle name', 'Small steps club');
    await press(tree, 'Continue');
    expect(currentRecord().step).toBe('pace');
    await choose(tree, 'Weekly');
    await press(tree, 'Continue');
    expect(currentRecord().step).toBe('frequency');
    expect(currentRecord().draft.commitmentFrequency.tapInsPerWeek).toBe(4);
    await press(tree, 'Continue');
    expect(currentRecord().step).toBe('type');
    await press(tree, 'Continue');
    expect(currentRecord().step).toBe('goal');
  });
  it('restores inactive numeric and pace choices', async () => {
    const current = seed('type');
    current.draft = applyStarter(current.draft, starters[0]);
    current.draft.commitmentCadence = 'weekly';
    current.draft.commitmentFrequency = {tapInsPerWeek: 4};
    useSetupJourneyStore.setState({records: {[key]: current}});
    const tree = await render();
    await choose(tree, 'Limit');
    await press(tree, 'Continue');
    await input(tree, 'Unit', 'cups');
    await input(tree, 'Maximum', '2');
    await act(async () =>
      useSetupJourneyStore.getState().update(key, {step: 'type'}),
    );
    await choose(tree, 'Build');
    expect(currentRecord().draft.unitLabel).toBe('minutes');
    expect(currentRecord().draft.targetValue).toBe(20);
    await act(async () =>
      useSetupJourneyStore.getState().update(key, {step: 'frequency'}),
    );
    await act(async () =>
      tree.root
        .findAllByType(Pressable)
        .find(
          node =>
            node.props.accessibilityState?.selected === false &&
            node.findAllByType(Text).some(text => text.props.children === 5),
        )
        ?.props.onPress(),
    );
    await act(async () =>
      useSetupJourneyStore.getState().update(key, {step: 'pace'}),
    );
    const before = currentRecord().draft.commitmentFrequency.tapInsPerWeek;
    expect(before).toBe(5);
    await choose(tree, 'Monthly');
    expect(
      currentRecord().draft.commitmentFrequency.opportunitiesPerPeriod,
    ).toBe(16);
    await choose(tree, 'Weekly');
    expect(currentRecord().draft.commitmentFrequency.tapInsPerWeek).toBe(
      before,
    );
  });
  it('returns from a review edit directly to review', async () => {
    const current = seed('review');
    current.draft = applyStarter(current.draft, starters[0]);
    useSetupJourneyStore.setState({records: {[key]: current}});
    const tree = await render();
    const edit = tree.root
      .findAllByType(Pressable)
      .find(node =>
        node.props.accessibilityLabel?.startsWith('Edit Circle name'),
      );
    await act(async () => edit!.props.onPress());
    await input(tree, 'Circle name', 'My walking club');
    await press(tree, 'Continue');
    expect(currentRecord().step).toBe('review');
    expect(currentRecord().draft.title).toBe('My walking club');
  });
  it('saves for later and restores the active draft on reopening', async () => {
    const tree = await render();
    await input(tree, 'Your commitment', 'Take a short walk');
    const saveLater = tree.root
      .findAllByType(Pressable)
      .find(node =>
        node
          .findAllByType(Text)
          .some(text => text.props.children === 'Save for later'),
      );
    await act(async () => saveLater!.props.onPress());
    expect(currentRecord().deferred).toBe(true);
    await act(async () => tree.unmount());
    mounted.splice(mounted.indexOf(tree), 1);
    await render();
    expect(currentRecord().draft.commitment).toBe('Take a short walk');
    expect(currentRecord().selection?.kind).toBe('custom');
    expect(currentRecord().deferred).toBe(false);
  });
  it('reuses one submission identifier after an uncertain save', async () => {
    const current = seed('review');
    current.draft = applyStarter(current.draft, starters[0]);
    useSetupJourneyStore.setState({records: {[key]: current}});
    (createCircle as jest.Mock).mockRejectedValueOnce(
      new Error('Network timeout'),
    );
    const tree = await render();
    await press(tree, 'Create commitment');
    expect(currentRecord().step).toBe('saveError');
    const first = (createCircle as jest.Mock).mock.calls[0][0];
    await press(tree, 'Try again');
    expect((createCircle as jest.Mock).mock.calls[1][0]).toEqual(first);
    expect(currentRecord().result?.circleId).toBe('created-circle');
    expect(currentRecord().step).toBe('finish');
  });
  it('never asks for OS permission merely because an account is ready', async () => {
    const current = seed('reminders');
    current.result = {circleId: 'created-circle', membership: 'active'};
    current.status = 'saved';
    useSetupJourneyStore.setState({records: {[key]: current}});
    const tree = await render('onboarding');
    expect(requestPushNotificationPermission).not.toHaveBeenCalled();
    await press(tree, 'Not now');
    expect(requestPushNotificationPermission).not.toHaveBeenCalled();
    expect(currentRecord().step).toBe('finish');
  });
  it('uses the existing contextual composer only after checking eligibility', async () => {
    const current = seed('finish');
    current.result = {circleId: 'created-circle', membership: 'active'};
    current.status = 'saved';
    useSetupJourneyStore.setState({records: {[key]: current}});
    const tree = await render();
    await press(tree, 'Tap In now');
    expect(currentRecord()).toBeUndefined();
    expect(navigation.dispatch).toHaveBeenCalledWith(
      expect.objectContaining({
        payload: expect.objectContaining({
          routes: expect.arrayContaining([
            expect.objectContaining({
              name: 'TapInComposer',
              params: {circleId: 'created-circle', source: 'tap_in'},
            }),
          ]),
        }),
      }),
    );
  });
  it('keeps pending approval separate from active membership', async () => {
    const current = seed('joinPreview');
    current.selection = {
      kind: 'circle',
      circle: {
        id: 'public-circle',
        title: 'Walk club',
        commitment: 'Walk',
        category: 'Fitness',
        memberCount: 5,
        maxSize: 10,
        groupStreakDays: 0,
        joinMode: 'request_to_join',
        commitmentCadence: 'weekly',
        commitmentFrequency: {tapInsPerWeek: 4},
        commitmentType: 'build',
        buildTrackingMode: 'confirmation',
        unitLabel: 'Tap In',
        timezone: 'UTC',
      },
    };
    useSetupJourneyStore.setState({records: {[key]: current}});
    (joinCircle as jest.Mock).mockResolvedValue({status: 'pending'});
    const tree = await render();
    await press(tree, 'Request to join');
    expect(currentRecord().result?.membership).toBe('pending');
    expect(
      tree.root
        .findAllByType(HoystButton)
        .some(node => node.props.label === 'Tap In now'),
    ).toBe(false);
    await press(tree, 'Go to Home');
    expect(currentRecord()).toBeUndefined();
  });
  it('shows recoverable full-Circle feedback instead of accepting a stale open seat', async () => {
    const current = seed('joinPreview');
    current.selection = {
      kind: 'circle',
      circle: {
        id: 'public-circle',
        title: 'Walk club',
        commitment: 'Walk',
        category: 'Fitness',
        memberCount: 9,
        maxSize: 10,
        groupStreakDays: 0,
        joinMode: 'open',
        commitmentCadence: 'weekly',
        commitmentFrequency: {tapInsPerWeek: 4},
        commitmentType: 'build',
        buildTrackingMode: 'confirmation',
        unitLabel: 'Tap In',
        timezone: 'UTC',
      },
    };
    useSetupJourneyStore.setState({records: {[key]: current}});
    (joinCircle as jest.Mock).mockRejectedValue({
      code: 'functions/resource-exhausted',
      message: 'Full',
    });
    const tree = await render();
    await press(tree, 'Join Circle');
    expect(currentRecord().step).toBe('full');
    await press(tree, 'Find another Circle');
    expect(currentRecord().step).toBe('suggestions');
  });
});


describe('shared goal editor polish', () => {
  async function renderGoal(
    patch: Partial<ReturnType<typeof createSetupJourney>['draft']>,
    disabled = false,
  ) {
    const initial = {...createSetupJourney('goal', 'UTC').draft, ...patch};
    const changed = jest.fn();
    function Harness() {
      const [draft, setDraft] = React.useState(initial);
      return (
        <GoalEditor
          draft={draft}
          disabled={disabled}
          onChange={next => {
            changed(next);
            setDraft(next);
          }}
        />
      );
    }
    let tree!: renderer.ReactTestRenderer;
    await act(async () => {
      tree = renderer.create(<Harness />);
    });
    mounted.push(tree);
    return {
      tree,
      changed,
      draft: () => tree.root.findByType(GoalEditor).props.draft,
    };
  }
  function preset(tree: renderer.ReactTestRenderer, unit: string) {
    return tree.root
      .findAllByType(Pressable)
      .find(node => node.props.accessibilityLabel === unit)!;
  }
  function previewText(tree: renderer.ReactTestRenderer) {
    return tree.root
      .findByProps({testID: 'goal-preview'})
      .findAllByType(Text)
      .map(node => node.props.children)
      .join(' ');
  }

  it.each(['create', 'onboarding'] as const)(
    'initializes the numeric unit in %s while retaining saved intent and validation',
    async entry => {
      const saved = seed('goal');
      saved.draft.buildTrackingMode = 'quantity';
      saved.draft.unitLabel = '';
      saved.draft.targetValue = 1;
      saved.customText = 'My existing custom commitment';
      saved.selection = {kind: 'custom'};
      useSetupJourneyStore.setState({records: {[key]: saved}});
      const tree = await render(entry);
      expect(currentRecord()).toMatchObject({
        requestId: saved.requestId,
        customText: saved.customText,
        selection: saved.selection,
        draft: {unitLabel: 'minutes', targetValue: 1},
      });
      await input(tree, 'Unit', '');
      await press(tree, 'Continue');
      expect(currentRecord()).toMatchObject({
        step: 'goal',
        requestId: saved.requestId,
        draft: {unitLabel: ''},
      });
      expect(JSON.stringify(tree.toJSON())).toContain(
        'Enter a unit of up to 32 characters.',
      );
      expect(createCircle).not.toHaveBeenCalled();
    },
  );
  it.each(['build', 'limit'] as const)(
    'prefills minutes for an empty numeric %s goal',
    async commitmentType => {
      const {tree, draft, changed} = await renderGoal({
        commitmentType,
        buildTrackingMode: 'quantity',
        unitLabel: '',
      });
      expect(draft().unitLabel).toBe('minutes');
      expect(changed).toHaveBeenCalledTimes(1);
      expect(preset(tree, 'minutes').props.accessibilityState.selected).toBe(
        true,
      );
      expect(
        tree.root
          .findByProps({testID: 'goal-unit-group'})
          .findAllByType(HoystInput)
          .map(node => node.props.accessibilityLabel),
      ).toEqual(['Unit']);
    },
  );
  it.each(['pages', 'laps', 'Tap In'])(
    'retains the existing numeric unit %s',
    async unitLabel => {
      const {draft, changed} = await renderGoal({
        buildTrackingMode: 'quantity',
        unitLabel,
      });
      expect(draft().unitLabel).toBe(unitLabel);
      expect(changed).not.toHaveBeenCalled();
    },
  );
  it('defaults an unconfigured confirmation goal on first activation and preserves clearing across switches', async () => {
    const {tree, draft} = await renderGoal({
      buildTrackingMode: 'confirmation',
      unitLabel: 'Tap In',
      targetValue: 7,
    });
    await choose(tree, 'Track an amount');
    expect(draft()).toMatchObject({unitLabel: 'minutes', targetValue: 7});
    await input(tree, 'Unit', 'laps');
    await choose(tree, 'Just show up');
    await choose(tree, 'Track an amount');
    expect(draft().unitLabel).toBe('laps');
    await input(tree, 'Unit', '');
    expect(previewText(tree)).toContain('Complete your goal to see a preview');
    await choose(tree, 'Just show up');
    expect(previewText(tree)).toContain('Confirm you did it');
    await choose(tree, 'Track an amount');
    expect(draft()).toMatchObject({unitLabel: '', targetValue: 7});
    expect(previewText(tree)).toContain('Complete your goal to see a preview');
  });
  it('preserves a configured confirmation unit on first amount activation', async () => {
    const {tree, draft} = await renderGoal({
      buildTrackingMode: 'confirmation',
      unitLabel: 'laps',
    });
    await choose(tree, 'Track an amount');
    expect(draft().unitLabel).toBe('laps');
  });
  it.each(['ios', 'android'] as const)(
    'synchronizes compact presets and manual units with %s touch targets',
    async os => {
      const original = Platform.OS;
      Object.defineProperty(Platform, 'OS', {configurable: true, value: os});
      try {
        const {tree, draft} = await renderGoal({
          buildTrackingMode: 'quantity',
          unitLabel: 'minutes',
        });
        await act(async () => preset(tree, 'pages').props.onPress());
        expect(draft().unitLabel).toBe('pages');
        await input(tree, 'Unit', '  PaGeS  ');
        expect(preset(tree, 'pages').props.accessibilityState.selected).toBe(
          true,
        );
        expect(draft().unitLabel).toBe('  PaGeS  ');
        await input(tree, 'Unit', 'laps');
        for (const unit of [
          'minutes',
          'pages',
          'reps',
          'steps',
          'cups',
          'hours',
        ]) {
          const pill = preset(tree, unit);
          expect(pill.props.accessibilityState.selected).toBe(false);
          expect(StyleSheet.flatten(pill.props.style).minHeight).toBe(
            os === 'ios' ? 44 : 48,
          );
        }
      } finally {
        Object.defineProperty(Platform, 'OS', {
          configurable: true,
          value: original,
        });
      }
    },
  );
  it.each(['light', 'dark'] as const)(
    'uses icon-free semantic mode colors and a bordered preview in %s',
    async appearance => {
      useSettingsStore.setState({appearance});
      const {tree} = await renderGoal({
        buildTrackingMode: 'quantity',
        unitLabel: 'minutes',
        targetValue: 1,
      });
      for (const [title, tone] of [
        ['Just show up', 'green'],
        ['Track an amount', 'blue'],
      ] as const) {
        const choice = tree.root
          .findAllByType(SetupChoice)
          .find(node => node.props.title === title)!;
        expect(choice.findAllByType(CommitmentTypeIcon)).toHaveLength(0);
        expect(
          StyleSheet.flatten(choice.findByType(Pressable).props.style),
        ).toMatchObject({
          backgroundColor:
            appearance === 'dark'
              ? palettes[tone].accent + '20'
              : palettes[tone].background,
          borderColor: choice.props.selected
            ? palettes[tone].accent
            : 'transparent',
        });
      }
      expect(
        StyleSheet.flatten(
          tree.root.findByProps({testID: 'goal-preview'}).props.style,
        ).borderWidth,
      ).toBe(1);
      expect(previewText(tree)).toContain(
        'Tap In preview For each Tap In At least 1 minutes Pace 1 Tap In each day',
      );
      await choose(tree, 'Just show up');
      const confirmation = tree.root
        .findAllByType(SetupChoice)
        .find(node => node.props.title === 'Just show up')!;
      expect(
        StyleSheet.flatten(confirmation.findByType(Pressable).props.style)
          .borderColor,
      ).toBe(palettes.green.accent);
    },
  );
  it('replaces invalid amounts with an incomplete preview while retaining pace', async () => {
    const {tree} = await renderGoal({
      buildTrackingMode: 'quantity',
      unitLabel: 'steps',
      targetValue: 1,
    });
    for (const value of ['', '0', '100001']) {
      await input(tree, 'Amount per Tap In', value);
      expect(previewText(tree)).toContain(
        'Complete your goal to see a preview',
      );
      expect(previewText(tree)).toContain('Pace 1 Tap In each day');
      expect(previewText(tree)).not.toContain('At least');
    }
    await input(tree, 'Amount per Tap In', '1');
    expect(previewText(tree)).toContain('At least 1 steps');
  });
  it('previews valid zero Limit bounds and hides invalid ranges or missing maximums', async () => {
    const {tree} = await renderGoal({
      commitmentType: 'limit',
      minimumValue: 0,
      maximumValue: 0,
      unitLabel: 'cups',
    });
    expect(previewText(tree)).toContain('0 to 0 cups');
    await input(tree, 'Minimum', '2');
    expect(previewText(tree)).toContain('Complete your goal to see a preview');
    await input(tree, 'Maximum', '3');
    expect(previewText(tree)).toContain('2 to 3 cups');
    await input(tree, 'Maximum', '');
    expect(previewText(tree)).toContain('Complete your goal to see a preview');
    expect(preset(tree, 'drinks')).toBeDefined();
  });
  it('disables mode choices, units and amount input while editing is saving', async () => {
    const {tree, changed, draft} = await renderGoal(
      {buildTrackingMode: 'quantity', targetValue: 2, unitLabel: 'minutes'},
      true,
    );
    for (const choice of tree.root.findAllByType(SetupChoice)) {
      expect(choice.findByType(Pressable).props.disabled).toBe(true);
      await act(async () => choice.props.onPress());
    }
    expect(preset(tree, 'pages').props.disabled).toBe(true);
    await act(async () => preset(tree, 'pages').props.onPress());
    for (const field of tree.root.findAllByType(HoystInput)) {
      expect(field.props.editable).toBe(false);
      await act(async () => field.props.onChangeText('9'));
    }
    expect(draft()).toMatchObject({
      buildTrackingMode: 'quantity',
      targetValue: 2,
      unitLabel: 'minutes',
    });
    expect(changed).not.toHaveBeenCalled();
  });
  it('initializes a newly visited numeric type without resetting its cleared unit on return', async () => {
    const {tree, draft} = await renderGoal({
      buildTrackingMode: 'quantity',
      unitLabel: 'pages',
    });
    const changeType = async (
      commitmentType: 'build' | 'limit',
      unitLabel: string,
    ) => {
      await act(async () =>
        tree.root
          .findByType(GoalEditor)
          .props.onChange({...draft(), commitmentType, unitLabel}),
      );
    };
    await changeType('limit', '');
    expect(draft().unitLabel).toBe('minutes');
    await input(tree, 'Unit', '');
    await changeType('build', 'pages');
    await changeType('limit', '');
    expect(draft().unitLabel).toBe('');
  });
  it('does not prefill a locked empty unit', async () => {
    const {draft, changed} = await renderGoal(
      {buildTrackingMode: 'quantity', unitLabel: ''},
      true,
    );
    expect(draft().unitLabel).toBe('');
    expect(changed).not.toHaveBeenCalled();
  });
  it('retains a cleared unit until leaving and initializes it again on a new visit', async () => {
    const first = await renderGoal({
      buildTrackingMode: 'quantity',
      unitLabel: 'minutes',
    });
    await input(first.tree, 'Unit', '');
    expect(first.draft().unitLabel).toBe('');
    const second = await renderGoal(first.draft());
    expect(second.draft().unitLabel).toBe('minutes');
  });
});


describe('Tap In proof setup', () => {
  it('shows a selected Photo proof default and preserves No proof through review and save', async () => {
    seed('proof');
    const tree = await render();
    expect(tree.root.findAllByType(SetupChoice).find(node => node.props.title === 'Photo proof')?.props.selected).toBe(true);
    await choose(tree, 'No proof needed');
    expect(currentRecord().draft.proofRequirement).toBe('none');
    await act(async () => useSetupJourneyStore.getState().update(key, {step: 'review'}));
    expect(JSON.stringify(tree.toJSON())).toContain('No proof needed');
    await act(async () => tree.unmount());
  });
});


it('preserves a pre-proof submitted payload when recovering an uncertain creation', async () => {
  const saved = seed('saveError');
  saved.draft = applyStarter(saved.draft, starters[0]);
  saved.submittedDraft = {...saved.draft};
  delete saved.submittedDraft.proofRequirement;
  saved.status = 'error';
  useSetupJourneyStore.setState({records: {[key]: saved}});
  const tree = await render();
  await press(tree, 'Try again');
  const sent = (createCircle as jest.Mock).mock.calls[0][0];
  expect(sent.requestId).toBe(saved.requestId);
  expect(sent).not.toHaveProperty('proofRequirement');
});
