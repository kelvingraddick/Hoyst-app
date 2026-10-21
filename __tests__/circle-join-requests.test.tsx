import React from 'react';
import {Alert, Modal, Text} from 'react-native';
import renderer, {act} from 'react-test-renderer';
import {LayeredAvatar} from '../src/design/components/LayeredAvatar';
import {CircleJoinRequestPrompt} from '../src/features/circles/components/CircleJoinRequestPrompt';
import {CircleJoinRequestSheet} from '../src/features/circles/components/CircleJoinRequestSheet';
import {reviewJoinRequest} from '../src/features/circles/services/circle-service';
import {getPendingCircleJoinRequests} from '../src/features/circles/services/join-request-selectors';
import type {CircleDetailModel, CircleMemberStatus} from '../src/types/models';

jest.mock('../src/features/circles/services/circle-service', () => ({
  reviewJoinRequest: jest.fn(),
}));
jest.mock('../src/design/theme/useHoystTheme', () => ({
  useHoystTheme: () =>
    require('../src/design/tokens/colors').getHoystThemeColors('light'),
}));
jest.mock('../src/design/components/LayeredAvatar', () => ({
  LayeredAvatar: () => null,
}));
jest.mock('react-native-safe-area-context', () => ({
  SafeAreaView: require('react-native').View,
}));
const request = (id: string, name = id): CircleMemberStatus => ({
  id,
  name,
  initials: name[0],
  membershipStatus: 'pending',
  state: 'pending',
  requestedAt: new Date('2026-10-20T12:00:00Z'),
});
const circle = (
  overrides: Partial<CircleDetailModel> = {},
): CircleDetailModel =>
  ({
    id: 'circle',
    title: 'Morning Movers',
    circleMode: 'group',
    lifecycleStatus: 'active',
    viewerRole: 'owner',
    viewerMembershipStatus: 'active',
    members: [request('a', 'Alex'), request('b', 'Blair')],
    ...overrides,
  } as CircleDetailModel);
let tree: renderer.ReactTestRenderer;
let alertSpy: jest.SpyInstance;
let onClose: jest.Mock;
function render(value = circle(), firstRequesterId?: string) {
  onClose = jest.fn();
  act(() => {
    tree = renderer.create(
      <CircleJoinRequestSheet
        circle={value}
        visible
        firstRequesterId={firstRequesterId}
        onClose={onClose}
      />,
    );
  });
}
function update(value: CircleDetailModel) {
  act(() => {
    tree.update(
      <CircleJoinRequestSheet circle={value} visible onClose={onClose} />,
    );
  });
}
function press(label: string) {
  act(() => {
    tree.root.findByProps({accessibilityLabel: label}).props.onPress();
  });
}
function output() {
  return tree.root
    .findAllByType(Text)
    .map(node => JSON.stringify(node.props.children))
    .join(' ');
}
function confirmDeny() {
  const buttons = alertSpy.mock.calls.at(-1)?.[2] as {
    text: string;
    onPress?: () => void;
  }[];
  act(() => {
    buttons.find(button => button.text === 'Deny')?.onPress?.();
  });
}
beforeEach(() => {
  jest.clearAllMocks();
  alertSpy = jest.spyOn(Alert, 'alert').mockImplementation(() => undefined);
  jest.mocked(reviewJoinRequest).mockResolvedValue({status: 'approved'});
});
afterEach(() => {
  if (tree) {
    act(() => tree.unmount());
  }
  alertSpy.mockRestore();
});

it('sorts pending requests by name and ID, without mutating the member strip', () => {
  const value = circle({
    members: [
      request('z', 'Blair'),
      request('b', 'Alex'),
      request('a', 'Alex'),
      {...request('active'), membershipStatus: 'active'},
    ],
  });
  expect(getPendingCircleJoinRequests(value).map(member => member.id)).toEqual([
    'a',
    'b',
    'z',
  ]);
  expect(value.members[0].id).toBe('z');
  expect(getPendingCircleJoinRequests(circle({members: []}))).toEqual([]);
});
it.each([
  {viewerRole: 'admin'},
  {viewerRole: 'member'},
  {viewerMembershipStatus: 'pending'},
  {viewerMembershipStatus: undefined},
  {circleMode: 'personal'},
  {lifecycleStatus: 'archived'},
] as Partial<CircleDetailModel>[])(
  'hides review for ineligible viewer or Circle %j',
  overrides => {
    const value = circle(overrides);
    expect(getPendingCircleJoinRequests(value)).toEqual([]);
    render(value);
    expect(tree.root.findByType(Modal).props.visible).toBe(false);
  },
);
it('places the selected requester first', () => {
  render(circle(), 'b');
  const rows = tree.root.findAll(
    node =>
      typeof node.type === 'string' &&
      /^join-request-/.test(node.props.testID ?? ''),
  );
  expect(rows.map(row => row.props.testID)).toEqual([
    'join-request-b',
    'join-request-a',
  ]);
});
it('prevents duplicate submissions and disables all decisions while saving', async () => {
  let finish!: (value: {status: 'approved'}) => void;
  jest.mocked(reviewJoinRequest).mockReturnValueOnce(
    new Promise(resolve => {
      finish = resolve;
    }),
  );
  render();
  const approve = tree.root.findByProps({
    accessibilityLabel: "Approve Alex's join request",
  }).props.onPress;
  act(() => {
    approve();
    approve();
  });
  expect(reviewJoinRequest).toHaveBeenCalledTimes(1);
  expect(reviewJoinRequest).toHaveBeenCalledWith({
    circleId: 'circle',
    requesterId: 'a',
    approved: true,
  });
  expect(
    tree.root.findByProps({accessibilityLabel: "Deny Blair's join request"})
      .props.disabled,
  ).toBe(true);
  await act(async () => {
    finish({status: 'approved'});
  });
  expect(output()).toContain('Their first Tap In starts at the next window.');
  expect(
    tree.root.findAllByProps({
      accessibilityLabel: "Approve Alex's join request",
    }),
  ).toHaveLength(0);
  expect(
    tree.root.findByProps({accessibilityLabel: "Approve Blair's join request"})
      .props.disabled,
  ).toBe(false);
});
it('requires confirmation for denial and supports cancellation', async () => {
  render();
  press("Deny Alex's join request");
  expect(alertSpy).toHaveBeenCalledWith(
    'Deny join request?',
    "Deny Alex's request to join Morning Movers?",
    expect.arrayContaining([
      expect.objectContaining({text: 'Cancel', style: 'cancel'}),
    ]),
  );
  expect(reviewJoinRequest).not.toHaveBeenCalled();
  jest.mocked(reviewJoinRequest).mockResolvedValueOnce({status: 'declined'});
  confirmDeny();
  await act(async () => {});
  expect(reviewJoinRequest).toHaveBeenCalledWith({
    circleId: 'circle',
    requesterId: 'a',
    approved: false,
  });
  expect(output()).toContain("Alex's request was declined.");
});
it.each(['This circle is full.', 'Check your connection and try again.'])(
  'keeps a failed request retryable: %s',
  async message => {
    jest.mocked(reviewJoinRequest).mockRejectedValueOnce(new Error(message));
    render();
    press("Approve Alex's join request");
    await act(async () => {});
    expect(output()).toContain(message);
    expect(
      tree.root.findByProps({accessibilityLabel: "Approve Alex's join request"})
        .props.disabled,
    ).toBe(false);
    press("Approve Alex's join request");
    await act(async () => {});
    expect(reviewJoinRequest).toHaveBeenCalledTimes(2);
  },
);
it('removes requests resolved elsewhere and allows a later request from the same person', async () => {
  render(circle({members: [request('a', 'Alex')]}));
  press("Approve Alex's join request");
  await act(async () => {});
  expect(output()).toContain('All requests handled');
  update(circle({members: []}));
  update(
    circle({
      members: [
        {
          ...request('a', 'Alex'),
          requestedAt: new Date('2026-10-21T12:00:00Z'),
        },
      ],
    }),
  );
  expect(
    tree.root.findByProps({accessibilityLabel: "Approve Alex's join request"}),
  ).toBeTruthy();
  update(circle({members: []}));
  expect(
    tree.root.findAllByProps({
      accessibilityLabel: "Approve Alex's join request",
    }),
  ).toHaveLength(0);
});
it('handles a stale server request without leaving an actionable row', async () => {
  jest
    .mocked(reviewJoinRequest)
    .mockRejectedValueOnce({code: 'functions/not-found'});
  render(circle({members: [request('a', 'Alex')]}));
  press("Approve Alex's join request");
  await act(async () => {});
  expect(output()).toContain('This request is no longer pending.');
  expect(output()).toContain('All requests handled');
});
it('rejects a stale denial confirmation after ownership is lost', () => {
  render();
  press("Deny Alex's join request");
  update(circle({viewerRole: 'member'}));
  confirmDeny();
  expect(reviewJoinRequest).not.toHaveBeenCalled();
  expect(tree.root.findByType(Modal).props.visible).toBe(false);
});
it('closes through the button, backdrop, and system back without submitting a decision', () => {
  render();
  press('Close join requests');
  act(() =>
    tree.root.findByProps({testID: 'join-requests-backdrop'}).props.onPress(),
  );
  act(() => tree.root.findByType(Modal).props.onRequestClose());
  expect(onClose).toHaveBeenCalledTimes(3);
  expect(reviewJoinRequest).not.toHaveBeenCalled();
});

it('shows one requester by name on Home and uses their actual avatar', () => {
  const member = {
    ...request('a', 'Alex'),
    avatarUrl: 'https://example.com/alex.png',
  };
  act(() => {
    tree = renderer.create(
      <CircleJoinRequestPrompt
        requests={[member]}
        circleTitle="Morning Movers"
        variant="home"
        onPress={jest.fn()}
      />,
    );
  });
  expect(output()).toContain('Alex wants to join');
  expect(output()).toContain('Morning Movers');
  expect(tree.root.findByType(LayeredAvatar).props.imageUrl).toBe(
    member.avatarUrl,
  );
});

it('previews distinct users, pluralizes the total, and opens review once', () => {
  const review = jest.fn();
  act(() => {
    tree = renderer.create(
      <CircleJoinRequestPrompt
        requests={[request('a', 'Alex'), request('b', 'Blair')]}
        onPress={review}
      />,
    );
  });
  expect(output()).toContain('2 join requests');
  expect(output()).toContain('Alex, Blair');
  expect(
    tree.root.findAllByType(LayeredAvatar).map(node => node.props.initials),
  ).toEqual(['A', 'B']);
  press('Review 2 join requests');
  expect(review).toHaveBeenCalledTimes(1);
});

it('bounds the avatar preview while showing the full request and overflow counts', () => {
  const requests = Array.from({length: 6}, (_, index) =>
    request(String(index), `Member ${index}`),
  );
  act(() => {
    tree = renderer.create(
      <CircleJoinRequestPrompt
        requests={requests}
        circleTitle="Morning Movers"
        onPress={jest.fn()}
      />,
    );
  });
  expect(output()).toContain('6 join requests');
  expect(tree.root.findAllByType(LayeredAvatar)).toHaveLength(2);
  expect(
    tree.root.findByProps({
      accessibilityLabel: 'Review 6 join requests for Morning Movers',
    }),
  ).toBeTruthy();
  expect(
    tree.root
      .findAllByType(Text)
      .some(
        node =>
          JSON.stringify(node.props.children) === JSON.stringify(['+', 4]),
      ),
  ).toBe(true);
  act(() => {
    tree.update(<CircleJoinRequestPrompt requests={[]} onPress={jest.fn()} />);
  });
  expect(tree.toJSON()).toBeNull();
});

it('approves and denies different requesters independently and keeps a failed request retryable', async () => {
  render(
    circle({
      members: [
        request('a', 'Alex'),
        request('b', 'Blair'),
        request('c', 'Casey'),
      ],
    }),
  );
  expect(output()).toContain('3 join requests');
  press("Approve Alex's join request");
  await act(async () => {});
  expect(output()).toContain('2 join requests');
  expect(
    tree.root.findByProps({accessibilityLabel: "Approve Blair's join request"}),
  ).toBeTruthy();
  jest.mocked(reviewJoinRequest).mockResolvedValueOnce({status: 'declined'});
  press("Deny Blair's join request");
  confirmDeny();
  await act(async () => {});
  expect(output()).toContain('1 join request');
  jest
    .mocked(reviewJoinRequest)
    .mockRejectedValueOnce(new Error('Connection lost. Try again.'));
  press("Approve Casey's join request");
  await act(async () => {});
  expect(output()).toContain('1 join request');
  expect(output()).not.toContain('All requests handled');
  press("Approve Casey's join request");
  await act(async () => {});
  expect(output()).toContain('All requests handled');
  expect(
    jest
      .mocked(reviewJoinRequest)
      .mock.calls.map(([input]) => [input.requesterId, input.approved]),
  ).toEqual([
    ['a', true],
    ['b', false],
    ['c', true],
    ['c', true],
  ]);
});
