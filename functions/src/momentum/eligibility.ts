import type {DocumentData} from 'firebase-admin/firestore';

import {getDateKey, type OpportunitySlot} from './schedule';

type DateValue =
  | Date
  | {toDate?: () => Date}
  | {seconds?: number}
  | string
  | undefined;

function toDate(value: DateValue) {
  if (value instanceof Date) {
    return value;
  }

  if (typeof value === 'string') {
    const parsed = new Date(value);
    return Number.isNaN(parsed.getTime()) ? undefined : parsed;
  }

  if (value && typeof value === 'object') {
    if ('toDate' in value && typeof value.toDate === 'function') {
      return value.toDate();
    }

    if ('seconds' in value && typeof value.seconds === 'number') {
      return new Date(value.seconds * 1000);
    }
  }

  return undefined;
}

function getMembershipDateKey(
  value: DateValue,
  timezone: string,
): string | undefined {
  const date = toDate(value);
  return date ? getDateKey(timezone, date) : undefined;
}

export function isMemberExpectedForSlot({
  member,
  slot,
  timezone,
}: {
  member: DocumentData | undefined;
  slot: OpportunitySlot;
  timezone: string;
}) {
  if (!member || member.status !== 'active') {
    return false;
  }

  const joinedDateKey = getMembershipDateKey(member.joinedAt, timezone);
  const leftDateKey = getMembershipDateKey(member.leftAt, timezone);

  if (leftDateKey && slot.expiresDateKey >= leftDateKey) {
    return false;
  }

  if (!joinedDateKey) {
    return true;
  }

  if (slot.availableDateKey > joinedDateKey) {
    return true;
  }

  return (
    member.opportunityEligibility === 'include_current' &&
    slot.availableDateKey <= joinedDateKey &&
    slot.expiresDateKey >= joinedDateKey
  );
}

export function getEligibleOpenSlot({
  dateKey,
  existingStatuses,
  member,
  slots,
  timezone,
}: {
  dateKey: string;
  existingStatuses: Map<number, unknown>;
  member: DocumentData | undefined;
  slots: OpportunitySlot[];
  timezone: string;
}) {
  return slots.find(slot => {
    const status = existingStatuses.get(slot.slotIndex);

    return (
      isMemberExpectedForSlot({member, slot, timezone}) &&
      slot.availableDateKey <= dateKey &&
      slot.expiresDateKey >= dateKey &&
      status !== 'completed' &&
      status !== 'skipped'
    );
  });
}
