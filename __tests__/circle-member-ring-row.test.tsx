import React from 'react';
import {StyleSheet} from 'react-native';
import renderer, {act} from 'react-test-renderer';

import {CircleMemberRingRow} from '../src/design/components/CircleMemberRingRow';
import type {CircleMemberStatus} from '../src/types/models';

jest.mock('../src/store/settings-store', () => ({
  useSettingsStore: (selector: (state: {appearance: 'light'}) => unknown) =>
    selector({appearance: 'light'}),
}));

function member(
  id: string,
  name: string,
  state: CircleMemberStatus['state'],
  membershipStatus?: CircleMemberStatus['membershipStatus'],
): CircleMemberStatus {
  return {
    id,
    initials: name
      .split(' ')
      .map(part => part[0])
      .join('')
      .slice(0, 2)
      .toUpperCase(),
    membershipStatus,
    name,
    state,
  };
}

function renderRow(
  members: CircleMemberStatus[],
  options: {
    inviteAction?: React.ComponentProps<typeof CircleMemberRingRow>['inviteAction'];
    maxVisible?: number;
  } = {},
): renderer.ReactTestRenderer {
  let tree: renderer.ReactTestRenderer | undefined;

  act(() => {
    tree = renderer.create(
      <CircleMemberRingRow
        inviteAction={options.inviteAction}
        maxVisible={options.maxVisible}
        members={members}
        subtitle="Progress this Cycle"
      />,
    );
  });

  return tree!;
}

function outputOf(tree: renderer.ReactTestRenderer) {
  return JSON.stringify(tree.toJSON());
}

function styleOf(tree: renderer.ReactTestRenderer, testID: string) {
  return StyleSheet.flatten(tree.root.findByProps({testID}).props.style);
}

describe('CircleMemberRingRow', () => {
  it('renders an empty Member state', () => {
    const tree = renderRow([]);
    const output = outputOf(tree);

    expect(output).toContain('Members will appear here');
    expect(output).not.toContain('Progress this Cycle, 0 done');
    expect(output).not.toContain('member-ghost-slot');
  });

  it('renders one Member without decorative ghost slots', () => {
    const tree = renderRow([member('user-1', 'Ada', 'pending')]);
    const output = outputOf(tree);

    expect(output).toContain('Circle Members');
    expect(output).toContain('Ada');
    expect(output).toContain('Needed');
    expect(output).toContain('1');
    expect(output).toContain('Member');
    expect(output).not.toContain('member-ghost-slot');
  });

  it('renders six visible Members without overflow', () => {
    const tree = renderRow([
      member('user-1', 'Ada', 'done'),
      member('user-2', 'Ben', 'pending'),
      member('user-3', 'Cam', 'skipped'),
      member('user-4', 'Dia', 'missed'),
      member('user-5', 'Eli', 'done'),
      member('user-6', 'Fay', 'pending', 'pending'),
    ]);
    const output = outputOf(tree);

    expect(output).toContain('Ada');
    expect(output).toContain('Ben');
    expect(output).toContain('Fay');
    expect(output).toContain('Done');
    expect(output).toContain('Needed');
    expect(output).toContain('Skipped');
    expect(output).toContain('Missed');
    expect(output).toContain('Pending');
    expect(output).not.toContain('Overflow');
    expect(output).not.toContain('member-ghost-slot');
  });

  it('renders overflow when the Member count exceeds the radial slots', () => {
    const tree = renderRow([
      member('user-1', 'Ada', 'done'),
      member('user-2', 'Ben', 'pending'),
      member('user-3', 'Cam', 'skipped'),
      member('user-4', 'Dia', 'missed'),
      member('user-5', 'Eli', 'done'),
      member('user-6', 'Fay', 'pending', 'pending'),
      member('user-7', 'Gia', 'pending'),
    ]);
    const output = outputOf(tree);

    expect(output).toContain('+2');
    expect(output).toContain('+2 more');
    expect(output).toContain('Overflow');
    expect(output).toContain('2 more Members');
  });

  it('renders neutral invite as the only placeholder-like radial slot', () => {
    const tree = renderRow([member('user-1', 'Ada', 'pending')], {
      inviteAction: {
        accessibilityLabel: 'Invite Members',
        onPress: jest.fn(),
      },
    });
    const output = outputOf(tree);

    expect(output).toContain('Invite Members');
    expect(output).toContain('Invite');
    expect(output).not.toContain('INVITE');
    expect(output).not.toContain('member-ghost-slot');
    expect(output.lastIndexOf('member-invite-slot')).toBeGreaterThan(
      output.indexOf('Ada'),
    );
    expect(output).toContain('rgba(16,24,40,0.14)');
    expect(output).not.toContain('rgba(139,92,246,0.10)');
    expect(output).toContain('dashed');

    const inviteLabel = tree.root.findByProps({
      testID: 'member-invite-label',
    });
    expect(inviteLabel.props.children).toBe('Invite');
    expect(StyleSheet.flatten(inviteLabel.props.style).textTransform).toBe(
      'none',
    );

    const inviteFrame = styleOf(tree, 'member-invite-frame');
    expect(inviteFrame.height).toBe(64);
    expect(inviteFrame.left).toBe(7);
    expect(inviteFrame.top).toBe(7);
    expect(inviteFrame.width).toBe(64);

    const memberSlot = styleOf(tree, 'member-slot-user-1');
    const inviteSlot = styleOf(tree, 'member-invite-radial-slot');

    expect(memberSlot.top).toBeLessThan(inviteSlot.top);
    expect(memberSlot.left).toBeCloseTo(inviteSlot.left, 1);
  });

  it('keeps invite after overflow when the radial slots are full', () => {
    const tree = renderRow(
      [
        member('user-1', 'Ada', 'done'),
        member('user-2', 'Ben', 'pending'),
        member('user-3', 'Cam', 'skipped'),
        member('user-4', 'Dia', 'missed'),
        member('user-5', 'Eli', 'done'),
        member('user-6', 'Fay', 'pending', 'pending'),
        member('user-7', 'Gia', 'pending'),
      ],
      {
        inviteAction: {
          accessibilityLabel: 'Invite Members',
          onPress: jest.fn(),
        },
      },
    );
    const output = outputOf(tree);

    expect(output).toContain('+3');
    expect(output).toContain('3 more Members');
    expect(output).not.toContain('member-ghost-slot');
    expect(output.lastIndexOf('member-invite-slot')).toBeGreaterThan(
      output.lastIndexOf('member-overflow-slot'),
    );
  });
});
