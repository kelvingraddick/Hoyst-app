import type {
  CircleJoinMode,
  CirclePrivacy,
  CirclePrivacyMode,
  CircleSummary,
  CommitmentFrequency,
  CreateCircleDraft,
  GraceRule,
} from '../../../types/models';

export type CreateCirclePayload = {
  category: string;
  commitment: string;
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

export function getLocalTimezone() {
  return Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';
}

export function createInitialCircleDraft(timezone?: string): CreateCircleDraft {
  return {
    category: 'Fitness',
    commitment: '',
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

  return {
    ...initialDraft,
    category: circle.category,
    commitment: circle.commitment,
    commitmentFrequency: normalizeCommitmentFrequency(
      circle.commitmentFrequency ?? initialDraft.commitmentFrequency,
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
): CommitmentFrequency {
  return {
    tapInsPerWeek: Math.min(
      7,
      Math.max(1, Math.round(frequency.tapInsPerWeek)),
    ),
  };
}

export function buildCreateCirclePayload(
  draft: CreateCircleDraft,
): CreateCirclePayload {
  return {
    category: draft.category.trim(),
    commitment: draft.commitment.trim(),
    commitmentFrequency: normalizeCommitmentFrequency(
      draft.commitmentFrequency,
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
