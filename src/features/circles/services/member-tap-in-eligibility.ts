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
  return (today.toISODate() ?? '') <= joined;
}
