import React from 'react';
import {Alert} from 'react-native';
import renderer, {act} from 'react-test-renderer';

import {HoystButton} from '../src/design/components/HoystButton';
import {HoystInput} from '../src/design/components/HoystInput';
import {CommitmentTypeIcon} from '../src/design/components/CommitmentTypeVisual';
import {EditCircleScreen} from '../src/features/circles/screens/EditCircleScreen';
import type {CircleDetailModel} from '../src/types/models';

const mockUpdateCircle = jest.fn();
let mockDetail: CircleDetailModel;

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
    SafeAreaView: ({children, ...props}: {children?: React.ReactNode}) =>
      MockReact.createElement(View, props, children),
    useSafeAreaInsets: () => ({bottom: 0, left: 0, right: 0, top: 0}),
  };
});

jest.mock('../src/store/settings-store', () => ({
  useSettingsStore: (selector: (state: {appearance: 'light'}) => unknown) =>
    selector({appearance: 'light'}),
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
      onDetail(mockDetail);
      return jest.fn();
    },
  ),
}));

jest.mock('../src/features/circles/services/circle-service', () => ({
  updateCircle: (...args: unknown[]) => mockUpdateCircle(...args),
}));

function detail(
  overrides: Partial<CircleDetailModel> = {},
): CircleDetailModel {
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

function renderScreen(nextDetail: CircleDetailModel) {
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

  return {beforeRemove: () => beforeRemove, navigation, tree: tree!};
}

describe('EditCircleScreen refresh', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockUpdateCircle.mockResolvedValue(undefined);
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
    expect(output).toContain('Rhythm and timing');
    expect(output).toContain('Skips');
    expect(output).toContain('your Progression');
    expect(output).not.toContain('Access and capacity');
    expect(output).not.toContain('Circle Progression');
    expect(output).not.toContain('members');
    expect(
      tree.root
        .findAllByType(CommitmentTypeIcon)
        .map(icon => icon.props.commitmentType),
    ).toEqual(['build', 'limit', 'avoid']);
    expect(
      tree.root
        .findAllByType(HoystButton)
        .find(button => button.props.label === 'Save changes')?.props.disabled,
    ).toBe(true);
  });

  it('shows group access, capacity, and member-cap validation', () => {
    const {tree} = renderScreen(detail());
    let output = JSON.stringify(tree.toJSON());

    expect(output).toContain('Edit Circle');
    expect(output).toContain('Access and capacity');
    expect(output).toContain('Public · Open seats');

    const decrease = () =>
      act(() =>
        tree.root
          .findByProps({accessibilityLabel: 'Decrease Maximum members'})
          .props.onPress(),
      );
    decrease();
    decrease();
    decrease();
    decrease();
    output = JSON.stringify(tree.toJSON());

    expect(output).toContain('Max size cannot be below 5 current members.');
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
