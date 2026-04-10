import type {ImageSourcePropType} from 'react-native';

export type CirclePrivacy = 'private' | 'public';
export type CircleJoinMode = 'invite_only' | 'request_to_join';
export type MemberRole = 'owner' | 'admin' | 'member';
export type CheckInStatus = 'done' | 'skip' | 'rest';
export type TodayCircleState = 'active' | 'done' | 'risk';
export type CircleMemberState = 'done' | 'pending' | 'missed';
export type CircleActivityTone = 'success' | 'pending' | 'alert';
export type ProgressDayState = 'done' | 'missed' | 'today' | 'future';

export type UserProfile = {
  id: string;
  handle: string;
  name: string;
  avatarUrl?: string;
  avatarImage?: ImageSourcePropType;
  bio?: string;
  timezone: string;
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

export type TodayCircleCard = {
  id: string;
  title: string;
  category: string;
  dailyTask: string;
  state: TodayCircleState;
  progressPercent: number;
  viewerHasCheckedIn: boolean;
  remainingCheckIns: number;
  streakDays: number;
  streakLabel: string;
  members: CircleMemberStatus[];
  completionLabel?: string;
  progressLabel?: string;
};

export type CircleDetailModel = {
  id: string;
  category: string;
  streakLabel: string;
  title: string;
  dailyGoal: string;
  completionRate: number;
  members: CircleMemberStatus[];
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

export type CheckInDraft = {
  note: string;
  photoUri?: string;
};
