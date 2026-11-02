import React from 'react';
import {StyleSheet} from 'react-native';
import renderer, {act} from 'react-test-renderer';

import {CommitmentCardHeader} from '../src/design/components/CommitmentCardSurface';
import {HomeCommitmentStack} from '../src/features/home/components/HomeCommitmentStack';
import type {CircleManagementCard} from '../src/types/models';

jest.mock('react-native-linear-gradient', () => {
  const {View} = require('react-native');
  return View;
});

jest.mock('react-native-haptic-feedback', () => ({
  trigger: jest.fn(),
}));

jest.mock('../src/store/settings-store', () => ({
  useSettingsStore: (
    selector: (state: {appearance: 'dark' | 'light'}) => unknown,
  ) => selector({appearance: mockAppearance}),
}));

let mockAppearance: 'dark' | 'light' = 'light';

function circle(
  overrides: Partial<CircleManagementCard> = {},
): CircleManagementCard {
  return {
    category: 'Fitness',
    commitment: 'Move for 30 minutes',
    commitmentCadence: 'daily',
    commitmentFrequency: {tapInsPerWeek: 7},
    completionRate: 0,
    cycleCoveredCount: 0,
    cycleRequiredCount: 1,
    id: 'circle-1',
    inviteUrl: undefined,
    joinMode: 'invite_only',
    maxSize: 4,
    memberCount: 1,
    members: [],
    privacy: 'private',
    progressPercent: 0,
    remainingCheckIns: 1,
    state: 'active',
    streakDays: 0,
    streakLabel: 'Start today',
    title: 'Morning Movement',
    viewerHasCheckedIn: false,
    viewerHasTappedInToday: false,
    viewerMembershipStatus: 'active',
    viewerRemainingTapIns: 1,
    viewerRole: 'member',
    viewerTodayStatus: undefined,
    ...overrides,
  };
}

function renderCards(cards: CircleManagementCard[], busy = false) {
  const onActionPress = jest.fn();
  const onViewDetails = jest.fn();
  let tree!: renderer.ReactTestRenderer;
  act(() => {
    tree = renderer.create(
      <HomeCommitmentStack
        cards={cards}
        isNudged={() => false}
        isNudging={() => busy}
        onActionPress={onActionPress}
        onViewDetails={onViewDetails}
      />,
    );
  });
  return {tree, onActionPress, onViewDetails};
}

describe('Home commitment actions', () => {
  beforeEach(() => {
    mockAppearance = 'light';
  });
  it.each([
    {
      commitmentType: 'build' as const,
      targetValue: 20,
      unitLabel: 'minutes',
      expected: 'Goal: 20 minutes',
    },
    {
      commitmentType: 'limit' as const,
      maximumValue: 2,
      unitLabel: 'hours',
      expected: 'Maximum: 2 hours',
    },
    {
      commitmentType: 'limit' as const,
      minimumValue: 2,
      maximumValue: 6,
      unitLabel: 'cups',
      expected: 'Allowed range: 2 to 6 cups',
    },
    {
      commitmentCadence: 'weekly' as const,
      commitmentFrequency: {tapInsPerWeek: 4},
      commitmentType: 'build' as const,
      targetValue: 20,
      unitLabel: 'minutes',
      expected: 'Goal: 4 Tap Ins per week · 20 minutes per Tap In',
    },
  ])('shows the goal beneath the focused description: %p', data => {
    const {tree} = renderCards([circle(data)]);
    const goal = tree.root.findByProps({
      testID: 'home-commitment-goal-circle-1',
    });
    expect(
      goal
        .findAllByType(require('../src/design/components/HoystText').HoystText)
        .map(node => node.props.children)
        .join(''),
    ).toBe(
      data.expected.startsWith('Goal:')
        ? data.expected
        : data.expected.replace(': ', ' · '),
    );
    expect(
      goal
        .findAllByType(require('../src/design/components/HoystText').HoystText)
        .map(node => StyleSheet.flatten(node.props.style).fontWeight),
    ).toEqual(['600', '600', '600']);
    expect(
      goal.parent!.findAllByType(
        require('../src/design/components/HoystText').HoystText,
      )[0].props.children,
    ).toBe('Move for 30 minutes');
  });
  it('does not add a quantity goal to simple or Avoid commitments', () => {
    for (const commitmentType of ['build', 'avoid'] as const) {
      const {tree} = renderCards([circle({commitmentType})]);
      expect(
        tree.root.findAllByProps({testID: 'home-commitment-goal-circle-1'}),
      ).toHaveLength(0);
    }
  });
  it('shows a cadence goal for a simple monthly commitment', () => {
    const {tree} = renderCards([
      circle({
        commitmentCadence: 'monthly',
        commitmentFrequency: {
          opportunitiesPerPeriod: 4,
          tapInsPerWeek: 4,
        },
        commitmentType: 'avoid',
      }),
    ]);
    const goal = tree.root.findByProps({
      testID: 'home-commitment-goal-circle-1',
    });
    expect(
      goal
        .findAllByType(require('../src/design/components/HoystText').HoystText)
        .map(node => node.props.children)
        .join(''),
    ).toBe('Goal: 4 Tap Ins per month');
  });
  it('renders every actionable card expanded and keeps action presses independent', () => {
    const second = circle({id: 'second'});
    const {tree, onActionPress, onViewDetails} = renderCards([
      circle(),
      second,
    ]);
    expect(tree.root.findAllByType(CommitmentCardHeader)).toHaveLength(2);
    expect(JSON.stringify(tree.toJSON())).not.toContain(
      'home-commitment-collapsed',
    );
    act(() =>
      tree.root
        .findByProps({testID: 'home-commitment-action-second'})
        .props.onPress(),
    );
    expect(onActionPress).toHaveBeenCalledWith(second);
    expect(onViewDetails).not.toHaveBeenCalled();
    act(() =>
      tree.root
        .findByProps({testID: 'home-commitment-details-circle-1'})
        .props.onPress(),
    );
    expect(onViewDetails).toHaveBeenCalledWith('circle-1');
    expect(onActionPress).toHaveBeenCalledTimes(1);
  });
  it('shows each card’s own cycle progress without inventing group data for personal commitments', () => {
    const {tree} = renderCards([
      circle({
        commitmentCadence: 'weekly',
        cycleCoveredCount: 5,
        cycleRequiredCount: 6,
        members: [
          {
            cycleGoalMet: true,
            id: 'm1',
            initials: 'M1',
            name: 'One',
            state: 'done',
          },
          {
            cycleGoalMet: false,
            id: 'm2',
            initials: 'M2',
            name: 'Two',
            state: 'pending',
          },
        ],
      }),
      circle({
        id: 'personal',
        circleMode: 'personal',
        cycleCoveredCount: 0,
        cycleRequiredCount: 1,
      }),
    ]);
    expect(JSON.stringify(tree.toJSON())).toContain(
      '1/2 members met goal this week',
    );
    const personal = tree.root.findByProps({
      testID: 'home-commitment-card-personal',
    });
    expect(
      personal.findAllByType(
        require('../src/design/components/LayeredAvatar').LayeredAvatar,
      ),
    ).toHaveLength(0);
  });
  it.each(['partial', 'failed', 'skip', 'done'] as const)(
    'offers Nudge after a saved %s result',
    status => {
      const card = circle({
        viewerHasTappedInToday: true,
        viewerTodayStatus: status,
        viewerCanUpdateTapIn: true,
        nudgeTargetCount: 2,
      });
      const {tree, onActionPress} = renderCards([card]);
      const action = tree.root.findByProps({
        testID: 'home-commitment-action-circle-1',
      });
      expect(action.props.accessibilityLabel).toBe(
        'Nudge for Morning Movement',
      );
      act(() => action.props.onPress());
      expect(onActionPress).toHaveBeenCalledWith(card);
    },
  );
  it('keeps completed and pending cards expanded with details and no submission controls', () => {
    const {tree, onViewDetails, onActionPress} = renderCards([
      circle({viewerHasTappedInToday: true}),
      circle({id: 'pending', viewerMembershipStatus: 'pending'}),
    ]);
    expect(tree.root.findAllByType(CommitmentCardHeader)).toHaveLength(2);
    expect(
      tree.root.findAll(
        node => node.props.accessibilityState?.expanded === false,
      ),
    ).toHaveLength(0);
    expect(
      tree.root.findAllByProps({testID: 'home-commitment-action-circle-1'}),
    ).toHaveLength(0);
    expect(
      tree.root.findAllByProps({testID: 'home-commitment-action-pending'}),
    ).toHaveLength(0);
    expect(JSON.stringify(tree.toJSON())).toContain('Pending approval');
    act(() =>
      tree.root
        .findByProps({testID: 'home-commitment-details-pending'})
        .props.onPress(),
    );
    expect(onViewDetails).toHaveBeenCalledWith('pending');
    expect(onActionPress).not.toHaveBeenCalled();
  });
  it('does not collapse or hide another card when work finishes', () => {
    const first = circle();
    const second = circle({id: 'second'});
    const {tree} = renderCards([first, second]);
    const props = tree.root.findByType(HomeCommitmentStack)
      .props as React.ComponentProps<typeof HomeCommitmentStack>;
    act(() =>
      tree.update(
        <HomeCommitmentStack
          {...props}
          cards={[{...first, viewerHasTappedInToday: true}, second]}
        />,
      ),
    );
    expect(tree.root.findAllByType(CommitmentCardHeader)).toHaveLength(2);
    expect(
      tree.root.findAllByProps({testID: 'home-commitment-action-circle-1'}),
    ).toHaveLength(0);
    expect(
      tree.root.findByProps({testID: 'home-commitment-action-second'}),
    ).toBeTruthy();
  });
  it('disables the primary action while a Nudge is sending', () => {
    const {tree} = renderCards(
      [circle({viewerHasTappedInToday: true, nudgeTargetCount: 2})],
      true,
    );
    expect(
      tree.root.findByProps({testID: 'home-commitment-action-circle-1'}).props
        .accessibilityState,
    ).toEqual({disabled: true, busy: true});
  });
  it('keeps personal category and long titles readable in dark mode', () => {
    mockAppearance = 'dark';
    const title = 'A long personal commitment with a meaningful full title';
    const {tree} = renderCards([circle({circleMode: 'personal', title})]);
    const output = JSON.stringify(tree.toJSON());
    expect(output).toContain(title);
    expect(output).toContain('FITNESS');
    expect(output).toContain('Move for 30 minutes');
    expect(
      tree.root.findByType(CommitmentCardHeader).props.colors.surface,
    ).toBe('#242428');
  });
});
