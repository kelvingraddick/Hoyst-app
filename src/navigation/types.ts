import type {NavigatorScreenParams} from '@react-navigation/native';

export type AppTabsParamList = {
  Home: undefined;
  Circles: undefined;
  TapIn: undefined;
  Explore: undefined;
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

export type TapInSource = 'home' | 'circle_detail' | 'tap_in';

export type RootStackParamList = {
  Loading: undefined;
  MainTabs: undefined;
  Auth: NavigatorScreenParams<AuthStackParamList> | undefined;
  Inbox: undefined;
  Settings: undefined;
  EditProfile: undefined;
  TapInPicker: undefined;
  CreateCircle: undefined;
  CircleDetail: {circleId: string; resumeAction?: 'join'};
  TapInComposer: {circleId: string; source: TapInSource};
  TapInComplete: {
    circleId: string;
    source: TapInSource;
    note?: string;
    photoUri?: string;
  };
};
