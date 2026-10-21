import {canShareCircleInvite} from '../src/features/circle-invites/services/invite-eligibility';

const activeCircle = {
  circleMode: 'group',
  lifecycleStatus: 'active',
  viewerMembershipStatus: 'active',
  inviteUrl: 'https://hoyst.app/join/example',
} as const;

describe('Circle invite eligibility', () => {
  it('allows active members with a link, including legacy Circle defaults', () => {
    expect(canShareCircleInvite(activeCircle)).toBe(true);
    expect(
      canShareCircleInvite({
        ...activeCircle,
        circleMode: undefined,
        lifecycleStatus: undefined,
      }),
    ).toBe(true);
  });

  it.each([
    {viewerMembershipStatus: 'pending' as const},
    {viewerMembershipStatus: undefined},
    {circleMode: 'personal' as const},
    {lifecycleStatus: 'archived' as const},
    {inviteUrl: undefined},
    {inviteUrl: ''},
  ])('excludes ineligible Circles or viewers: %j', overrides => {
    expect(canShareCircleInvite({...activeCircle, ...overrides})).toBe(false);
  });
});
