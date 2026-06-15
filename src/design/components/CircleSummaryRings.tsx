import React from 'react';
import {
  Pressable,
  StyleSheet,
  View,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import LinearGradient from 'react-native-linear-gradient';
import Svg, {Circle, G, Path} from 'react-native-svg';

import type {MomentumStatus} from '../../types/models';
import {brandColors} from '../tokens/colors';
import {actionMotion} from '../tokens/actions';
import {radius} from '../tokens/radius';
import {useHoystTheme} from '../theme/useHoystTheme';
import {GlassPanel} from './GlassPanel';
import {GradientRing} from './GradientRing';
import {HoystText} from './HoystText';
import {MomentumStageIcon} from './MomentumStageIcon';
import {
  getMomentumStatusPillPalette,
  getMomentumStatusVisualColor,
} from './MomentumStatusPill';

const RING_SIZE = 80;
const RING_STROKE = 8;
const DISC_SIZE = 52;
const CONTRIBUTION_ICON_BACKGROUND = '#E8F8EF';
const MOMENTUM_STAGE_ICON_BACKGROUND = '#FFF3DF';
const STREAK_ICON_BACKGROUND = '#FFF3CF';
const SUMMARY_ICON_ARTWORK_SIZE = 33;
const MOMENTUM_STAGE_ICON_SIZE = 42;

type CircleSummaryRingsProps = {
  contributionPercent: number;
  momentumLabel: string;
  momentumPercent: number;
  momentumStatus: MomentumStatus;
  onPress?: () => void;
  surfaceStyle?: StyleProp<ViewStyle>;
  streakDays: number;
};

function ContributionSummaryIcon({
  size = SUMMARY_ICON_ARTWORK_SIZE,
}: {
  size?: number;
}) {
  return (
    <Svg
      height={size}
      testID="circle-summary-contribution-icon"
      viewBox="0 0 64 64"
      width={size}>
      <G>
        <Circle cx={32} cy={17} fill={brandColors.green} r={9} />
        <Circle cx={18} cy={27} fill="#0E9B57" opacity={0.86} r={7} />
        <Circle cx={46} cy={27} fill="#0E9B57" opacity={0.86} r={7} />
        <Path
          d="M16 54c.8-11.6 7-18.5 16-18.5S47.2 42.4 48 54v2H16v-2Z"
          fill={brandColors.green}
        />
        <Path
          d="M6 55c.8-8.8 5.9-14 13.2-14 3.4 0 6.3 1.1 8.5 3.1-2.4 2.9-3.8 6.5-4.3 10.9H6Z"
          fill="#0E9B57"
          opacity={0.62}
        />
        <Path
          d="M40.6 55c-.5-4.4-1.9-8-4.3-10.9 2.2-2 5.1-3.1 8.5-3.1 7.3 0 12.4 5.2 13.2 14H40.6Z"
          fill="#0E9B57"
          opacity={0.62}
        />
        <Path
          d="M25 44.5 32 50.6l7-6.1"
          fill="none"
          stroke="#FFFFFF"
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={4.4}
        />
      </G>
    </Svg>
  );
}

function StreakSummaryIcon({
  size = SUMMARY_ICON_ARTWORK_SIZE,
}: {
  size?: number;
}) {
  return (
    <Svg
      height={size}
      testID="circle-summary-streak-icon"
      viewBox="0 0 64 64"
      width={size}>
      <G>
        <Path
          d="M31.8 57c-10.9-1.8-18-9.4-17-20.2.6-6.8 5.4-11.5 10-16 4.5-4.4 6.7-8.1 5.5-13.8 11.3 5.7 17.2 15.3 14.8 25.1 4.6 2.3 7.1 7.3 5.4 12.6C48.2 52.4 40.3 58.4 31.8 57Z"
          fill={brandColors.spectrumYellow}
        />
        <Path
          d="M31.8 57c8.5 1.4 16.4-4.6 18.7-12.3 1.7-5.3-.8-10.3-5.4-12.6C47.5 22.3 41.6 12.7 30.3 7c3.2 13.5-13.7 17-15.5 29.8-1 10.8 6.1 18.4 17 20.2Z"
          fill="#C47A00"
          opacity={0.2}
        />
        <Path
          d="M32.2 49.8c-5.8-1-9.2-5.2-8.4-10.9.4-3.5 3.2-6.1 5.8-8.6 2.9-2.8 4.2-5 3.5-8.6 6.3 4.3 9.1 10.7 6.8 16.4 3.4 1 4.9 4.4 3.5 7.3-1.8 3.8-6.5 5.2-11.2 4.4Z"
          fill="#FFFFFF"
          opacity={0.85}
        />
        <Path
          d="M32.2 49.8c4.7.8 9.4-.6 11.2-4.4 1.4-2.9-.1-6.3-3.5-7.3 2.3-5.7-.5-12.1-6.8-16.4 1.6 7.6-8.4 10-9.3 17.2-.8 5.7 2.6 9.9 8.4 10.9Z"
          fill="#C47A00"
          opacity={0.14}
        />
      </G>
    </Svg>
  );
}

type RingStatVisual = {
  arc: string;
  badgeBackground: string;
  badgeForeground: string;
  cardBackground: string;
  cardBorder: string;
  cardTint: string;
  disc: string;
  shadowColor: string;
  trackDark: string;
  trackLight: string;
};

function RingStatCard({
  accessibilityLabel,
  badgeLabel,
  badgeTestID,
  children,
  discTestID,
  onPress,
  progress,
  surfaceStyle,
  title,
  visual,
}: {
  accessibilityLabel: string;
  badgeLabel: string;
  badgeTestID?: string;
  children: React.ReactNode;
  discTestID?: string;
  onPress?: () => void;
  progress: number;
  surfaceStyle?: StyleProp<ViewStyle>;
  title: string;
  visual: RingStatVisual;
}) {
  const theme = useHoystTheme();
  const discBorder = theme.isDark ? theme.backgroundElevated : '#FFFFFF';

  return (
    <View style={styles.cardSlot}>
      <Pressable
        accessibilityLabel={accessibilityLabel}
        accessibilityRole={onPress ? 'button' : undefined}
        onPress={onPress}
        style={({pressed}) =>
          onPress && pressed
            ? {
                opacity: actionMotion.pressedOpacity,
                transform: [{scale: actionMotion.pressedScale}],
              }
            : null
        }>
        <GlassPanel
          padding="none"
          style={[
            styles.cardPanel,
            {
              backgroundColor: visual.cardBackground,
              borderColor: visual.cardBorder,
              shadowColor: visual.shadowColor,
            },
            surfaceStyle,
          ]}>
          <View style={styles.cardInner}>
            <View pointerEvents="none" style={styles.gradientInset}>
              <LinearGradient
                colors={[visual.cardTint, 'rgba(255,255,255,0)']}
                locations={[0, 0.72]}
                start={{x: 0.5, y: 1}}
                end={{x: 0.5, y: 0}}
                style={StyleSheet.absoluteFill}
              />
            </View>
            <HoystText
              adjustsFontSizeToFit
              numberOfLines={1}
              style={styles.cardTitle}
              tone="muted"
              variant="label">
              {title}
            </HoystText>
            <View style={styles.ringWrap}>
              <GradientRing
                flatColor={visual.arc}
                progress={progress}
                size={RING_SIZE}
                strokeWidth={RING_STROKE}
                trackColor={theme.isDark ? visual.trackDark : visual.trackLight}
              />
              <View pointerEvents="none" style={styles.discWrap}>
                <View
                  testID={discTestID}
                  style={[
                    styles.disc,
                    {backgroundColor: visual.disc, borderColor: discBorder},
                  ]}>
                  {children}
                </View>
              </View>
            </View>
            <View
              style={[
                styles.badge,
                {
                  backgroundColor: visual.badgeBackground,
                  borderColor: discBorder,
                },
              ]}>
              <HoystText
                allowFontScaling={false}
                numberOfLines={1}
                style={[styles.badgeLabel, {color: visual.badgeForeground}]}
                testID={badgeTestID}>
                {badgeLabel}
              </HoystText>
            </View>
          </View>
        </GlassPanel>
      </Pressable>
    </View>
  );
}

function clampPercent(value: number) {
  if (!Number.isFinite(value)) {
    return 0;
  }

  return Math.max(0, Math.min(100, value));
}

export function CircleSummaryRings({
  contributionPercent,
  momentumLabel,
  momentumPercent,
  momentumStatus,
  onPress,
  surfaceStyle,
  streakDays,
}: CircleSummaryRingsProps): React.JSX.Element {
  const theme = useHoystTheme();
  const contribution = clampPercent(contributionPercent);
  const momentum = clampPercent(momentumPercent);
  const momentumPalette = getMomentumStatusPillPalette(momentumStatus, theme);
  const momentumVisualColor = getMomentumStatusVisualColor(
    momentumStatus,
    theme,
  );
  const streakProgress = Math.max(0, Math.min(1, streakDays / 7));
  const streakDayLabel = streakDays === 1 ? 'Day' : 'Days';
  const streakBadge = `${streakDays} ${streakDayLabel.toLowerCase()}`;

  const contributionVisual: RingStatVisual = {
    arc: '#0E9B57',
    badgeBackground: '#E0F4E9',
    badgeForeground: '#07763E',
    cardBackground: theme.isDark ? 'rgba(16,185,103,0.08)' : '#FFFFFF',
    cardBorder: theme.isDark
      ? 'rgba(112,226,163,0.18)'
      : 'rgba(16,185,103,0.12)',
    cardTint: theme.isDark ? 'rgba(16,185,103,0.16)' : 'rgba(16,185,103,0.11)',
    disc: CONTRIBUTION_ICON_BACKGROUND,
    shadowColor: theme.isDark ? theme.shadow : 'rgba(7,118,62,0.22)',
    trackDark: 'rgba(16,185,103,0.26)',
    trackLight: '#CDEBDA',
  };
  const momentumVisual: RingStatVisual = {
    arc: momentumVisualColor,
    badgeBackground: momentumPalette.backgroundColor,
    badgeForeground: momentumPalette.color,
    cardBackground: theme.isDark ? momentumPalette.backgroundColor : '#FFFFFF',
    cardBorder: theme.isDark
      ? momentumPalette.backgroundColor
      : `${momentumVisualColor}1F`,
    cardTint: theme.isDark
      ? `${momentumVisualColor}24`
      : 'rgba(255,138,61,0.13)',
    disc: MOMENTUM_STAGE_ICON_BACKGROUND,
    shadowColor: theme.isDark ? theme.shadow : `${momentumVisualColor}33`,
    trackDark: momentumPalette.backgroundColor,
    trackLight: momentumPalette.backgroundColor,
  };
  const streakVisual: RingStatVisual = {
    arc: '#F5A800',
    badgeBackground: '#FFF1CC',
    badgeForeground: '#C27400',
    cardBackground: theme.isDark ? 'rgba(245,168,0,0.08)' : '#FFFFFF',
    cardBorder: theme.isDark ? 'rgba(255,196,0,0.18)' : 'rgba(245,168,0,0.14)',
    cardTint: theme.isDark ? 'rgba(245,168,0,0.18)' : 'rgba(245,168,0,0.12)',
    disc: STREAK_ICON_BACKGROUND,
    shadowColor: theme.isDark ? theme.shadow : 'rgba(194,116,0,0.22)',
    trackDark: 'rgba(255,196,0,0.26)',
    trackLight: '#FFE9B3',
  };

  return (
    <View style={styles.row}>
      <RingStatCard
        accessibilityLabel={`Contribution ${contribution}% complete.`}
        badgeLabel={`${contribution}%`}
        discTestID="circle-summary-contribution-disc"
        onPress={onPress}
        progress={contribution / 100}
        surfaceStyle={surfaceStyle}
        title="Contribution"
        visual={contributionVisual}>
        <ContributionSummaryIcon />
      </RingStatCard>
      <RingStatCard
        accessibilityLabel={`Momentum ${momentum}%, ${momentumLabel}.`}
        badgeLabel={momentumLabel}
        discTestID="circle-summary-momentum-disc"
        onPress={onPress}
        progress={momentum / 100}
        surfaceStyle={surfaceStyle}
        title="Momentum"
        visual={momentumVisual}>
        <MomentumStageIcon
          size={MOMENTUM_STAGE_ICON_SIZE}
          status={momentumStatus}
          testID="circle-summary-momentum-stage-icon"
        />
      </RingStatCard>
      <RingStatCard
        accessibilityLabel={`Streak ${streakDays} ${streakDayLabel.toLowerCase()}.`}
        badgeLabel={streakBadge}
        discTestID="circle-summary-streak-disc"
        onPress={onPress}
        progress={streakProgress}
        surfaceStyle={surfaceStyle}
        title="Streak"
        visual={streakVisual}>
        <StreakSummaryIcon />
      </RingStatCard>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    gap: 10,
  },
  cardSlot: {
    flex: 1,
    minWidth: 0,
  },
  cardInner: {
    alignItems: 'center',
    overflow: 'hidden',
    paddingBottom: 16,
    paddingHorizontal: 6,
    paddingTop: 13,
    position: 'relative',
  },
  gradientInset: {
    bottom: 1,
    left: 1,
    position: 'absolute',
    right: 1,
    top: 1,
  },
  cardPanel: {
    elevation: 3,
    shadowOffset: {height: 4, width: 0},
    shadowOpacity: 0.5,
    shadowRadius: 10,
  },
  cardTitle: {
    letterSpacing: 0.4,
    textAlign: 'center',
    width: '100%',
  },
  ringWrap: {
    height: RING_SIZE,
    marginTop: 8,
    width: RING_SIZE,
  },
  discWrap: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
  },
  disc: {
    alignItems: 'center',
    borderRadius: DISC_SIZE / 2,
    borderWidth: 3,
    height: DISC_SIZE,
    justifyContent: 'center',
    overflow: 'hidden',
    width: DISC_SIZE,
  },
  badge: {
    borderRadius: radius.pill,
    borderWidth: 1.5,
    elevation: 3,
    marginTop: -13,
    paddingHorizontal: 10,
    paddingVertical: 3,
    shadowOffset: {height: 3, width: 0},
    shadowOpacity: 0.16,
    shadowRadius: 6,
    zIndex: 2,
  },
  badgeLabel: {
    fontSize: 12.5,
    fontWeight: '800',
    letterSpacing: 0,
    lineHeight: 16,
    textAlign: 'center',
  },
});
