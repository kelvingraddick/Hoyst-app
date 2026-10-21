import React from 'react';
import {ScrollView, StyleSheet, Text} from 'react-native';
import {UserPlus} from 'lucide-react-native';
import renderer, {act, type ReactTestInstance} from 'react-test-renderer';

import {DesignSystemProvider, getSystemTheme} from '../src/design/system';
import {
  CircleMemberStrip,
  getMemberProgressConfig,
} from '../src/features/circles/components/CircleMemberStrip';
import {getHoystThemeColors} from '../src/design/tokens/colors';
import type {CircleMemberStatus} from '../src/types/models';

let mockAppearance: 'light' | 'dark' = 'light';

jest.mock('../src/store/settings-store', () => ({
  useSettingsStore: (
    selector: (state: {appearance: 'light' | 'dark'}) => unknown,
  ) => selector({appearance: mockAppearance}),
}));

const members: CircleMemberStatus[] = [
  {
    id: 'viewer',
    initials: 'KM',
    name: 'Kelvin',
    state: 'done',
  },
  {
    id: 'member-2',
    initials: 'AR',
    name: 'Ari',
    state: 'pending',
  },
];

function textContent(node: ReactTestInstance): string {
  return node.children
    .map(child => (typeof child === 'string' ? child : textContent(child)))
    .join('');
}

function renderStrip(
  overrides: Partial<React.ComponentProps<typeof CircleMemberStrip>> = {},
) {
  const onInvite = jest.fn();
  const onSelectMember = jest.fn();
  let tree!: renderer.ReactTestRenderer;

  act(() => {
    tree = renderer.create(
      <DesignSystemProvider scheme={mockAppearance}>
        <CircleMemberStrip
          belowStripAction={<Text>Nudge all</Text>}
          inviteAction={{
            accessibilityLabel: 'Invite members',
            onPress: onInvite,
          }}
          members={members}
          onSelectMember={onSelectMember}
          selectedMemberId="member-2"
          subtitle="2 members total"
          viewerUid="viewer"
          {...overrides}
        />
      </DesignSystemProvider>,
    );
  });

  return {onInvite, onSelectMember, tree};
}

beforeEach(() => {
  mockAppearance = 'light';
});

afterEach(() => {
  jest.clearAllMocks();
});

it('keeps the compact members strip horizontal with its total beneath the heading', () => {
  const {tree} = renderStrip();
  const output = tree.root.findAllByType(Text).map(textContent).join(' ');
  const scroller = tree.root.findByProps({testID: 'circle-member-strip'});

  expect(scroller.type).toBe(ScrollView);
  expect(scroller.props.horizontal).toBe(true);
  expect(output).toContain('Circle members');
  expect(output).toContain('2 members total');
  expect(output).toContain('TAPPED IN');
  expect(output).toContain('NEEDS');
});

it('uses a subtle Invite icon and places the bulk row before selected-member actions', () => {
  const actionPress = jest.fn();
  const {tree} = renderStrip({
    action: {
      accessibilityLabel: 'Nudge Ari',
      label: 'Nudge',
      onPress: actionPress,
      tone: 'nudge',
    },
  });
  const inviteIcon = tree.root
    .findByProps({testID: 'circle-member-strip-invite-avatar'})
    .findByType(UserPlus);
  const strip = tree.root.findByProps({testID: 'circle-member-strip'});
  const belowAction = tree.root.findByProps({
    testID: 'circle-member-strip-below-action',
  });
  const selectedAction = tree.root.findByProps({
    testID: 'circle-member-strip-selected-action',
  });
  const inviteAvatar = tree.root.findByProps({
    testID: 'circle-member-strip-invite-avatar',
  });
  const output = JSON.stringify(tree.toJSON());

  expect(inviteIcon.props).toEqual(
    expect.objectContaining({opacity: 0.72, size: 18, strokeWidth: 2}),
  );
  expect(StyleSheet.flatten(inviteAvatar.props.style)).toEqual(
    expect.objectContaining({height: 48, width: 48}),
  );
  expect(output.indexOf('circle-member-strip')).toBeLessThan(
    output.indexOf('circle-member-strip-below-action'),
  );
  expect(output.indexOf('circle-member-strip-below-action')).toBeLessThan(
    output.indexOf('circle-member-strip-selected-action'),
  );
  expect(strip).toBeTruthy();
  expect(belowAction).toBeTruthy();
  expect(selectedAction).toBeTruthy();
});

it('matches completed member rings and badges to the completed day green', () => {
  const theme = getHoystThemeColors('light');
  const {tree} = renderStrip();
  const config = getMemberProgressConfig(members[0], theme);
  const badge = tree.root.findByProps({
    testID: 'circle-member-strip-status-viewer',
  });

  expect(config.labelColor).toBe(theme.successForeground);
  expect(config.ringColor).toBe(theme.success);
  expect(StyleSheet.flatten(badge.props.style)).toEqual(
    expect.objectContaining({backgroundColor: theme.success}),
  );
});

it('preserves Invite and member selection callbacks', () => {
  const {onInvite, onSelectMember, tree} = renderStrip();
  const member = tree.root.findByProps({
    testID: 'circle-member-strip-member-member-2',
  });

  for (const testID of [
    'circle-member-heading-invite',
    'circle-member-strip-invite',
  ]) {
    act(() => tree.root.findByProps({testID}).props.onPress());
  }
  act(() => member.props.onPress());

  expect(onInvite).toHaveBeenCalledTimes(2);
  expect(onSelectMember).toHaveBeenCalledWith(members[1]);
});

it.each(['light', 'dark'] as const)(
  'uses category button colors and keeps the avatar shortcut neutral in %s mode',
  appearance => {
    mockAppearance = appearance;
    const theme = getSystemTheme(appearance);
    const {tree} = renderStrip({inviteCategory: 'blue'});
    const headingInvite = tree.root.findByProps({
      testID: 'circle-member-heading-invite',
    });
    const inviteAvatar = tree.root.findByProps({
      testID: 'circle-member-strip-invite-avatar',
    });
    const foreground = theme.isDark ? theme.canvas : theme.onAction;

    expect(
      StyleSheet.flatten(headingInvite.props.style),
    ).toEqual(
      expect.objectContaining({
        backgroundColor: theme.category.blue.foreground,
        minHeight: 44,
        minWidth: 92,
      }),
    );
    expect(headingInvite.findByType(UserPlus).props.color).toBe(foreground);
    expect(
      StyleSheet.flatten(headingInvite.findByType(Text).props.style).color,
    ).toBe(foreground);
    expect(StyleSheet.flatten(inviteAvatar.props.style).backgroundColor).toBe(
      theme.isDark ? 'rgba(255,255,255,0.07)' : 'rgba(16,24,40,0.055)',
    );
  },
);

it('hides both member-section invite controls without an invite action', () => {
  const {tree} = renderStrip({inviteAction: undefined});

  for (const testID of [
    'circle-member-heading-invite',
    'circle-member-strip-invite',
  ]) {
    expect(tree.root.findAllByProps({testID})).toHaveLength(0);
  }
});

it('prioritizes a weekly goal and announces today activity separately', () => {
  const {tree} = renderStrip({
    commitmentCadence: 'weekly',
    members: [
      {
        cycleCoveredCount: 3,
        cycleGoalMet: true,
        cycleRequiredCount: 3,
        id: 'viewer',
        initials: 'KM',
        membershipStatus: 'active',
        name: 'Kelvin',
        state: 'done',
        todayStatus: 'done',
      },
    ],
    selectedMemberId: 'viewer',
  });
  const output = tree.root.findAllByType(Text).map(textContent).join(' ');
  const member = tree.root.findByProps({
    testID: 'circle-member-strip-member-viewer',
  });

  expect(output).toContain('GOAL MET');
  expect(member.props.accessibilityLabel).toBe(
    'Kelvin · You, Weekly goal met, tapped in today',
  );
});
