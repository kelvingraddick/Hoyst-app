import {claimSetupJourney} from '../src/features/create-circle/services/setup-account';
import {createSetupJourney} from '../src/features/create-circle/services/setup-journey';

it('claims the guest intent without changing its request or selections', () => {
  const guest = createSetupJourney('review');
  guest.draft.commitment = 'Read a page';
  const next = claimSetupJourney(
    {onboarding: guest},
    'onboarding',
    'alice',
    createSetupJourney(),
  );
  expect(next.onboarding).toMatchObject({
    ownerUid: 'alice',
    requestId: guest.requestId,
    draft: {commitment: 'Read a page'},
  });
});

it('hides another account’s draft from guests and restores it for its owner', () => {
  const alice = {
    ...createSetupJourney('profile'),
    ownerUid: 'alice',
    profileDraft: {name: 'Alice', handle: 'alice'},
  };
  const guest = claimSetupJourney(
    {onboarding: alice},
    'onboarding',
    undefined,
    createSetupJourney(),
  );
  expect(guest.onboarding.profileDraft).toBeUndefined();
  expect(guest['account:alice:onboarding']).toEqual(alice);
  const bob = claimSetupJourney(
    guest,
    'onboarding',
    'bob',
    createSetupJourney(),
  );
  const restored = claimSetupJourney(
    bob,
    'onboarding',
    'alice',
    createSetupJourney(),
  );
  expect(restored.onboarding).toMatchObject({
    ownerUid: 'alice',
    requestId: alice.requestId,
    profileDraft: alice.profileDraft,
  });
  expect(restored['account:alice:onboarding']).toBeUndefined();
  expect(restored['account:bob:onboarding'].ownerUid).toBe('bob');
});

it('retains the exact submitted draft and request ID for an interrupted save', () => {
  const saving = {
    ...createSetupJourney('review'),
    ownerUid: 'alice',
    status: 'saving' as const,
  };
  saving.submittedDraft = {
    ...saving.draft,
    commitment: 'Keep the submitted promise',
  };
  const next = claimSetupJourney(
    {onboarding: saving},
    'onboarding',
    'bob',
    createSetupJourney(),
  );
  expect(next['account:alice:onboarding']).toMatchObject({
    status: 'error',
    step: 'saveError',
    requestId: saving.requestId,
    submittedDraft: saving.submittedDraft,
  });
});
