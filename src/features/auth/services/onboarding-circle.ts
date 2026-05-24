import type {
  CircleJoinMode,
  CirclePrivacyMode,
  CreateCircleDraft,
} from '../../../types/models';
import {
  buildCreateCirclePayload,
  createInitialCircleDraft,
  defaultCircleMaxSize,
  defaultSkipGraceRule,
  getPrivacyChoiceFields,
  normalizeCommitmentCadence,
  normalizeCommitmentFrequency,
} from '../../create-circle/services/create-circle-draft';
import type {OnboardingFocusArea} from './onboarding-options';

export function getStarterCircleCategory(focusArea?: OnboardingFocusArea) {
  if (focusArea === 'fitness') {
    return 'Fitness';
  }

  if (focusArea === 'focus') {
    return 'Deep Work';
  }

  if (focusArea === 'wellness') {
    return 'Wellness';
  }

  if (focusArea === 'sobriety') {
    return 'Sobriety';
  }

  return 'Custom';
}

export function createInitialStarterCircleDraft({
  focusArea,
  timezone,
}: {
  focusArea?: OnboardingFocusArea;
  timezone?: string;
} = {}): CreateCircleDraft {
  const draft = createInitialCircleDraft(timezone);

  return applyStarterCircleHiddenDefaults({
    ...draft,
    category: getStarterCircleCategory(focusArea),
  });
}

export function applyStarterCircleHiddenDefaults(
  draft: CreateCircleDraft,
  {
    focusArea,
    timezone,
  }: {
    focusArea?: OnboardingFocusArea;
    timezone?: string;
  } = {},
): CreateCircleDraft {
  const normalizedDraft = {
    ...createInitialCircleDraft(timezone),
    ...draft,
    graceRules: {
      skip: {
        ...defaultSkipGraceRule,
        ...draft.graceRules?.skip,
      },
    },
  };
  const commitmentCadence = normalizeCommitmentCadence(
    normalizedDraft.commitmentCadence,
    normalizedDraft.commitmentFrequency,
  );
  const fallbackTimezone =
    timezone?.trim() ||
    normalizedDraft.timezone.trim() ||
    createInitialCircleDraft().timezone;

  return {
    ...normalizedDraft,
    ...(focusArea ? {category: getStarterCircleCategory(focusArea)} : {}),
    graceRules: {
      skip: {...defaultSkipGraceRule},
    },
    commitmentCadence,
    commitmentFrequency: normalizeCommitmentFrequency(
      normalizedDraft.commitmentFrequency,
      commitmentCadence,
    ),
    maxSize: defaultCircleMaxSize,
    timezone: normalizedDraft.timezone.trim() || fallbackTimezone,
  };
}

export function updateStarterCircleFocusArea(
  draft: CreateCircleDraft,
  focusArea: OnboardingFocusArea,
): CreateCircleDraft {
  return applyStarterCircleHiddenDefaults(draft, {focusArea});
}

export function updateStarterCirclePrivacyMode(
  draft: CreateCircleDraft,
  privacyMode: CirclePrivacyMode,
): CreateCircleDraft {
  const publicJoinMode =
    draft.joinMode === 'open' || draft.joinMode === 'request_to_join'
      ? draft.joinMode
      : 'request_to_join';
  const fields = getPrivacyChoiceFields(privacyMode, publicJoinMode);

  return {
    ...draft,
    ...fields,
    privacyMode,
  };
}

export function updateStarterCirclePublicJoinMode(
  draft: CreateCircleDraft,
  joinMode: Extract<CircleJoinMode, 'open' | 'request_to_join'>,
): CreateCircleDraft {
  return {
    ...draft,
    joinMode,
    privacy: 'public',
    privacyMode: 'public',
  };
}

export function isStarterCircleDraftReady(draft: CreateCircleDraft) {
  const title = typeof draft.title === 'string' ? draft.title.trim() : '';
  const commitment =
    typeof draft.commitment === 'string' ? draft.commitment.trim() : '';

  return (
    title.length > 0 &&
    title.length <= 80 &&
    commitment.length > 0 &&
    commitment.length <= 160
  );
}

export function buildStarterCirclePayload(draft: CreateCircleDraft) {
  return buildCreateCirclePayload(applyStarterCircleHiddenDefaults(draft));
}
