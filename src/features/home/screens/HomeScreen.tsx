import React from 'react';
import {Pressable, StyleSheet, View} from 'react-native';
import {Bell, ChevronRight, Medal} from 'lucide-react-native';
import type {NativeStackNavigationProp} from '@react-navigation/native-stack';
import {useNavigation} from '@react-navigation/native';

import {BrandMark} from '../../../design/components/BrandMark';
import {GlassPanel} from '../../../design/components/GlassPanel';
import {LayeredAvatar} from '../../../design/components/LayeredAvatar';
import {HoystScreen} from '../../../design/components/HoystScreen';
import {HoystText} from '../../../design/components/HoystText';
import {TodayCircleCard} from '../../../design/components/TodayCircleCard';
import {radius} from '../../../design/tokens/radius';
import {useHoystTheme} from '../../../design/theme/useHoystTheme';
import {currentUserProfile, todayCircles} from '../../circles/mockData';
import type {RootStackParamList} from '../../../navigation/types';

const recentProgress = [
  {label: '18', state: 'done'},
  {label: '19', state: 'done'},
  {label: '20', state: 'missed'},
  {label: '21', state: 'done'},
  {label: '22', state: 'done'},
  {label: '23', state: 'done'},
  {label: '24', state: 'today'},
] as const;

function HeaderAction({
  children,
  onPress,
}: {
  children: React.ReactNode;
  onPress?: () => void;
}) {
  const theme = useHoystTheme();

  return (
    <Pressable
      onPress={onPress}
      style={({pressed}) => [
        styles.headerAction,
        {
          backgroundColor: theme.surfaceSoft,
          borderColor: theme.border,
          opacity: pressed ? 0.92 : 1,
        },
      ]}>
      {children}
    </Pressable>
  );
}

export function HomeScreen(): React.JSX.Element {
  const theme = useHoystTheme();
  const navigation = useNavigation();
  const rootNavigation =
    navigation.getParent<NativeStackNavigationProp<RootStackParamList>>();

  return (
    <HoystScreen contentContainerStyle={styles.content}>
      <View style={styles.topBar}>
        <BrandMark isDark={theme.isDark} kind="logo" style={styles.logo} />
        <View style={styles.topActions}>
          <HeaderAction onPress={() => rootNavigation?.navigate('Inbox')}>
            <Bell color={theme.accentSecondary} size={22} strokeWidth={2.2} />
          </HeaderAction>
          <HeaderAction>
            <LayeredAvatar
              initials="KE"
              imageSource={currentUserProfile.avatarImage}
              size={32}
              state="done"
            />
          </HeaderAction>
        </View>
      </View>

      <View style={styles.heroCopy}>
        <HoystText variant="headline">Good morning, Kelvin</HoystText>
        <HoystText tone="muted" variant="label">
          Tuesday, October 24
        </HoystText>
      </View>

      <GlassPanel style={styles.progressPanel}>
        <View style={styles.progressHeader}>
          <HoystText style={styles.progressTitle} tone="muted" variant="label">
            Last 7 Days
          </HoystText>
          <HoystText
            style={[styles.progressPercent]}
            variant="bodyStrong">
            82%
          </HoystText>
        </View>
        <View style={styles.progressGrid}>
          {recentProgress.map(day => {
            const isDone = day.state === 'done';
            const isMissed = day.state === 'missed';
            const isToday = day.state === 'today';
            const progressCellStateStyle = isDone
              ? styles.progressCellDone
              : isMissed
                ? styles.progressCellMissed
                : isToday
                  ? styles.progressCellToday
                  : undefined;
            const progressCellThemeStyle = progressCellStateStyle
              ? undefined
              : {backgroundColor: theme.surfaceStrong, borderColor: theme.border};

            return (
              <View
                key={day.label}
                style={[
                  styles.progressCell,
                  progressCellStateStyle,
                  progressCellThemeStyle,
                ]}>
                <HoystText
                  style={{
                    color: isDone
                      ? theme.success
                      : isMissed
                      ? theme.danger
                      : isToday
                      ? theme.accentSecondary
                      : theme.textMuted,
                  }}
                  variant="bodyStrong">
                  {day.label}
                </HoystText>
              </View>
            );
          })}
        </View>
      </GlassPanel>

      <View
        style={[
          styles.streakSummary,
          {
            backgroundColor: theme.surfaceStrong,
            borderColor: theme.border,
          },
        ]}>
        <View
          style={[
            styles.streakIconWrap,
            styles.streakIconTint,
          ]}>
          <Medal color={theme.warning} size={20} strokeWidth={2.1} />
        </View>
        <View style={styles.streakCopy}>
          <HoystText style={styles.streakEyebrow} tone="muted" variant="tiny">
            Personal Progress
          </HoystText>
          <HoystText style={styles.streakValue}>45-day streak</HoystText>
        </View>
        <ChevronRight color={theme.textSubtle} size={20} strokeWidth={2.2} />
      </View>

      {todayCircles.map(circle => (
        <TodayCircleCard
          card={circle}
          key={circle.id}
          onPress={() =>
            rootNavigation?.navigate('TapInComposer', {
              circleId: circle.id,
              source: 'home',
            })
          }
        />
      ))}
    </HoystScreen>
  );
}

const styles = StyleSheet.create({
  content: {
    paddingBottom: 172,
  },
  topBar: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  logo: {
    height: 34,
    width: 81,
  },
  topActions: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 10,
  },
  headerAction: {
    alignItems: 'center',
    borderRadius: 16,
    borderWidth: 1,
    height: 38,
    justifyContent: 'center',
    width: 38,
  },
  heroCopy: {
    gap: 8,
  },
  progressHeader: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 0,
  },
  progressPanel: {
    marginHorizontal: 0,
  },
  progressTitle: {
    fontSize: 11,
    fontWeight: '700',
    lineHeight: 11,
    letterSpacing: 1.4,
    textTransform: 'uppercase',
  },
  progressPercent: {
    fontSize: 11,
    lineHeight: 11,
  },
  progressGrid: {
    flexDirection: 'row',
    gap: 8,
    justifyContent: 'space-between',
  },
  progressCell: {
    alignItems: 'center',
    aspectRatio: 1,
    borderRadius: 9,
    borderWidth: 1.25,
    flex: 1,
    justifyContent: 'center',
  },
  progressCellDone: {
    backgroundColor: 'rgba(68,216,92,0.14)',
    borderColor: 'rgba(68,216,92,0.34)',
  },
  progressCellMissed: {
    backgroundColor: 'rgba(255,110,132,0.14)',
    borderColor: 'rgba(255,110,132,0.32)',
  },
  progressCellToday: {
    backgroundColor: 'rgba(139,92,246,0.16)',
    borderColor: 'rgba(186,158,255,0.5)',
    borderStyle: 'dashed',
  },
  streakSummary: {
    alignItems: 'center',
    borderRadius: radius.lg,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 12,
    minHeight: 84,
    paddingHorizontal: 16,
  },
  streakIconWrap: {
    alignItems: 'center',
    borderRadius: 16,
    height: 46,
    justifyContent: 'center',
    width: 46,
  },
  streakIconTint: {
    backgroundColor: 'rgba(255,138,61,0.14)',
  },
  streakCopy: {
    flex: 1,
    gap: 4,
  },
  streakEyebrow: {
    letterSpacing: 1.4,
    textTransform: 'uppercase',
  },
  streakValue: {
    fontSize: 18,
    fontWeight: '800',
    letterSpacing: -0.3,
    lineHeight: 22,
  },
});
