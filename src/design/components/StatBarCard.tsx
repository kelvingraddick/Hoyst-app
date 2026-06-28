import React from 'react';
import {
  Pressable,
  StyleSheet,
  View,
  type StyleProp,
  type ViewStyle,
} from 'react-native';

import {actionMotion} from '../tokens/actions';
import {useHoystTheme} from '../theme/useHoystTheme';
import {GlassPanel} from './GlassPanel';
import {HoystText} from './HoystText';

const CHIP_SIZE = 48;
const INACTIVE_DAY_LABEL_COLOR = {
  dark: '#8D96AD',
  light: '#9A9ABC',
} as const;

export function clampStatPercent(value: number) {
  if (!Number.isFinite(value)) {
    return 0;
  }

  return Math.max(0, Math.min(100, value));
}

// Flat frosted stat card (v4). A tinted icon chip over a translucent glass
// surface, a bold value, an uppercase label, and a thin progress bar. Shares
// the home metric row (Contribution / Momentum / Streak) and is built to be
// reused anywhere a compact metric is needed.
export function StatBarCard({
  accessibilityLabel,
  barColor,
  chipColor,
  chipTestID,
  children,
  label,
  onPress,
  progress,
  surfaceStyle,
  trackColor,
  value,
  valueTestID,
}: {
  accessibilityLabel: string;
  barColor: string;
  chipColor: string;
  chipTestID?: string;
  children: React.ReactNode;
  label: string;
  onPress?: () => void;
  progress: number;
  surfaceStyle?: StyleProp<ViewStyle>;
  trackColor: string;
  value: string;
  valueTestID?: string;
}): React.JSX.Element {
  const theme = useHoystTheme();
  const percent = clampStatPercent(progress * 100);
  const labelColor = theme.isDark
    ? INACTIVE_DAY_LABEL_COLOR.dark
    : INACTIVE_DAY_LABEL_COLOR.light;

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
        <GlassPanel padding="none" style={[styles.cardPanel, surfaceStyle]}>
          <View style={styles.cardInner}>
            <View
              style={[
                styles.chip,
                {
                  backgroundColor: chipColor,
                  borderColor: theme.glassChipBorder,
                },
              ]}
              testID={chipTestID}>
              {children}
            </View>
            <HoystText
              adjustsFontSizeToFit
              numberOfLines={1}
              style={styles.value}
              testID={valueTestID}>
              {value}
            </HoystText>
            <HoystText
              adjustsFontSizeToFit
              numberOfLines={1}
              style={[styles.label, {color: labelColor}]}
              variant="label">
              {label}
            </HoystText>
            <View style={[styles.track, {backgroundColor: trackColor}]}>
              <View
                style={[
                  styles.fill,
                  {backgroundColor: barColor, width: `${percent}%`},
                ]}
              />
            </View>
          </View>
        </GlassPanel>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  cardSlot: {
    flex: 1,
    minWidth: 0,
  },
  cardPanel: {
    elevation: 3,
    shadowOffset: {height: 6, width: 0},
    shadowOpacity: 0.5,
    shadowRadius: 12,
  },
  cardInner: {
    alignItems: 'flex-start',
    padding: 14,
  },
  chip: {
    alignItems: 'center',
    borderRadius: 14,
    borderWidth: 1,
    height: CHIP_SIZE,
    justifyContent: 'center',
    marginBottom: 11,
    overflow: 'hidden',
    width: CHIP_SIZE,
  },
  value: {
    fontSize: 22,
    fontWeight: '800',
    letterSpacing: -0.4,
    lineHeight: 26,
  },
  label: {
    letterSpacing: 0.5,
    marginBottom: 9,
    marginTop: 5,
  },
  track: {
    borderRadius: 3,
    height: 5,
    overflow: 'hidden',
    width: '100%',
  },
  fill: {
    borderRadius: 3,
    height: 5,
  },
});
