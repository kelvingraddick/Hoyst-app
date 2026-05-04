import type {ImageSourcePropType} from 'react-native';

export type CirclePrivacy = 'private' | 'public';
export type CircleJoinMode = 'open' | 'invite_only' | 'request_to_join';
export type MemberRole = 'owner' | 'admin' | 'member';
export type CheckInStatus = 'done' | 'skip' | 'rest';
export type TodayCircleState = 'active' | 'done' | 'risk';
export type CircleMemberState = 'done' | 'pending' | 'missed';
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
  tone: CircleActivityTone;
  message: string;
  timestamp: string;
  actionLabel?: string;
  imageVariant?: 'workout' | 'none';
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
  remainingCheckIns?: number;
  streakDays?: number;
  memberCount?: number;
  maxSize?: number;
  privacy?: CirclePrivacy;
  joinMode?: CircleJoinMode;
  viewerRole?: MemberRole;
  inviteUrl?: string;
  joinLabel?: CircleJoinLabel;
  matchCopy?: string;
  completionLabel?: string;
  progressLabel?: string;
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
  title: string;
  dailyTask: string;
  privacy: CirclePrivacy;
  maxSize: number;
  inviteCode: string;
};

export type TapInDraft = {
  note: string;
  photoUri?: string;
};
