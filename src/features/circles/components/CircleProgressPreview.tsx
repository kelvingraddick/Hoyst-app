/** Debug-only native fixtures. Never read or write an account. */
import React, {useEffect} from 'react';
import {Pressable, ScrollView, View} from 'react-native';
import LinearGradient from 'react-native-linear-gradient';
import {SafeAreaView} from 'react-native-safe-area-context';
import {DesignSystemProvider} from '../../../design/system';
import {useSettingsStore} from '../../../store/settings-store';
import {useHoystTheme} from '../../../design/theme/useHoystTheme';
import {HoystText} from '../../../design/components/HoystText';
import {TapInPulseButton} from '../../../design/components/TapInPulseButton';
import {
  circleProgressConfiguration,
  circlePeriodForDate,
  type CircleDayCoverage,
  type CircleProgressSummary,
} from '../../../shared/circle-progress';
import type {CircleDetailModel} from '../../../types/models';
import {CircleDetailHero} from '../screens/CircleDetailScreen';
import {CircleMemberStrip} from './CircleMemberStrip';
import {CircleProgressPanel} from './CircleProgressPanel';

export function CircleProgressPreview({
  mode,
  onClose,
}: {
  mode: string;
  onClose: () => void;
}) {
  const dark = mode.includes('dark');
  useEffect(() => {
    const previous = useSettingsStore.getState().appearance;
    useSettingsStore
      .getState()
      .setAppearancePreference(dark ? 'dark' : 'light');
    return () => useSettingsStore.getState().setAppearancePreference(previous);
  }, [dark]);
  return (
    <DesignSystemProvider scheme={dark ? 'dark' : 'light'}>
      <PreviewContent mode={mode} onClose={onClose} />
    </DesignSystemProvider>
  );
}

function PreviewContent({mode, onClose}: {mode: string; onClose: () => void}) {
  const theme = useHoystTheme();
  const cadence = mode.includes('monthly')
    ? 'monthly'
    : mode.includes('daily')
    ? 'daily'
    : 'weekly';
  const personal = mode.includes('personal');
  const unavailable = mode.includes('unknown');
  const emptyToday = mode.includes('empty');
  const periodLabel =
    cadence === 'daily'
      ? 'today'
      : cadence === 'monthly'
      ? 'this month'
      : 'this week';
  const target = cadence === 'daily' ? 1 : 3;
  const coveredCount = emptyToday ? 0 : cadence === 'daily' ? 1 : 2;
  const detail = {
    id: 'preview',
    title: 'Building Hoyst',
    category: 'Work',
    circleMode: personal ? 'personal' : 'group',
    viewerUid: 'you',
    commitment:
      cadence === 'daily'
        ? 'Make progress on Hoyst every day'
        : `Make progress on Hoyst 3 times a ${
            cadence === 'monthly' ? 'month' : 'week'
          }`,
    commitmentCadence: cadence,
    commitmentFrequency: {
      tapInsPerWeek: cadence === 'daily' ? 7 : 3,
      opportunitiesPerPeriod: target,
    },
    timezone: 'America/New_York',
    members: [
      {
        id: 'kelvin',
        name: 'Kelvin',
        initials: 'K',
        state: 'done',
        membershipStatus: 'active',
        cycleGoalMet: true,
        cycleCoveredCount: 3,
        cycleRequiredCount: 3,
      },
      {
        id: 'you',
        name: 'You',
        initials: 'P',
        state: 'pending',
        membershipStatus: 'active',
        cycleGoalMet: false,
        cycleCoveredCount: 2,
        cycleRequiredCount: 3,
      },
    ],
    memberCount: 2,
    maxSize: 10,
    viewerRole: 'owner',
    privacy: 'public',
    viewerMembershipStatus: 'active',
  } as CircleDetailModel;
  const config = circleProgressConfiguration(
    detail as unknown as Record<string, unknown>,
  );
  const summary = (group: boolean): CircleProgressSummary => ({
    version: 2,
    revision: config.revision,
    asOfDateKey: '2026-10-17',
    cadence,
    period: circlePeriodForDate('2026-10-17', cadence),
    streak: {
      count: unavailable
        ? null
        : emptyToday
        ? 0
        : cadence === 'daily'
        ? 1
        : group
        ? 2
        : 4,
      unit:
        cadence === 'daily' ? 'day' : cadence === 'monthly' ? 'month' : 'week',
      availability: unavailable ? 'unavailable' : 'ready',
    },
    progress: {
      covered: emptyToday ? 0 : group ? 1 : coveredCount,
      required: group ? 2 : target,
      outcome: unavailable ? 'unknown' : 'open',
    },
  });
  const dates = [
    '2026-10-11',
    '2026-10-12',
    '2026-10-13',
    '2026-10-14',
    '2026-10-15',
    '2026-10-16',
    '2026-10-17',
  ];
  const days = new Map<string, CircleDayCoverage>(
    dates.map((day, index) => [
      day,
      {
        known: !unavailable,
        expectedUids: ['you', 'kelvin'],
        completedUids: emptyToday
          ? index >= 2 && index <= 5
            ? ['kelvin']
            : []
          : index === 0
          ? ['you']
          : index === 1
          ? ['you', 'kelvin']
          : index === 2 || index === 6
          ? ['kelvin']
          : index === 3
          ? ['you']
          : [],
        skippedUids: !emptyToday && index === 0 ? ['kelvin'] : [],
        restoredUids: [],
      },
    ]),
  );
  return (
    <SafeAreaView
      style={{flex: 1, backgroundColor: theme.isDark ? '#090B12' : '#FAFAF7'}}>
      <ScrollView
        contentContainerStyle={{
          maxWidth: mode.includes('narrow') ? 360 : undefined,
          width: '100%',
          alignSelf: 'center',
          paddingBottom: 32,
        }}>
        {!mode.includes('panel') ? (
          <LinearGradient
            colors={
              theme.isDark ? ['#086CA830', '#090B12'] : ['#18B9FF35', '#FAFAF7']
            }>
            <CircleDetailHero
              detail={detail}
              onBack={onClose}
              onOpenSettings={() => undefined}
              onTintLayout={() => undefined}
              primaryAction={
                <TapInPulseButton
                  label="Tap In"
                  supportingText={`${coveredCount} of ${target} Tap Ins ${periodLabel}`}
                  onPress={() => undefined}
                  variant="hero"
                  ringState="active"
                  heroPalette={{
                    backgroundColor: '#086CA8',
                    foregroundColor: '#FFFFFF',
                    supportingTextColor: '#E0F2FF',
                    chevronBackgroundColor: '#FFFFFF20',
                  }}
                />
              }
            />
          </LinearGradient>
        ) : null}
        <View style={{paddingHorizontal: 22, paddingTop: 20, gap: 20}}>
          <CircleProgressPanel
            detail={detail}
            viewer={summary(false)}
            group={personal ? undefined : summary(true)}
            days={dates.map(dateKey => ({dateKey}))}
            coverage={days}
            loadDay={async (_circle, day) =>
              days.get(day)!.expectedUids.map(id => ({
                id,
                displayName: id === 'you' ? 'You' : 'Kelvin',
              }))
            }
          />
          {!personal ? (
            <CircleMemberStrip
              members={detail.members}
              viewerUid="you"
              onSelectMember={() => undefined}
              subtitle="2 members total"
              inviteAction={{
                accessibilityLabel: 'Invite Members',
                onPress: () => undefined,
              }}
              commitmentCadence={cadence}
            />
          ) : null}
          <Pressable
            accessibilityRole="button"
            onPress={onClose}
            style={{minHeight: 44, justifyContent: 'center'}}>
            <HoystText tone="muted">Close preview</HoystText>
          </Pressable>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
