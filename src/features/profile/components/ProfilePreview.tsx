/** Development-only fixtures. No account identity, history, or preferences are written. */
import React, {useEffect, useState} from 'react';
import {View} from 'react-native';
import {
  NavigationContainer,
  NavigationIndependentTree,
} from '@react-navigation/native';
import {createNativeStackNavigator} from '@react-navigation/native-stack';
import {QueryClient, QueryClientProvider} from '@tanstack/react-query';
import {AppTabsNavigator} from '../../../navigation/AppTabsNavigator';
import type {RootStackParamList} from '../../../navigation/types';
import type {UserProfile} from '../../../types/models';
import {useSettingsStore} from '../../../store/settings-store';
import {getSystemTheme} from '../../../design/system';
import {ProfilePreviewContext} from './ProfilePreviewContext';
import {normalizeProfileTint} from '../services/profile-personalization';
import {ProfileShareScreen} from '../screens/ProfileShareScreen';
import {ProfileMilestonesScreen} from '../screens/ProfileMilestonesScreen';
import {EditProfileScreen} from '../../settings/screens/EditProfileScreen';
import {
  SettingsScreen,
  AccountSettingsScreen,
  NotificationSettingsScreen,
  AppearanceSettingsScreen,
  AboutHoystScreen,
} from '../../settings/screens/SettingsScreens';
import type {ProgressSummary} from '../../progress/services/progress-service';
const Stack = createNativeStackNavigator<RootStackParamList>();
const queryClient = new QueryClient({
  defaultOptions: {queries: {retry: false}},
});
const progress: ProgressSummary = {
  totalXP: 340,
  level: 5,
  levelXP: 60,
  requiredXP: 70,
  remainingXP: 10,
  inventory: {skips: 3, restores: 1},
  tasks: {},
  milestones: {
    streak_3: true,
    streak_7: true,
    streak_14: true,
    tap_ins_50: true,
  },
  routineRemainingXP: 30,
  flags: {earning: true, inventory: true, restoring: true, buying: false},
};
const routes: Record<string, keyof RootStackParamList> = {
  edit: 'EditProfile',
  share: 'ProfileShare',
  settings: 'Settings',
  account: 'AccountSettings',
  notifications: 'NotificationSettings',
  appearance: 'AppearanceSettings',
  about: 'AboutHoyst',
  milestones: 'ProfileMilestones',
};
export function ProfilePreview({mode}: {mode: string}) {
  const scheme = mode.includes('dark') ? 'dark' : 'light';
  const parts = mode.split('-');
  const tint = normalizeProfileTint(
    parts.find(part =>
      ['green', 'blue', 'purple', 'orange', 'gold'].includes(part),
    ),
  );
  const [profile, setProfile] = useState<UserProfile>({
    id: 'profile-read-only-fixture',
    name: 'Kelvin North',
    handle: 'kelvin',
    bio: 'Small steps. Stronger every day.',
    timezone: 'America/New_York',
    profileTint: tint,
    onboardingStatus: 'complete',
    avatarImage: require('../../../assets/avatars/kelvin.png'),
  });
  useEffect(() => {
    const previous = useSettingsStore.getState().appearance;
    useSettingsStore.getState().setAppearancePreference(scheme);
    return () => useSettingsStore.getState().setAppearancePreference(previous);
  }, [scheme]);
  const status = parts.includes('guest')
    ? 'guest'
    : parts.includes('incomplete')
    ? 'incomplete'
    : parts.includes('loading')
    ? 'loading'
    : parts.includes('error')
    ? 'error'
    : undefined;
  const route = routes[parts.find(part => routes[part]) ?? ''];
  const empty = parts.includes('empty');
  return (
    <QueryClientProvider client={queryClient}>
      <ProfilePreviewContext.Provider
        value={{
          scheme,
          status,
          profile:
            status === 'guest' || status === 'incomplete' ? undefined : profile,
          stats:
            status === 'loading' || status === 'error'
              ? undefined
              : {
                  activeCircleCount: empty ? 0 : 1,
                  activePersonalCommitmentCount: empty ? 0 : 3,
                  personalStreakDays: empty ? 0 : 14,
                  longestStreakDays: empty ? 0 : 28,
                  totalTapIns: empty ? 0 : 186,
                  hasTappedInToday: !empty,
                },
          progress:
            status === 'loading' || status === 'error'
              ? undefined
              : empty
              ? {...progress, totalXP: 0, level: 1, levelXP: 0, milestones: {}}
              : progress,
          momentumLabel:
            status === 'loading' || status === 'error'
              ? undefined
              : empty
              ? '0 of 3'
              : '86%',
          categories: empty ? [] : ['fitness', 'learning', 'wellness'],
          captureBottom: parts.includes('bottom'),
          viewportWidth: parts.includes('narrow') ? 360 : undefined,
          updateProfile: setProfile,
        }}>
        <View style={{flex: 1, backgroundColor: getSystemTheme(scheme).canvas}}>
          <View
            style={{
              flex: 1,
              width: parts.includes('narrow') ? 360 : '100%',
              maxWidth: '100%',
              alignSelf: 'center',
            }}>
            <NavigationIndependentTree>
              <NavigationContainer
                initialState={{
                  index: route ? 1 : 0,
                  routes: [
                    {name: 'MainTabs', params: {screen: 'Profile'}},
                    ...(route ? [{name: route}] : []),
                  ],
                }}>
                <Stack.Navigator screenOptions={{headerShown: false}}>
                  <Stack.Screen
                    name="MainTabs"
                    component={AppTabsNavigator}
                    initialParams={{screen: 'Profile'}}
                  />
                  <Stack.Screen
                    name="EditProfile"
                    component={EditProfileScreen}
                  />
                  <Stack.Screen
                    name="ProfileShare"
                    component={ProfileShareScreen}
                  />
                  <Stack.Screen
                    name="ProfileMilestones"
                    component={ProfileMilestonesScreen}
                  />
                  <Stack.Screen name="Settings" component={SettingsScreen} />
                  <Stack.Screen
                    name="AccountSettings"
                    component={AccountSettingsScreen}
                  />
                  <Stack.Screen
                    name="NotificationSettings"
                    component={NotificationSettingsScreen}
                  />
                  <Stack.Screen
                    name="AppearanceSettings"
                    component={AppearanceSettingsScreen}
                  />
                  <Stack.Screen
                    name="AboutHoyst"
                    component={AboutHoystScreen}
                  />
                </Stack.Navigator>
              </NavigationContainer>
            </NavigationIndependentTree>
          </View>
        </View>
      </ProfilePreviewContext.Provider>
    </QueryClientProvider>
  );
}
