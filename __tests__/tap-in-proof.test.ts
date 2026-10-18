import {
  getTapInProofRequirement,
  readProofRequirement,
} from '../src/shared/tap-in-proof';
import {getTapInProofRequirement as serverRequirement} from '../functions/src/shared/tap-in-proof';
import {
  getProofPhotoPath,
  requireCompletedTapInProof,
} from '../functions/src/checkins/proof';
import {
  createInitialCircleDraft,
  buildCircleEditDraft,
  buildCreateCirclePayload,
} from '../src/features/create-circle/services/create-circle-draft';
import {setupSteps} from '../src/features/create-circle/services/setup-journey';

describe('Tap In proof policy', () => {
  it('defaults new personal and group drafts to Photo proof while old Circles edit as none', () => {
    const draft = createInitialCircleDraft('UTC');
    for (const circleMode of ['personal', 'group'] as const) {
      expect(
        buildCreateCirclePayload({...draft, circleMode}).proofRequirement,
      ).toBe('photo');
      expect(
        buildCreateCirclePayload({
          ...draft,
          circleMode,
          proofRequirement: 'none',
        }).proofRequirement,
      ).toBe('none');
    }
    expect(buildCircleEditDraft(draft).proofRequirement).toBe('photo');
    const {proofRequirement: _, ...legacy} = draft;
    expect(buildCircleEditDraft(legacy).proofRequirement).toBe('none');
  });
  it.each(['build', 'limit', 'avoid'] as const)(
    'always includes Proof after goal or type for %s',
    commitmentType => {
      const steps = setupSteps({
        ...createInitialCircleDraft('UTC'),
        circleMode: 'personal',
        commitmentType,
      });
      expect(
        steps[steps.indexOf(commitmentType === 'avoid' ? 'type' : 'goal') + 1],
      ).toBe('proof');
    },
  );
  it('retains the original rule including legacy Tap Ins after the Circle changes', () => {
    for (const read of [getTapInProofRequirement, serverRequirement]) {
      expect(read({proofRequirement: 'photo'})).toBe('photo');
      expect(read({proofRequirement: 'photo'}, {})).toBe('none');
      expect(
        read({proofRequirement: 'photo'}, {proofRequirement: 'none'}),
      ).toBe('none');
      expect(
        read({proofRequirement: 'none'}, {proofRequirement: 'photo'}),
      ).toBe('photo');
    }
    expect(readProofRequirement(undefined)).toBe('none');
  });
  it.each(['partial', 'failed', 'skip'])('allows %s without proof', status => {
    expect(() =>
      requireCompletedTapInProof({requirement: 'photo', status}),
    ).not.toThrow();
  });
  it('requires proof for completed entries only under the photo rule', () => {
    expect(() =>
      requireCompletedTapInProof({requirement: 'photo', status: 'done'}),
    ).toThrow('Add Photo proof');
    expect(() =>
      requireCompletedTapInProof({requirement: 'none', status: 'done'}),
    ).not.toThrow();
  });
});

describe('proof photo identity', () => {
  const input = {
    bucketName: 'proof-bucket',
    circleId: 'circle',
    dateKey: '2026-10-17',
    uid: 'member',
  };
  const url = (path: string, bucket = input.bucketName) =>
    `https://firebasestorage.googleapis.com/v0/b/${bucket}/o/${encodeURIComponent(
      path,
    )}?alt=media&token=test`;
  const path = 'circles/circle/check-ins/2026-10-17/member/proof-unique.jpg';
  it('accepts the correct immutable object', () => {
    expect(getProofPhotoPath({...input, photoUrl: url(path)})).toBe(path);
  });
  it.each([
    url(path, 'other-bucket'),
    url(path.replace('/circle/', '/other/')),
    url(path.replace('/member/', '/other/')),
    url(path.replace('2026-10-17', '2026-10-16')),
    url(path.replace('proof-unique.jpg', 'proof.jpg')),
    url(path.replace('proof-unique.jpg', '../proof-other.jpg')),
    'https://example.com/proof.jpg',
    url(path).replace('https:', 'http:'),
  ])('rejects foreign, mutable, or wrong-day proof: %s', photoUrl => {
    expect(() => getProofPhotoPath({...input, photoUrl})).toThrow(
      'Add the photo again',
    );
  });
});
