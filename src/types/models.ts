import type {ImageSourcePropType} from 'react-native';

export type CirclePrivacy = 'private' | 'public';
export type CirclePrivacyMode = 'link_only' | 'private' | 'public';
export type CircleJoinMode = 'open' | 'invite_only' | 'request_to_join';
export type CircleMembershipStatus = 'active' | 'pending';
export type MemberRole = 'owner' | 'admin' | 'member';
export type CheckInStatus = 'done' | 'skip' | 'rest';
export type TodayCircleState = 'active' | 'done' | 'risk';
export type CircleMemberState = 'done' | 'pending' | 'missed' | 'skipped';
export type CircleActivityTone = 'success' | 'pending' | 'alert';
export type ProgressDayState = 'done' | 'missed' | 'today' | 'future';
export type CircleJoinLabel = 'Open seats' | 'Request to join';
export type CommitmentCadence = 'daily' | 'weekly' | 'monthly';
export type OpportunityStatus =
  | 'upcoming'
  | 'available'
  | 'completed'
  | 'missed'
  | 'expired'
  | 'skipped';
export type MomentumStatus =
  | 'getting_started'
  | 'building_momentum'
  | 'strong_momentum'
  | 'peak_momentum';

export type UserProfile = {
  id: string;
  handle: string;
  name: string;
  avatarUrl?: string;
  avatarImage?: ImageSourcePropType;
  bio?: string;
  timezone: string;
  onboardingStatus?: 'complete';
};

export type GraceRule = {
  allowance: number;
  windowDays: number;
};

export type CommitmentFrequency = {
  tapInsPerWeek: number;
  opportunitiesPerPeriod?: number;
};

export type CommitmentSchedule = {
  cadence: CommitmentCadence;
  opportunitiesPerPeriod: number;
  slotPolicy: 'scheduled_slots';
  timezone: string;
};

export type MomentumSummary = {
  availableOpportunities: number;
  bestStreak: number;
  completedOpportunities: number;
  currentStreak: number;
  label: string;
  percentage: number;
  periodKey: string;
  status: MomentumStatus;
};

export type Opportunity = {
  availableDateKey: string;
  cadence: CommitmentCadence;
  circleId: string;
  completedAt?: unknown;
  completionDateKey?: string;
  commitment: string;
  createdAt?: unknown;
  expiresDateKey: string;
  id: string;
  linkedCheckInId?: string;
  periodKey: string;
  slotIndex: number;
  status: OpportunityStatus;
  title: string;
  timezone: string;
  updatedAt?: unknown;
};

export type Circle = {
  id: string;
  title: string;
  category: string;
  commitment: string;
  commitmentCadence: CommitmentCadence;
  commitmentFrequency: CommitmentFrequency;
  timezone: string;
  maxSize: number;
  privacy: CirclePrivacy;
  joinMode: CircleJoinMode;
  memberCount: number;
  graceRules: {
    skip: GraceRule;
    rest: GraceRule;
  };
};

export type CircleMemberStatus = {
  id: string;
  name: string;
  initials: string;
  avatarImage?: ImageSourcePropType;
  avatarUrl?: string;
  membershipStatus?: CircleMembershipStatus;
  state: CircleMemberState;
  badgeCount?: number;
};

export type CircleProgressDay = {
  day: number;
  state: ProgressDayState;
};

export type CircleGroupProgressDay = {
  coveredCount: number;
  dateKey: string;
  label: string;
  state: ProgressDayState;
  totalCount: number;
};

export type CircleActivityItem = {
  id: string;
  actorName: string;
  actorInitials: string;
  actorAvatarImage?: ImageSourcePropType;
  actorAvatarUrl?: string;
  tone: CircleActivityTone;
  message: string;
  timestamp: string;
  actionLabel?: string;
  imageVariant?: 'workout' | 'none';
  mediaImageUrl?: string;
};

export type InboxEventType =
  | 'circle_at_risk'
  | 'circle_complete'
  | 'circle_discovery_suggestion'
  | 'circle_nudge_prompt'
  | 'companion_achievement_unlocked'
  | 'companion_circle_created'
  | 'companion_circle_joined'
  | 'companion_momentum_level_up'
  | 'companion_skipped'
  | 'companion_streak_milestone'
  | 'companion_tapped_in'
  | 'evening_summary'
  | 'join_approved'
  | 'join_declined'
  | 'join_request'
  | 'member_due_prompt'
  | 'member_joined'
  | 'nudge'
  | 'tap_in_final_warning'
  | 'tap_in_midday_reminder';

export type InboxDeeplink =
  | {screen: 'CircleDetail'; circleId: string}
  | {screen: 'Inbox'}
  | {screen: 'TapInPicker'}
  | {screen: 'TapInComposer'; circleId: string; source: 'notification'};

export type InboxEvent = {
  actor?: {
    avatarUrl?: string;
    displayName?: string;
    handle?: string;
    uid?: string;
  };
  body: string;
  circleId?: string;
  createdAtLabel: string;
  deeplink: InboxDeeplink;
  feedCategory?: 'companion';
  id: string;
  isRead: boolean;
  mediaImageUrl?: string;
  title: string;
  type: InboxEventType;
};

export type CircleSummary = {
  id: string;
  title: string;
  category: string;
  commitment: string;
  commitmentCadence?: CommitmentCadence;
  commitmentFrequency?: CommitmentFrequency;
  streakLabel: string;
  members: CircleMemberStatus[];
  state?: TodayCircleState;
  progressPercent?: number;
  completionRate?: number;
  viewerHasCheckedIn?: boolean;
  viewerTodayStatus?: CheckInStatus;
  remainingCheckIns?: number;
  graceRules?: {
    skip: GraceRule;
  };
  streakDays?: number;
  memberCount?: number;
  maxSize?: number;
  privacy?: CirclePrivacy;
  joinMode?: CircleJoinMode;
  viewerRole?: MemberRole;
  viewerMembershipStatus?: CircleMembershipStatus;
  inviteUrl?: string;
  joinLabel?: CircleJoinLabel;
  matchCopy?: string;
  nudgeTargetCount?: number;
  completionLabel?: string;
  progressLabel?: string;
  timezone?: string;
  viewerHasTappedInToday?: boolean;
  viewerAvailableSkips?: number;
  viewerRemainingTapIns?: number;
};

export type TodayCircleCard = CircleSummary & {
  state: TodayCircleState;
  progressPercent: number;
  viewerHasCheckedIn: boolean;
  viewerHasTappedInToday?: boolean;
  remainingCheckIns: number;
  streakDays: number;
};

export type CircleManagementFilter = 'all' | 'needsYou' | 'atRisk' | 'done';

export type CircleManagementCard = TodayCircleCard & {
  privacy: CirclePrivacy;
  joinMode: CircleJoinMode;
  memberCount: number;
  maxSize: number;
  viewerRole: MemberRole;
  inviteUrl?: string;
};

export type ExploreCircle = CircleSummary & {
  matchCopy: string;
  joinLabel: CircleJoinLabel;
  memberCount: number;
  maxSize: number;
  completionRate: number;
};

export type CircleDetailModel = CircleSummary & {
  commitmentLabel: string;
  completionRate: number;
  groupProgressDays?: CircleGroupProgressDay[];
  memberCount: number;
  maxSize: number;
  monthProgress: CircleProgressDay[];
  activity: CircleActivityItem[];
};

export type CreateCircleDraft = {
  category: string;
  commitmentCadence: CommitmentCadence;
  graceRules: {
    skip: GraceRule;
  };
  joinMode: CircleJoinMode;
  title: string;
  commitment: string;
  commitmentFrequency: CommitmentFrequency;
  privacy: CirclePrivacy;
  privacyMode: CirclePrivacyMode;
  maxSize: number;
  inviteCode: string;
  timezone: string;
};

export type TapInDraft = {
  note: string;
  photoUri?: string;
};
