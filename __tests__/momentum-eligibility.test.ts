import {
  getEligibleOpenSlot,
  isMemberExpectedForSlot,
} from '../functions/src/momentum/eligibility';

const slots = [
  {
    availableDateKey: '2026-07-13',
    expiresDateKey: '2026-07-14',
    periodKey: '2026-07-13',
    slotIndex: 0,
  },
  {
    availableDateKey: '2026-07-15',
    expiresDateKey: '2026-07-16',
    periodKey: '2026-07-13',
    slotIndex: 1,
  },
];

describe('membership opportunity eligibility', () => {
  it('gives a creator the opportunity open when the circle is created', () => {
    expect(
      isMemberExpectedForSlot({
        member: {
          joinedAt: new Date('2026-07-14T16:00:00Z'),
          opportunityEligibility: 'include_current',
          status: 'active',
        },
        slot: slots[0],
        timezone: 'UTC',
      }),
    ).toBe(true);
  });

  it('starts a later member at the next opening', () => {
    const member = {
      joinedAt: new Date('2026-07-14T16:00:00Z'),
      opportunityEligibility: 'next_opening',
      status: 'active',
    };

    expect(
      isMemberExpectedForSlot({member, slot: slots[0], timezone: 'UTC'}),
    ).toBe(false);
    expect(
      isMemberExpectedForSlot({member, slot: slots[1], timezone: 'UTC'}),
    ).toBe(true);
  });

  it('removes a member from a window that is open when they leave', () => {
    expect(
      isMemberExpectedForSlot({
        member: {
          joinedAt: new Date('2026-07-12T16:00:00Z'),
          leftAt: new Date('2026-07-14T16:00:00Z'),
          opportunityEligibility: 'next_opening',
          status: 'active',
        },
        slot: slots[0],
        timezone: 'UTC',
      }),
    ).toBe(false);
  });

  it('preserves expectations for windows that closed before leaving', () => {
    expect(
      isMemberExpectedForSlot({
        member: {
          joinedAt: new Date('2026-07-12T16:00:00Z'),
          leftAt: new Date('2026-07-15T16:00:00Z'),
          opportunityEligibility: 'next_opening',
          status: 'active',
        },
        slot: slots[0],
        timezone: 'UTC',
      }),
    ).toBe(true);
  });

  it('does not assign a Tap In before an eligible slot opens', () => {
    expect(
      getEligibleOpenSlot({
        dateKey: '2026-07-14',
        existingStatuses: new Map(),
        member: {
          joinedAt: new Date('2026-07-14T12:00:00Z'),
          opportunityEligibility: 'next_opening',
          status: 'active',
        },
        slots,
        timezone: 'UTC',
      }),
    ).toBeUndefined();
  });
  it('caps a flexible quota at entry and rejects the joining date', () => {
    const quota = Array.from({length: 3}, (_, slotIndex) => ({availableDateKey: '2026-10-12', expiresDateKey: '2026-10-18', periodKey: '2026-10-12', slotIndex, policyVersion: 2 as const}));
    const member = {joinedAt: new Date('2026-10-16T12:00:00Z'), opportunityEligibility: 'next_opening', status: 'active'};
    expect(quota.filter(slot => isMemberExpectedForSlot({member, slot, timezone: 'UTC'}))).toHaveLength(2);
    expect(getEligibleOpenSlot({member, slots: quota, dateKey: '2026-10-16', existingStatuses: new Map(), timezone: 'UTC'})).toBeUndefined();
    expect(getEligibleOpenSlot({member, slots: quota, dateKey: '2026-10-17', existingStatuses: new Map(), timezone: 'UTC'})?.slotIndex).toBe(0);
  });

});
