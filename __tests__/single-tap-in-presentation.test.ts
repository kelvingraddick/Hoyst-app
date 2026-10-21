import {
  getSingleTapInCoverageDates,
  getSingleTapInPresentation,
} from '../src/features/circles/services/single-tap-in-presentation';
import type {CircleDetailModel} from '../src/types/models';
import type {
  CircleDayCoverage,
  CircleProgressSummary,
} from '../src/shared/circle-progress';

const day = '2026-10-20';
const detail = {
  viewerUid: 'me',
  commitmentType: 'build',
  buildTrackingMode: 'confirmation',
  commitmentCadence: 'daily',
} as CircleDetailModel;
const summary: CircleProgressSummary = {
  version: 2,
  revision: 'fixture',
  asOfDateKey: day,
  cadence: 'daily',
  period: {key: day, start: day, end: day},
  progress: {required: 1, covered: 0, outcome: 'open'},
  streak: {count: 0, unit: 'day', availability: 'ready'},
};
const quantity: Partial<CircleDetailModel> = {
  buildTrackingMode: 'quantity',
  targetValue: 7,
  unitLabel: 'hour',
};
function present(
  overrides: Partial<CircleDetailModel> = {},
  progress: CircleProgressSummary = summary,
  coverage: ReadonlyMap<string, CircleDayCoverage> = new Map(),
) {
  return getSingleTapInPresentation({
    detail: {...detail, ...overrides},
    summary: progress,
    coverage,
  });
}
const complete = {
  ...summary,
  progress: {...summary.progress, covered: 1, outcome: 'secured' as const},
};

it('uses status for confirmation goals without a redundant Tap In fraction', () => {
  expect(present()).toEqual({status: 'Needs Tap In'});
  expect(present({viewerTodayCheckIn: {dateKey: day, status: 'done'}})).toEqual(
    {status: 'Goal met'},
  );
});

it.each([
  ['unknown', {required: 1, covered: 0, outcome: 'unknown' as const}],
  ['ineligible', {required: 0, covered: 0, outcome: 'neutral' as const}],
  ['multiple Tap Ins', {required: 3, covered: 1, outcome: 'open' as const}],
])('leaves %s progress to the existing presentation', (_, progress) => {
  expect(present({}, {...summary, progress})).toBeUndefined();
});

it('leaves a missing summary unavailable', () => {
  expect(
    getSingleTapInPresentation({detail, coverage: new Map()}),
  ).toBeUndefined();
});

it('shows the configured goal before logging without inventing a saved zero', () => {
  expect(present(quantity)).toEqual({
    status: 'Needs Tap In',
    supportingText: 'Goal: 7 hours',
  });
  expect(
    present({commitmentType: 'limit', maximumValue: 2, unitLabel: 'cup'}),
  ).toEqual({status: 'Needs Tap In', supportingText: 'Maximum: 2 cups'});
});

it.each([
  [0, 'In progress', '0 of 7 hours'],
  [5, 'In progress', '5 of 7 hours'],
  [5.5, 'In progress', '5.5 of 7 hours'],
  [7, 'Goal met', '7 of 7 hours'],
  [8, 'Goal met', '8 of 7 hours'],
])('validates a saved amount of %s against its goal', (value, status, copy) => {
  expect(
    present({
      ...quantity,
      viewerTodayCheckIn: {dateKey: day, status: 'done', currentValue: value},
    }),
  ).toEqual({status, supportingText: copy});
});

it('does not treat a saved partial Tap In as goal completion', () => {
  expect(
    present({
      ...quantity,
      viewerHasTappedInToday: true,
      viewerTodayCheckIn: {
        dateKey: day,
        status: 'done',
        coverageStatus: 'partial',
        currentValue: 5,
      },
    }),
  ).toEqual({status: 'In progress', supportingText: '5 of 7 hours'});
});

it.each([undefined, NaN, -1])(
  'does not infer quantity completion from an invalid saved amount %s',
  currentValue => {
    expect(
      present({
        ...quantity,
        viewerTodayCheckIn: {dateKey: day, status: 'done', currentValue},
      }),
    ).toEqual({status: 'Needs Tap In', supportingText: 'Goal: 7 hours'});
  },
);

it('retains actual amounts when a quantity target is one', () => {
  expect(
    present({
      ...quantity,
      targetValue: 1,
      unitLabel: 'mile',
      viewerTodayCheckIn: {dateKey: day, status: 'done', currentValue: 2},
    }),
  ).toEqual({status: 'Goal met', supportingText: '2 of 1 mile'});
});

it('uses the saved goal snapshot and preserves custom unit phrases', () => {
  expect(
    present({
      ...quantity,
      targetValue: 9,
      viewerTodayCheckIn: {
        dateKey: day,
        status: 'partial',
        currentValue: 5,
        targetValue: 7,
        unitLabel: 'Hours of sleep',
      },
    }),
  ).toEqual({status: 'In progress', supportingText: '5 of 7 Hours of sleep'});
});

it.each([
  [undefined, 2, 0, 'Goal met', '0 cups · Maximum: 2 cups'],
  [undefined, 2, 3, 'Goal not met', '3 cups · Maximum: 2 cups'],
  [1, 3, 0, 'Goal not met', '0 cups · Allowed range: 1 to 3 cups'],
  [1, 3, 2, 'Goal met', '2 cups · Allowed range: 1 to 3 cups'],
  [undefined, 0, 0, 'Goal met', '0 cups · Maximum: 0 cups'],
])('respects limit bounds %s to %s at %s', (min, max, value, status, copy) => {
  expect(
    present({
      commitmentType: 'limit',
      minimumValue: min,
      maximumValue: max,
      unitLabel: 'cup',
      viewerTodayCheckIn: {dateKey: day, status: 'done', currentValue: value},
    }),
  ).toEqual({status, supportingText: copy});
});

it('keeps avoid-goal results free of invented quantity progress', () => {
  expect(
    present({
      commitmentType: 'avoid',
      viewerTodayCheckIn: {dateKey: day, status: 'failed', currentValue: 0},
    }),
  ).toEqual({status: 'Goal not met'});
});

it.each(['2026-10-19', '2026-10-21'])(
  'ignores a saved record dated %s',
  dateKey => {
    expect(
      present({
        ...quantity,
        currentValue: 7,
        viewerTodayCheckIn: {dateKey, status: 'done', currentValue: 7},
      }),
    ).toEqual({status: 'Needs Tap In', supportingText: 'Goal: 7 hours'});
  },
);

it.each(['weekly', 'monthly'] as const)(
  'keeps an earlier completed %s goal separate from a later partial amount',
  cadence => {
    const period = {
      ...complete,
      cadence,
      period: {key: '2026-10-01', start: '2026-10-01', end: '2026-10-31'},
    };
    const earlierCompletion = new Map([
      [
        '2026-10-02',
        {
          known: true,
          expectedUids: ['me'],
          completedUids: ['me'],
          skippedUids: [],
          restoredUids: [],
        },
      ],
    ]);
    expect(
      present(
        {
          ...quantity,
          commitmentCadence: cadence,
          commitmentFrequency: {tapInsPerWeek: 1, opportunitiesPerPeriod: 1},
          viewerTodayCheckIn: {
            dateKey: day,
            status: 'partial',
            currentValue: 3,
          },
        },
        period,
        earlierCompletion,
      ),
    ).toEqual({status: 'Goal met'});
    expect(
      present(
        {...quantity, commitmentCadence: cadence},
        period,
        earlierCompletion,
      ),
    ).toEqual({
      status: 'Goal met',
    });
    expect(
      present(
        {
          ...quantity,
          commitmentCadence: cadence,
          commitmentFrequency: {tapInsPerWeek: 1, opportunitiesPerPeriod: 1},
        },
        {...period, progress: summary.progress},
      ),
    ).toEqual({status: 'Needs Tap In', supportingText: 'Goal: 7 hours'});
  },
);

it('labels a valid skip as Skipped rather than claiming the goal was met', () => {
  expect(
    present({viewerTodayCheckIn: {dateKey: day, status: 'skip'}}, complete),
  ).toEqual({status: 'Skipped'});
});

it.each([
  ['skipped', 'Skipped'],
  ['restored', 'Protected'],
] as const)('identifies %s period coverage', (kind, status) => {
  const coverage = new Map([
    [
      day,
      {
        known: true,
        expectedUids: ['me'],
        completedUids: [],
        skippedUids: ['me'],
        restoredUids: kind === 'restored' ? ['me'] : [],
      },
    ],
  ]);
  expect(present({}, complete, coverage)).toEqual({status});
});

it('does not borrow another member or another period protection status', () => {
  const coverage = new Map([
    [
      '2026-10-19',
      {
        known: true,
        expectedUids: ['me'],
        completedUids: [],
        skippedUids: ['me'],
        restoredUids: ['me'],
      },
    ],
    [
      day,
      {
        known: true,
        expectedUids: ['me', 'other'],
        completedUids: [],
        skippedUids: ['other'],
        restoredUids: ['other'],
      },
    ],
  ]);
  expect(present({}, complete, coverage)).toEqual({
    status: 'Progress unavailable',
  });
});

it('does not claim completion from aggregate coverage without its source', () => {
  expect(present({}, complete)).toEqual({status: 'Progress unavailable'});
});

it.each(['skipped', 'restored'] as const)(
  'loads earlier monthly %s coverage outside the activity strip',
  kind => {
    const monthly = {
      ...complete,
      cadence: 'monthly' as const,
      period: {key: '2026-10-01', start: '2026-10-01', end: '2026-10-31'},
    };
    const dates = getSingleTapInCoverageDates(monthly, ['2026-10-19', day]);
    expect(dates).toContain('2026-10-01');
    expect(dates).toHaveLength(20);
    expect(dates).not.toContain('2026-10-21');
    const coverage = new Map([
      [
        '2026-10-02',
        {
          known: true,
          expectedUids: ['me'],
          completedUids: [],
          skippedUids: ['me'],
          restoredUids: kind === 'restored' ? ['me'] : [],
        },
      ],
    ]);
    expect(present({}, monthly, coverage)).toEqual({
      status: kind === 'restored' ? 'Protected' : 'Skipped',
    });
  },
);

it('keeps timeline reads unchanged for multiple or unknown Tap In requirements', () => {
  const timeline = ['2026-10-19', day];
  expect(getSingleTapInCoverageDates(undefined, timeline)).toEqual(timeline);
  expect(
    getSingleTapInCoverageDates(
      {...summary, progress: {...summary.progress, required: 3}},
      timeline,
    ),
  ).toEqual(timeline);
});
