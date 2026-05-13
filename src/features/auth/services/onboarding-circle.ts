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
} from '../../create-circle/services/create-circle-draft';
import type {OnboardingGoal} from './onboarding-options';

export function getStarterCircleCategory(goal?: OnboardingGoal) {
  if (goal === 'fitness') {
    return 'Fitness';
  }

  if (goal === 'focus') {
    return 'Deep Work';
  }

  if (goal === 'wellness') {
    return 'Wellness';
  }

  if (goal === 'sobriety') {
    return 'Sobriety';
  }

  return 'Custom';
}

export function createInitialStarterCircleDraft({
  goal,
  timezone,
}: {
  goal?: OnboardingGoal;
  timezone?: string;
} = {}): CreateCircleDraft {
  const draft = createInitialCircleDraft(timezone);

  return applyStarterCircleHiddenDefaults({
    ...draft,
    category: getStarterCircleCategory(goal),
  });
}

export function applyStarterCircleHiddenDefaults(
  draft: CreateCircleDraft,
  {
    goal,
    timezone,
  }: {
    goal?: OnboardingGoal;
    timezone?: string;
  } = {},
): CreateCircleDraft {
  const fallbackTimezone =
    timezone?.trim() || draft.timezone.trim() || createInitialCircleDraft().timezone;

  return {
    ...draft,
    ...(goal ? {category: getStarterCircleCategory(goal)} : {}),
    graceRules: {
      skip: {...defaultSkipGraceRule},
    },
    maxSize: defaultCircleMaxSize,
    timezone: draft.timezone.trim() || fallbackTimezone,
  };
}

export function updateStarterCircleGoal(
  draft: CreateCircleDraft,
  goal: OnboardingGoal,
): CreateCircleDraft {
  return applyStarterCircleHiddenDefaults(draft, {goal});
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
  return (
    draft.title.trim().length > 0 &&
    draft.title.trim().length <= 80 &&
    draft.dailyTask.trim().length > 0 &&
    draft.dailyTask.trim().length <= 160
  );
}

export function buildStarterCirclePayload(draft: CreateCircleDraft) {
  return buildCreateCirclePayload(applyStarterCircleHiddenDefaults(draft));
}
