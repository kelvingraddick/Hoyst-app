import AsyncStorage from '@react-native-async-storage/async-storage';
import {createSetupJourney} from '../src/features/create-circle/services/setup-journey';
import {useSetupJourneyStore} from '../src/store/setup-journey-store';
import {useOnboardingStore} from '../src/store/onboarding-store';

jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest/async-storage-mock'),
);

beforeEach(async () => {
  await useSetupJourneyStore.persist.rehydrate();
  await useOnboardingStore.persist.rehydrate();
  useSetupJourneyStore.setState({hydrated: true, records: {}});
  useOnboardingStore.getState().reset();
});

it('clears only a matching legacy draft while retaining account preferences and completion', async () => {
  const draft = createSetupJourney().draft;
  draft.commitment = 'Read each day';
  useOnboardingStore.setState({
    starterCircleSetupId: 'completed-request',
    starterCircleDraft: draft,
    hasPendingStarterCircleSetup: true,
    hasPendingProfileCompletion: true,
    currentStep: 'auth',
    firstCircleSkipped: true,
    journey: 'invite',
    categories: ['Learning'],
    focusArea: 'focus',
    displayName: 'Jamie',
    handle: 'jamie',
    timezone: 'America/New_York',
    hasHydrated: true,
  });
  useOnboardingStore.getState().completeSavedSetup('completed-request');
  expect(useOnboardingStore.getState()).toMatchObject({
    hasSeenOnboarding: true,
    hasPendingStarterCircleSetup: false,
    hasPendingProfileCompletion: false,
    starterCircleSetupId: undefined,
    starterCircleDraft: {commitment: '', title: ''},
    currentStep: 'welcome',
    firstCircleSkipped: false,
    journey: 'standard',
    categories: ['Learning'],
    focusArea: 'focus',
    displayName: 'Jamie',
    handle: 'jamie',
    timezone: 'America/New_York',
    hasHydrated: true,
  });
  await useOnboardingStore.persist.rehydrate();
  expect(useOnboardingStore.getState()).toMatchObject({
    hasSeenOnboarding: true,
    hasPendingStarterCircleSetup: false,
    starterCircleSetupId: undefined,
    starterCircleDraft: {commitment: ''},
    categories: ['Learning'],
    handle: 'jamie',
  });
});

it('preserves another legacy submission and its resume flags', () => {
  const draft = {...createSetupJourney().draft, commitment: 'Keep practising'};
  useOnboardingStore.setState({
    starterCircleSetupId: 'other-request',
    starterCircleDraft: draft,
    currentStep: 'circleRules',
    hasPendingStarterCircleSetup: true,
    hasPendingProfileCompletion: true,
    journey: 'invite',
  });
  useOnboardingStore.getState().completeSavedSetup('completed-request');
  expect(useOnboardingStore.getState()).toMatchObject({
    hasSeenOnboarding: true,
    starterCircleSetupId: 'other-request',
    starterCircleDraft: draft,
    currentStep: 'circleRules',
    hasPendingStarterCircleSetup: true,
    hasPendingProfileCompletion: true,
    journey: 'invite',
  });
});

it('prunes completed records on hydration while keeping unexited success and retry data', async () => {
  const completed = {...createSetupJourney('finish'), completed: true};
  const deferred = {...createSetupJourney('goal'), deferred: true};
  const saving = {
    ...createSetupJourney('review'),
    status: 'saving' as const,
    submittedDraft: createSetupJourney().draft,
  };
  const saved = {...createSetupJourney('finish'), status: 'saved' as const};
  await AsyncStorage.setItem(
    'hoyst-setup-journeys-v1',
    JSON.stringify({
      state: {records: {completed, deferred, saving, saved}},
      version: 1,
    }),
  );
  await useSetupJourneyStore.persist.rehydrate();
  expect(useSetupJourneyStore.getState().records).toEqual({
    deferred,
    saving: {...saving, status: 'error', step: 'saveError'},
    saved,
  });
  const stored = JSON.parse(
    (await AsyncStorage.getItem('hoyst-setup-journeys-v1'))!,
  );
  expect(stored.state.records.completed).toBeUndefined();
  expect(stored.version).toBe(1);
});

it('does not resurrect a removed draft from partial or functional updates', () => {
  const store = useSetupJourneyStore.getState();
  store.ensure('onboarding');
  const previousId =
    useSetupJourneyStore.getState().records.onboarding.requestId;
  store.discard('onboarding');
  store.update('onboarding', {step: 'profile'});
  const lateUpdate = jest.fn(current => ({...current, step: 'profile'}));
  store.update('onboarding', lateUpdate);
  expect(useSetupJourneyStore.getState().records).toEqual({});
  expect(lateUpdate).not.toHaveBeenCalled();
  store.ensure('onboarding');
  expect(useSetupJourneyStore.getState().records.onboarding.requestId).not.toBe(
    previousId,
  );
});


it('hydrates legacy proof drafts with photo while preserving explicit No proof and submitted retries', async () => {
  const legacy = createSetupJourney('proof');
  delete legacy.draft.proofRequirement;
  const selected = createSetupJourney('review');
  selected.draft.proofRequirement = 'none';
  selected.submittedDraft = {...selected.draft};
  await AsyncStorage.setItem('hoyst-setup-journeys-v1', JSON.stringify({state: {records: {legacy, selected}}, version: 1}));
  await useSetupJourneyStore.persist.rehydrate();
  expect(useSetupJourneyStore.getState().records.legacy.draft.proofRequirement).toBe('photo');
  expect(useSetupJourneyStore.getState().records.selected.draft.proofRequirement).toBe('none');
  expect(useSetupJourneyStore.getState().records.selected.submittedDraft?.proofRequirement).toBe('none');
});
