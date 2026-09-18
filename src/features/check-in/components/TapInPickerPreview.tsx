/** Developer-only fixtures. No subscriptions or account writes. */
import React, {useState} from 'react';
import {StyleSheet, View} from 'react-native';
import {
  NavigationContainer,
  NavigationIndependentTree,
} from '@react-navigation/native';
import {
  createNativeStackNavigator,
  type NativeStackScreenProps,
} from '@react-navigation/native-stack';
import {
  DesignSystemProvider,
  DSButton,
  DSScreen,
  DSText,
} from '../../../design/system';
import type {CircleManagementCard} from '../../../types/models';
import {
  TapInPickerPresentation,
  type PickerUtility,
} from './TapInPickerPresentation';

type Mode = 'Several due' | 'Mixed goals' | 'All covered' | 'Long titles';
type Routes = {
  Menu: undefined;
  Sheet: {mode: Mode; dark: boolean; narrow: boolean};
};
const Stack = createNativeStackNavigator<Routes>();
function circle(
  id: string,
  title: string,
  overrides: Partial<CircleManagementCard> = {},
): CircleManagementCard {
  return {
    id,
    title,
    category: 'Deep Work',
    commitment: 'One task a day to help build the Hoyst app',
    commitmentType: 'build',
    commitmentCadence: 'daily',
    commitmentFrequency: {tapInsPerWeek: 7},
    completionRate: 0,
    joinMode: 'open',
    maxSize: 8,
    memberCount: 3,
    members: [],
    privacy: 'public',
    progressPercent: 0,
    remainingCheckIns: 1,
    state: 'active',
    streakDays: 4,
    streakLabel: '4d streak',
    viewerHasCheckedIn: false,
    viewerHasTappedInToday: false,
    viewerMembershipStatus: 'active',
    viewerRemainingTapIns: 1,
    viewerRole: 'member',
    ...overrides,
  };
}
function Fixture({route, navigation}: NativeStackScreenProps<Routes, 'Sheet'>) {
  const {mode, dark, narrow} = route.params;
  const [notice, setNotice] = useState('');
  const due =
    mode === 'All covered'
      ? []
      : mode === 'Several due'
      ? [
          circle('hoyst', 'Building Hoyst', {state: 'risk'}),
          circle('move', 'Move for 20 minutes', {
            category: 'Fitness',
            commitment: 'Make time to move each day',
            targetValue: 20,
            unitLabel: 'minutes',
          }),
          circle('read', 'Read 10 pages', {
            category: 'Wellness',
            commitment: 'Spend a little time with a book',
            targetValue: 10,
            unitLabel: 'pages',
          }),
        ]
      : [
          circle(
            'move',
            mode === 'Long titles'
              ? 'Make time for movement even on the busiest working days'
              : 'Morning movement',
            {
              category: 'Fitness',
              commitment: 'Make time to move each day',
              targetValue: 20,
              unitLabel: 'minutes',
              currentValue: 12,
              viewerHasTappedInToday: true,
              viewerCanUpdateTapIn: true,
              viewerTodayStatus: 'partial',
            },
          ),
          circle('screen', 'Screen time', {
            commitment: 'Keep recreational screen time in balance',
            commitmentType: 'limit',
            maximumValue: 2,
            unitLabel: 'hours',
          }),
        ];
  const utilities: PickerUtility[] = [
    ['hoyst-covered', 'Building Hoyst', 'nudge', 'Nudge 2'],
    ['walk', 'Evening walk', 'share', 'Share'],
    ['reflection', 'Daily reflection', 'view', 'View'],
  ].map(([id, title, kind, label]) => ({
    circle: circle(id, title),
    kind: kind as PickerUtility['kind'],
    progress: '1/1 member met goal today',
    label,
    status: 'Covered today',
    onPress: () => setNotice(`${label} preview only`),
  }));
  return (
    <DesignSystemProvider scheme={dark ? 'dark' : 'light'}>
      <View style={[styles.fixture, narrow && styles.narrow]}>
        <TapInPickerPresentation
          coveredCount={
            mode === 'Mixed goals' || mode === 'Long titles' ? 4 : 3
          }
          totalCount={due.length + 3}
          dueCircles={due}
          utilities={utilities}
          deadline={mode === 'Several due' ? '4d streak' : undefined}
          message={{
            title: 'Today is covered',
            body: 'No Tap Ins due right now.',
            success: true,
          }}
          onClose={() => navigation.goBack()}
          onTapIn={() => setNotice('Tap In preview only')}
        />
        {notice ? <DSText>{notice}</DSText> : null}
      </View>
    </DesignSystemProvider>
  );
}
export function TapInPickerPreview({onClose}: {onClose: () => void}) {
  const [dark, setDark] = useState(false);
  const [narrow, setNarrow] = useState(false);
  return (
    <NavigationIndependentTree>
      <NavigationContainer>
        <Stack.Navigator screenOptions={{headerShown: false}}>
          <Stack.Screen name="Menu">
            {({navigation}) => (
              <DesignSystemProvider>
                <DSScreen>
                  <DSText variant="screenTitle">Selector previews</DSText>
                  <DSText>
                    Local fixtures. Actions do not save to an account.
                  </DSText>
                  <DSButton
                    label={dark ? 'Use light theme' : 'Use dark theme'}
                    onPress={() => setDark(!dark)}
                  />
                  <DSButton
                    label={narrow ? 'Use 402 width' : 'Use 360 width'}
                    onPress={() => setNarrow(!narrow)}
                  />
                  {(
                    [
                      'Several due',
                      'Mixed goals',
                      'All covered',
                      'Long titles',
                    ] as Mode[]
                  ).map(mode => (
                    <DSButton
                      key={mode}
                      label={mode}
                      onPress={() =>
                        navigation.navigate('Sheet', {mode, dark, narrow})
                      }
                    />
                  ))}
                  <DSButton label="Close previews" onPress={onClose} />
                </DSScreen>
              </DesignSystemProvider>
            )}
          </Stack.Screen>
          <Stack.Screen
            name="Sheet"
            component={Fixture}
            options={{presentation: 'modal', animation: 'slide_from_bottom'}}
          />
        </Stack.Navigator>
      </NavigationContainer>
    </NavigationIndependentTree>
  );
}

const styles = StyleSheet.create({
  fixture: {flex: 1, width: '100%', alignSelf: 'center'},
  narrow: {width: 360},
});
