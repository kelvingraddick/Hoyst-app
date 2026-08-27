import React from 'react';
import {Clock3} from 'lucide-react-native';
import {StyleSheet} from 'react-native';
import renderer, {act} from 'react-test-renderer';

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

describe('HomeCommitmentStack', () => {
  beforeEach(() => {
    mockAppearance = 'light';
  });

  it('focuses one full card, collapses the rest, and does not optimistically fill a Tap In check', () => {
    const onActionPress = jest.fn();
    const onFocusCard = jest.fn();
    const onViewDetails = jest.fn();
    const first = circle();
    const second = circle({
      id: 'circle-2',
      title: 'Read every day',
    });
    let tree: renderer.ReactTestRenderer | undefined;

    act(() => {
      tree = renderer.create(
        <HomeCommitmentStack
          cards={[first, second]}
          focusedCardId={first.id}
          isNudged={() => false}
          isNudging={() => false}
          onActionPress={onActionPress}
          onFocusCard={onFocusCard}
          onViewDetails={onViewDetails}
        />,
      );
    });

    const check = tree!.root.findByProps({
      testID: 'home-commitment-check-circle-1',
    });

    expect(
      tree!.root.findByProps({
        testID: 'home-commitment-focused-circle-1',
      }),
    ).toBeTruthy();
    expect(
      tree!.root.findByProps({
        testID: 'home-commitment-collapsed-circle-2',
      }),
    ).toBeTruthy();
    const stackInstances = tree!.root.findAllByProps({
      testID: 'home-commitments-stack',
    });
    const stack = stackInstances[stackInstances.length - 1];
    const focusedLayer = stack.findByProps({
      testID: 'home-commitment-focused-layer-circle-1',
    });

    expect(stack.children.indexOf(focusedLayer)).toBe(0);
    expect(check.props.accessibilityState).toEqual({
      checked: false,
      disabled: false,
    });

    act(() => {
      check.props.onPress();
    });

    expect(onActionPress).toHaveBeenCalledWith(first);
    expect(check.props.accessibilityState.checked).toBe(false);

    act(() => {
      tree!.root
        .findByProps({testID: 'home-commitment-collapsed-circle-2'})
        .props.onPress();
    });

    expect(onFocusCard).toHaveBeenCalledWith(second.id);

    const collapsedLayerStyle = StyleSheet.flatten(
      tree!.root.findByProps({
        testID: 'home-commitment-collapsed-layer-circle-2',
      }).props.style,
    );
    const focusedCardStyle = StyleSheet.flatten(
      tree!.root.findByProps({
        testID: 'home-commitment-focused-layer-circle-1',
      }).props.style,
    );
    const focusedCheckStyle = StyleSheet.flatten(
      tree!.root.findByProps({
        testID: 'home-commitment-check-indicator-circle-1',
      }).props.style,
    );
    const collapsedCheckStyle = StyleSheet.flatten(
      tree!.root.findByProps({
        testID: 'home-commitment-check-indicator-circle-2',
      }).props.style,
    );

    expect(collapsedLayerStyle.marginTop).toBe(-14);
    expect(focusedCardStyle.zIndex).toBeGreaterThan(collapsedLayerStyle.zIndex);
    expect(focusedCheckStyle).toMatchObject({height: 30, width: 64});
    expect(collapsedCheckStyle).toMatchObject({height: 30, width: 64});
    expect(
      tree!.root.findAllByProps({children: 'TAP IN'}).length,
    ).toBeGreaterThan(0);

    act(() => {
      tree!.root
        .findByProps({testID: 'home-commitment-details-circle-1'})
        .props.onPress();
    });

    expect(onViewDetails).toHaveBeenCalledWith(first.id);
  });

  it('expands the selected card in its existing stack position', () => {
    const first = circle();
    const second = circle({id: 'circle-2', title: 'Read every day'});
    const third = circle({id: 'circle-3', title: 'Sleep 8 hours'});
    const props = {
      cards: [first, second, third],
      isNudged: () => false,
      isNudging: () => false,
      onActionPress: jest.fn(),
      onFocusCard: jest.fn(),
      onViewDetails: jest.fn(),
    };
    let tree: renderer.ReactTestRenderer | undefined;

    act(() => {
      tree = renderer.create(
        <HomeCommitmentStack {...props} focusedCardId={first.id} />,
      );
    });

    act(() => {
      tree!.update(
        <HomeCommitmentStack {...props} focusedCardId={second.id} />,
      );
    });

    const firstLayer = tree!.root.findByProps({
      testID: 'home-commitment-collapsed-layer-circle-1',
    });
    const focusedLayer = tree!.root.findByProps({
      testID: 'home-commitment-focused-layer-circle-2',
    });
    const thirdLayer = tree!.root.findByProps({
      testID: 'home-commitment-collapsed-layer-circle-3',
    });
    const firstLayerStyle = StyleSheet.flatten(firstLayer.props.style);
    const focusedLayerStyle = StyleSheet.flatten(focusedLayer.props.style);
    const thirdLayerStyle = StyleSheet.flatten(thirdLayer.props.style);

    expect(firstLayer.parent).toBe(focusedLayer.parent);
    expect(focusedLayer.parent).toBe(thirdLayer.parent);
    expect(focusedLayer.parent!.children.indexOf(firstLayer)).toBe(0);
    expect(focusedLayer.parent!.children.indexOf(focusedLayer)).toBe(1);
    expect(focusedLayer.parent!.children.indexOf(thirdLayer)).toBe(2);
    expect(focusedLayerStyle.marginTop).toBe(-14);
    expect(thirdLayerStyle.marginTop).toBe(-14);
    expect(focusedLayerStyle.zIndex).toBeGreaterThan(firstLayerStyle.zIndex);
    expect(focusedLayerStyle.zIndex).toBeGreaterThan(thirdLayerStyle.zIndex);
  });

  it('uses opaque dark category fills across overlapped stack cards', () => {
    mockAppearance = 'dark';
    const focused = circle({category: 'Deep Work'});
    const collapsed = circle({
      category: 'Fitness',
      id: 'circle-2',
      title: 'Read every day',
    });
    let tree: renderer.ReactTestRenderer | undefined;

    act(() => {
      tree = renderer.create(
        <HomeCommitmentStack
          cards={[focused, collapsed]}
          focusedCardId={focused.id}
          isNudged={() => false}
          isNudging={() => false}
          onActionPress={jest.fn()}
          onFocusCard={jest.fn()}
          onViewDetails={jest.fn()}
        />,
      );
    });

    const focusedStyle = StyleSheet.flatten(
      tree!.root.findByProps({
        testID: 'home-commitment-focused-circle-1',
      }).props.style,
    );
    const collapsedStyle = StyleSheet.flatten(
      tree!.root.findByProps({
        testID: 'home-commitment-collapsed-surface-circle-2',
      }).props.style,
    );

    expect(focusedStyle.backgroundColor).toBe('#133240');
    expect(collapsedStyle.backgroundColor).toBe('#122b1f');
  });

  it('shows the saved Tap In state as a filled non-interactive check', () => {
    const completed = circle({
      id: 'completed',
      state: 'done',
      viewerHasCheckedIn: true,
      viewerHasTappedInToday: true,
      viewerRemainingTapIns: 0,
      viewerTodayStatus: 'done',
    });
    let tree: renderer.ReactTestRenderer | undefined;

    act(() => {
      tree = renderer.create(
        <HomeCommitmentStack
          cards={[completed]}
          focusedCardId={completed.id}
          isNudged={() => false}
          isNudging={() => false}
          onActionPress={jest.fn()}
          onFocusCard={jest.fn()}
          onViewDetails={jest.fn()}
        />,
      );
    });

    const check = tree!.root.findByProps({
      testID: 'home-commitment-check-completed',
    });

    expect(check.props.accessibilityState).toEqual({
      checked: true,
      disabled: true,
    });
    expect(check.props.onPress).toBeUndefined();
    expect(
      StyleSheet.flatten(
        tree!.root.findByProps({
          testID: 'home-commitment-check-indicator-completed',
        }).props.style,
      ),
    ).toMatchObject({height: 30, width: 30});
    expect(tree!.root.findAllByProps({children: 'TAP IN'})).toHaveLength(0);
  });

  it('shows pending approval with a clock instead of a checkbox', () => {
    const pending = circle({
      id: 'pending',
      title: 'Pending Circle',
      viewerMembershipStatus: 'pending',
    });
    let tree: renderer.ReactTestRenderer | undefined;

    act(() => {
      tree = renderer.create(
        <HomeCommitmentStack
          cards={[pending]}
          focusedCardId={pending.id}
          isNudged={() => false}
          isNudging={() => false}
          onActionPress={jest.fn()}
          onFocusCard={jest.fn()}
          onViewDetails={jest.fn()}
        />,
      );
    });

    const check = tree!.root.findByProps({
      testID: 'home-commitment-check-pending',
    });
    const indicatorStyle = StyleSheet.flatten(
      tree!.root.findByProps({
        testID: 'home-commitment-check-indicator-pending',
      }).props.style,
    );

    expect(check.props.accessibilityLabel).toBe(
      'Pending approval for Pending Circle',
    );
    expect(check.props.accessibilityRole).toBe('image');
    expect(check.props.accessibilityState).toEqual({disabled: true});
    expect(check.props.onPress).toBeUndefined();
    expect(indicatorStyle).toMatchObject({
      borderWidth: 0,
      height: 30,
      width: 30,
    });
    expect(tree!.root.findByType(Clock3)).toBeTruthy();
  });

  it('keeps a nudge action available when the viewer has already tapped in', () => {
    const onActionPress = jest.fn();
    const nudgeCircle = circle({
      id: 'nudge-circle',
      nudgeTargetCount: 2,
      remainingCheckIns: 2,
      viewerHasCheckedIn: true,
      viewerHasTappedInToday: true,
      viewerRemainingTapIns: 0,
      viewerTodayStatus: 'done',
    });
    let tree: renderer.ReactTestRenderer | undefined;

    act(() => {
      tree = renderer.create(
        <HomeCommitmentStack
          cards={[nudgeCircle]}
          focusedCardId={nudgeCircle.id}
          isNudged={() => false}
          isNudging={() => false}
          onActionPress={onActionPress}
          onFocusCard={jest.fn()}
          onViewDetails={jest.fn()}
        />,
      );
    });

    const check = tree!.root.findByProps({
      testID: 'home-commitment-check-nudge-circle',
    });
    const nudge = tree!.root.findByProps({
      accessibilityLabel: 'Nudge 2 Members',
    });

    expect(check.props.accessibilityState).toEqual({
      checked: true,
      disabled: true,
    });

    act(() => {
      nudge.props.onPress();
    });

    expect(onActionPress).toHaveBeenCalledWith(nudgeCircle);
  });
});
