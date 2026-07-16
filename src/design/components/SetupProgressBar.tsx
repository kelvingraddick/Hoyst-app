import React from 'react';
import {
  StyleSheet,
  View,
  type DimensionValue,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import LinearGradient from 'react-native-linear-gradient';

import {gradients} from '../tokens/gradients';
import {radius} from '../tokens/radius';
import {useHoystTheme} from '../theme/useHoystTheme';

type SetupProgressBarProps = {
  current: number;
  style?: StyleProp<ViewStyle>;
  testID?: string;
  total: number;
};

export function getSetupProgress(current: number, total: number) {
  const roundedTotal = Number.isFinite(total) ? Math.round(total) : 1;
  const roundedCurrent = Number.isFinite(current) ? Math.round(current) : 0;
  const normalizedTotal = Math.max(1, roundedTotal);
  const normalizedCurrent = Math.max(
    0,
    Math.min(normalizedTotal, roundedCurrent),
  );

  return {
    current: normalizedCurrent,
    percent: Math.round((normalizedCurrent / normalizedTotal) * 100),
    total: normalizedTotal,
  };
}

export function SetupProgressBar({
  current,
  style,
  testID = 'setup-progress-bar',
  total,
}: SetupProgressBarProps): React.JSX.Element {
  const theme = useHoystTheme();
  const progress = getSetupProgress(current, total);
  const fillWidth: DimensionValue = `${progress.percent}%`;
  const accessibilityText = `Step ${progress.current} of ${progress.total}`;

  return (
    <View
      accessible
      accessibilityLabel={accessibilityText}
      accessibilityRole="progressbar"
      accessibilityValue={{
        max: progress.total,
        min: 0,
        now: progress.current,
        text: accessibilityText,
      }}
      style={[
        styles.track,
        {
          backgroundColor: theme.surfaceMuted,
          borderColor: theme.borderStrong,
          shadowColor: theme.accentSecondaryForeground,
        },
        style,
      ]}
      testID={testID}>
      <LinearGradient
        colors={[...gradients.purpleButton]}
        end={{x: 1, y: 0}}
        start={{x: 0, y: 0}}
        style={[styles.fill, {width: fillWidth}]}
        testID={`${testID}-fill`}>
        <View style={styles.highlight} />
      </LinearGradient>
    </View>
  );
}

const styles = StyleSheet.create({
  track: {
    borderRadius: radius.pill,
    borderWidth: 1,
    flex: 1,
    height: 10,
    overflow: 'hidden',
    shadowOffset: {height: 0, width: 0},
    shadowOpacity: 0.14,
    shadowRadius: 5,
  },
  fill: {
    borderRadius: radius.pill,
    height: '100%',
    overflow: 'hidden',
  },
  highlight: {
    backgroundColor: 'rgba(255,255,255,0.34)',
    borderRadius: radius.pill,
    height: 1,
    left: 4,
    position: 'absolute',
    right: 4,
    top: 1,
  },
});
