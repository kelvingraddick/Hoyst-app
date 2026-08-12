import React from 'react';
import {StyleSheet} from 'react-native';
import renderer, {act} from 'react-test-renderer';
import {UsersRound} from 'lucide-react-native';

import {CircleCardTapInButton} from '../src/design/components/CircleCardTapInButton';
import {CircleCategoryIcon} from '../src/design/components/CircleCategoryIcon';
import {GradientRing} from '../src/design/components/GradientRing';
import {GlassPanel} from '../src/design/components/GlassPanel';
import {TodayCircleCard} from '../src/design/components/TodayCircleCard';
import {getHoystThemeColors} from '../src/design/tokens/colors';
import type {CircleManagementCard} from '../src/types/models';

jest.mock('@react-native-community/blur', () => ({
  BlurView: ({children, ...props}: {children?: React.ReactNode}) => {
    const MockReact = require('react');
    const {View} = require('react-native');

    return MockReact.createElement(View, props, children);
  },
}));

jest.mock('react-native-linear-gradient', () => {
  const MockReact = require('react');
  const {View} = require('react-native');

  return ({children, ...props}: {children?: React.ReactNode}) =>
    MockReact.createElement(View, props, children);
});

jest.mock('react-native-haptic-feedback', () => ({
  trigger: jest.fn(),
}));

jest.mock('../src/store/settings-store', () => ({
  useSettingsStore: (selector: (state: {appearance: 'light'}) => unknown) =>
    selector({appearance: 'light'}),
}));

function circle(
  overrides: Partial<CircleManagementCard>,
): CircleManagementCard {
  return {
    category: 'Fitness',
    commitment: 'Move for 30 minutes',
    commitmentCadence: 'daily',
    commitmentFrequency: {tapInsPerWeek: 7},
    completionRate: 42,
    id: 'circle-1',
    inviteUrl: 'https://example.com/invite',
    joinMode: 'open',
    maxSize: 8,
    memberCount: 2,
    members: [],
    privacy: 'public',
    progressPercent: 42,
    remainingCheckIns: 1,
    state: 'active',
    streakDays: 4,
    streakLabel: 'Start today',
    title: 'Morning Movers',
    viewerHasCheckedIn: false,
    viewerMembershipStatus: 'active',
    viewerRole: 'member',
    viewerTodayStatus: 'rest',
    ...overrides,
  };
}

describe('TodayCircleCard', () => {
  it('shows tapped-in copy and passes progress to the mini ring', () => {
    let tree: renderer.ReactTestRenderer | undefined;

    act(() => {
      tree = renderer.create(
        <TodayCircleCard
          card={circle({})}
          onActionPress={jest.fn()}
          onCardPress={jest.fn()}
        />,
      );
    });

    const output = JSON.stringify(tree!.toJSON());
    const ring = tree!.root.findByType(GradientRing);
    const tapInButton = tree!.root.findByType(CircleCardTapInButton);
    const companionIcon = tree!.root.findByType(UsersRound);
    const lightTheme = getHoystThemeColors('light');

    expect(output).toContain('42% tapped-in today');
    expect(tapInButton.props.ringState).toBe('active');
    expect(ring.props).toMatchObject({
      flatColor: '#07763E',
      progress: 0.42,
      size: 18,
      strokeWidth: 3,
    });
    expect(companionIcon.props.color).toBe('#07763E');
    expect(companionIcon.props.color).not.toBe(lightTheme.accentForeground);
  });

  it('keeps a completed weekly commitment tappable on a new day', () => {
    let tree: renderer.ReactTestRenderer | undefined;

    act(() => {
      tree = renderer.create(
        <TodayCircleCard
          card={circle({
            commitmentCadence: 'weekly',
            commitmentFrequency: {tapInsPerWeek: 2},
            progressPercent: 100,
            remainingCheckIns: 0,
            state: 'done',
            title: 'Weekly Complete',
            viewerHasCheckedIn: true,
            viewerHasTappedInToday: false,
            viewerRemainingTapIns: 0,
            viewerTodayStatus: undefined,
          })}
          onActionPress={jest.fn()}
          onCardPress={jest.fn()}
        />,
      );
    });

    const output = JSON.stringify(tree!.toJSON());
    const tapInButton = tree!.root.findByType(CircleCardTapInButton);

    expect(output).toContain('Tap Today');
    expect(tapInButton.props.label).toBe('Tap In');
    expect(tapInButton.props.ringState).toBe('active');
  });

  it('renders upcoming daily cards as compact next-action cards', () => {
    let tree: renderer.ReactTestRenderer | undefined;

    act(() => {
      tree = renderer.create(
        <TodayCircleCard
          card={circle({
            progressPercent: 100,
            remainingCheckIns: 0,
            state: 'done',
            title: 'Hydration Habit',
            viewerHasCheckedIn: true,
            viewerHasTappedInToday: true,
            viewerRemainingTapIns: 0,
            viewerTodayStatus: 'done',
          })}
          onActionPress={jest.fn()}
          onCardPress={jest.fn()}
          variant="upcoming"
        />,
      );
    });

    const output = JSON.stringify(tree!.toJSON());

    expect(output).toContain('Hydration Habit');
    expect(output).toContain('Next tap tomorrow');
    expect(output).not.toContain('Tap In');
    expect(tree!.root.findAllByType(CircleCardTapInButton)).toHaveLength(0);
  });

  it('renders upcoming weekly remaining copy', () => {
    let tree: renderer.ReactTestRenderer | undefined;

    act(() => {
      tree = renderer.create(
        <TodayCircleCard
          card={circle({
            commitmentCadence: 'weekly',
            commitmentFrequency: {tapInsPerWeek: 4},
            progressPercent: 50,
            remainingCheckIns: 2,
            title: 'Morning Crew',
            viewerHasCheckedIn: false,
            viewerHasTappedInToday: true,
            viewerRemainingTapIns: 2,
            viewerTodayStatus: 'done',
          })}
          onActionPress={jest.fn()}
          onCardPress={jest.fn()}
          variant="upcoming"
        />,
      );
    });

    const output = JSON.stringify(tree!.toJSON());

    expect(output).toContain('Morning Crew');
    expect(output).toContain('Next tap this week');
    expect(output).toContain('2 Tap Ins left this week');
    expect(tree!.root.findAllByType(CircleCardTapInButton)).toHaveLength(0);
  });

  it('renders pending upcoming cards with approval copy', () => {
    let tree: renderer.ReactTestRenderer | undefined;

    act(() => {
      tree = renderer.create(
        <TodayCircleCard
          card={circle({
            progressPercent: 0,
            remainingCheckIns: 0,
            title: 'Pending Circle',
            viewerHasCheckedIn: false,
            viewerMembershipStatus: 'pending',
            viewerRemainingTapIns: 0,
            viewerTodayStatus: undefined,
          })}
          onActionPress={jest.fn()}
          onCardPress={jest.fn()}
          variant="upcoming"
        />,
      );
    });

    const output = JSON.stringify(tree!.toJSON());

    expect(output).toContain('Pending Circle');
    expect(output).toContain('Pending approval');
    expect(output).toContain('Approval needed before Tap In unlocks.');
  });

  it('renders attention cards as peek-width category-accented action cards', () => {
    const onActionPress = jest.fn();
    const stopPropagation = jest.fn();
    let tree: renderer.ReactTestRenderer | undefined;

    act(() => {
      tree = renderer.create(
        <TodayCircleCard
          card={circle({
            category: 'Wellness',
            commitment: 'Sleep 8 hours in a day',
            completionRate: 29,
            members: [
              {
                id: 'member-1',
                initials: 'AR',
                name: 'Ari Runner',
                state: 'done',
              },
            ],
            progressPercent: 29,
            title: 'Sleep 8 Hours',
          })}
          onActionPress={onActionPress}
          onCardPress={jest.fn()}
          variant="attention"
        />,
      );
    });

    const output = JSON.stringify(tree!.toJSON());
    const panelStyle = StyleSheet.flatten(
      tree!.root.findByType(GlassPanel).props.style,
    );
    const tapInButton = tree!.root.findByProps({
      testID: 'attention-tap-in-button',
    });
    const categoryColor = '#5A1CFF';
    const tapInButtonSurface = tapInButton.find(node => {
      const flattenedStyle = StyleSheet.flatten(node.props.style);

      return flattenedStyle?.minHeight === 42;
    });
    const tapInButtonSurfaceStyle = StyleSheet.flatten(
      tapInButtonSurface.props.style,
    );
    const categoryAccentNodes = tree!.root.findAll(node => {
      const flattenedStyle = StyleSheet.flatten(node.props.style);

      return flattenedStyle?.backgroundColor === categoryColor;
    });
    const iconBackplate = tree!.root.find(node => {
      const flattenedStyle = StyleSheet.flatten(node.props.style);

      return (
        flattenedStyle?.backgroundColor === '#F0ECFF' &&
        flattenedStyle.height === 36 &&
        flattenedStyle.width === 36
      );
    });
    const iconBackplateStyle = StyleSheet.flatten(iconBackplate.props.style);
    const descriptionNode = tree!.root.find(node => {
      return node.props.children === 'Sleep 8 hours in a day';
    });
    const metricNode = tree!.root.find(node => {
      return node.props.children === '29% complete today';
    });
    const descriptionStyle = StyleSheet.flatten(descriptionNode.props.style);
    const metricStyle = StyleSheet.flatten(metricNode.props.style);
    const peekWidthNodes = tree!.root.findAll(node => {
      const flattenedStyle = StyleSheet.flatten(node.props.style);

      return flattenedStyle?.width === 300;
    });
    const gradientNodes = tree!.root.findAll(node => {
      return Array.isArray(node.props.colors);
    });

    expect(output).toContain('Sleep 8 hours in a day');
    expect(output).toContain('WELLNESS');
    expect(output).toContain('29% complete today');
    expect(output).not.toContain('Needs You');
    expect(output).not.toContain('1 Member already showed up');
    expect(iconBackplateStyle.borderRadius).toBe(11);
    expect(iconBackplateStyle.borderRadius).not.toBe(18);
    expect(descriptionStyle.fontWeight).toBe('600');
    expect(metricStyle.fontWeight).toBe('500');
    expect(gradientNodes).toHaveLength(0);
    expect(peekWidthNodes.length).toBeGreaterThan(1);
    expect(panelStyle.width).toBe(300);
    expect(tapInButtonSurfaceStyle.backgroundColor).toBe(categoryColor);
    expect(tapInButtonSurfaceStyle.shadowColor).toBe(categoryColor);
    expect(categoryAccentNodes.length).toBeGreaterThan(0);
    expect(output).toContain('Tap In');

    act(() => {
      tapInButton.props.onPress({stopPropagation});
    });

    expect(stopPropagation).toHaveBeenCalledTimes(1);
    expect(onActionPress).toHaveBeenCalledTimes(1);
  });

  it('keeps category icons circular by default', () => {
    let tree: renderer.ReactTestRenderer | undefined;

    act(() => {
      tree = renderer.create(
        <CircleCategoryIcon category="Wellness" size={36} />,
      );
    });

    const iconBackplate = tree!.root.find(node => {
      const flattenedStyle = StyleSheet.flatten(node.props.style);

      return (
        flattenedStyle?.backgroundColor === '#F0ECFF' &&
        flattenedStyle.height === 36 &&
        flattenedStyle.width === 36
      );
    });
    const iconBackplateStyle = StyleSheet.flatten(iconBackplate.props.style);

    expect(iconBackplateStyle.borderRadius).toBe(18);
  });
});
