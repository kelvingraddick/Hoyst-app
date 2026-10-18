import type {CircleProgressResult} from '../shared/circle-progress';
import type {CommitmentAppearance} from '../shared/commitment-appearance';
import type {NavigatorScreenParams} from '@react-navigation/native';
import type {
  CheckInCoverageStatus,
  CircleMemberStatus,
  CircleMode,
  CommitmentPace,
  CommitmentType,
} from '../types/models';
import type {PastCircleSummary} from '../features/circles/services/past-circle-service';

export type AppTabsParamList = {
  Home: undefined;
  Explore: undefined;
  TapIn: undefined;
  Progress: undefined;
  Profile: undefined;
};

export type SignInEntryPoint = 'welcome' | 'profile';

export type SignInMethod = 'email' | 'phone';

export type SignInRouteParams = {
  setupKey?: string;
  entryPoint?: SignInEntryPoint;
  method?: SignInMethod;
};

export type AuthStackParamList = {
  Welcome: {setupKey?: string} | undefined;
  SignIn: SignInRouteParams | undefined;
};

export type TapInSource = 'circle_detail' | 'home' | 'notification' | 'tap_in';

export type TapInCompletionMomentum = {
  currentStreak: number;
  streakDelta: number;
};

export type TapInCompletionStatus = 'done' | 'skip' | 'partial' | 'failed';

export type RootStackParamList = {
  ProgressDetails: {
    section: import('../features/progress/screens/ProgressScreen').ProgressSection;
    packType?: 'skips' | 'restores';
    dateKey?: string;
    activityId?: string;
    ownerUid?: string;
  };
  Loading: undefined;
  MainTabs: NavigatorScreenParams<AppTabsParamList> | undefined;
  Auth: NavigatorScreenParams<AuthStackParamList> | undefined;
  CircleInvite: {inviteCode: string};
  Circles: undefined;
  Inbox: undefined;
  EditProfile: {focusPhoto?: boolean} | undefined;
  ProfileShare: undefined;
  ProfileMilestones: undefined;
  Settings: undefined;
  AccountSettings: undefined;
  NotificationSettings: undefined;
  AppearanceSettings: undefined;
  AboutHoyst: undefined;
  EditCircle: {circleId: string};
  CircleTools: {circleId: string};
  ConvertPersonalCircle: {circleId: string};
  TapInPicker: undefined;
  CreateCircle: undefined;
  CircleDetail: {
    circleId: string;
    resumeAction?: 'join';
    source?: 'notification';
  };
  PastCircle: {summary: PastCircleSummary};
  ArchivedCircles: undefined;
  TapInComposer: {circleId: string; source: TapInSource};
  TapInComplete: {
    proofRequirement?: import('../shared/tap-in-proof').ProofRequirement;
    category?: string;
    appearance?: CommitmentAppearance;
    circleId: string;
    circleMode?: CircleMode;
    commitmentCadence?: CommitmentPace;
    timezone?: string;
    dateKey: string;
    circleTitle?: string;
    commitment?: string;
    commitmentType?: CommitmentType;
    coverageStatus?: CheckInCoverageStatus;
    currentValue?: number;
    inviteUrl?: string;
    maximumValue?: number;
    memberCount?: number;
    members?: CircleMemberStatus[];
    minimumValue?: number;
    periodTapInCount?: number;
    progressLabel?: string;
    source: TapInSource;
    status?: TapInCompletionStatus;
    streakDays?: number;
    streakLabel?: string;
    targetValue?: number;
    unitLabel?: string;
    circleProgress?: CircleProgressResult;
    completionMomentum?: TapInCompletionMomentum;
    completionProgress?: {
      xpEarned: number;
      rewards: {skips: number; restores: number};
    };
    note?: string;
    photoUri?: string;
  };
  TapInStoryShare: {
    category?: string;
    appearance?: CommitmentAppearance;
    circleId: string;
    circleMode?: CircleMode;
    circleTitle?: string;
    commitment?: string;
    commitmentType?: CommitmentType;
    commitmentCadence?: CommitmentPace;
    dateKey: string;
    timezone?: string;
    status?: TapInCompletionStatus;
    coverageStatus?: CheckInCoverageStatus;
    currentValue?: number;
    minimumValue?: number;
    maximumValue?: number;
    targetValue?: number;
    unitLabel?: string;
    circleProgress?: CircleProgressResult;
    inviteUrl?: string;
    memberCount?: number;
    members?: CircleMemberStatus[];
    source: TapInSource;
    photoUri?: string;
  };
};
