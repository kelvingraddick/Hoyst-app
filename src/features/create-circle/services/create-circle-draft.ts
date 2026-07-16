import type {
  CircleJoinMode,
  CircleMode,
  CirclePrivacy,
  CirclePrivacyMode,
  CircleSummary,
  CommitmentCadence,
  CommitmentFrequency,
  CommitmentType,
  CreateCircleDraft,
  GraceRule,
} from '../../../types/models';

export type CreateCirclePayload = {
  category: string;
  circleMode: CircleMode;
  commitment: string;
  commitmentCadence: CommitmentCadence;
  commitmentFrequency: CommitmentFrequency;
  commitmentType: CommitmentType;
  graceRules: {
    skip: GraceRule;
  };
  joinMode: CircleJoinMode;
  maximumValue?: number;
  maxSize: number;
  minimumValue?: number;
  privacy: CirclePrivacy;
  stepValue: number;
  targetValue?: number;
  timezone: string;
  title: string;
  unitLabel: string;
};

export const defaultSkipGraceRule: GraceRule = {
  allowance: 2,
  windowDays: 7,
};
export const defaultCircleMode: CircleMode = 'group';
export const defaultCircleMaxSize = 10;
export const defaultCommitmentFrequency: CommitmentFrequency = {
  tapInsPerWeek: 7,
};
export const defaultWeeklyCommitmentFrequency: CommitmentFrequency = {
  tapInsPerWeek: 4,
};
export const defaultMonthlyCommitmentFrequency: CommitmentFrequency = {
  opportunitiesPerPeriod: 4,
  tapInsPerWeek: 4,
};
export const defaultCommitmentCadence: CommitmentCadence = 'daily';
export const defaultCommitmentType: CommitmentType = 'build';
export const defaultCommitmentUnitLabel = 'Tap In';
export const defaultCommitmentStepValue = 1;
export const defaultCommitmentTargetValue = 1;

export function getLocalTimezone() {
  return Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';
}

export function createInitialCircleDraft(timezone?: string): CreateCircleDraft {
  return {
    category: 'Fitness',
    circleMode: defaultCircleMode,
    commitment: '',
    commitmentCadence: defaultCommitmentCadence,
    commitmentFrequency: defaultCommitmentFrequency,
    commitmentType: defaultCommitmentType,
    graceRules: {
      skip: defaultSkipGraceRule,
    },
    inviteCode: '',
    joinMode: 'request_to_join',
    maxSize: defaultCircleMaxSize,
    privacy: 'public',
    privacyMode: 'public',
    stepValue: defaultCommitmentStepValue,
    targetValue: defaultCommitmentTargetValue,
    timezone: timezone?.trim() || getLocalTimezone(),
    title: '',
    unitLabel: defaultCommitmentUnitLabel,
  };
}

export function getPrivacyChoiceFields(
  privacyMode: CirclePrivacyMode,
  publicJoinMode: Extract<CircleJoinMode, 'open' | 'request_to_join'>,
) {
  if (privacyMode === 'public') {
    return {
      joinMode: publicJoinMode,
      privacy: 'public' as const,
    };
  }

  if (privacyMode === 'link_only') {
    return {
      joinMode: 'invite_only' as const,
      privacy: 'private' as const,
    };
  }

  return {
    joinMode: 'request_to_join' as const,
    privacy: 'private' as const,
  };
}

export function getCirclePrivacyMode({
  joinMode,
  privacy,
}: Pick<CircleSummary, 'joinMode' | 'privacy'>): CirclePrivacyMode {
  if (privacy === 'public') {
    return 'public';
  }

  if (joinMode === 'invite_only') {
    return 'link_only';
  }

  return 'private';
}

export function buildCircleEditDraft(
  circle: Pick<
    CircleSummary,
    | 'category'
    | 'circleMode'
    | 'commitment'
    | 'commitmentCadence'
    | 'commitmentFrequency'
    | 'commitmentType'
    | 'graceRules'
    | 'joinMode'
    | 'maximumValue'
    | 'maxSize'
    | 'minimumValue'
    | 'privacy'
    | 'stepValue'
    | 'targetValue'
    | 'title'
    | 'unitLabel'
  > & {timezone?: string},
  fallbackTimezone?: string,
): CreateCircleDraft {
  const initialDraft = createInitialCircleDraft(fallbackTimezone);
  const privacyMode = getCirclePrivacyMode(circle);
  const commitmentCadence = normalizeCommitmentCadence(
    circle.commitmentCadence,
    circle.commitmentFrequency,
  );

  return {
    ...initialDraft,
    category: circle.category,
    circleMode: normalizeCircleMode(circle.circleMode),
    commitment: circle.commitment,
    commitmentCadence,
    commitmentFrequency: normalizeCommitmentFrequency(
      circle.commitmentFrequency ?? initialDraft.commitmentFrequency,
      commitmentCadence,
    ),
    commitmentType: normalizeCommitmentType(circle.commitmentType),
    graceRules: {
      skip: normalizeSkipGraceRule(
        circle.graceRules?.skip ?? initialDraft.graceRules.skip,
      ),
    },
    joinMode: circle.joinMode ?? initialDraft.joinMode,
    maximumValue: normalizeOptionalQuantityValue(circle.maximumValue),
    maxSize: clampCircleMaxSize(circle.maxSize ?? initialDraft.maxSize),
    minimumValue: normalizeOptionalQuantityValue(circle.minimumValue),
    privacy: circle.privacy ?? initialDraft.privacy,
    privacyMode,
    stepValue: normalizeStepValue(circle.stepValue ?? initialDraft.stepValue),
    targetValue:
      normalizeCommitmentType(circle.commitmentType) === 'limit'
        ? undefined
        : normalizeOptionalQuantityValue(circle.targetValue) ??
          initialDraft.targetValue,
    timezone: circle.timezone?.trim() || initialDraft.timezone,
    title: circle.title,
    unitLabel: normalizeUnitLabel(circle.unitLabel ?? initialDraft.unitLabel),
  };
}

export function clampCircleMaxSize(value: number) {
  if (!Number.isFinite(value)) {
    return 2;
  }

  return Math.min(100, Math.max(2, Math.round(value)));
}

export function isCircleMaxSizeBelowMemberCount(
  maxSize: number,
  memberCount: number,
) {
  return clampCircleMaxSize(maxSize) < Math.max(0, Math.round(memberCount));
}

export function normalizeSkipGraceRule(rule: GraceRule): GraceRule {
  return {
    allowance: Math.min(30, Math.max(0, Math.round(rule.allowance))),
    windowDays: Math.min(365, Math.max(1, Math.round(rule.windowDays))),
  };
}

export function normalizeCommitmentType(value: unknown): CommitmentType {
  return value === 'limit' || value === 'avoid' || value === 'build'
    ? value
    : defaultCommitmentType;
}

export function normalizeCircleMode(value: unknown): CircleMode {
  return value === 'personal' ? 'personal' : 'group';
}

export function normalizeStepValue(value: unknown) {
  return typeof value === 'number' && Number.isFinite(value) && value > 0
    ? value
    : defaultCommitmentStepValue;
}

export function normalizeUnitLabel(value: unknown) {
  return typeof value === 'string' && value.trim().length > 0
    ? value.trim().slice(0, 32)
    : defaultCommitmentUnitLabel;
}

export function normalizeOptionalQuantityValue(value: unknown) {
  return typeof value === 'number' && Number.isFinite(value)
    ? Math.max(0, Math.round(value))
    : undefined;
}

export function normalizeCommitmentFrequency(
  frequency: CommitmentFrequency,
  cadence: CommitmentCadence = 'weekly',
): CommitmentFrequency {
  if (cadence === 'daily') {
    return {...defaultCommitmentFrequency};
  }

  if (cadence === 'monthly') {
    return {
      opportunitiesPerPeriod: Math.min(
        31,
        Math.max(
          1,
          Math.round(
            frequency.opportunitiesPerPeriod ?? frequency.tapInsPerWeek ?? 4,
          ),
        ),
      ),
      tapInsPerWeek: Math.min(
        7,
        Math.max(1, Math.round(frequency.tapInsPerWeek ?? 4)),
      ),
    };
  }

  return {
    tapInsPerWeek: Math.min(
      7,
      Math.max(1, Math.round(frequency.tapInsPerWeek)),
    ),
  };
}

export function normalizeCommitmentCadence(
  cadence: unknown,
  frequency?: CommitmentFrequency,
): CommitmentCadence {
  if (cadence === 'daily' || cadence === 'weekly' || cadence === 'monthly') {
    return cadence;
  }

  return normalizeCommitmentFrequency(
    frequency ?? defaultCommitmentFrequency,
    'weekly',
  ).tapInsPerWeek >= 7
    ? 'daily'
    : 'weekly';
}

export function buildCreateCirclePayload(
  draft: CreateCircleDraft,
): CreateCirclePayload {
  const circleMode = normalizeCircleMode(draft.circleMode);
  const commitmentCadence = normalizeCommitmentCadence(
    draft.commitmentCadence,
    draft.commitmentFrequency,
  );
  const commitmentType = normalizeCommitmentType(draft.commitmentType);
  const maximumValue =
    commitmentType === 'limit'
      ? normalizeOptionalQuantityValue(
          draft.maximumValue ??
            draft.targetValue ??
            defaultCommitmentTargetValue,
        ) ?? defaultCommitmentTargetValue
      : undefined;
  const minimumValue =
    commitmentType === 'limit'
      ? normalizeOptionalQuantityValue(draft.minimumValue)
      : undefined;
  const targetValue =
    commitmentType === 'build'
      ? normalizeOptionalQuantityValue(draft.targetValue) ??
        defaultCommitmentTargetValue
      : commitmentType === 'avoid'
      ? defaultCommitmentTargetValue
      : undefined;

  return {
    category: draft.category.trim(),
    circleMode,
    commitment: draft.commitment.trim(),
    commitmentCadence,
    commitmentFrequency: normalizeCommitmentFrequency(
      draft.commitmentFrequency,
      commitmentCadence,
    ),
    commitmentType,
    graceRules: {
      skip: normalizeSkipGraceRule(draft.graceRules.skip),
    },
    joinMode: circleMode === 'personal' ? 'invite_only' : draft.joinMode,
    ...(typeof maximumValue === 'number' ? {maximumValue} : {}),
    ...(typeof minimumValue === 'number'
      ? {minimumValue: Math.min(minimumValue, maximumValue ?? minimumValue)}
      : {}),
    maxSize: circleMode === 'personal' ? 1 : clampCircleMaxSize(draft.maxSize),
    privacy: circleMode === 'personal' ? 'private' : draft.privacy,
    stepValue: defaultCommitmentStepValue,
    ...(typeof targetValue === 'number' ? {targetValue} : {}),
    timezone: draft.timezone.trim() || getLocalTimezone(),
    title:
      circleMode === 'personal' ? draft.commitment.trim() : draft.title.trim(),
    unitLabel:
      commitmentType === 'avoid'
        ? defaultCommitmentUnitLabel
        : normalizeUnitLabel(draft.unitLabel),
  };
}
