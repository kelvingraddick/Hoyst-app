import type {NavigatorScreenParams} from '@react-navigation/native';

export type AppTabsParamList = {
  Home: undefined;
  Explore: undefined;
  TapIn: undefined;
  Inbox: undefined;
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

export type RootStackParamList = {
  Loading: undefined;
  MainTabs: NavigatorScreenParams<AppTabsParamList> | undefined;
  Auth: NavigatorScreenParams<AuthStackParamList> | undefined;
  EditProfile: undefined;
  EditCircle: {circleId: string};
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
    source: TapInSource;
    status?: 'done' | 'skip';
    note?: string;
    photoUri?: string;
  };
};
