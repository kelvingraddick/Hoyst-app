import React from 'react';
import {Pressable, StyleSheet} from 'react-native';
import renderer, {act, type ReactTestInstance} from 'react-test-renderer';

import {CircleMemberGrid} from '../src/design/components/CircleMemberGrid';
import {GradientRing} from '../src/design/components/GradientRing';
import {LayeredAvatar} from '../src/design/components/LayeredAvatar';
import type {CircleMemberStatus} from '../src/types/models';

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

jest.mock('react-native-haptic-feedback', () => ({
  trigger: jest.fn(),
}));

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

function renderGrid(
  members: CircleMemberStatus[],
  options: Partial<React.ComponentProps<typeof CircleMemberGrid>> = {},
) {
  let tree: renderer.ReactTestRenderer | undefined;

  act(() => {
    tree = renderer.create(
      <CircleMemberGrid
        members={members}
        subtitle="1 of 3 today"
        {...options}
      />,
    );
  });

  return tree!;
}

function outputOf(tree: renderer.ReactTestRenderer) {
  return JSON.stringify(tree.toJSON());
}

function textContent(node: ReactTestInstance): string {
  return node.children
    .map(child =>
      typeof child === 'string'
        ? child
        : textContent(child as ReactTestInstance),
    )
    .join('');
}

describe('CircleMemberGrid', () => {
  it('renders an empty Member state', () => {
    const tree = renderGrid([]);
    const output = outputOf(tree);

    expect(output).toContain('Circle Members');
    expect(output).toContain('Members will appear here');
    expect(output).not.toContain('circle-member-grid-scroll');
  });

  it('renders four members in row-major order without horizontal scroll', () => {
    const tree = renderGrid([
      member('user-1', 'Ada', 'pending'),
      member('user-2', 'Ben', 'done'),
      member('user-3', 'Cam', 'skipped'),
      member('user-4', 'Dia', 'missed'),
    ]);
    const pageText = textContent(
      tree.root.findByProps({testID: 'circle-member-grid-page-0'}),
    );

    expect(pageText.indexOf('Ada')).toBeLessThan(pageText.indexOf('Ben'));
    expect(pageText.indexOf('Ben')).toBeLessThan(pageText.indexOf('Cam'));
    expect(pageText.indexOf('Cam')).toBeLessThan(pageText.indexOf('Dia'));
    expect(
      tree.root.findAllByProps({testID: 'circle-member-grid-scroll'}),
    ).toHaveLength(0);
  });

  it('places invite last when fewer than four members are visible', () => {
    const tree = renderGrid(
      [member('user-1', 'Ada', 'pending'), member('user-2', 'Ben', 'done')],
      {
        inviteAction: {
          accessibilityLabel: 'Invite Members',
          onPress: jest.fn(),
        },
      },
    );
    const pageText = textContent(
      tree.root.findByProps({testID: 'circle-member-grid-page-0'}),
    );

    expect(pageText.indexOf('Ada')).toBeLessThan(pageText.indexOf('Ben'));
    expect(pageText.indexOf('Ben')).toBeLessThan(pageText.indexOf('Invite'));
  });

  it('uses orange needed rings and a neutral translucent invite card', () => {
    const tree = renderGrid([member('user-1', 'Ada', 'pending')], {
      inviteAction: {
        accessibilityLabel: 'Invite Members',
        onPress: jest.fn(),
      },
    });
    const output = outputOf(tree);
    const firstRing = tree.root.findAllByType(GradientRing)[0];
    const firstAvatar = tree.root.findAllByType(LayeredAvatar)[0];
    const invitePressable = tree.root.findByProps({
      accessibilityLabel: 'Invite Members',
    });
    const inviteStyle = StyleSheet.flatten(
      invitePressable.props.style({pressed: false}),
    );

    expect(firstRing.props.flatColor).toBe('#F5A623');
    expect(firstRing.props.strokeWidth).toBe(4.5);
    expect(firstAvatar.props.chrome).toBe('minimal');
    expect(firstAvatar.props.size).toBe(56);
    expect(output).toContain('Needs Tap In');
    expect(output).not.toContain('Needed');
    expect(inviteStyle.height).toBe(inviteStyle.width);
    expect(output).toContain('rgba(142,147,176,0.34)');
    expect(output).not.toContain('rgba(122,85,255,0.06)');
    expect(output).not.toContain('rgba(122,85,255,0.32)');
  });

  it('keeps invite in the first four slots when the grid overflows', () => {
    const tree = renderGrid(
      [
        member('user-1', 'Ada', 'pending'),
        member('user-2', 'Ben', 'done'),
        member('user-3', 'Cam', 'skipped'),
        member('user-4', 'Dia', 'missed'),
        member('user-5', 'Eli', 'pending'),
      ],
      {
        inviteAction: {
          accessibilityLabel: 'Invite Members',
          onPress: jest.fn(),
        },
      },
    );
    const firstPageText = textContent(
      tree.root.findByProps({testID: 'circle-member-grid-page-0'}),
    );
    const secondPageText = textContent(
      tree.root.findByProps({testID: 'circle-member-grid-page-1'}),
    );

    expect(firstPageText).toContain('Ada');
    expect(firstPageText).toContain('Ben');
    expect(firstPageText).toContain('Cam');
    expect(firstPageText).toContain('Invite');
    expect(firstPageText).not.toContain('Dia');
    expect(secondPageText).toContain('Dia');
    expect(secondPageText).toContain('Eli');
    expect(
      tree.root.findByProps({testID: 'circle-member-grid-scroll'}),
    ).toBeTruthy();
  });

  it('shows viewer Tap In and per-member Nudge actions where eligible', () => {
    const onTapInViewer = jest.fn();
    const onNudgeMember = jest.fn();
    const members = [
      member('viewer-uid', 'Kelvin', 'pending'),
      member('user-2', 'Ari', 'pending'),
      member('user-3', 'Sky', 'done'),
      member('user-4', 'Penny', 'pending', 'pending'),
    ];
    const tree = renderGrid(members, {
      canTapInViewer: true,
      onNudgeMember,
      onTapInViewer,
      viewerUid: 'viewer-uid',
    });
    const output = outputOf(tree);

    expect(output).toContain('Tap In');
    expect(output).toContain('Nudge');
    expect(output).toContain('Done');
    expect(output).toContain('Pending');

    const nudgeButton = tree.root.findByProps({
      accessibilityLabel: 'Nudge 1 Member',
    });
    act(() => {
      nudgeButton.props.onPress();
    });

    expect(onNudgeMember).toHaveBeenCalledWith(members[1]);
    expect(
      tree.root
        .findAllByType(Pressable)
        .some(node => textContent(node).includes('Tap In')),
    ).toBe(true);
    expect(output).not.toContain('Review');
  });

  it('shows pending request review without replacing active nudge actions', () => {
    const onNudgeMember = jest.fn();
    const onReviewPendingMember = jest.fn();
    const pendingRequest = member(
      'requester-1',
      'Penny',
      'pending',
      'pending',
    );
    const members = [member('user-2', 'Ari', 'pending'), pendingRequest];
    const tree = renderGrid(members, {
      onNudgeMember,
      onReviewPendingMember,
    });
    const output = outputOf(tree);

    expect(output).toContain('Nudge');
    expect(output).toContain('Review');
    expect(
      tree.root.findAllByProps({
        accessibilityLabel: "Review Ari's join request",
      }),
    ).toHaveLength(0);

    const reviewButton = tree.root.findByProps({
      accessibilityLabel: "Review Penny's join request",
    });
    act(() => {
      reviewButton.props.onPress();
    });

    expect(onReviewPendingMember).toHaveBeenCalledWith(pendingRequest);
  });

  it('keeps pending request cards read-only without a review handler', () => {
    const tree = renderGrid([
      member('requester-1', 'Penny', 'pending', 'pending'),
    ]);
    const output = outputOf(tree);

    expect(output).toContain('Pending');
    expect(output).not.toContain('Review');
    expect(
      tree.root.findAllByProps({
        accessibilityLabel: "Review Penny's join request",
      }),
    ).toHaveLength(0);
  });

  it('marks the pending request review action busy while reviewing', () => {
    const tree = renderGrid(
      [member('requester-1', 'Penny', 'pending', 'pending')],
      {
        onReviewPendingMember: jest.fn(),
        reviewingPendingMemberId: 'requester-1',
      },
    );
    const reviewButton = tree.root.findByProps({
      accessibilityLabel: "Reviewing Penny's join request",
    });

    expect(outputOf(tree)).toContain('Reviewing');
    expect(reviewButton.props.accessibilityState).toEqual({
      busy: true,
      disabled: true,
    });
  });

  it('keeps the pending viewer name label readable inside the card', () => {
    const tree = renderGrid(
      [member('viewer-uid', 'Kelvin', 'pending', 'pending')],
      {
        viewerUid: 'viewer-uid',
      },
    );
    const nameLabel = tree.root.findByProps({
      testID: 'circle-member-name-viewer-uid',
    });
    const nameStyle = StyleSheet.flatten(nameLabel.props.style);

    expect(textContent(nameLabel)).toBe('Kelvin · You');
    expect(nameStyle.fontSize).toBeGreaterThanOrEqual(13);
    expect(nameStyle.width).toBe('100%');
    expect(nameLabel.props.minimumFontScale).toBeGreaterThanOrEqual(0.82);
  });
});
