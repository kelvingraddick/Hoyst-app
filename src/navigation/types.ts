import type {NavigatorScreenParams} from '@react-navigation/native';

export type AppTabsParamList = {
  Home: undefined;
  Circles: undefined;
  TapIn: undefined;
  Explore: undefined;
  Profile: undefined;
};

export type AuthStackParamList = {
  Welcome: undefined;
  SignIn: undefined;
  CompleteProfile: undefined;
};

export type TapInSource = 'home' | 'circle_detail' | 'tap_in';

export type RootStackParamList = {
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
