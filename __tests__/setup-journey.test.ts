import {
  applyStarter,
  createSetupJourney,
  recommendStarters,
  setupSteps,
  starters,
  validateSetup,
  validateSetupStep,
} from '../src/features/create-circle/services/setup-journey';
import {
  buildCreateCirclePayload,
  createInitialCircleDraft,
  defaultMonthlyCommitmentFrequency,
  defaultWeeklyCommitmentFrequency,
} from '../src/features/create-circle/services/create-circle-draft';
import {applyStarterCircleHiddenDefaults} from '../src/features/auth/services/onboarding-circle';
import {
  getCoverageStatusForValue,
  isSingleTapInCommitment,
} from '../src/features/commitments/commitment-logic';
import {
  getCoverageStatusForTapIn,
  isSingleTapInCommitment as serverSingle,
} from '../functions/src/shared/commitments';

describe('approved setup journey', () => {
  it('starts new drafts daily while retaining weekly four and monthly sixteen defaults', () => {
    expect(createInitialCircleDraft('UTC')).toMatchObject({
      commitmentCadence: 'daily',
      commitmentFrequency: {tapInsPerWeek: 7},
      circleMode: 'group',
      privacy: 'public',
      joinMode: 'open',
      maxSize: 10,
      commitmentType: 'build',
      buildTrackingMode: 'confirmation',
    });
    expect(defaultWeeklyCommitmentFrequency.tapInsPerWeek).toBe(4);
    expect(defaultMonthlyCommitmentFrequency.opportunitiesPerPeriod).toBe(16);
  });
  it('puts pace and frequency before type and per-Tap-In goal', () => {
    const steps = setupSteps({
      ...createInitialCircleDraft('UTC'),
      commitmentCadence: 'weekly',
    });
    expect(steps.indexOf('pace')).toBeLessThan(steps.indexOf('frequency'));
    expect(steps.indexOf('frequency')).toBeLessThan(steps.indexOf('type'));
    expect(steps.indexOf('type')).toBeLessThan(steps.indexOf('goal'));
  });
  it('keeps personal naming but skips shared access and capacity', () => {
    const steps = setupSteps({
      ...createInitialCircleDraft('UTC'),
      circleMode: 'personal',
    });
    expect(steps).toContain('name');
    for (const step of ['privacy', 'joining', 'capacity'])
      expect(steps).not.toContain(step);
  });
  it('skips numeric goal for Avoid and frequency for daily pace', () => {
    const steps = setupSteps({
      ...createInitialCircleDraft('UTC'),
      commitmentType: 'avoid',
      commitmentCadence: 'daily',
    });
    expect(steps).not.toContain('goal');
    expect(steps).not.toContain('frequency');
  });
  it('does not show public joining choices for link-only or private Circles', () => {
    expect(
      setupSteps({
        ...createInitialCircleDraft('UTC'),
        privacyMode: 'link_only',
      }),
    ).not.toContain('joining');
    expect(
      setupSteps({...createInitialCircleDraft('UTC'), privacyMode: 'private'}),
    ).not.toContain('joining');
  });
  it('retains a personal custom name independently of the commitment text', () => {
    expect(
      buildCreateCirclePayload({
        ...createInitialCircleDraft('UTC'),
        circleMode: 'personal',
        title: 'My morning movement',
        commitment: 'Take a short walk',
      }),
    ).toMatchObject({
      title: 'My morning movement',
      commitment: 'Take a short walk',
      maxSize: 1,
      privacy: 'private',
      joinMode: 'invite_only',
    });
  });
  it('serializes only the active goal configuration', () => {
    const payload = buildCreateCirclePayload({
      ...createInitialCircleDraft('UTC'),
      title: 'Walk',
      commitment: 'Take a walk',
      targetValue: 20,
      unitLabel: 'minutes',
      buildTrackingMode: 'confirmation',
      minimumValue: 5,
      maximumValue: 10,
    });
    expect(payload).toMatchObject({
      buildTrackingMode: 'confirmation',
      targetValue: 1,
      unitLabel: 'Tap In',
    });
    expect(payload).not.toHaveProperty('minimumValue');
    expect(payload).not.toHaveProperty('maximumValue');
  });
  it('sets the tracking choice from the selected starter', () => {
    const initial = createInitialCircleDraft('UTC');
    expect(
      applyStarter(initial, starters.find(starter => starter.id === 'walk')!),
    ).toMatchObject({
      buildTrackingMode: 'quantity',
      targetValue: 20,
      unitLabel: 'minutes',
    });
    expect(
      applyStarter(
        initial,
        starters.find(starter => starter.id === 'connect')!,
      ),
    ).toMatchObject({buildTrackingMode: 'confirmation'});
  });
  it('refreshes matching starters without needing public discovery', () => {
    expect(recommendStarters('walk for 15 minutes', ['Work'])[0].id).toBe(
      'walk',
    );
    expect(recommendStarters('', ['Learning'])[0].id).toBe('read');
    expect(recommendStarters('', []).length).toBe(3);
  });
  it('validates amount, unit, and range rather than silently accepting invalid numbers', () => {
    const draft = {
      ...createInitialCircleDraft('UTC'),
      buildTrackingMode: 'quantity' as const,
      targetValue: 0,
    };
    expect(validateSetupStep('goal', draft)).toBeDefined();
    expect(
      validateSetupStep('goal', {...draft, targetValue: 1, unitLabel: ''}),
    ).toBeDefined();
    expect(
      validateSetupStep('goal', {...draft, targetValue: 1, unitLabel: 'pages'}),
    ).toBeUndefined();
    expect(
      validateSetupStep('goal', {
        ...draft,
        commitmentType: 'limit',
        minimumValue: 30,
        maximumValue: 20,
      }),
    ).toBeDefined();
    expect(
      validateSetupStep('goal', {
        ...draft,
        commitmentType: 'limit',
        minimumValue: 0,
        maximumValue: 0,
        unitLabel: 'cups',
      }),
    ).toBeUndefined();
  });
  it('preserves legacy numeric goals and old monthly counts when normalizing a saved draft', () => {
    const old = {
      ...createInitialCircleDraft('UTC'),
      buildTrackingMode: undefined,
      targetValue: 20,
      unitLabel: 'minutes',
      commitmentCadence: 'monthly' as const,
      commitmentFrequency: {tapInsPerWeek: 4, opportunitiesPerPeriod: 4},
    };
    expect(applyStarterCircleHiddenDefaults(old)).toMatchObject({
      buildTrackingMode: 'quantity',
      targetValue: 20,
      unitLabel: 'minutes',
      commitmentFrequency: {opportunitiesPerPeriod: 4},
    });
  });
  it('gives each new intent a stable identifier and keeps validation independent of authentication', () => {
    const a = createSetupJourney();
    const b = createSetupJourney();
    expect(a.requestId).not.toBe(b.requestId);
    expect(validateSetup(a.draft)).toBeDefined();
  });
});

describe('client/server tracking parity', () => {
  it('does not mistake a numeric goal of one page for a basic Tap In', () => {
    const circle = {
      commitmentType: 'build' as const,
      buildTrackingMode: 'quantity' as const,
      targetValue: 1,
      unitLabel: 'pages',
    };
    expect(isSingleTapInCommitment(circle)).toBe(false);
    expect(serverSingle(circle)).toBe(false);
    for (const value of [0, 1]) {
      const expected = value === 0 ? 'partial' : 'covered';
      expect(getCoverageStatusForValue({circle, currentValue: value})).toBe(
        expected,
      );
      expect(
        getCoverageStatusForTapIn({
          circle,
          currentValue: value,
          status: 'done',
        }),
      ).toBe(expected);
    }
  });
  it('keeps legacy target-one commitments basic and target-twenty commitments numeric', () => {
    expect(
      isSingleTapInCommitment({commitmentType: 'build', targetValue: 1}),
    ).toBe(true);
    expect(serverSingle({commitmentType: 'build', targetValue: 1})).toBe(true);
    expect(
      isSingleTapInCommitment({commitmentType: 'build', targetValue: 20}),
    ).toBe(false);
    expect(serverSingle({commitmentType: 'build', targetValue: 20})).toBe(
      false,
    );
  });
  it('counts a confirmation independently from the chosen numeric draft value', () => {
    const circle = {
      commitmentType: 'build' as const,
      buildTrackingMode: 'confirmation' as const,
      targetValue: 20,
      unitLabel: 'minutes',
    };
    expect(getCoverageStatusForValue({circle, currentValue: 0})).toBe(
      'covered',
    );
    expect(
      getCoverageStatusForTapIn({circle, currentValue: 0, status: 'done'}),
    ).toBe('covered');
  });
});
