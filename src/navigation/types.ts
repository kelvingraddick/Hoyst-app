export type AppTabsParamList = {
  Home: undefined;
  Circles: undefined;
  Explore: undefined;
  Inbox: undefined;
  Profile: undefined;
};

export type AuthStackParamList = {
  Welcome: undefined;
  SignIn: undefined;
};

export type RootStackParamList = {
  MainTabs: undefined;
  Auth: undefined;
  CreateCircle: undefined;
  CircleDetail: {circleId: string};
  CheckInModal: {circleId: string; source: 'home' | 'circle_detail'};
};
