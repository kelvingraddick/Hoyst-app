import type {NavigatorScreenParams} from '@react-navigation/native';

export type AppTabsParamList = {
  Home: undefined;
  Explore: undefined;
  TapIn: undefined;
  Inbox: undefined;
  Profile: undefined;
};

export type SignInEntryPoint =
  | 'welcome'
  | 'onboarding'
  | 'protectedAction'
  | 'profile'
  | 'settings';

export type SignInMethod = 'email' | 'phone';

export type SignInMode = 'signIn' | 'register';

export type SignInRouteParams = {
  entryPoint?: SignInEntryPoint;
  method?: SignInMethod;
  mode: SignInMode;
};

export type AuthStackParamList = {
  Welcome: undefined;
  SignIn: SignInRouteParams | undefined;
  CompleteProfile: undefined;
};

export type TapInSource = 'circle_detail' | 'home' | 'notification' | 'tap_in';

export type RootStackParamList = {
  Loading: undefined;
  MainTabs: NavigatorScreenParams<AppTabsParamList> | undefined;
  Auth: NavigatorScreenParams<AuthStackParamList> | undefined;
  Settings: undefined;
  EditProfile: undefined;
  TapInPicker: undefined;
  CreateCircle: undefined;
  CircleDetail: {circleId: string; resumeAction?: 'join'};
  TapInComposer: {circleId: string; source: TapInSource};
  TapInComplete: {
    circleId: string;
    source: TapInSource;
    status?: 'done' | 'skip';
    note?: string;
    photoUri?: string;
  };
};
