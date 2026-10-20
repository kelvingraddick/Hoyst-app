import React from 'react';
import {Alert, StyleSheet, Text} from 'react-native';
import renderer, {act} from 'react-test-renderer';

import {HoystButton} from '../src/design/components/HoystButton';
import {HoystInput} from '../src/design/components/HoystInput';
import {CommitmentTypeIcon} from '../src/design/components/CommitmentTypeVisual';
import {
  GoalEditor,
  ProofSelector,
  SetupAppearanceEditor,
  SetupCategoryGrid,
  SetupChoice,
} from '../src/features/create-circle/components/SetupStepContent';
import {SetupJourneyFrame} from '../src/features/create-circle/components/SetupJourneyFrame';
import {TimezonePicker} from '../src/features/auth/components/TimezonePicker';
import {GlassPanel} from '../src/design/components/GlassPanel';
import {getSystemTheme} from '../src/design/system/tokens';
import {EditCircleScreen} from '../src/features/circles/screens/EditCircleScreen';
import type {CircleDetailModel} from '../src/types/models';

const mockUpdateCircle = jest.fn();
let mockDetail: CircleDetailModel | undefined;
let mockAppearance: 'light' | 'dark' = 'light';
const renderedTrees: renderer.ReactTestRenderer[] = [];

jest.mock('@react-native-community/blur', () => {
  const MockReact = require('react');
  const {View} = require('react-native');

  return {
    BlurView: ({children, ...props}: {children?: React.ReactNode}) =>
      MockReact.createElement(View, props, children),
  };
});

jest.mock('react-native-linear-gradient', () => {
  const MockReact = require('react');
  const {View} = require('react-native');

  return ({children, ...props}: {children?: React.ReactNode}) =>
    MockReact.createElement(View, props, children);
});

jest.mock('react-native-safe-area-context', () => {
  const MockReact = require('react');
  const {View} = require('react-native');

  return {
    SafeAreaProvider: ({children}: React.PropsWithChildren) => children,
    SafeAreaView: ({children, ...props}: {children?: React.ReactNode}) =>
      MockReact.createElement(View, props, children),
    useSafeAreaInsets: () => ({bottom: 0, left: 0, right: 0, top: 0}),
  };
});

jest.mock('../src/store/settings-store', () => ({
  useSettingsStore: (
    selector: (state: {appearance: 'light' | 'dark'}) => unknown,
  ) => selector({appearance: mockAppearance}),
}));

jest.mock('../src/store/session-store', () => ({
  useSessionStore: (
    selector: (state: {
      status: 'authenticatedReady';
      user: {uid: string};
    }) => unknown,
  ) => selector({status: 'authenticatedReady', user: {uid: 'user-1'}}),
}));

jest.mock('../src/store/profile-store', () => ({
  useUserProfileStore: (
    selector: (state: {profile: {timezone: string}}) => unknown,
  ) => selector({profile: {timezone: 'UTC'}}),
}));

jest.mock('../src/features/home/services/home-data-service', () => ({
  subscribeToMemberCircleDetail: jest.fn(
    ({onDetail}: {onDetail: (detail: CircleDetailModel) => void}) => {
      if (mockDetail) {
        onDetail(mockDetail);
      }
      return jest.fn();
    },
  ),
}));

jest.mock('../src/features/circles/services/circle-service', () => ({
  updateCircle: (...args: unknown[]) => mockUpdateCircle(...args),
}));

function detail(overrides: Partial<CircleDetailModel> = {}): CircleDetailModel {
  return {
    activity: [],
    category: 'Fitness',
    circleMode: 'group',
    commitment: 'Move for 30 minutes',
    commitmentCadence: 'daily',
    commitmentFrequency: {tapInsPerWeek: 7},
    commitmentLabel: 'Commitment: Move for 30 minutes',
    commitmentType: 'build',
    completionRate: 60,
    graceRules: {skip: {allowance: 2, windowDays: 7}},
    groupProgressDays: [],
    id: 'circle-1',
    inviteUrl: 'https://hoyst.app/join/circle-1',
    joinLabel: 'Open seats',
    joinMode: 'open',
    matchCopy: 'A steady crew for movement.',
    maxSize: 8,
    memberCount: 5,
    members: [],
    monthProgress: [],
    nudgeTargetCount: 0,
    privacy: 'public',
    progressLabel: 'Today 60%',
    progressPercent: 60,
    remainingCheckIns: 2,
    state: 'active',
    stepValue: 1,
    streakDays: 3,
    streakLabel: '3d streak',
    targetValue: 1,
    title: 'Morning Movers',
    timezone: 'UTC',
    unitLabel: 'Tap In',
    viewerHasCheckedIn: false,
    viewerHasTappedInToday: false,
    viewerMembershipStatus: 'active',
    viewerRemainingTapIns: 1,
    viewerRole: 'owner',
    viewerTodayStatus: 'rest',
    ...overrides,
  };
}

function renderScreen(nextDetail?: CircleDetailModel) {
  mockDetail = nextDetail;
  let beforeRemove:
    | ((event: {
        data: {action: {type: string}};
        preventDefault: jest.Mock;
      }) => void)
    | undefined;
  const navigation = {
    addListener: jest.fn((eventName, listener) => {
      if (eventName === 'beforeRemove') {
        beforeRemove = listener;
      }
      return jest.fn();
    }),
    dispatch: jest.fn(),
    goBack: jest.fn(),
  };
  let tree: renderer.ReactTestRenderer | undefined;

  act(() => {
    tree = renderer.create(
      <EditCircleScreen
        navigation={navigation as never}
        route={
          {
            key: 'EditCircle',
            name: 'EditCircle',
            params: {circleId: 'circle-1'},
          } as never
        }
      />,
    );
  });

  renderedTrees.push(tree!);
  return {beforeRemove: () => beforeRemove, navigation, tree: tree!};
}

function choice(tree: renderer.ReactTestRenderer, title: string) {
  return tree.root
    .findAllByType(SetupChoice)
    .find(node => node.props.title === title)!;
}
function saveButton(tree: renderer.ReactTestRenderer) {
  return tree.root
    .findAllByType(HoystButton)
    .find(
      node =>
        node.props.label === 'Save changes' || node.props.label === 'Saving...',
    )!;
}

describe('EditCircleScreen refresh', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockAppearance = 'light';
    jest
      .spyOn(require('react-native'), 'useWindowDimensions')
      .mockReturnValue({width: 390, height: 844, scale: 3, fontScale: 1});
    mockUpdateCircle.mockResolvedValue(undefined);
  });

  afterEach(() => {
    act(() => renderedTrees.splice(0).forEach(tree => tree.unmount()));
    jest.restoreAllMocks();
  });

  it('uses Personal terminology and hides group-only settings', () => {
    const {tree} = renderScreen(
      detail({
        circleMode: 'personal',
        commitment: 'Read every day',
        joinMode: 'invite_only',
        maxSize: 1,
        memberCount: 1,
        privacy: 'private',
        title: 'Read every day',
      }),
    );
    const output = JSON.stringify(tree.toJSON());

    expect(output).toContain('Edit Commitment');
    expect(output).toContain('Basics');
    expect(output).toContain('Commitment rules');
    expect(output).toContain('Pace and timing');
    expect(output).not.toContain('Skips');
    expect(output).not.toContain('Allow Skips');
    expect(output).not.toContain('Access and capacity');
    expect(output).not.toContain('Circle Progress');
    expect(output).not.toContain('Members');
    expect(
      ['Build', 'Limit', 'Avoid'].map(
        title =>
          choice(tree, title).findByType(CommitmentTypeIcon).props
            .commitmentType,
      ),
    ).toEqual(['build', 'limit', 'avoid']);
    expect(
      tree.root
        .findAllByType(HoystButton)
        .find(button => button.props.label === 'Save changes')?.props.disabled,
    ).toBe(true);
  });

  it('shares the grouped unit editor and labeled preview while retaining a custom numeric unit', async () => {
    const {tree} = renderScreen(
      detail({
        buildTrackingMode: 'quantity',
        targetValue: 1,
        unitLabel: 'laps',
      }),
    );
    const group = tree.root.findByProps({testID: 'goal-unit-group'});
    expect(group.findByType(HoystInput).props.value).toBe('laps');
    expect(
      tree.root
        .findByProps({testID: 'goal-preview'})
        .findAllByType(require('react-native').Text)
        .some(node => node.props.children === 'Tap In preview'),
    ).toBe(true);
    const pages = group
      .findAllByType(require('react-native').Pressable)
      .find(node => node.props.accessibilityLabel === 'pages')!;
    await act(async () => pages.props.onPress());
    expect(
      tree.root.findByProps({testID: 'goal-unit-group'}).findByType(HoystInput)
        .props.value,
    ).toBe('pages');
  });

  it('shows group access, capacity, and member-cap validation', () => {
    const {tree} = renderScreen(detail());
    let output = JSON.stringify(tree.toJSON());

    expect(output).toContain('Edit Circle');
    expect(output).toContain('Access and capacity');
    expect(choice(tree, 'Public').props.selected).toBe(true);
    expect(choice(tree, 'Open seats').props.selected).toBe(true);

    const decrease = () =>
      act(() =>
        tree.root
          .findByProps({accessibilityLabel: 'Decrease Maximum Members'})
          .props.onPress(),
      );
    decrease();
    decrease();
    decrease();
    decrease();
    output = JSON.stringify(tree.toJSON());

    expect(output).toContain('Max size cannot be below 5 current Members.');
    expect(saveButton(tree).props.disabled).toBe(true);
  });

  it.each(['light', 'dark'] as const)(
    'uses the onboarding frame and blue action in %s',
    appearance => {
      mockAppearance = appearance;
      const {tree} = renderScreen(detail());
      const frame = tree.root.findByType(SetupJourneyFrame);
      expect(frame.props.phase).toBeUndefined();
      expect(frame.props.message).toBeUndefined();
      expect(frame.props.onLater).toBeUndefined();
      expect(tree.root.findAllByType(GlassPanel)).toHaveLength(0);
      expect(JSON.stringify(tree.toJSON())).not.toContain('Owner settings');
      expect(saveButton(tree).props.backgroundColor).toBe(
        getSystemTheme(appearance).actionFill,
      );
      const heading = tree.root
        .findAllByType(Text)
        .find(node => node.props.children === 'Edit Circle')!;
      expect(StyleSheet.flatten(heading.props.style)).toMatchObject({
        fontSize: 24,
        lineHeight: 29,
      });
    },
  );

  it('scales edit headings and choice descriptions at enlarged text sizes', () => {
    jest
      .spyOn(require('react-native'), 'useWindowDimensions')
      .mockReturnValue({width: 320, height: 640, scale: 3, fontScale: 2});
    const {tree} = renderScreen(detail());
    const text = (value: string) =>
      tree.root
        .findAllByType(Text)
        .find(node => node.props.children === value)!;
    expect(StyleSheet.flatten(text('Edit Circle').props.style)).toMatchObject({
      fontSize: 48,
      lineHeight: 58,
    });
    expect(StyleSheet.flatten(text('Basics').props.style)).toMatchObject({
      fontSize: 36,
      lineHeight: 46,
    });
    expect(
      StyleSheet.flatten(text('Set your Tap Ins per week.').props.style),
    ).toMatchObject({fontSize: 28, lineHeight: 40});
    expect(text('Basics').props.allowFontScaling).toBe(false);
  });

  it.each([undefined, detail({viewerRole: 'member'})])(
    'uses the same frame for loading and owner restrictions',
    nextDetail => {
      const {tree, navigation} = renderScreen(nextDetail);
      expect(
        tree.root.findByType(SetupJourneyFrame).props.primary,
      ).toBeUndefined();
      expect(tree.root.findAllByType(SetupChoice)).toHaveLength(0);
      expect(JSON.stringify(tree.toJSON())).toContain(
        nextDetail ? 'Only the circle owner' : 'Loading owner settings',
      );
      act(() => tree.root.findByType(SetupJourneyFrame).props.onBack());
      expect(navigation.goBack).toHaveBeenCalled();
    },
  );

  it('retains the draft when fields, category, and appearance change', async () => {
    const {tree} = renderScreen(detail());
    act(() =>
      tree.root.findByType(SetupCategoryGrid).props.onChange('Learning'),
    );
    act(() => {
      const editor = tree.root.findByType(SetupAppearanceEditor);
      editor.props.onChange({
        ...editor.props.draft,
        appearance: {emoji: '📚', palette: 'blue'},
      });
    });
    act(() =>
      tree.root
        .findAllByType(HoystInput)
        .find(input => input.props.accessibilityLabel === 'Circle name')!
        .props.onChangeText('Study crew'),
    );
    await act(async () => saveButton(tree).props.onPress());
    expect(mockUpdateCircle).toHaveBeenCalledWith(
      expect.objectContaining({
        circleId: 'circle-1',
        category: 'Learning',
        title: 'Study crew',
        commitment: 'Move for 30 minutes',
        appearance: {emoji: '📚', palette: 'blue'},
      }),
    );
  });

  it('keeps invalid fields unsavable and enables save after correction', () => {
    const {tree} = renderScreen(detail());
    const name = () =>
      tree.root
        .findAllByType(HoystInput)
        .find(input => input.props.accessibilityLabel === 'Circle name')!;
    act(() => name().props.onChangeText(''));
    expect(saveButton(tree).props.disabled).toBe(true);
    act(() => name().props.onChangeText('New name'));
    expect(saveButton(tree).props.disabled).toBe(false);
    act(() =>
      tree.root.findByType(TimezonePicker).props.onChange('Invalid/Timezone'),
    );
    expect(saveButton(tree).props.disabled).toBe(true);
  });

  it('preserves privacy normalization and shows joining rules only for public Circles', async () => {
    const {tree} = renderScreen(detail());
    act(() => choice(tree, 'Private').props.onPress());
    expect(choice(tree, 'Private').props.selected).toBe(true);
    expect(choice(tree, 'Open seats')).toBeUndefined();
    act(() => choice(tree, 'Public').props.onPress());
    expect(choice(tree, 'Request approval').props.selected).toBe(true);
    act(() => choice(tree, 'Link-only').props.onPress());
    expect(choice(tree, 'Request approval')).toBeUndefined();
    await act(async () => saveButton(tree).props.onPress());
    expect(mockUpdateCircle).toHaveBeenCalledWith(
      expect.objectContaining({
        privacy: 'private',
        joinMode: 'invite_only',
      }),
    );
  });

  it('preserves cadence defaults and saves an adjusted monthly frequency', async () => {
    const {tree} = renderScreen(detail());
    act(() => choice(tree, 'Weekly').props.onPress());
    expect(
      tree.root.findByType(GoalEditor).props.draft.commitmentFrequency
        .tapInsPerWeek,
    ).toBe(4);
    expect(
      tree.root.findByProps({accessibilityLabel: 'Increase Tap Ins per week'}),
    ).toBeDefined();
    act(() => choice(tree, 'Monthly').props.onPress());
    expect(
      tree.root.findByType(GoalEditor).props.draft.commitmentFrequency
        .opportunitiesPerPeriod,
    ).toBe(16);
    expect(
      tree.root.findAllByProps({
        accessibilityLabel: 'Increase Tap Ins per week',
      }),
    ).toHaveLength(0);
    act(() =>
      tree.root
        .findByProps({accessibilityLabel: 'Increase Tap Ins per month'})
        .props.onPress(),
    );
    await act(async () => saveButton(tree).props.onPress());
    expect(mockUpdateCircle).toHaveBeenCalledWith(
      expect.objectContaining({
        commitmentCadence: 'monthly',
        commitmentFrequency: {opportunitiesPerPeriod: 17, tapInsPerWeek: 7},
      }),
    );
  });

  it('preserves proof selection, saving feedback, and retry after failure', async () => {
    const {tree, navigation, beforeRemove} = renderScreen(
      detail({proofRequirement: 'none'}),
    );
    expect(choice(tree, 'No proof needed').props.selected).toBe(true);
    act(() => choice(tree, 'Photo proof').props.onPress());
    let rejectSave: (error: Error) => void = () => undefined;
    mockUpdateCircle.mockImplementationOnce(
      () =>
        new Promise((_resolve, reject) => {
          rejectSave = reject;
        }),
    );
    const alert = jest.spyOn(Alert, 'alert').mockImplementation(jest.fn());
    act(() => {
      saveButton(tree).props.onPress();
    });
    expect(saveButton(tree).props.label).toBe('Saving...');
    expect(saveButton(tree).props.disabled).toBe(true);
    expect(tree.root.findByType(ProofSelector).props.disabled).toBe(true);
    await act(async () => rejectSave(new Error('Try again')));
    expect(alert).toHaveBeenCalledWith('Save failed', 'Try again');
    expect(navigation.goBack).not.toHaveBeenCalled();
    expect(saveButton(tree).props.disabled).toBe(false);
    const event = {
      data: {action: {type: 'GO_BACK'}},
      preventDefault: jest.fn(),
    };
    act(() => beforeRemove()?.(event));
    expect(event.preventDefault).toHaveBeenCalled();
    await act(async () => saveButton(tree).props.onPress());
    expect(mockUpdateCircle).toHaveBeenLastCalledWith(
      expect.objectContaining({proofRequirement: 'photo'}),
    );
    expect(navigation.goBack).toHaveBeenCalled();
  });

  it('dispatches the requested navigation action only when dirty changes are discarded', () => {
    const {tree, beforeRemove, navigation} = renderScreen(detail());
    act(() =>
      tree.root
        .findAllByType(HoystInput)
        .find(input => input.props.multiline)!
        .props.onChangeText('Changed commitment'),
    );
    const alert = jest.spyOn(Alert, 'alert').mockImplementation(jest.fn());
    const action = {type: 'GO_BACK'};
    act(() => beforeRemove()?.({data: {action}, preventDefault: jest.fn()}));
    expect(navigation.dispatch).not.toHaveBeenCalled();
    const discard = alert.mock.calls[0][2]!.find(
      button => button.text === 'Discard',
    )!;
    act(() => discard.onPress!());
    expect(navigation.dispatch).toHaveBeenCalledWith(action);
  });

  it('allows an untouched edit form to close without a warning', () => {
    const {beforeRemove} = renderScreen(detail());
    const event = {
      data: {action: {type: 'GO_BACK'}},
      preventDefault: jest.fn(),
    };

    act(() => beforeRemove()?.(event));
    expect(event.preventDefault).not.toHaveBeenCalled();
  });

  it('warns on dirty back and bypasses the warning after save', async () => {
    const alertSpy = jest.spyOn(Alert, 'alert').mockImplementation(jest.fn());
    const {beforeRemove, navigation, tree} = renderScreen(
      detail({
        circleMode: 'personal',
        commitment: 'Read every day',
        joinMode: 'invite_only',
        maxSize: 1,
        memberCount: 1,
        privacy: 'private',
        title: 'Read every day',
      }),
    );
    const commitmentInput = tree.root
      .findAllByType(HoystInput)
      .find(input => input.props.multiline);

    if (!commitmentInput) {
      throw new Error('Commitment input not found');
    }

    act(() => commitmentInput.props.onChangeText('Read for 20 minutes'));
    const event = {
      data: {action: {type: 'GO_BACK'}},
      preventDefault: jest.fn(),
    };
    act(() => beforeRemove()?.(event));
    expect(event.preventDefault).toHaveBeenCalled();
    expect(alertSpy).toHaveBeenCalledWith(
      'Discard changes?',
      'Your unsaved changes will be lost.',
      expect.any(Array),
    );

    const save = tree.root
      .findAllByType(HoystButton)
      .find(button => button.props.label === 'Save changes');
    if (!save) {
      throw new Error('Save button not found');
    }
    await act(async () => {
      save.props.onPress();
      await Promise.resolve();
    });

    expect(mockUpdateCircle).toHaveBeenCalledWith(
      expect.objectContaining({
        circleId: 'circle-1',
        circleMode: 'personal',
        commitment: 'Read for 20 minutes',
      }),
    );
    expect(navigation.goBack).toHaveBeenCalled();

    const postSaveEvent = {
      data: {action: {type: 'GO_BACK'}},
      preventDefault: jest.fn(),
    };
    act(() => beforeRemove()?.(postSaveEvent));
    expect(postSaveEvent.preventDefault).not.toHaveBeenCalled();
    alertSpy.mockRestore();
  });
});
