import React, {useEffect, useRef, useState} from 'react';
import {
  Animated,
  Pressable,
  StyleSheet,
  useWindowDimensions,
  View,
} from 'react-native';
import {useSafeAreaInsets} from 'react-native-safe-area-context';
import {Bell} from 'lucide-react-native';

import type {HoyState} from '../../features/home/services/hoy-state';
import type {MomentumStatus} from '../../types/models';
import {brandColors} from '../tokens/colors';
import {actionMotion} from '../tokens/actions';
import {useHoystTheme} from '../theme/useHoystTheme';
import {BrandMark} from './BrandMark';
import {HoystText} from './HoystText';
import {HoyOrb} from './HoyOrb';
import {MomentumStageIcon} from './MomentumStageIcon';
import {getMomentumStatusVisualColor} from './MomentumStatusPill';

const HOY_SIZE = 48;
const NOTIFICATION_BUTTON_SIZE = 36;
const UNREAD_BADGE_SIZE = 18;
const HEADER_HORIZONTAL_PADDING = 22;
const LOGO_WIDTH = 84;
const LOGO_RIGHT_MARGIN = 8;
const TOP_ROW_GAP = 8;
const MOMENTUM_VALUE_GAP = 8;
const MOMENTUM_VALUE_WIDTH = 100;
const MOMENTUM_KNOB_SIZE = 24;

export const homeHeroPalettes = {
  light: {
    background: brandColors.backgroundLight,
    bubbleText: '#16181D',
    bubbleSubtle: '#5B5B86',
    subline: brandColors.blueVivid,
    track: 'rgba(124,111,240,0.18)',
  },
  dark: {
    background: brandColors.backgroundDark,
    bubbleText: '#E8ECF5',
    bubbleSubtle: '#9292B4',
    subline: brandColors.blue,
    track: 'rgba(124,111,240,0.24)',
  },
} as const;

type HomeHeroHeaderProps = {
  bubbleText?: string;
  isHoyActionDisabled?: boolean;
  hoyAccessibilityLabel: string;
  hoyCelebrationKey?: number;
  hoyState?: HoyState;
  onHoyActionPress: () => void;
  surfaceColor: string;
};

type HomeNotificationButtonProps = {
  accessibilityLabel: string;
  badgeText?: string;
  onPress: () => void;
};

type HomeMomentumBarProps = {
  momentumPercent: number;
  momentumStatus: MomentumStatus;
  onPress: () => void;
  trackColor: string;
};

function BubbleText({text}: {text: string}) {
  const palette = useHoystTheme().isDark
    ? homeHeroPalettes.dark
    : homeHeroPalettes.light;
  const opacity = useRef(new Animated.Value(0)).current;
  const [displayedText, setDisplayedText] = useState(text);

  useEffect(() => {
    let isActive = true;

    if (text === displayedText) {
      const fadeIn = Animated.timing(opacity, {
        duration: 180,
        toValue: 1,
        useNativeDriver: true,
      });

      fadeIn.start();

      return () => {
        isActive = false;
        fadeIn.stop();
      };
    }

    const fadeOut = Animated.timing(opacity, {
      duration: 140,
      toValue: 0,
      useNativeDriver: true,
    });

    fadeOut.start(({finished}) => {
      if (!finished || !isActive) {
        return;
      }

      setDisplayedText(text);
      opacity.setValue(0);
      Animated.timing(opacity, {
        duration: 180,
        toValue: 1,
        useNativeDriver: true,
      }).start();
    });

    return () => {
      isActive = false;
      fadeOut.stop();
    };
  }, [displayedText, opacity, text]);

  return (
    <Animated.View style={[styles.bubbleTextContainer, {opacity}]}>
      <HoystText
        numberOfLines={3}
        style={[styles.bubbleText, {color: palette.bubbleText}]}>
        {displayedText}
      </HoystText>
    </Animated.View>
  );
}

function HoyPlaceholder({
  surfaceColor,
}: {
  surfaceColor: string;
}): React.JSX.Element {
  const theme = useHoystTheme();

  return (
    <View
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      style={[
        styles.hoyPlaceholder,
        {
          backgroundColor: surfaceColor,
          shadowColor: theme.shadow,
        },
      ]}
      testID="home-hero-hoy-placeholder"
    />
  );
}

export function HomeHeroHeader({
  bubbleText,
  isHoyActionDisabled = false,
  hoyAccessibilityLabel,
  hoyCelebrationKey,
  hoyState,
  onHoyActionPress,
  surfaceColor,
}: HomeHeroHeaderProps): React.JSX.Element {
  const theme = useHoystTheme();
  const insets = useSafeAreaInsets();
  const {width: screenWidth} = useWindowDimensions();
  const palette = theme.isDark ? homeHeroPalettes.dark : homeHeroPalettes.light;
  const bubbleMaxWidth = Math.max(
    120,
    screenWidth -
      HEADER_HORIZONTAL_PADDING * 2 -
      LOGO_WIDTH -
      LOGO_RIGHT_MARGIN -
      TOP_ROW_GAP * 2 -
      HOY_SIZE,
  );
  return (
    <View style={[styles.header, {paddingTop: insets.top + 10}]}>
      <View style={styles.topRow}>
        <BrandMark isDark={theme.isDark} kind="logo" style={styles.logo} />
        <Pressable
          accessibilityLabel={hoyAccessibilityLabel}
          accessibilityRole="button"
          disabled={isHoyActionDisabled}
          onPress={onHoyActionPress}
          style={({pressed}) => [
            styles.hoyAction,
            {opacity: pressed ? actionMotion.pressedOpacity : 1},
          ]}
          testID="home-hero-hoy-action">
          <View
            testID="home-hero-bubble-surface"
            style={[
              styles.bubbleSurface,
              {
                maxWidth: bubbleMaxWidth,
              },
            ]}>
            <View
              style={[
                styles.bubble,
                {
                  backgroundColor: surfaceColor,
                },
              ]}
              testID="home-hero-bubble-fill">
              {bubbleText ? (
                <BubbleText text={bubbleText} />
              ) : (
                <View
                  accessibilityElementsHidden
                  importantForAccessibility="no-hide-descendants"
                  style={styles.bubbleSkeleton}>
                  <View
                    style={[
                      styles.bubbleSkeletonLine,
                      {backgroundColor: palette.track},
                    ]}
                  />
                  <View
                    style={[
                      styles.bubbleSkeletonLineShort,
                      {backgroundColor: palette.track},
                    ]}
                  />
                </View>
              )}
            </View>
          </View>
        </Pressable>
        <View style={styles.hoyCluster}>
          {hoyState ? (
            <HoyOrb
              celebrationKey={hoyCelebrationKey}
              size={HOY_SIZE}
              state={hoyState}
              testID="home-hero-hoy-orb"
            />
          ) : (
            <HoyPlaceholder surfaceColor={surfaceColor} />
          )}
          <View style={styles.hoyTail}>
            <View
              testID="home-hero-tail-dot-large"
              style={[styles.tailDotLarge, {backgroundColor: surfaceColor}]}
            />
            <View
              testID="home-hero-tail-dot-small"
              style={[styles.tailDotSmall, {backgroundColor: surfaceColor}]}
            />
          </View>
        </View>
      </View>
    </View>
  );
}

export function HomeNotificationButton({
  accessibilityLabel,
  badgeText,
  onPress,
}: HomeNotificationButtonProps): React.JSX.Element {
  const theme = useHoystTheme();

  return (
    <Pressable
      accessibilityLabel={accessibilityLabel}
      accessibilityRole="button"
      hitSlop={4}
      onPress={onPress}
      style={({pressed}) => [
        styles.notificationButton,
        {opacity: pressed ? actionMotion.pressedOpacity : 1},
      ]}
      testID="home-hero-notification-button">
      <Bell color={theme.text} size={22} strokeWidth={2.2} />
      {badgeText ? (
        <View
          style={styles.unreadBadge}
          testID="home-hero-notification-unread-badge">
          <HoystText
            allowFontScaling={false}
            numberOfLines={1}
            style={styles.unreadBadgeText}>
            {badgeText}
          </HoystText>
        </View>
      ) : null}
    </Pressable>
  );
}

export function HomeMomentumBar({
  momentumPercent,
  momentumStatus,
  onPress,
  trackColor,
}: HomeMomentumBarProps): React.JSX.Element {
  const theme = useHoystTheme();
  const {width: screenWidth} = useWindowDimensions();
  const clampedPercent = Math.max(
    0,
    Math.min(100, Number.isFinite(momentumPercent) ? momentumPercent : 0),
  );
  const momentumVisualColor = getMomentumStatusVisualColor(
    momentumStatus,
    theme,
  );
  const momentumBarWidth = Math.max(
    160,
    screenWidth - HEADER_HORIZONTAL_PADDING * 2,
  );
  const momentumTrackWidth = Math.max(
    96,
    momentumBarWidth - MOMENTUM_VALUE_WIDTH - MOMENTUM_VALUE_GAP,
  );
  const momentumKnobLeft = Math.max(
    0,
    Math.min(
      momentumTrackWidth - MOMENTUM_KNOB_SIZE,
      (momentumTrackWidth * clampedPercent) / 100 - MOMENTUM_KNOB_SIZE / 2,
    ),
  );

  return (
    <Pressable
      accessibilityLabel={`14-day momentum, ${Math.round(clampedPercent)}%`}
      accessibilityRole="button"
      onPress={onPress}
      style={({pressed}) => [
        styles.momentumPressable,
        {
          opacity: pressed ? actionMotion.pressedOpacity : 1,
          transform: [{scale: pressed ? actionMotion.pressedScale : 1}],
        },
      ]}
      testID="home-momentum-bar">
      <View style={[styles.compactBarArea, {width: momentumTrackWidth}]}>
        <View
          style={[styles.compactBarTrack, {backgroundColor: trackColor}]}
          testID="home-momentum-bar-track">
          <View
            testID="home-momentum-bar-fill"
            style={[
              styles.compactBarFill,
              {
                backgroundColor: momentumVisualColor,
                width: `${clampedPercent}%`,
              },
            ]}
          />
        </View>
        <View
          style={[
            styles.compactBarKnob,
            {left: momentumKnobLeft, shadowColor: theme.glassShadow},
          ]}>
          <MomentumStageIcon
            size={18}
            status={momentumStatus}
            testID="home-momentum-stage-icon"
          />
        </View>
      </View>
      <HoystText
        style={[
          styles.momentumValue,
          {color: theme.isDark ? '#8D96AD' : '#9A9ABC'},
        ]}
        testID="home-momentum-value">
        {`${Math.round(clampedPercent)}% MOMENTUM`}
      </HoystText>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  header: {
    paddingBottom: 0,
    paddingHorizontal: 22,
  },
  topRow: {
    alignItems: 'flex-start',
    flexDirection: 'row',
    gap: 8,
    justifyContent: 'flex-start',
  },
  hoyAction: {
    alignItems: 'center',
    flexBasis: 0,
    flexDirection: 'row',
    flexGrow: 1,
    flexShrink: 1,
    gap: 5,
    minWidth: 0,
    position: 'relative',
  },
  bubbleSurface: {
    flexBasis: 0,
    flexGrow: 1,
    flexShrink: 1,
    minWidth: 0,
  },
  bubble: {
    borderRadius: 16,
    borderBottomLeftRadius: 5,
    overflow: 'hidden',
    paddingHorizontal: 11,
    paddingVertical: 9,
  },
  bubbleText: {
    flexShrink: 1,
    fontSize: 15,
    fontWeight: '600',
    letterSpacing: 0,
    lineHeight: 20,
  },
  bubbleTextContainer: {
    flexShrink: 1,
    width: '100%',
  },
  bubbleSkeleton: {
    gap: 6,
    minWidth: 0,
    paddingVertical: 2,
  },
  bubbleSkeletonLine: {
    borderRadius: 6,
    height: 12,
    opacity: 0.8,
    width: '94%',
  },
  bubbleSkeletonLineShort: {
    borderRadius: 6,
    height: 12,
    opacity: 0.6,
    width: '62%',
  },
  tailDotLarge: {
    borderRadius: 5,
    height: 9,
    width: 9,
  },
  tailDotSmall: {
    borderRadius: 3,
    height: 5,
    marginTop: 6,
    width: 5,
  },
  hoyCluster: {
    flexShrink: 0,
    height: HOY_SIZE,
    position: 'relative',
    width: HOY_SIZE,
  },
  hoyTail: {
    alignItems: 'flex-start',
    left: -11,
    position: 'absolute',
    top: HOY_SIZE - 3,
  },
  hoyPlaceholder: {
    borderRadius: HOY_SIZE / 2,
    elevation: 3,
    height: HOY_SIZE,
    overflow: 'hidden',
    shadowOffset: {height: 3, width: 0},
    shadowOpacity: 0.18,
    shadowRadius: 6,
    width: HOY_SIZE,
  },
  unreadBadge: {
    alignItems: 'center',
    backgroundColor: brandColors.red,
    borderColor: brandColors.white,
    borderRadius: UNREAD_BADGE_SIZE / 2,
    borderWidth: 2,
    height: UNREAD_BADGE_SIZE,
    justifyContent: 'center',
    position: 'absolute',
    right: -5,
    top: -5,
    width: UNREAD_BADGE_SIZE,
  },
  unreadBadgeText: {
    color: brandColors.white,
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0,
    lineHeight: 13,
    textAlign: 'center',
  },
  logo: {
    alignSelf: 'flex-start',
    height: 36,
    marginLeft: -4,
    marginRight: LOGO_RIGHT_MARGIN,
    width: LOGO_WIDTH,
  },
  notificationButton: {
    alignItems: 'center',
    height: NOTIFICATION_BUTTON_SIZE,
    justifyContent: 'center',
    position: 'relative',
    width: NOTIFICATION_BUTTON_SIZE,
  },
  momentumPressable: {
    height: 44,
    minWidth: 0,
    position: 'relative',
    width: '100%',
  },
  momentumValue: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0,
    lineHeight: 16,
    position: 'absolute',
    right: 0,
    textAlign: 'right',
    top: 14,
    width: MOMENTUM_VALUE_WIDTH,
  },
  compactBarArea: {
    height: MOMENTUM_KNOB_SIZE,
    left: 0,
    position: 'relative',
    top: 10,
  },
  compactBarTrack: {
    borderRadius: 3,
    height: 6,
    left: 0,
    overflow: 'hidden',
    position: 'absolute',
    right: 0,
    top: 9,
  },
  compactBarFill: {
    borderRadius: 3,
    height: 6,
  },
  compactBarKnob: {
    alignItems: 'center',
    backgroundColor: '#FFF3DF',
    borderRadius: MOMENTUM_KNOB_SIZE / 2,
    elevation: 2,
    height: MOMENTUM_KNOB_SIZE,
    justifyContent: 'center',
    position: 'absolute',
    shadowOffset: {height: 2, width: 0},
    shadowOpacity: 0.3,
    shadowRadius: 4,
    top: 0,
    width: MOMENTUM_KNOB_SIZE,
  },
});
