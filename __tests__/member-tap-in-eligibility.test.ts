import {isFirstTapInPending} from '../src/features/circles/services/member-tap-in-eligibility';
import type {CircleDetailModel, CircleMemberStatus} from '../src/types/models';

const member: CircleMemberStatus = {
  id: 'new',
  name: 'New',
  initials: 'N',
  state: 'pending',
  membershipStatus: 'active',
  opportunityEligibility: 'next_opening',
  joinedAt: new Date('2026-10-09T12:00:00Z'),
};
const circle = {
  commitmentCadence: 'daily',
  commitmentFrequency: {tapInsPerWeek: 7},
  timezone: 'America/New_York',
} as CircleDetailModel;
it('waits for the next daily opening, including the Circle timezone', () => {
  expect(
    isFirstTapInPending(member, circle, new Date('2026-10-10T03:59:00Z')),
  ).toBe(true);
  expect(
    isFirstTapInPending(member, circle, new Date('2026-10-10T04:00:00Z')),
  ).toBe(false);
});
it('retains current-window and legacy membership behavior', () => {
  expect(
    isFirstTapInPending(
      {...member, opportunityEligibility: 'include_current'},
      circle,
    ),
  ).toBe(false);
  expect(
    isFirstTapInPending({...member, opportunityEligibility: undefined}, circle),
  ).toBe(false);
});
it('waits through a weekly window that opened before joining', () => {
  const weekly = {
    ...circle,
    commitmentCadence: 'weekly',
    commitmentFrequency: {tapInsPerWeek: 4},
  } as CircleDetailModel;
  expect(
    isFirstTapInPending(member, weekly, new Date('2026-10-09T18:00:00Z')),
  ).toBe(true);
  expect(
    isFirstTapInPending(member, weekly, new Date('2026-10-10T12:00:00Z')),
  ).toBe(false);
});
it('clamps slots to a shorter month and opens the following local day', () => {
  const monthly = {
    ...circle,
    commitmentCadence: 'monthly',
    commitmentFrequency: {tapInsPerWeek: 7, opportunitiesPerPeriod: 31},
  } as CircleDetailModel;
  const february = {...member, joinedAt: new Date('2026-02-27T12:00:00Z')};
  expect(
    isFirstTapInPending(february, monthly, new Date('2026-02-27T18:00:00Z')),
  ).toBe(true);
  expect(
    isFirstTapInPending(february, monthly, new Date('2026-02-28T12:00:00Z')),
  ).toBe(false);
});
