import React, {useEffect, useMemo, useState} from 'react';
import {ScrollView, StyleSheet, View} from 'react-native';
import {useQuery} from '@tanstack/react-query';

import {AchievementCard} from '../../../design/components/AchievementCard';
import {GlassPanel} from '../../../design/components/GlassPanel';
import {HoystScreen} from '../../../design/components/HoystScreen';
import {HoystText} from '../../../design/components/HoystText';
import {SectionHeader} from '../../../design/components/SectionHeader';
import {
  MomentumAchievementFlameIllustration,
  MomentumCalendarIllustration,
  MomentumCompleteIllustration,
  MomentumLightningIllustration,
  MomentumLockedMedalIllustration,
  MomentumMiniTrophyIllustration,
  MomentumStarIllustration,
  MomentumStreakIllustration,
} from '../../../design/components/MomentumIllustrations';
import {MomentumStageIcon} from '../../../design/components/MomentumStageIcon';
import {MomentumStatusPill} from '../../../design/components/MomentumStatusPill';
import {radius} from '../../../design/tokens/radius';
import {useHoystTheme} from '../../../design/theme/useHoystTheme';
import {useSessionStore} from '../../../store/session-store';
import {useUserProfileStore} from '../../../store/profile-store';
import type {MomentumSummary} from '../../../types/models';
import {
  createEmptyHomeData,
  subscribeToHomeData,
  type HomeData,
  type HomeProgressCell,
} from '../../home/services/home-data-service';
import {
  buildMomentumSummaryFromHomeData,
  formatOpportunityCount,
  getMomentumDisplayModel,
  subscribeToMomentumSummary,
} from '../services/momentum-service';
import {getProfileSummary} from '../../profile/services/profile-summary-service';

const MOMENTUM_LOOKBACK_DAYS = 28;
const CURRENT_STREAK_VISIBLE_DAYS = 14;
const MOMENTUM_ICON_SIZE = 54;

const achievementSpecs = [
  {
    detail: 'Keep showing up.',
    metric: 'longestStreakDays',
    threshold: 10,
    title: '10 Day Streak',
    visual: 'orange_flame',
  },
  {
    detail: "You're on fire.",
    metric: 'longestStreakDays',
    threshold: 20,
    title: '20 Day Streak',
    visual: 'purple_flame',
  },
  {
    detail: 'One week strong.',
    metric: 'longestStreakDays',
    threshold: 7,
    title: '7 Days Straight',
    visual: 'calendar',
  },
  {
    detail: 'Action taker.',
    metric: 'totalTapIns',
    threshold: 50,
    title: '50 Taps',
    visual: 'lightning',
  },
  {
    detail: 'Keep it legendary.',
    metric: 'longestStreakDays',
    threshold: 30,
    title: '30 Day Streak',
    visual: 'medal',
  },
] as const;

function getAchievementIcon(
  visual: (typeof achievementSpecs)[number]['visual'],
  value: number,
) {
  if (visual === 'calendar') {
    return <MomentumCalendarIllustration size={58} />;
  }

  if (visual === 'lightning') {
    return <MomentumLightningIllustration size={60} />;
  }

  if (visual === 'medal') {
    return <MomentumLockedMedalIllustration size={60} />;
  }

  return (
    <MomentumAchievementFlameIllustration
      size={66}
      value={value}
      variant={visual === 'purple_flame' ? 'purple' : 'orange'}
    />
  );
}

function getDayNoun(value: number) {
  return value === 1 ? 'day' : 'days';
}

function getCurrentStreakDayStyle(
  theme: ReturnType<typeof useHoystTheme>,
  state: HomeProgressCell['state'],
) {
  if (state === 'done') {
    return {
      cell: {
        backgroundColor: `${theme.success}14`,
        borderColor: `${theme.successForeground}55`,
      },
      text: theme.successForeground,
    };
  }

  if (state === 'missed') {
    return {
      cell: {
        backgroundColor: `${theme.danger}14`,
        borderColor: `${theme.dangerForeground}55`,
      },
      text: theme.dangerForeground,
    };
  }

  if (state === 'today') {
    return {
      cell: {
        backgroundColor: `${theme.accentSecondary}16`,
        borderColor: `${theme.accentSecondaryForeground}80`,
        borderStyle: 'dashed' as const,
      },
      text: theme.accentSecondaryForeground,
    };
  }

  return {
    cell: {
      backgroundColor: theme.surfaceSoft,
      borderColor: theme.border,
    },
    text: theme.textMuted,
  };
}

function MomentumBars({percentage}: {percentage: number}) {
  const theme = useHoystTheme();
  const barHeights = [20, 27, 34, 41, 48, 55];
  const clampedPercentage = Math.max(0, Math.min(100, percentage));
  const activeBarCount =
    clampedPercentage <= 0
      ? 0
      : Math.ceil((clampedPercentage / 100) * barHeights.length);

  return (
    <View accessibilityElementsHidden style={styles.momentumBars}>
      {barHeights.map((height, index) => (
        <View
          key={height}
          style={[
            styles.momentumBar,
            {
              backgroundColor:
                index < activeBarCount ? theme.success : theme.surfaceMuted,
              height,
            },
          ]}
        />
      ))}
    </View>
  );
}

function CurrentStreakDayCell({day}: {day: HomeProgressCell}) {
  const theme = useHoystTheme();
  const stateStyle = getCurrentStreakDayStyle(theme, day.state);

  return (
    <View
      accessibilityLabel={`${day.label}: ${day.state}`}
      style={[styles.currentStreakDay, stateStyle.cell]}>
      <HoystText
        numberOfLines={1}
        style={[styles.currentStreakDayText, {color: stateStyle.text}]}
        variant="bodyStrong">
        {day.label}
      </HoystText>
    </View>
  );
}

function buildMomentumWinRecap(circles: HomeData['circles']) {
  const winCircles = circles.filter(
    circle =>
      circle.viewerMembershipStatus !== 'pending' &&
      circle.viewerTodayStatus === 'done',
  );
  const winCount = winCircles.length;

  if (winCount === 0) {
    return {
      badge: 'Start a win',
      detail: 'No Tap Ins logged yet.',
      title: 'Ready when you are',
    };
  }

  const firstCircleTitle = winCircles[0]?.title.trim() || 'a circle';

  if (winCount === 1) {
    return {
      badge: '1 win logged',
      detail: `You checked in for ${firstCircleTitle}.`,
      title: "Today's win",
    };
  }

  return {
    badge: `${winCount} wins logged`,
    detail: `You checked in for ${firstCircleTitle} + ${winCount - 1} more.`,
    title: "Today's wins",
  };
}

export function MomentumScreen(): React.JSX.Element {
  const theme = useHoystTheme();
  const status = useSessionStore(state => state.status);
  const user = useSessionStore(state => state.user);
  const profile = useUserProfileStore(state => state.profile);
  const [homeData, setHomeData] = useState<HomeData>(() =>
    createEmptyHomeData('UTC', new Date(), MOMENTUM_LOOKBACK_DAYS),
  );
  const [remoteSummary, setRemoteSummary] = useState<MomentumSummary>();
  const timezone = profile?.timezone ?? 'UTC';
  const canLoad = status === 'authenticatedReady' && Boolean(user?.uid);

  useEffect(() => {
    if (!canLoad || !user?.uid) {
      setHomeData(
        createEmptyHomeData(timezone, new Date(), MOMENTUM_LOOKBACK_DAYS),
      );
      return undefined;
    }

    return subscribeToHomeData({
      lookbackDays: MOMENTUM_LOOKBACK_DAYS,
      onData: setHomeData,
      onError: () => undefined,
      timezone,
      uid: user.uid,
    });
  }, [canLoad, timezone, user?.uid]);

  useEffect(() => {
    if (!canLoad || !user?.uid) {
      setRemoteSummary(undefined);
      return undefined;
    }

    return subscribeToMomentumSummary({
      onError: () => undefined,
      onSummary: setRemoteSummary,
      uid: user.uid,
    });
  }, [canLoad, user?.uid]);

  const fallbackSummary = useMemo(
    () => buildMomentumSummaryFromHomeData(homeData),
    [homeData],
  );
  const summary = remoteSummary ?? fallbackSummary;
  const momentumDisplay = getMomentumDisplayModel(remoteSummary);
  const scoreValue = momentumDisplay.isCalibrating
    ? `${momentumDisplay.resolvedOpportunityCount} of ${momentumDisplay.requiredResolvedOpportunityCount}`
    : `${momentumDisplay.rawRollingPercentage}%`;
  const profileSummaryQuery = useQuery({
    enabled: canLoad,
    queryFn: getProfileSummary,
    queryKey: ['profileSummary', profile?.id],
    refetchOnMount: 'always',
  });
  const currentStreakDays = Math.max(
    0,
    Math.round(homeData.personalStreakDays),
  );
  const bestStreakDays = Math.max(
    0,
    Math.round(profileSummaryQuery.data?.longestStreakDays ?? 0),
  );
  const totalTapIns = Math.max(
    0,
    Math.round(profileSummaryQuery.data?.totalTapIns ?? 0),
  );
  const currentStreakRows = useMemo(() => {
    const visibleDays = homeData.progressDays.slice(
      -CURRENT_STREAK_VISIBLE_DAYS,
    );

    return [visibleDays.slice(0, 7), visibleDays.slice(7, 14)].filter(
      row => row.length > 0,
    );
  }, [homeData.progressDays]);
  const winRecap = useMemo(
    () => buildMomentumWinRecap(homeData.circles),
    [homeData.circles],
  );
  const unlockedCount = achievementSpecs.filter(
    achievement =>
      (achievement.metric === 'totalTapIns' ? totalTapIns : bestStreakDays) >=
      achievement.threshold,
  ).length;
  const achievementProgress =
    achievementSpecs.length > 0
      ? Math.round((unlockedCount / achievementSpecs.length) * 100)
      : 0;

  return (
    <HoystScreen contentContainerStyle={styles.content}>
      <View style={styles.heroCopy}>
        <HoystText variant="headline">Momentum</HoystText>
        <HoystText tone="muted">
          Your streaks. Your progress. Your wins.
        </HoystText>
      </View>

      <GlassPanel padding="compact" style={styles.momentumOverviewCard}>
        <View style={styles.momentumOverviewTop}>
          <View style={styles.momentumStageIconWrap}>
            <MomentumStageIcon
              status={momentumDisplay.status}
              size={MOMENTUM_ICON_SIZE}
            />
          </View>
          <View style={styles.momentumOverviewCopy}>
            <HoystText numberOfLines={1} style={styles.cardLabel} tone="muted">
              14-Day Momentum
            </HoystText>
            <View style={styles.momentumValueRow}>
              <HoystText style={styles.momentumPercent}>{scoreValue}</HoystText>
              <MomentumStatusPill
                label={momentumDisplay.label}
                status={momentumDisplay.status}
              />
            </View>
            <HoystText
              numberOfLines={2}
              style={styles.momentumMetaText}
              tone="muted">
              {momentumDisplay.isCalibrating
                ? `Complete 3 opportunities to set your Momentum level. ${momentumDisplay.resolvedOpportunityCount} of ${momentumDisplay.requiredResolvedOpportunityCount} resolved.`
                : 'Your last 14 days. Recent progress counts more.'}
            </HoystText>
          </View>
          <View style={styles.momentumTrendWrap}>
            <MomentumBars percentage={momentumDisplay.displayProgress} />
          </View>
        </View>

        <View
          style={[styles.currentProgressRow, {borderTopColor: theme.border}]}>
          <HoystText style={styles.cardLabel} tone="muted">
            Current progress
          </HoystText>
          <HoystText style={styles.currentProgressValue}>
            {formatOpportunityCount(summary)}
          </HoystText>
        </View>

        <View style={[styles.momentumWinRow, {borderTopColor: theme.border}]}>
          <View
            style={[
              styles.momentumWinIcon,
              {backgroundColor: `${theme.success}14`},
            ]}>
            <MomentumCompleteIllustration size={42} />
          </View>
          <View style={styles.momentumWinCopy}>
            <HoystText numberOfLines={1} style={styles.cardLabel} tone="muted">
              {winRecap.title}
            </HoystText>
            <HoystText
              numberOfLines={2}
              style={styles.momentumWinDetail}
              tone="muted">
              {winRecap.detail}
            </HoystText>
            <View
              style={[
                styles.momentumBadge,
                {backgroundColor: `${theme.success}12`},
              ]}>
              <MomentumLightningIllustration size={18} />
              <HoystText style={styles.badgeLabel} tone="success">
                {winRecap.badge}
              </HoystText>
            </View>
          </View>
        </View>
      </GlassPanel>

      <GlassPanel style={styles.currentStreakCard}>
        <View style={styles.currentStreakHeader}>
          <HoystText
            numberOfLines={1}
            style={styles.currentStreakLabel}
            tone="muted">
            Current Streak
          </HoystText>
          <View
            accessibilityLabel={`Best streak: ${bestStreakDays} ${getDayNoun(
              bestStreakDays,
            )}`}
            style={[
              styles.bestStreakBadge,
              {backgroundColor: `${theme.accentWarm}12`},
            ]}>
            <MomentumMiniTrophyIllustration
              color={theme.accentWarm}
              size={15}
            />
            <HoystText
              numberOfLines={1}
              style={[
                styles.bestStreakText,
                {color: theme.accentWarmForeground},
              ]}>
              Best: {bestStreakDays} {getDayNoun(bestStreakDays)}
            </HoystText>
          </View>
        </View>
        <View style={styles.currentStreakBody}>
          <View
            accessible
            accessibilityLabel={`${currentStreakDays} ${getDayNoun(
              currentStreakDays,
            )} current streak`}
            style={styles.currentStreakIconWrap}>
            <MomentumStreakIllustration
              size={MOMENTUM_ICON_SIZE}
              streakDays={currentStreakDays}
            />
          </View>
          <View style={styles.currentStreakCopy}>
            <View style={styles.currentStreakValueRow}>
              <HoystText
                adjustsFontSizeToFit
                minimumFontScale={0.72}
                numberOfLines={1}
                style={[styles.currentStreakValue, {color: theme.accentWarm}]}>
                {currentStreakDays}
              </HoystText>
              <HoystText
                numberOfLines={1}
                style={[
                  styles.currentStreakUnit,
                  {color: theme.accentWarmForeground},
                ]}>
                {getDayNoun(currentStreakDays)}
              </HoystText>
            </View>
            <HoystText
              numberOfLines={1}
              style={styles.currentStreakPrompt}
              tone="muted">
              {currentStreakDays > 0 ? 'Keep it going!' : 'Start your streak'}
            </HoystText>
          </View>
        </View>
        <View style={styles.currentStreakGrid}>
          {currentStreakRows.map((row, rowIndex) => (
            <View key={rowIndex} style={styles.currentStreakRow}>
              {row.map(day => (
                <CurrentStreakDayCell day={day} key={day.dateKey} />
              ))}
            </View>
          ))}
        </View>
      </GlassPanel>

      <View style={styles.achievementsSection}>
        <SectionHeader title="Achievements" />
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={styles.achievementScroller}
          contentContainerStyle={styles.achievementRow}>
          {achievementSpecs.map(achievement => {
            const isUnlocked =
              (achievement.metric === 'totalTapIns'
                ? totalTapIns
                : bestStreakDays) >= achievement.threshold;
            return (
              <AchievementCard
                detail={achievement.detail}
                icon={getAchievementIcon(
                  achievement.visual,
                  achievement.threshold,
                )}
                isLocked={!isUnlocked}
                isUnlocked={isUnlocked}
                key={achievement.title}
                title={achievement.title}
              />
            );
          })}
        </ScrollView>
      </View>

      <GlassPanel padding="compact" style={styles.unlockPanel}>
        <View
          style={[styles.smallIcon, {backgroundColor: `${theme.warning}12`}]}>
          <MomentumStarIllustration color={theme.warningForeground} size={22} />
        </View>
        <View style={styles.unlockCopy}>
          <HoystText
            numberOfLines={1}
            style={styles.unlockText}
            tone="muted"
            variant="bodyStrong">
            {unlockedCount} of {achievementSpecs.length} achievements unlocked
          </HoystText>
          <View
            style={[
              styles.progressTrack,
              {backgroundColor: theme.surfaceHigh},
            ]}>
            <View
              style={[
                styles.progressFill,
                {
                  backgroundColor: theme.accentWarm,
                  width: `${achievementProgress}%`,
                },
              ]}
            />
          </View>
        </View>
      </GlassPanel>
    </HoystScreen>
  );
}

const styles = StyleSheet.create({
  achievementsSection: {
    gap: 10,
  },
  achievementRow: {
    gap: 10,
    paddingRight: 20,
  },
  achievementScroller: {
    marginHorizontal: -20,
    paddingLeft: 20,
  },
  badgeLabel: {
    fontSize: 14,
    fontWeight: '800',
    letterSpacing: 0,
    lineHeight: 18,
  },
  cardLabel: {
    fontSize: 16,
    fontWeight: '800',
    letterSpacing: 0,
    lineHeight: 21,
  },
  content: {
    paddingBottom: 180,
  },
  heroCopy: {
    gap: 8,
  },
  bestStreakBadge: {
    alignItems: 'center',
    borderRadius: radius.pill,
    flexDirection: 'row',
    flexShrink: 0,
    gap: 5,
    maxWidth: 122,
    paddingHorizontal: 9,
    paddingVertical: 6,
  },
  bestStreakText: {
    flexShrink: 1,
    fontSize: 13,
    fontWeight: '800',
    letterSpacing: 0,
    lineHeight: 17,
  },
  currentStreakCard: {
    gap: 16,
    marginTop: -8,
  },
  currentStreakBody: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 10,
  },
  currentStreakCopy: {
    flex: 1,
    gap: 4,
    minWidth: 0,
  },
  currentStreakDay: {
    alignItems: 'center',
    aspectRatio: 1,
    borderRadius: 12,
    borderWidth: 1.25,
    flex: 1,
    justifyContent: 'center',
    minWidth: 0,
  },
  currentStreakDayText: {
    fontSize: 14,
    lineHeight: 18,
  },
  currentStreakGrid: {
    borderRadius: 22,
    gap: 7,
  },
  currentStreakHeader: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 8,
    justifyContent: 'space-between',
  },
  currentStreakIconWrap: {
    alignItems: 'center',
    flexShrink: 0,
    height: MOMENTUM_ICON_SIZE,
    justifyContent: 'center',
    width: MOMENTUM_ICON_SIZE,
  },
  currentStreakLabel: {
    flex: 1,
    fontSize: 16,
    fontWeight: '800',
    letterSpacing: 0,
    lineHeight: 21,
  },
  currentStreakPrompt: {
    fontSize: 13,
    fontWeight: '600',
    letterSpacing: 0,
    lineHeight: 17,
  },
  currentProgressRow: {
    alignItems: 'center',
    borderTopWidth: StyleSheet.hairlineWidth,
    flexDirection: 'row',
    gap: 12,
    justifyContent: 'space-between',
    paddingTop: 14,
  },
  currentProgressValue: {
    flex: 1,
    fontSize: 14,
    fontWeight: '700',
    lineHeight: 19,
    textAlign: 'right',
  },
  currentStreakRow: {
    flexDirection: 'row',
    gap: 7,
  },
  currentStreakUnit: {
    fontSize: 16,
    fontWeight: '800',
    letterSpacing: 0,
    lineHeight: 21,
    paddingBottom: 5,
  },
  currentStreakValue: {
    fontSize: 36,
    fontWeight: '800',
    letterSpacing: 0,
    lineHeight: 42,
  },
  currentStreakValueRow: {
    alignItems: 'flex-end',
    flexDirection: 'row',
    gap: 5,
    minWidth: 0,
  },
  momentumBadge: {
    alignItems: 'center',
    alignSelf: 'flex-start',
    borderRadius: radius.pill,
    flexDirection: 'row',
    gap: 8,
    paddingHorizontal: 14,
    paddingVertical: 7,
  },
  momentumBar: {
    borderRadius: radius.pill,
    width: 7,
  },
  momentumBars: {
    alignItems: 'flex-end',
    flexDirection: 'row',
    gap: 4,
    height: 56,
  },
  momentumMetaText: {
    fontSize: 13,
    fontWeight: '600',
    letterSpacing: 0,
    lineHeight: 17,
  },
  momentumOverviewCard: {
    minHeight: 104,
  },
  momentumOverviewCopy: {
    flex: 1,
    gap: 4,
    minWidth: 0,
  },
  momentumOverviewTop: {
    alignItems: 'center',
    alignSelf: 'stretch',
    flexDirection: 'row',
    gap: 8,
    justifyContent: 'space-between',
  },
  momentumPercent: {
    fontSize: 26,
    fontWeight: '800',
    letterSpacing: 0,
    lineHeight: 30,
  },
  momentumStageIconWrap: {
    alignItems: 'center',
    flexShrink: 0,
    height: MOMENTUM_ICON_SIZE,
    justifyContent: 'center',
    marginRight: 4,
    width: MOMENTUM_ICON_SIZE,
  },
  momentumTrendWrap: {
    alignItems: 'center',
    flexDirection: 'row',
    flexShrink: 0,
    gap: 9,
  },
  momentumValueRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 5,
    minWidth: 0,
  },
  momentumWinCopy: {
    flex: 1,
    gap: 8,
    minWidth: 0,
  },
  momentumWinDetail: {
    fontSize: 14,
    fontWeight: '600',
    letterSpacing: 0,
    lineHeight: 18,
  },
  momentumWinIcon: {
    alignItems: 'center',
    borderRadius: radius.pill,
    flexShrink: 0,
    height: MOMENTUM_ICON_SIZE,
    justifyContent: 'center',
    width: MOMENTUM_ICON_SIZE,
  },
  momentumWinRow: {
    alignItems: 'flex-start',
    borderTopWidth: 1,
    flexDirection: 'row',
    gap: 12,
    paddingTop: 14,
  },
  progressFill: {
    borderRadius: radius.pill,
    height: '100%',
  },
  progressTrack: {
    flexBasis: 84,
    flexGrow: 1,
    minWidth: 72,
    borderRadius: radius.pill,
    height: 8,
    overflow: 'hidden',
  },
  smallIcon: {
    alignItems: 'center',
    borderRadius: radius.pill,
    height: 44,
    justifyContent: 'center',
    width: 44,
  },
  unlockCopy: {
    alignItems: 'center',
    flex: 1,
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    minWidth: 0,
  },
  unlockPanel: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 14,
    minHeight: 70,
  },
  unlockText: {
    flexShrink: 1,
    fontSize: 15,
    lineHeight: 20,
    minWidth: 0,
  },
});
