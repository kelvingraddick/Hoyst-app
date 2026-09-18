import React from 'react';
import {StyleSheet, TouchableWithoutFeedback} from 'react-native';
import renderer, {act} from 'react-test-renderer';

import {CircleCategoryIcon} from '../src/design/components/CircleCategoryIcon';
import {HomeCommitmentStack} from '../src/features/home/components/HomeCommitmentStack';
import type {CircleManagementCard} from '../src/types/models';

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

function renderCards(
  cards: CircleManagementCard[],
  focusedCardId?: string,
  busy = false,
) {
  const onActionPress = jest.fn();
  const onFocusCard = jest.fn();
  const onViewDetails = jest.fn();
  let tree!: renderer.ReactTestRenderer;
  act(() => {
    tree = renderer.create(
      <HomeCommitmentStack
        cards={cards}
        focusedCardId={focusedCardId}
        isNudged={() => false}
        isNudging={() => busy}
        onActionPress={onActionPress}
        onFocusCard={onFocusCard}
        onViewDetails={onViewDetails}
      />,
    );
  });
  return {tree, onActionPress, onFocusCard, onViewDetails};
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
  it('offers direct actions on expanded and compact rows without recording completion', () => {
    const first = circle();
    const second = circle({id: 'second'});
    const {tree, onActionPress, onFocusCard} = renderCards([first, second]);
    act(() => {
      tree.root
        .findByProps({testID: 'home-commitment-action-second'})
        .props.onPress();
    });
    expect(onActionPress).toHaveBeenCalledWith(second);
    expect(onFocusCard).not.toHaveBeenCalled();
    expect(
      tree.root.findAllByProps({testID: 'home-commitment-done-second'}),
    ).toHaveLength(0);
  });
  it('shows cycle progress on the expanded card without changing collapsed cards', () => {
    const {tree} = renderCards([
      circle({
        commitmentCadence: 'weekly',
        cycleCoveredCount: 5,
        cycleRequiredCount: 6,
        id: 'weekly-group',
        members: [
          {
            cycleGoalMet: true,
            id: 'member-1',
            initials: 'M1',
            name: 'Member One',
            state: 'done',
          },
          {
            cycleGoalMet: false,
            id: 'member-2',
            initials: 'M2',
            name: 'Member Two',
            state: 'pending',
          },
        ],
        title: 'Weekly Group',
      }),
      circle({
        circleMode: 'personal',
        cycleCoveredCount: 0,
        cycleRequiredCount: 1,
        id: 'daily-personal',
        title: 'Daily Personal',
      }),
    ]);
    const output = JSON.stringify(tree.toJSON());

    expect(output).toContain('1/2 members met goal this week');
    expect(output).not.toContain('Goal not met today');
    expect(output).toContain('Needs your Tap In');
    expect(
      tree.root.findByProps({
        testID: 'home-commitment-collapsed-daily-personal',
      }).props.accessibilityLabel,
    ).toBe('Expand Daily Personal. Needs your Tap In');
  });
  it('keeps focus and detail navigation separate from submitting an action', () => {
    const second = circle({id: 'second'});
    const {tree, onFocusCard, onViewDetails, onActionPress} = renderCards([
      circle(),
      second,
    ]);
    act(() =>
      tree.root
        .findByProps({testID: 'home-commitment-collapsed-second'})
        .props.onPress(),
    );
    expect(onFocusCard).toHaveBeenCalledWith('second');
    act(() =>
      tree.root
        .findByProps({testID: 'home-commitment-expand-second'})
        .props.onPress(),
    );
    expect(onFocusCard).toHaveBeenCalledTimes(2);
    act(() =>
      tree.root
        .findByProps({testID: 'home-commitment-details-circle-1'})
        .props.onPress(),
    );
    expect(onViewDetails).toHaveBeenCalledWith('circle-1');
    expect(onActionPress).not.toHaveBeenCalled();

    act(() => tree.root.findByType(TouchableWithoutFeedback).props.onPress());
    expect(onViewDetails).toHaveBeenCalledTimes(2);
    expect(
      tree.root.findByProps({
        testID: 'home-commitment-detail-arrow-circle-1',
      }),
    ).toBeTruthy();
    const categoryIcons = tree.root.findAllByType(CircleCategoryIcon);
    expect(categoryIcons[0].props.showBackplate).toBe(false);
    expect(categoryIcons[1].props.showBackplate).toBeUndefined();
    expect(
      StyleSheet.flatten(
        tree.root.findByProps({testID: 'home-commitment-focused-circle-1'})
          .props.style,
      ),
    ).toMatchObject({paddingHorizontal: 18, paddingVertical: 12});

    act(() =>
      tree.root
        .findByProps({testID: 'home-commitment-action-circle-1'})
        .props.onPress(),
    );
    expect(onActionPress).toHaveBeenCalledWith(circle());
    expect(onViewDetails).toHaveBeenCalledTimes(2);
  });
  it("shows a personal commitment's actual category in the focused card", () => {
    const {tree} = renderCards([circle({circleMode: 'personal'})]);
    const output = JSON.stringify(tree.toJSON());

    expect(output).toContain('FITNESS');
    expect(output).not.toContain('PERSONAL COMMITMENT');
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
  it('keeps completed and pending rows compact and without submission controls', () => {
    const {tree} = renderCards([
      circle({viewerHasTappedInToday: true}),
      circle({id: 'pending', viewerMembershipStatus: 'pending'}),
    ]);
    expect(
      tree.root.findAllByProps({testID: 'home-commitment-action-circle-1'}),
    ).toHaveLength(0);
    expect(
      tree.root.findAllByProps({testID: 'home-commitment-focused-circle-1'}),
    ).toHaveLength(0);
    expect(
      tree.root.findByProps({testID: 'home-commitment-collapsed-pending'}).props
        .accessibilityLabel,
    ).toContain('Pending approval');
  });
  it.each([
    {viewerHasTappedInToday: true},
    {viewerMembershipStatus: 'pending' as const},
  ])('allows intentional expansion of a non-actionable row: %p', overrides => {
    const card = circle(overrides);
    const {tree, onViewDetails, onActionPress} = renderCards([card], card.id);
    expect(
      tree.root.findByProps({testID: 'home-commitment-focused-circle-1'}),
    ).toBeTruthy();
    expect(JSON.stringify(tree.toJSON())).toContain(card.commitment);
    expect(
      tree.root.findAllByProps({testID: 'home-commitment-action-circle-1'}),
    ).toHaveLength(0);
    act(() =>
      tree.root
        .findByProps({testID: 'home-commitment-details-circle-1'})
        .props.onPress(),
    );
    expect(onViewDetails).toHaveBeenCalledWith(card.id);
    expect(onActionPress).not.toHaveBeenCalled();
  });
  it('expands completed and pending rows through either content or chevron', () => {
    const {tree, onFocusCard, onActionPress, onViewDetails} = renderCards([
      circle({viewerHasTappedInToday: true}),
      circle({id: 'pending', viewerMembershipStatus: 'pending'}),
    ]);
    act(() => {
      tree.root
        .findByProps({testID: 'home-commitment-collapsed-circle-1'})
        .props.onPress();
      tree.root
        .findByProps({testID: 'home-commitment-expand-pending'})
        .props.onPress();
    });
    expect(onFocusCard.mock.calls).toEqual([['circle-1'], ['pending']]);
    expect(onActionPress).not.toHaveBeenCalled();
    expect(onViewDetails).not.toHaveBeenCalled();
  });
  it('disables the primary action while a Nudge is sending', () => {
    const {tree} = renderCards(
      [circle({viewerHasTappedInToday: true, nudgeTargetCount: 2})],
      undefined,
      true,
    );
    expect(
      tree.root.findByProps({testID: 'home-commitment-action-circle-1'}).props
        .accessibilityState,
    ).toEqual({disabled: true, busy: true});
  });
  it('keeps full descriptions and long compact titles readable in dark mode', () => {
    mockAppearance = 'dark';
    const longTitle = 'A long personal commitment with a meaningful full title';
    const {tree} = renderCards([
      circle(),
      circle({id: 'long', title: longTitle}),
    ]);
    expect(JSON.stringify(tree.toJSON())).toContain(longTitle);
    expect(JSON.stringify(tree.toJSON())).toContain('Move for 30 minutes');
  });
});
