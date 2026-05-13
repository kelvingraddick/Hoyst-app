import type {
  CircleJoinMode,
  CirclePrivacy,
  CirclePrivacyMode,
  CreateCircleDraft,
  GraceRule,
} from '../../../types/models';

export type CreateCirclePayload = {
  category: string;
  dailyTask: string;
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

export function getLocalTimezone() {
  return Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';
}

export function createInitialCircleDraft(timezone?: string): CreateCircleDraft {
  return {
    category: 'Fitness',
    dailyTask: '',
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

export function clampCircleMaxSize(value: number) {
  if (!Number.isFinite(value)) {
    return 2;
  }

  return Math.min(100, Math.max(2, Math.round(value)));
}

export function normalizeSkipGraceRule(rule: GraceRule): GraceRule {
  return {
    allowance: Math.min(30, Math.max(0, Math.round(rule.allowance))),
    windowDays: Math.min(365, Math.max(1, Math.round(rule.windowDays))),
  };
}

export function buildCreateCirclePayload(
  draft: CreateCircleDraft,
): CreateCirclePayload {
  return {
    category: draft.category.trim(),
    dailyTask: draft.dailyTask.trim(),
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
