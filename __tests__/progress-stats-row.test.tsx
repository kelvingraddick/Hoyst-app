import React from 'react';
import {StyleSheet, Text, View} from 'react-native';
import renderer, {act} from 'react-test-renderer';
import {ProgressStatsRow} from '../src/features/progress/components/ProgressStatsRow';

let mockDimensions = {width: 466, height: 678, scale: 3, fontScale: 1};
jest.mock('react-native/Libraries/Utilities/useWindowDimensions', () => ({
  __esModule: true,
  default: () => mockDimensions,
}));
jest.mock('../src/design/system', () => ({
  DSSurface: ({children, ...props}: React.ComponentProps<typeof View>) =>
    require('react').createElement(
      require('react-native').View,
      props,
      children,
    ),
  DSText: ({children, ...props}: React.ComponentProps<typeof Text>) =>
    require('react').createElement(
      require('react-native').Text,
      props,
      children,
    ),
  useSystemTheme: () => ({muted: '#666'}),
}));
jest.mock('../src/features/progress/components/ProgressStatBadge', () => ({
  ProgressStatBadge: () =>
    require('react').createElement(require('react-native').View),
}));

const streakPress = jest.fn();
const momentumPress = jest.fn();
const element = (viewportWidth?: number) => (
  <ProgressStatsRow
    streak="1 day"
    momentum="42%"
    viewportWidth={viewportWidth}
    onStreakPress={streakPress}
    onMomentumPress={momentumPress}
    testIDPrefix="home"
  />
);

describe('measured streak and momentum row', () => {
  let tree: renderer.ReactTestRenderer;
  const row = () =>
    tree.root.findAllByType(View).find(node => node.props.onLayout)!;
  const resize = (width: number) =>
    act(() => row().props.onLayout({nativeEvent: {layout: {width}}}));
  beforeEach(() => {
    mockDimensions = {width: 466, height: 678, scale: 3, fontScale: 1};
    streakPress.mockClear();
    momentumPress.mockClear();
  });
  afterEach(() => {
    if (tree) {
      act(() => tree.unmount());
    }
  });

  it.each([324, 329, 331, 332, 338, 346, 358])(
    'keeps the cards side by side at %i content points',
    width => {
      act(() => {
        tree = renderer.create(element());
      });
      resize(width);
      expect(StyleSheet.flatten(row().props.style).flexDirection).toBe('row');
    },
  );

  it('still stacks genuinely narrow content and large text', () => {
    act(() => {
      tree = renderer.create(element());
    });
    resize(316);
    expect(StyleSheet.flatten(row().props.style).flexDirection).toBeUndefined();
    resize(338);
    expect(StyleSheet.flatten(row().props.style).flexDirection).toBe('row');
    mockDimensions = {...mockDimensions, fontScale: 1.5};
    act(() => tree.update(element()));
    expect(StyleSheet.flatten(row().props.style).flexDirection).toBeUndefined();
  });

  it('uses the real Duo outer row width rather than its wider window', () => {
    mockDimensions = {...mockDimensions, width: 457};
    act(() => {
      tree = renderer.create(element());
    });
    resize(329);
    expect(StyleSheet.flatten(row().props.style).flexDirection).toBe('row');
  });

  it('responds to text-size changes without a window resize or remount', () => {
    act(() => {
      tree = renderer.create(element());
    });
    resize(329);
    const streak = tree.root.findByProps({testID: 'home-streak-card'});
    for (const fontScale of [1.118, 1.235, 1]) {
      mockDimensions = {...mockDimensions, fontScale};
      act(() => tree.update(element()));
      expect(StyleSheet.flatten(row().props.style).flexDirection).toBe(
        fontScale <= 1.15 ? 'row' : undefined,
      );
      expect(tree.root.findByProps({testID: 'home-streak-card'})).toBe(streak);
    }
  });

  it('uses the measured row instead of an explicit whole-window width after layout', () => {
    act(() => {
      tree = renderer.create(element(820));
    });
    resize(300);
    expect(StyleSheet.flatten(row().props.style).flexDirection).toBeUndefined();
    resize(338);
    expect(StyleSheet.flatten(row().props.style).flexDirection).toBe('row');
  });

  it('preserves card instances, values, text sizing and actions across resize', () => {
    act(() => {
      tree = renderer.create(element());
    });
    const streak = tree.root.findByProps({testID: 'home-streak-card'});
    const momentum = tree.root.findByProps({testID: 'home-momentum-card'});
    for (const width of [338, 720, 300, 338]) {
      resize(width);
      expect(tree.root.findByProps({testID: 'home-streak-card'})).toBe(streak);
      expect(tree.root.findByProps({testID: 'home-momentum-card'})).toBe(
        momentum,
      );
    }
    const values = tree.root
      .findAllByType(Text)
      .filter(node => ['1 day', '42%'].includes(node.props.children));
    expect(values).toHaveLength(2);
    for (const value of values) {
      expect(value.props.adjustsFontSizeToFit).toBeUndefined();
    }
    act(() => {
      streak.props.onPress();
      momentum.props.onPress();
    });
    expect(streakPress).toHaveBeenCalledTimes(1);
    expect(momentumPress).toHaveBeenCalledTimes(1);
  });
});
