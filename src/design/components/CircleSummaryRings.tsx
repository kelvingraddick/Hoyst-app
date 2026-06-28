import React from 'react';
import {StyleSheet, View, type StyleProp, type ViewStyle} from 'react-native';
import Svg, {G, Path, Rect} from 'react-native-svg';

import type {MomentumStatus} from '../../types/models';
import {brandColors, frostedBlobColors} from '../tokens/colors';
import {useHoystTheme} from '../theme/useHoystTheme';
import {MomentumStageIcon} from './MomentumStageIcon';
import {
  getMomentumStatusVisualColor,
} from './MomentumStatusPill';
import {StatBarCard, clampStatPercent} from './StatBarCard';

const CONTRIBUTION_CHIP_BACKGROUND = '#E8F8EF';
const MOMENTUM_CHIP_BACKGROUND = '#FFF3DF';
const STREAK_CHIP_BACKGROUND = '#FFF3CF';
const SUMMARY_ICON_ARTWORK_SIZE = 33;
const MOMENTUM_STAGE_ICON_SIZE = 38;

type CircleSummaryRingsProps = {
  contributionPercent: number;
  momentumLabel: string;
  momentumPercent: number;
  momentumStatus: MomentumStatus;
  onPress?: () => void;
  surfaceStyle?: StyleProp<ViewStyle>;
  streakDays: number;
};

export function ContributionSummaryIcon({
  size = SUMMARY_ICON_ARTWORK_SIZE,
  testID = 'circle-summary-contribution-icon',
}: {
  size?: number;
  testID?: string;
}) {
  return (
    <Svg
      height={size}
      testID={testID}
      viewBox="0 0 64 64"
      width={size}>
      <G>
        <Rect
          fill="#0E9B57"
          height={25}
          opacity={0.58}
          rx={7}
          testID="circle-summary-contribution-side-left"
          width={12}
          x={10}
          y={23}
        />
        <Rect
          fill={brandColors.green}
          height={34}
          rx={8}
          testID="circle-summary-contribution-badge"
          width={14}
          x={25}
          y={17}
        />
        <Rect
          fill="#0E9B57"
          height={25}
          opacity={0.58}
          rx={7}
          testID="circle-summary-contribution-side-right"
          width={12}
          x={42}
          y={23}
        />
        <Path
          d="M24.5 55h15"
          fill="none"
          stroke={brandColors.green}
          strokeLinecap="round"
          strokeWidth={5}
        />
        <Path
          d="M27.6 34.2 31.1 37.8 37.4 30.6"
          fill="none"
          stroke="#FFFFFF"
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={3.8}
          testID="circle-summary-contribution-check"
        />
      </G>
    </Svg>
  );
}

export function StreakSummaryIcon({
  size = SUMMARY_ICON_ARTWORK_SIZE,
  testID = 'circle-summary-streak-icon',
}: {
  size?: number;
  testID?: string;
}) {
  return (
    <Svg
      height={size}
      testID={testID}
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

// Home metric row, restyled to the v4 flat frosted stat cards. Reuses the
// existing contribution / momentum / streak artwork inside tinted chips.
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
  const contribution = clampStatPercent(contributionPercent);
  const momentum = clampStatPercent(momentumPercent);
  const momentumVisualColor = getMomentumStatusVisualColor(
    momentumStatus,
    theme,
  );
  const streakProgress = Math.max(0, Math.min(1, streakDays / 7));

  return (
    <View style={styles.row}>
      <StatBarCard
        accessibilityLabel={`Contribution ${contribution}% complete.`}
        barColor={frostedBlobColors.green}
        chipColor={CONTRIBUTION_CHIP_BACKGROUND}
        chipTestID="circle-summary-contribution-disc"
        label="Contribution"
        onPress={onPress}
        progress={contribution / 100}
        surfaceStyle={surfaceStyle}
        trackColor="rgba(34,165,101,0.2)"
        value={`${contribution}%`}>
        <ContributionSummaryIcon />
      </StatBarCard>
      <StatBarCard
        accessibilityLabel={`Momentum ${momentum}%, ${momentumLabel}.`}
        barColor={momentumVisualColor}
        chipColor={MOMENTUM_CHIP_BACKGROUND}
        chipTestID="circle-summary-momentum-disc"
        label="Momentum"
        onPress={onPress}
        progress={momentum / 100}
        surfaceStyle={surfaceStyle}
        trackColor={`${momentumVisualColor}33`}
        value={momentumLabel}>
        <MomentumStageIcon
          size={MOMENTUM_STAGE_ICON_SIZE}
          status={momentumStatus}
          testID="circle-summary-momentum-stage-icon"
        />
      </StatBarCard>
      <StatBarCard
        accessibilityLabel={`Streak ${streakDays} ${
          streakDays === 1 ? 'day' : 'days'
        }.`}
        barColor={frostedBlobColors.orange}
        chipColor={STREAK_CHIP_BACKGROUND}
        chipTestID="circle-summary-streak-disc"
        label="Streak"
        onPress={onPress}
        progress={streakProgress}
        surfaceStyle={surfaceStyle}
        trackColor="rgba(249,115,22,0.2)"
        value={`${streakDays} ${streakDays === 1 ? 'day' : 'days'}`}>
        <StreakSummaryIcon />
      </StatBarCard>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    gap: 11,
  },
});
