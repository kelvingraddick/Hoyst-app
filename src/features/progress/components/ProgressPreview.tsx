/** Development-only layout fixtures. These never earn, spend, purchase, or impersonate an account. */
import React, {useEffect} from 'react';
import {StyleSheet, View} from 'react-native';
import {useSettingsStore} from '../../../store/settings-store';
import {
  NavigationContainer,
  NavigationIndependentTree,
} from '@react-navigation/native';
import {createNativeStackNavigator} from '@react-navigation/native-stack';
import {QueryClient, QueryClientProvider} from '@tanstack/react-query';
import {AppTabsNavigator} from '../../../navigation/AppTabsNavigator';
import type {RootStackParamList} from '../../../navigation/types';
import {ProgressPreviewContext} from '../screens/ProgressScreen';
import {HomePreviewContext} from '../../home/components/HomePreviewContext';
import type {ProgressSummary} from '../services/progress-service';
import {
  DesignSystemProvider,
  DSScreen,
  DSText,
  DSButton,
  getSystemTheme,
} from '../../../design/system';
export type ProgressPreviewMode =
  | 'light-stats'
  | 'light-stats-details'
  | 'dark-stats-details'
  | 'dark-stats'
  | 'light-stats-narrow'
  | 'dark-stats-narrow'
  | 'home-light'
  | 'home-dark'
  | 'home-light-bottom'
  | 'home-dark-bottom'
  | 'home-light-narrow'
  | 'home-dark-narrow'
  | 'level-one'
  | 'level-four'
  | 'light'
  | 'dark'
  | 'guest'
  | 'loading'
  | 'error'
  | 'zero'
  | 'light-bottom'
  | 'dark-bottom'
  | 'light-middle'
  | 'dark-middle'
  | 'light-narrow'
  | 'dark-narrow'
  | 'light-narrow-middle'
  | 'dark-narrow-middle'
  | 'zero-bottom';
const Stack = createNativeStackNavigator<RootStackParamList>();
const queryClient = new QueryClient({
  defaultOptions: {queries: {retry: false}},
});
const summary: ProgressSummary = {
  totalXP: 120,
  level: 2,
  levelXP: 50,
  requiredXP: 70,
  remainingXP: 20,
  inventory: {skips: 3, restores: 1},
  tasks: {
    profile: true,
    commitment: true,
    first_tap_in: true,
    second_day: true,
  },
  milestones: {},
  routineRemainingXP: 30,
  flags: {earning: true, inventory: true, restoring: true, buying: false},
};
export function ProgressPreview({
  mode,
  onClose,
}: {
  mode: ProgressPreviewMode;
  onClose: () => void;
}) {
  const scheme = mode.includes('dark') ? 'dark' : 'light';
  useEffect(() => {
    const previous = useSettingsStore.getState().appearance;
    useSettingsStore.getState().setAppearancePreference(scheme);
    return () => useSettingsStore.getState().setAppearancePreference(previous);
  }, [scheme]);
  return (
    <QueryClientProvider client={queryClient}>
      <HomePreviewContext.Provider
        value={
          mode.startsWith('home-')
            ? {
                captureBottom: mode.endsWith('-bottom'),
                viewportWidth: mode.includes('-narrow') ? 360 : undefined,
              }
            : undefined
        }>
        <ProgressPreviewContext.Provider
          value={{
            scheme,
            captureBottom: mode.endsWith('-bottom'),
            captureEarning: mode.endsWith('-middle'),
            captureStats: mode.includes('-stats'),
            captureStatsDetails: mode.endsWith('-stats-details'),
            summary:
              mode === 'error'
                ? undefined
                : {
                    ...summary,
                    ...(mode === 'level-one'
                      ? {totalXP: 0, level: 1, levelXP: 0, remainingXP: 70}
                      : mode === 'level-four'
                      ? {totalXP: 220, level: 4, levelXP: 10, remainingXP: 60}
                      : {}),
                    inventory: mode.startsWith('zero')
                      ? {skips: 0, restores: 0}
                      : summary.inventory,
                  },
            guest: mode === 'guest',
            loading: mode === 'loading',
            error:
              mode === 'error'
                ? 'Progress could not be loaded. Please try again.'
                : undefined,
            streak: 2,
            momentum: 30,
          }}>
          <View
            style={[
              styles.preview,
              {backgroundColor: getSystemTheme(scheme).canvas},
            ]}>
            <View
              style={[
                styles.preview,
                mode.includes('-narrow') && styles.narrow,
              ]}>
              <NavigationIndependentTree>
                <NavigationContainer>
                  <Stack.Navigator screenOptions={{headerShown: false}}>
                    <Stack.Screen
                      name="MainTabs"
                      component={AppTabsNavigator}
                      initialParams={{
                        screen: mode.startsWith('home-') ? 'Home' : 'Progress',
                      }}
                    />
                    <Stack.Screen name="ProgressDetails">
                      {({navigation}) => (
                        <DesignSystemProvider scheme={scheme}>
                          <DSScreen>
                            <DSText variant="heading">
                              Read-only Progress preview
                            </DSText>
                            <DSText>
                              This fixture previews the production screen
                              layout. It cannot change account data.
                            </DSText>
                            <DSButton
                              label="Back to Progress"
                              onPress={() => navigation.goBack()}
                            />
                            <DSButton label="Close preview" onPress={onClose} />
                          </DSScreen>
                        </DesignSystemProvider>
                      )}
                    </Stack.Screen>
                  </Stack.Navigator>
                </NavigationContainer>
              </NavigationIndependentTree>
            </View>
          </View>
        </ProgressPreviewContext.Provider>
      </HomePreviewContext.Provider>
    </QueryClientProvider>
  );
}
const styles = StyleSheet.create({
  preview: {flex: 1},
  narrow: {width: 360, maxWidth: '100%', alignSelf: 'center'},
});
