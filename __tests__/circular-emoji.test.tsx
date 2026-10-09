import React from 'react';
import {StyleSheet, Text, View} from 'react-native';
import renderer, {act} from 'react-test-renderer';
import {
  CircularEmoji,
  circularEmoji,
} from '../src/design/components/CircularEmoji';
import {MomentumStageIcon} from '../src/design/components/MomentumStageIcon';
import {InboxEventBadge} from '../src/features/inbox/components/InboxEventBadge';
import {getSystemTheme} from '../src/design/system/tokens';
import {legacyCircleActivityEventTypes} from '../src/types/models';
import {
  Check,
  TriangleAlert,
  UserCheck,
  UserX,
  UserPlus,
  AlarmClock,
} from 'lucide-react-native';

function render(element: React.ReactElement) {
  let tree!: renderer.ReactTestRenderer;
  act(() => {
    tree = renderer.create(element);
  });
  return tree;
}

it('keeps fixed UI meanings independent of Commitment customization', () => {
  expect(circularEmoji).toEqual({
    streak: '🔥',
    momentum: '📈',
    tapIns: '📅',
    milestone: '🏆',
    gettingStarted: '✨',
    building: '🧱',
    strong: '⚡',
    peak: '🏆',
    skip: '⏭️',
    restore: '🔄',
    build: '🧱',
    limit: '🎚️',
    avoid: '🚫',
    nudge: '🫵',
    notification: '🔔',
    reminder: '⏰',
    members: '👥',
    personal: '👤',
    archive: '📦',
    discovery: '🧭',
  });
});

it.each([16, 32, 40])(
  'preserves native emoji sequences and geometry at %s px',
  size => {
    const tree = render(
      <CircularEmoji
        kind="limit"
        size={size}
        backgroundColor="#EEF1F7"
        accessibilityLabel="Limit commitment type"
      />,
    );
    const wrapper = tree.root.findByType(View);
    const text = tree.root.findByType(Text);
    expect(StyleSheet.flatten(wrapper.props.style)).toMatchObject({
      width: size,
      height: size,
      borderRadius: size / 2,
      backgroundColor: '#EEF1F7',
    });
    expect(wrapper.props.accessibilityLabel).toBe('Limit commitment type');
    expect(wrapper.props.accessible).toBe(true);
    expect(text.props.children).toBe('🎚️');
    expect(text.props.accessible).toBe(false);
    expect(text.props.accessibilityElementsHidden).toBe(true);
    expect(text.props.allowFontScaling).toBe(false);
    expect(StyleSheet.flatten(text.props.style).fontFamily).toBeUndefined();
    expect(StyleSheet.flatten(text.props.style).color).toBeUndefined();
  },
);

it('does not announce decorative badges beside an existing label', () => {
  const tree = render(<CircularEmoji kind="streak" />);
  expect(tree.root.findByType(View).props.accessible).toBe(false);
  expect(tree.root.findByType(Text).props.importantForAccessibility).toBe(
    'no-hide-descendants',
  );
});

it.each([
  ['getting_started', '✨'],
  ['building_momentum', '🧱'],
  ['strong_momentum', '⚡'],
  ['peak_momentum', '🏆'],
] as const)('renders the %s momentum stage', (status, emoji) => {
  const tree = render(
    <MomentumStageIcon status={status} size={40} testID="stage" />,
  );
  expect(tree.root.findByType(Text).props.children).toBe(emoji);
  expect(
    StyleSheet.flatten(tree.root.findByType(View).props.style).backgroundColor,
  ).toBe('#FFF3DF');
});

it.each([false, true])(
  'uses decorative Inbox emoji in dark mode=%s while preserving exact status icons',
  isDark => {
    const badges = render(
      <>
        <InboxEventBadge isDark={isDark} type="nudge" />
        <InboxEventBadge
          isDark={isDark}
          type={legacyCircleActivityEventTypes.streakMilestone}
        />
        <InboxEventBadge isDark={isDark} type="circle_complete" />
        <InboxEventBadge isDark={isDark} type="circle_at_risk" />
        <InboxEventBadge isDark={isDark} type="join_approved" />
        <InboxEventBadge isDark={isDark} type="join_declined" />
        <InboxEventBadge isDark={isDark} type="join_request" />
        <InboxEventBadge isDark={isDark} type="tap_in_final_warning" />
      </>,
    );
    expect(
      badges.root.findAllByType(Text).map(node => node.props.children),
    ).toEqual(['🫵', '🔥', '⏰']);
    for (const icon of [Check, TriangleAlert, UserCheck, UserX, UserPlus]) {
      expect(badges.root.findAllByType(icon)).toHaveLength(1);
    }
    expect(badges.root.findAllByType(AlarmClock)).toHaveLength(0);
    const warning = badges.root
      .findAllByType(CircularEmoji)
      .find(node => node.props.kind === 'reminder')!;
    expect(warning.props.size).toBe(28);
    expect(warning.props.emojiSize).toBe(16);
    expect(warning.props.backgroundColor).toBe(
      getSystemTheme(isDark ? 'dark' : 'light').category.orange.surface,
    );
    expect(warning.props.accessibilityLabel).toBeUndefined();
  },
);
