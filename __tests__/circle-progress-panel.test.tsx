import React from 'react';
import {Modal, Pressable, Text, StyleSheet} from 'react-native';
import * as ReactNative from 'react-native';
import renderer, {act} from 'react-test-renderer';
import {DesignSystemProvider, DSSectionHeading} from '../src/design/system';
import {CircleProgressPanel} from '../src/features/circles/components/CircleProgressPanel';
import type {CircleDetailModel} from '../src/types/models';
import type {
  CircleDayCoverage,
  CircleProgressSummary,
} from '../src/shared/circle-progress';

jest.mock('../src/features/circles/services/circle-progress-service', () => ({
  loadCircleDayDetails: jest.fn(),
}));
jest.mock('../src/store/settings-store', () => ({
  useSettingsStore: (select: (state: {appearance: string}) => unknown) =>
    select({appearance: 'light'}),
}));
const day = '2026-10-17';
const detail = {
  id: 'test',
  circleMode: 'group',
  commitmentCadence: 'weekly',
  viewerUid: 'me',
  viewerMembershipStatus: 'active',
  members: [
    {id: 'me', name: 'You'},
    {id: 'other', name: 'Alex'},
  ],
} as CircleDetailModel;
const summary: CircleProgressSummary = {
  version: 2,
  revision: 'fixture',
  asOfDateKey: day,
  cadence: 'weekly',
  period: {key: day, start: day, end: day},
  streak: {count: 1, unit: 'week', availability: 'ready'},
  progress: {covered: 1, required: 3, outcome: 'open'},
};
const covered: CircleDayCoverage = {
  known: true,
  expectedUids: ['me', 'other', 'former'],
  completedUids: ['me'],
  skippedUids: ['other'],
  restoredUids: ['other'],
};
let tree: renderer.ReactTestRenderer;
const text = () =>
  tree.root
    .findAllByType(Text)
    .flatMap(node => node.props.children)
    .flat(Infinity)
    .filter(value => typeof value === 'string' || typeof value === 'number')
    .join(' ')
    .replace(/\s+/g, ' ');
const press = (label: string) =>
  tree.root
    .findAllByType(Pressable)
    .find(node => String(node.props.accessibilityLabel).includes(label))!
    .props.onPress();
function mount(
  props: Partial<React.ComponentProps<typeof CircleProgressPanel>> = {},
) {
  act(() => {
    tree = renderer.create(
      <DesignSystemProvider scheme="light">
        <CircleProgressPanel
          detail={detail}
          viewer={summary}
          group={summary}
          days={[{dateKey: day}]}
          coverage={new Map([[day, covered]])}
          {...props}
        />
      </DesignSystemProvider>,
    );
  });
}
afterEach(() => {
  act(() => tree?.unmount());
  jest.restoreAllMocks();
});

it.each([
  [360, 1],
  [440, 1.6],
])(
  'keeps amount status and streak access readable at width %s and font scale %s',
  (width, fontScale) => {
    jest
      .spyOn(ReactNative, 'useWindowDimensions')
      .mockReturnValue({width, height: 850, fontScale, scale: 3});
    mount({
      detail: {
        ...detail,
        commitmentType: 'build',
        buildTrackingMode: 'quantity',
        targetValue: 7,
        unitLabel: 'Hours of sleep',
        viewerTodayCheckIn: {dateKey: day, status: 'partial', currentValue: 5},
      },
      viewer: {
        ...summary,
        progress: {covered: 0, required: 1, outcome: 'open'},
      },
    });
    expect(text()).toContain('In progress 5 of 7 Hours of sleep');
    const metric = tree.root.findByProps({
      testID: 'circle-viewer-period-progress',
    });
    expect(metric.props.accessibilityLabel).toBe(
      'You. In progress. 5 of 7 Hours of sleep',
    );
    expect(
      metric.findAllByProps({accessibilityRole: 'progressbar'}),
    ).toHaveLength(0);
    expect(
      StyleSheet.flatten(
        tree.root.findByProps({testID: 'circle-period-goals'}).props.style,
      ).flexDirection,
    ).toBe('column');
    act(() => press('Your streak:'));
    expect(tree.root.findByType(Modal).props.visible).toBe(true);
  },
);

it('uses equal member fractions and explicit cadence units independently of the goal target', () => {
  mount();
  const self = tree.root.findByProps({testID: `circle-day-you-${day}`});
  const others = tree.root.findByProps({testID: `circle-day-others-${day}`});
  expect(self.props.strokeDasharray).toBe(others.props.strokeDasharray);
  expect(others.props.strokeDashoffset).toBeCloseTo(
    (-2 * Math.PI * self.props.r) / 3,
  );
  expect(text()).toContain('1 week');
  expect(text()).toContain('1 of 3 Tap Ins');
  expect(text()).toContain('Your streak');
  expect(text()).toContain('Group streak');
});
it.each([
  ['daily', 'Today'],
  ['weekly', 'This week'],
  ['monthly', 'This month'],
] as const)(
  'places %s progress after daily activity and keeps the counts descriptive',
  (cadence, heading) => {
    const one = {
      ...summary,
      progress: {...summary.progress, covered: 0, required: 1},
    };
    mount({
      detail: {...detail, commitmentCadence: cadence},
      viewer: one,
      group: one,
    });
    const headings = tree.root
      .findAllByType(DSSectionHeading)
      .map(node => node.props.title);
    expect(headings).toEqual(['Daily activity', heading]);
    expect(text()).toContain('Needs Tap In');
    expect(text()).not.toContain('0 of 1 Tap In');
    expect(text()).toContain('0 of 1 met goal');
    expect(
      tree.root.findAllByProps({
        accessibilityLabel: 'Group progress: 0 of 1 member met goal',
      }).length,
    ).toBeGreaterThan(0);
    expect(text()).not.toContain('Tap a day for completion and skip details');
    expect(
      tree.root
        .findByProps({testID: 'circle-viewer-period-progress'})
        .findAllByProps({accessibilityRole: 'progressbar'}),
    ).toHaveLength(0);
    expect(
      tree.root
        .findByProps({testID: 'circle-group-period-progress'})
        .findByProps({accessibilityRole: 'progressbar'}).props
        .accessibilityValue,
    ).toEqual({min: 0, max: 1, now: 0});
  },
);
it('shows only the group tile and no member activity for a nonmember', () => {
  mount({detail: {...detail, viewerMembershipStatus: undefined}});
  expect(
    tree.root.findAllByProps({testID: 'circle-viewer-period-progress'}),
  ).toHaveLength(0);
  expect(
    tree.root.findByProps({testID: 'circle-group-period-progress'}),
  ).toBeTruthy();
  expect(text()).not.toContain('Daily activity');
  expect(text()).not.toContain('Your streak');
});
it('turns fully protected coverage into a full check and explains restored and historical members', async () => {
  const all = {...covered, skippedUids: ['other', 'former']};
  const loadDay = jest
    .fn()
    .mockResolvedValue([{id: 'former', displayName: 'Sam', status: 'skip'}]);
  mount({coverage: new Map([[day, all]]), loadDay});
  expect(
    tree.root.findAllByProps({testID: `circle-day-you-${day}`}),
  ).toHaveLength(0);
  await act(async () => {
    await press('Saturday, October 17');
  });
  expect(text()).toContain('3 of 3 members covered');
  expect(text()).toContain('Alex: Restored');
  expect(text()).toContain('Sam: Skipped');
  expect(text()).toContain('Membership reflects this date');
});
it('distinguishes incomplete quantity entries and unavailable history from zero', async () => {
  mount({
    loadDay: jest
      .fn()
      .mockResolvedValue([
        {id: 'former', displayName: 'Sam', status: 'partial'},
      ]),
  });
  await act(async () => {
    await press('Saturday, October 17');
  });
  expect(text()).toContain('Sam: Partial');
  act(() => press('Close details'));
  act(() =>
    tree.update(
      <DesignSystemProvider scheme="light">
        <CircleProgressPanel
          detail={detail}
          days={[{dateKey: day}]}
          coverage={new Map()}
        />
      </DesignSystemProvider>,
    ),
  );
  act(() => press('Saturday, October 17'));
  expect(text()).toContain('Historical membership or activity is unavailable');
  expect(text()).toContain('Progress unavailable');
  expect(text()).not.toContain('0 of 3');
});
it('keeps personal commitments private to Your streak and provides cadence explanations', () => {
  mount({detail: {...detail, circleMode: 'personal'}});
  expect(text()).not.toContain('Group streak');
  act(() => press('Your streak:'));
  expect(text()).toContain(
    'Weekly and monthly Tap Ins can happen on any eligible days',
  );
  expect(tree.root.findByType(Modal).props.visible).toBe(true);
});
it('ignores a day result after the sheet has closed', async () => {
  let resolve!: (value: []) => void;
  mount({
    loadDay: jest.fn(
      () =>
        new Promise<[]>(receive => {
          resolve = receive;
        }),
    ),
  });
  act(() => {
    press('Saturday, October 17');
  });
  act(() => press('Close details'));
  await act(async () => resolve([]));
  expect(tree.root.findByType(Modal).props.visible).toBe(false);
});
