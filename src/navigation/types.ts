import type {NavigatorScreenParams} from '@react-navigation/native';

export type AppTabsParamList = {
  Home: undefined;
  Explore: undefined;
  TapIn: undefined;
  Momentum: undefined;
  Profile: undefined;
};

export type SignInEntryPoint = 'welcome' | 'profile';

export type SignInMethod = 'email' | 'phone';

export type SignInRouteParams = {
  entryPoint?: SignInEntryPoint;
  method?: SignInMethod;
};

export type AuthStackParamList = {
  Welcome: undefined;
  SignIn: SignInRouteParams | undefined;
};

export type TapInSource = 'circle_detail' | 'home' | 'notification' | 'tap_in';

export type TapInCompletionMomentum = {
  currentStreak: number;
  streakDelta: number;
};

export type RootStackParamList = {
  Loading: undefined;
  MainTabs: NavigatorScreenParams<AppTabsParamList> | undefined;
  Auth: NavigatorScreenParams<AuthStackParamList> | undefined;
  Circles: undefined;
  Inbox: undefined;
  EditProfile: undefined;
  EditCircle: {circleId: string};
  CircleTools: {circleId: string};
  CircleThread: {circleId: string};
  TapInPicker: undefined;
  CreateCircle: undefined;
  CircleDetail: {
    circleId: string;
    resumeAction?: 'join';
    source?: 'notification';
  };
  TapInComposer: {circleId: string; source: TapInSource};
  TapInComplete: {
    circleId: string;
    circleTitle?: string;
    commitment?: string;
    inviteUrl?: string;
    memberCount?: number;
    periodTapInCount?: number;
    progressLabel?: string;
    source: TapInSource;
    status?: 'done' | 'skip';
    streakDays?: number;
    streakLabel?: string;
    completionMomentum?: TapInCompletionMomentum;
    note?: string;
    photoUri?: string;
  };
  TapInStoryShare: {
    circleId: string;
    circleTitle?: string;
    commitment?: string;
    inviteUrl?: string;
    memberCount?: number;
    periodTapInCount?: number;
    progressLabel?: string;
    source: TapInSource;
    streakDays?: number;
    streakLabel?: string;
    note?: string;
    photoUri?: string;
  };
};
