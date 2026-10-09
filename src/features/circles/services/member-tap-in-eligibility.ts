import {DateTime} from 'luxon';
import type {
  CircleDetailModel,
  CircleMemberStatus,
} from '../../../types/models';

export function isFirstTapInPending(
  member: CircleMemberStatus,
  circle: Pick<
    CircleDetailModel,
    'commitmentCadence' | 'commitmentFrequency' | 'timezone'
  >,
  now = new Date(),
) {
  if (
    member.membershipStatus !== 'active' ||
    member.opportunityEligibility !== 'next_opening' ||
    !member.joinedAt
  )
    return false;
  const today = DateTime.fromJSDate(now)
    .setZone(circle.timezone ?? 'UTC')
    .startOf('day');
  const joined = DateTime.fromJSDate(member.joinedAt)
    .setZone(circle.timezone ?? 'UTC')
    .toISODate();
  if (!today.isValid || !joined) return false;
  const pace = circle.commitmentCadence ?? 'weekly';
  const start =
    pace === 'monthly'
      ? today.startOf('month')
      : pace === 'weekly'
      ? today.startOf('week')
      : today;
  const days =
    pace === 'monthly' ? today.daysInMonth ?? 31 : pace === 'weekly' ? 7 : 1;
  const count =
    pace === 'daily'
      ? 1
      : Math.min(
          days,
          Math.max(
            1,
            Math.round(
              (pace === 'monthly'
                ? circle.commitmentFrequency?.opportunitiesPerPeriod
                : undefined) ??
                circle.commitmentFrequency?.tapInsPerWeek ??
                (pace === 'monthly' ? 4 : 7),
            ),
          ),
        );
  const elapsed = Math.round(today.diff(start, 'days').days);
  const offsets = Array.from({length: count}, (_, index) =>
    Math.floor((index * days) / count),
  );
  const currentOffset = offsets.filter(offset => offset <= elapsed).pop() ?? 0;
  // Server next_opening membership includes only slots opening AFTER the join day.
  return (start.plus({days: currentOffset}).toISODate() ?? '') <= joined;
}
