import {getDateKey} from '../profile/streak';
import {isCoveredCheckInData} from '../shared/commitments';

export type HistoryRecord = {
  id: string;
  circleId: string;
  storedDateKey: string;
  data: Record<string, any>;
};
export type ProgressActivity = {
  id: string;
  circleId: string;
  dateKey: string;
  title: string;
  category: string;
  status:
    | 'completed'
    | 'partial'
    | 'failed'
    | 'skipped'
    | 'restored'
    | 'missed';
  description: string;
  note?: string;
  photoUrl?: string;
  cadence?: string;
  periodKey?: string;
  occurredAt?: string;
  sortKey: string;
};
export type ProgressDay = {
  dateKey: string;
  status: 'success' | 'partial' | 'protected' | 'none';
  tapIns: number;
  activityCount: number;
};
export function validDateKey(value: unknown): value is string {
  return (
    typeof value === 'string' &&
    /^\d{4}-\d{2}-\d{2}$/.test(value) &&
    !Number.isNaN(Date.parse(value)) &&
    new Date(value).toISOString().slice(0, 10) === value
  );
}
export function resolveTimezone(value: unknown) {
  try {
    if (typeof value === 'string' && value.trim()) {
      new Intl.DateTimeFormat('en', {timeZone: value}).format();
      return value;
    }
  } catch {}
  return 'UTC';
}
function timestamp(value: any): Date | undefined {
  const date = value?.toDate?.();
  return date instanceof Date && !Number.isNaN(date.getTime())
    ? date
    : undefined;
}
export function recordDate(record: HistoryRecord, timezone: string) {
  const data = record.data;
  if (data.protectionKind === 'restore') {
    return (
      data.restoration?.personalEffectiveDateKey ||
      data.effectiveDateKey ||
      record.storedDateKey
    );
  }
  const date = timestamp(data.createdAt);
  return date ? getDateKey(date, timezone) : record.storedDateKey;
}
export function activityFromRecord(
  record: HistoryRecord,
  timezone: string,
  metadata: Record<string, any> = {},
): ProgressActivity | undefined {
  const data = record.data;
  const status =
    data.protectionKind === 'restore'
      ? 'restored'
      : data.status === 'skip'
      ? 'skipped'
      : data.status === 'partial' || data.coverageStatus === 'partial'
      ? 'partial'
      : data.status === 'failed' || data.coverageStatus === 'failed'
      ? 'failed'
      : data.status === 'done' && isCoveredCheckInData(data)
      ? 'completed'
      : undefined;
  const dateKey = recordDate(record, timezone);
  if (!status || !validDateKey(dateKey)) return undefined;
  const labels = {
    completed: 'Completed',
    partial: 'Partial',
    failed: 'Not completed',
    skipped: 'Skipped',
    restored: 'Streak restored',
  };
  const quantity =
    typeof data.currentValue === 'number'
      ? ` · ${data.currentValue} ${data.unitLabel || 'logged'}`
      : '';
  const date = timestamp(data.createdAt);
  // Preserve full timestamp precision before using the stable document identifier.
  const seconds = String(data.createdAt?.seconds ?? 0).padStart(12, '0');
  const nanos = String(data.createdAt?.nanoseconds ?? 0).padStart(9, '0');
  return {
    id: record.id,
    circleId: record.circleId,
    dateKey,
    status,
    title: metadata.title || data.title || 'Past commitment',
    category: metadata.category || data.category || 'Custom',
    description: labels[status] + quantity,
    ...(typeof data.note === 'string' && data.note ? {note: data.note} : {}),
    ...(typeof data.photoUrl === 'string' && data.photoUrl
      ? {photoUrl: data.photoUrl}
      : {}),
    ...(metadata.cadence || data.cadence || data.commitmentCadence
      ? {cadence: metadata.cadence || data.cadence || data.commitmentCadence}
      : {}),
    ...(metadata.periodKey ||
    data.periodKey ||
    data.restoration?.originalPeriodKey
      ? {
          periodKey:
            metadata.periodKey ||
            data.periodKey ||
            data.restoration?.originalPeriodKey,
        }
      : {}),
    ...(date ? {occurredAt: date.toISOString()} : {}),
    sortKey: `${seconds}:${nanos}:${record.id}`,
  };
}
export function monthSummary(
  monthKey: string,
  timezone: string,
  activities: ProgressActivity[],
  now = new Date(),
) {
  const daysInMonth = new Date(
    Date.UTC(Number(monthKey.slice(0, 4)), Number(monthKey.slice(5)), 0),
  ).getUTCDate();
  const days: ProgressDay[] = Array.from({length: daysInMonth}, (_, i) => {
    const dateKey = `${monthKey}-${String(i + 1).padStart(2, '0')}`;
    const entries = activities.filter(entry => entry.dateKey === dateKey);
    const tapIns = entries.filter(entry => entry.status === 'completed').length;
    return {
      dateKey,
      tapIns,
      activityCount: entries.length,
      status: tapIns
        ? 'success'
        : entries.some(entry => entry.status === 'partial')
        ? 'partial'
        : entries.some(
            entry => entry.status === 'skipped' || entry.status === 'restored',
          )
        ? 'protected'
        : 'none',
    };
  });
  return {
    monthKey,
    timezone,
    todayDateKey: getDateKey(now, timezone),
    days,
    tapIns: days.reduce((sum, day) => sum + day.tapIns, 0),
    activeDays: days.filter(day => day.tapIns > 0).length,
  };
}
export function pageActivities(
  activities: ProgressActivity[],
  after?: string,
  limit = 20,
) {
  const sorted = [...activities].sort((a, b) =>
    a.sortKey === b.sortKey ? 0 : a.sortKey < b.sortKey ? 1 : -1,
  );
  const remaining = after
    ? sorted.filter(entry => entry.sortKey < after)
    : sorted;
  const entries = remaining.slice(0, limit);
  return {
    entries,
    nextSortKey:
      remaining.length > limit
        ? entries[entries.length - 1].sortKey
        : undefined,
  };
}
