import React from 'react';
import {
  Pressable,
  StyleSheet,
  View,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import LinearGradient from 'react-native-linear-gradient';

import {actionMotion} from '../tokens/actions';
import {radius} from '../tokens/radius';
import {useHoystTheme} from '../theme/useHoystTheme';
import {GlassPanel} from './GlassPanel';
import {GradientRing} from './GradientRing';
import {HoystText} from './HoystText';

export const STAT_RING_SIZE = 80;
export const STAT_RING_STROKE = 8;
const DISC_SIZE = 52;

// Visual recipe for a single stat ring card. The `disc` color is an
// intentional light "coin" surface that sits on top of the themed card in
// both light and dark mode; the disc border follows the theme so the coin
// reads as a raised badge regardless of scheme.
export type StatRingVisual = {
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

export function clampStatPercent(value: number) {
  if (!Number.isFinite(value)) {
    return 0;
  }

  return Math.max(0, Math.min(100, value));
}

// Shared gradient ring stat card used by the Home momentum summary and the
// Circle Detail stats row. Renders a labeled card with a progress ring, a
// centered coin icon, and a value badge overlapping the ring.
export function StatRingCard({
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
  visual: StatRingVisual;
}): React.JSX.Element {
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
              variant="label">
              {title}
            </HoystText>
            <View style={styles.ringWrap}>
              <GradientRing
                flatColor={visual.arc}
                progress={progress}
                size={STAT_RING_SIZE}
                strokeWidth={STAT_RING_STROKE}
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

const styles = StyleSheet.create({
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
    height: STAT_RING_SIZE,
    marginTop: 8,
    width: STAT_RING_SIZE,
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
