jest.mock('../functions/src/firebase', () => ({
  db: {
    collection: jest.fn((name: string) => {
      const createMockRef = (path: string): Ref => ({
        collection: (childName: string) =>
          createMockRef(`${path}/${childName}`),
        doc: (id: string) => createMockRef(`${path}/${id}`),
        path,
      });

      return createMockRef(name);
    }),
  },
}));

jest.mock(
  'firebase-admin/firestore',
  () => ({
    FieldValue: {
      delete: jest.fn(() => ({type: 'delete'})),
      increment: jest.fn((value: number) => ({type: 'increment', value})),
      serverTimestamp: jest.fn(() => ({type: 'serverTimestamp'})),
    },
  }),
  {virtual: true},
);

jest.mock(
  'firebase-functions/v2/https',
  () => {
    class MockHttpsError extends Error {
      code: string;

      constructor(code: string, message: string) {
        super(message);
        this.code = code;
      }
    }

    return {
      HttpsError: MockHttpsError,
      onCall: (handler: unknown) => handler,
    };
  },
  {virtual: true},
);

jest.mock(
  'firebase-functions/v2/scheduler',
  () => ({
    onSchedule: (_options: unknown, handler: unknown) => handler,
  }),
  {virtual: true},
);

import {
  recordTapInOpportunity,
  removeTapInOpportunity,
} from '../functions/src/momentum';
import {
  getDateKey,
  getOpportunitySlots,
  normalizeCommitmentSchedule,
} from '../functions/src/momentum/schedule';

type Ref = {
  collection: (name: string) => Ref;
  doc: (id: string) => Ref;
  path: string;
};

function createRef(path: string): Ref {
  return {
    collection: (name: string) => createRef(`${path}/${name}`),
    doc: (id: string) => createRef(`${path}/${id}`),
    path,
  };
}

function snapshot(data?: Record<string, unknown>) {
  return {
    data: () => data,
    exists: Boolean(data),
  };
}

function createReadBeforeWriteTransaction(
  snapshots = new Map<string, Record<string, unknown> | undefined>(),
) {
  const calls: string[] = [];
  let hasWritten = false;
  const transaction = {
    delete: jest.fn((ref: Ref) => {
      hasWritten = true;
      calls.push(`delete:${ref.path}`);
    }),
    get: jest.fn(async (ref: Ref) => {
      if (hasWritten) {
        throw new Error(`read after write: ${ref.path}`);
      }

      calls.push(`get:${ref.path}`);
      return snapshot(snapshots.get(ref.path));
    }),
    set: jest.fn((ref: Ref) => {
      hasWritten = true;
      calls.push(`set:${ref.path}`);
    }),
  };

  return {calls, transaction};
}

function expectReadsBeforeWrites(calls: string[]) {
  const firstWriteIndex = calls.findIndex(
    call => call.startsWith('set:') || call.startsWith('delete:'),
  );
  const lastReadIndex = calls.reduce(
    (lastIndex, call, index) =>
      call.startsWith('get:') ? index : lastIndex,
    -1,
  );

  expect(firstWriteIndex).toBeGreaterThanOrEqual(0);
  expect(lastReadIndex).toBeLessThan(firstWriteIndex);
}

const circle = {
  commitment: 'One task a day to help build the Hoyst app',
  commitmentCadence: 'daily',
  commitmentFrequency: {tapInsPerWeek: 7},
  memberCount: 1,
  timezone: 'UTC',
  title: 'Building Hoyst',
};

const weeklyCircle = {
  ...circle,
  commitmentCadence: 'weekly',
  commitmentFrequency: {tapInsPerWeek: 2},
};

const profile = {
  displayName: 'Kelvin',
  handle: 'kelvin',
};

describe('momentum transaction ordering', () => {
  it('records Tap In opportunity reads before transaction writes', async () => {
    const {calls, transaction} = createReadBeforeWriteTransaction();

    await expect(
      recordTapInOpportunity({
        checkInId: 'user-1',
        circle,
        circleId: 'circle-1',
        dateKey: '9999-12-31',
        memberCount: 1,
        profile,
        status: 'done',
        transaction: transaction as never,
        uid: 'user-1',
      }),
    ).resolves.toBeUndefined();

    expectReadsBeforeWrites(calls);
  });

  it('does not overwrite momentum opportunities after the period target is covered', async () => {
    const slots = getOpportunitySlots(normalizeCommitmentSchedule(weeklyCircle));
    const snapshots = new Map<string, Record<string, unknown> | undefined>(
      slots.map(slot => [
        `userPrivate/user-1/opportunities/circle-1_${slot.periodKey}_${slot.slotIndex}`,
        {
          completionDateKey: slot.availableDateKey,
          slotIndex: slot.slotIndex,
          status: 'completed',
        },
      ]),
    );
    const {calls, transaction} = createReadBeforeWriteTransaction(snapshots);

    await expect(
      recordTapInOpportunity({
        checkInId: 'user-1',
        circle: weeklyCircle,
        circleId: 'circle-1',
        dateKey: '9999-12-31',
        memberCount: 1,
        profile,
        status: 'done',
        transaction: transaction as never,
        uid: 'user-1',
      }),
    ).resolves.toBeUndefined();

    expect(calls.every(call => call.startsWith('get:'))).toBe(true);
    expect(transaction.set).not.toHaveBeenCalled();
    expect(transaction.delete).not.toHaveBeenCalled();
  });

  it('removes Tap In opportunity reads before transaction writes', async () => {
    const dateKey = getDateKey('UTC');
    const snapshots = new Map<string, Record<string, unknown> | undefined>([
      [
        `userPrivate/user-1/opportunities/circle-1_${dateKey}_0`,
        {
          completionDateKey: dateKey,
          slotIndex: 0,
          status: 'completed',
        },
      ],
    ]);
    const {calls, transaction} = createReadBeforeWriteTransaction(snapshots);

    await expect(
      removeTapInOpportunity({
        circle,
        circleId: 'circle-1',
        dateKey,
        transaction: transaction as never,
        uid: 'user-1',
      }),
    ).resolves.toBeUndefined();

    expectReadsBeforeWrites(calls);
  });

  it('does not decrement momentum opportunities for surplus Tap In removal', async () => {
    const slots = getOpportunitySlots(normalizeCommitmentSchedule(weeklyCircle));
    const snapshots = new Map<string, Record<string, unknown> | undefined>(
      slots.map(slot => [
        `userPrivate/user-1/opportunities/circle-1_${slot.periodKey}_${slot.slotIndex}`,
        {
          completionDateKey: slot.availableDateKey,
          slotIndex: slot.slotIndex,
          status: 'completed',
        },
      ]),
    );
    const {calls, transaction} = createReadBeforeWriteTransaction(snapshots);

    await expect(
      removeTapInOpportunity({
        circle: weeklyCircle,
        circleId: 'circle-1',
        dateKey: '9999-12-31',
        transaction: transaction as never,
        uid: 'user-1',
      }),
    ).resolves.toBeUndefined();

    expect(calls.every(call => call.startsWith('get:'))).toBe(true);
    expect(transaction.set).not.toHaveBeenCalled();
    expect(transaction.delete).not.toHaveBeenCalled();
  });
});
