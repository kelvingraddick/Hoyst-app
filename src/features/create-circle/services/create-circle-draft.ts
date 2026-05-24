import type {
  CircleJoinMode,
  CirclePrivacy,
  CirclePrivacyMode,
  CircleSummary,
  CommitmentCadence,
  CommitmentFrequency,
  CreateCircleDraft,
  GraceRule,
} from '../../../types/models';

export type CreateCirclePayload = {
  category: string;
  commitment: string;
  commitmentCadence: CommitmentCadence;
  commitmentFrequency: CommitmentFrequency;
  graceRules: {
    skip: GraceRule;
  };
  joinMode: CircleJoinMode;
  maxSize: number;
  privacy: CirclePrivacy;
  timezone: string;
  title: string;
};

export const defaultSkipGraceRule: GraceRule = {
  allowance: 2,
  windowDays: 7,
};
export const defaultCircleMaxSize = 10;
export const defaultCommitmentFrequency: CommitmentFrequency = {
  tapInsPerWeek: 7,
};
export const defaultWeeklyCommitmentFrequency: CommitmentFrequency = {
  tapInsPerWeek: 4,
};
export const defaultCommitmentCadence: CommitmentCadence = 'daily';

export function getLocalTimezone() {
  return Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';
}

export function createInitialCircleDraft(timezone?: string): CreateCircleDraft {
  return {
    category: 'Fitness',
    commitment: '',
    commitmentCadence: defaultCommitmentCadence,
    commitmentFrequency: defaultCommitmentFrequency,
    graceRules: {
      skip: defaultSkipGraceRule,
    },
    inviteCode: '',
    joinMode: 'request_to_join',
    maxSize: defaultCircleMaxSize,
    privacy: 'public',
    privacyMode: 'public',
    timezone: timezone?.trim() || getLocalTimezone(),
    title: '',
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
    | 'commitment'
    | 'commitmentCadence'
    | 'commitmentFrequency'
    | 'graceRules'
    | 'joinMode'
    | 'maxSize'
    | 'privacy'
    | 'title'
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
    commitment: circle.commitment,
    commitmentCadence,
    commitmentFrequency: normalizeCommitmentFrequency(
      circle.commitmentFrequency ?? initialDraft.commitmentFrequency,
      commitmentCadence,
    ),
    graceRules: {
      skip: normalizeSkipGraceRule(
        circle.graceRules?.skip ?? initialDraft.graceRules.skip,
      ),
    },
    joinMode: circle.joinMode ?? initialDraft.joinMode,
    maxSize: clampCircleMaxSize(circle.maxSize ?? initialDraft.maxSize),
    privacy: circle.privacy ?? initialDraft.privacy,
    privacyMode,
    timezone: circle.timezone?.trim() || initialDraft.timezone,
    title: circle.title,
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

export function normalizeCommitmentFrequency(
  frequency: CommitmentFrequency,
  cadence: CommitmentCadence = 'weekly',
): CommitmentFrequency {
  if (cadence === 'daily') {
    return {...defaultCommitmentFrequency};
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
  if (cadence === 'daily' || cadence === 'weekly') {
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
  const commitmentCadence = normalizeCommitmentCadence(
    draft.commitmentCadence,
    draft.commitmentFrequency,
  );

  return {
    category: draft.category.trim(),
    commitment: draft.commitment.trim(),
    commitmentCadence,
    commitmentFrequency: normalizeCommitmentFrequency(
      draft.commitmentFrequency,
      commitmentCadence,
    ),
    graceRules: {
      skip: normalizeSkipGraceRule(draft.graceRules.skip),
    },
    joinMode: draft.joinMode,
    maxSize: clampCircleMaxSize(draft.maxSize),
    privacy: draft.privacy,
    timezone: draft.timezone.trim() || getLocalTimezone(),
    title: draft.title.trim(),
  };
}
