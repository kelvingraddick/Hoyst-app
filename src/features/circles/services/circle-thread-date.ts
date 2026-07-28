import {DateTime} from 'luxon';

import type {CircleThreadItem} from '../../../types/models';

export type CircleThreadDaySection = {
  dateKey: string;
  items: CircleThreadItem[];
  label: string;
};

function getZonedDateTime(value: Date | number, timezone: string) {
  const preferred =
    value instanceof Date
      ? DateTime.fromJSDate(value, {zone: timezone})
      : DateTime.fromMillis(value, {zone: timezone});

  if (preferred.isValid) {
    return preferred;
  }

  return value instanceof Date
    ? DateTime.fromJSDate(value, {zone: 'UTC'})
    : DateTime.fromMillis(value, {zone: 'UTC'});
}

function getDayLabel({
  date,
  todayKey,
  yesterdayKey,
}: {
  date: DateTime;
  todayKey: string;
  yesterdayKey: string;
}) {
  const dateKey = date.toFormat('yyyy-LL-dd');

  if (dateKey === todayKey) {
    return 'TODAY';
  }

  if (dateKey === yesterdayKey) {
    return 'YESTERDAY';
  }

  return date.setLocale('en-US').toFormat('LLL d, yyyy').toUpperCase();
}

export function buildCircleThreadDaySections({
  items,
  now = new Date(),
  timezone,
}: {
  items: CircleThreadItem[];
  now?: Date;
  timezone: string;
}): CircleThreadDaySection[] {
  const today = getZonedDateTime(now, timezone).startOf('day');
  const todayKey = today.toFormat('yyyy-LL-dd');
  const yesterdayKey = today.minus({days: 1}).toFormat('yyyy-LL-dd');
  const sections = new Map<string, CircleThreadDaySection>();

  items.forEach(item => {
    const date = getZonedDateTime(item.createdAtMs, timezone);
    const dateKey = date.toFormat('yyyy-LL-dd');
    const existing = sections.get(dateKey);

    if (existing) {
      existing.items.push(item);
      return;
    }

    sections.set(dateKey, {
      dateKey,
      items: [item],
      label: getDayLabel({date, todayKey, yesterdayKey}),
    });
  });

  return Array.from(sections.values());
}
