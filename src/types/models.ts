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

export type Circle = {
  id: string;
  title: string;
  category: string;
  dailyTask: string;
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
};

export type InboxEventType =
  | 'circle_at_risk'
  | 'join_approved'
  | 'join_declined'
  | 'join_request'
  | 'member_joined'
  | 'poke'
  | 'tap_in_final_warning'
  | 'tap_in_midday_reminder';

export type InboxDeeplink =
  | {screen: 'CircleDetail'; circleId: string}
  | {screen: 'Inbox'}
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
  id: string;
  isRead: boolean;
  title: string;
  type: InboxEventType;
};

export type CircleSummary = {
  id: string;
  title: string;
  category: string;
  dailyTask: string;
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
  completionLabel?: string;
  progressLabel?: string;
  timezone?: string;
};

export type TodayCircleCard = CircleSummary & {
  state: TodayCircleState;
  progressPercent: number;
  viewerHasCheckedIn: boolean;
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
  dailyGoal: string;
  completionRate: number;
  memberCount: number;
  maxSize: number;
  monthProgress: CircleProgressDay[];
  activity: CircleActivityItem[];
};

export type CreateCircleDraft = {
  category: string;
  graceRules: {
    skip: GraceRule;
  };
  joinMode: CircleJoinMode;
  title: string;
  dailyTask: string;
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
