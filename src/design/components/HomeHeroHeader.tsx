import React, {useEffect, useRef, useState} from 'react';
import {Animated, Pressable, StyleSheet, View} from 'react-native';
import {useSafeAreaInsets} from 'react-native-safe-area-context';
import {Bell} from 'lucide-react-native';

import type {HomeHeroCopy} from '../../features/home/services/home-hero-copy';
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

const HOY_SIZE = 52;
const UNREAD_BADGE_SIZE = 22;
const BAR_HEIGHT = 10;
const KNOB_SIZE = 34;
const MOMENTUM_STAGE_ICON_BACKGROUND = '#FFF3DF';

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
  copy: HomeHeroCopy;
  isHoyActionDisabled?: boolean;
  hoyAccessibilityLabel: string;
  hoyCelebrationKey?: number;
  hoyState?: HoyState;
  momentumDetail: string;
  momentumPercent: number;
  momentumStatus: MomentumStatus;
  notificationAccessibilityLabel: string;
  notificationBadgeText?: string;
  onHoyActionPress: () => void;
  onMomentumPress: () => void;
  onNotificationPress: () => void;
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
    <Animated.View style={{opacity}}>
      <HoystText
        numberOfLines={3}
        style={[styles.bubbleText, {color: palette.bubbleText}]}>
        {displayedText}
      </HoystText>
    </Animated.View>
  );
}

function HoyPlaceholder(): React.JSX.Element {
  const theme = useHoystTheme();

  return (
    <View
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      style={[
        styles.hoyPlaceholder,
        {
          backgroundColor: theme.panelSurface,
          borderColor: theme.border,
          shadowColor: theme.shadow,
        },
      ]}
      testID="home-hero-hoy-placeholder"
    />
  );
}

export function HomeHeroHeader({
  bubbleText,
  copy,
  isHoyActionDisabled = false,
  hoyAccessibilityLabel,
  hoyCelebrationKey,
  hoyState,
  momentumDetail,
  momentumPercent,
  momentumStatus,
  notificationAccessibilityLabel,
  notificationBadgeText,
  onHoyActionPress,
  onMomentumPress,
  onNotificationPress,
}: HomeHeroHeaderProps): React.JSX.Element {
  const theme = useHoystTheme();
  const insets = useSafeAreaInsets();
  const palette = theme.isDark ? homeHeroPalettes.dark : homeHeroPalettes.light;
  const clampedPercent = Math.max(
    0,
    Math.min(100, Number.isFinite(momentumPercent) ? momentumPercent : 0),
  );
  const knobPercent = Math.max(5, Math.min(95, clampedPercent));
  const momentumVisualColor = getMomentumStatusVisualColor(
    momentumStatus,
    theme,
  );

  return (
    <View style={[styles.header, {paddingTop: insets.top + 10}]}>
      <Pressable
        accessibilityLabel={hoyAccessibilityLabel}
        accessibilityRole="button"
        disabled={isHoyActionDisabled}
        onPress={onHoyActionPress}
        style={({pressed}) => ({
          opacity: pressed ? actionMotion.pressedOpacity : 1,
        })}
        testID="home-hero-hoy-action">
        <View style={styles.topRow}>
          <View
            testID="home-hero-bubble-surface"
            style={[
              styles.bubbleSurface,
              {
                shadowColor: theme.shadow,
              },
            ]}>
            <View
              style={[
                styles.bubble,
                {
                  backgroundColor: theme.panelSurface,
                  borderColor: theme.border,
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
          <View style={styles.bubbleTail}>
            <View
              testID="home-hero-tail-dot-large"
              style={[
                styles.tailDotLarge,
                {
                  backgroundColor: theme.panelSurface,
                  borderColor: theme.border,
                  shadowColor: theme.shadow,
                },
              ]}
            />
            <View
              testID="home-hero-tail-dot-small"
              style={[
                styles.tailDotSmall,
                {
                  backgroundColor: theme.panelSurface,
                  borderColor: theme.border,
                  shadowColor: theme.shadow,
                },
              ]}
            />
          </View>
          <View style={styles.hoyCluster}>
            {hoyState ? (
              <HoyOrb
                celebrationKey={hoyCelebrationKey}
                size={HOY_SIZE}
                state={hoyState}
                testID="home-hero-hoy-orb"
              />
            ) : (
              <HoyPlaceholder />
            )}
          </View>
        </View>
      </Pressable>

      <View style={styles.logoRow}>
        <BrandMark isDark={theme.isDark} kind="logo" style={styles.logo} />
        <Pressable
          accessibilityLabel={notificationAccessibilityLabel}
          accessibilityRole="button"
          hitSlop={4}
          onPress={onNotificationPress}
          style={({pressed}) => [
            styles.notificationButton,
            {opacity: pressed ? actionMotion.pressedOpacity : 1},
          ]}
          testID="home-hero-notification-button">
          <Bell color={theme.text} size={24} strokeWidth={2.2} />
          {notificationBadgeText ? (
            <View
              style={styles.unreadBadge}
              testID="home-hero-notification-unread-badge">
              <HoystText
                allowFontScaling={false}
                numberOfLines={1}
                style={styles.unreadBadgeText}>
                {notificationBadgeText}
              </HoystText>
            </View>
          ) : null}
        </Pressable>
      </View>

      <View style={styles.copyBlock}>
        <HoystText style={[styles.headline, {color: theme.text}]}>
          {copy.headline}
        </HoystText>
        <HoystText style={[styles.subline, {color: palette.subline}]}>
          {copy.subline}
        </HoystText>
      </View>

      <Pressable
        accessibilityLabel={`14-day momentum, ${momentumDetail}`}
        accessibilityRole="button"
        onPress={onMomentumPress}
        style={({pressed}) => [
          {
            opacity: pressed ? actionMotion.pressedOpacity : 1,
            transform: [{scale: pressed ? actionMotion.pressedScale : 1}],
          },
        ]}>
        <View style={styles.momentumLabelRow}>
          <HoystText
            style={[styles.momentumLabel, {color: palette.bubbleSubtle}]}>
            14-DAY MOMENTUM
          </HoystText>
          <HoystText style={[styles.momentumDetail, {color: theme.text}]}>
            {momentumDetail}
          </HoystText>
        </View>
        <View style={styles.barLayout}>
          <View style={[styles.barTrack, {backgroundColor: palette.track}]}>
            <View
              testID="home-momentum-bar-fill"
              style={[
                styles.barFill,
                {
                  backgroundColor: momentumVisualColor,
                  width: `${clampedPercent}%`,
                },
              ]}
            />
          </View>
          <View
            testID="home-momentum-bar-knob"
            style={[
              styles.barKnob,
              {
                backgroundColor: MOMENTUM_STAGE_ICON_BACKGROUND,
                left: `${knobPercent}%`,
                shadowColor: theme.glassShadow,
              },
            ]}>
            <MomentumStageIcon
              size={26}
              status={momentumStatus}
              testID="home-momentum-stage-icon"
            />
          </View>
        </View>
      </Pressable>
    </View>
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
    justifyContent: 'flex-start',
  },
  bubbleSurface: {
    elevation: 4,
    flex: 1,
    flexShrink: 1,
    minWidth: 0,
    shadowOffset: {height: 7, width: 0},
    shadowOpacity: 0.72,
    shadowRadius: 18,
  },
  bubble: {
    borderRadius: 18,
    borderBottomLeftRadius: 6,
    borderWidth: 1,
    overflow: 'hidden',
    paddingHorizontal: 15,
    paddingVertical: 12,
  },
  bubbleText: {
    fontSize: 15,
    fontWeight: '600',
    letterSpacing: 0,
    lineHeight: 20,
  },
  bubbleSkeleton: {
    gap: 6,
    minWidth: 150,
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
  bubbleTail: {
    alignItems: 'flex-start',
    flexDirection: 'row',
    gap: 4,
    marginHorizontal: 5,
    marginTop: 22,
  },
  tailDotLarge: {
    borderRadius: 6,
    borderWidth: 1,
    elevation: 4,
    height: 12,
    shadowOffset: {height: 6, width: 0},
    shadowOpacity: 0.64,
    shadowRadius: 12,
    width: 12,
  },
  tailDotSmall: {
    borderRadius: 4,
    borderWidth: 1,
    elevation: 3,
    height: 7,
    marginTop: 8,
    shadowOffset: {height: 5, width: 0},
    shadowOpacity: 0.58,
    shadowRadius: 10,
    width: 7,
  },
  hoyCluster: {
    height: HOY_SIZE,
    width: HOY_SIZE,
  },
  hoyPlaceholder: {
    borderRadius: HOY_SIZE / 2,
    borderWidth: 1,
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
    right: -7,
    top: -7,
    width: UNREAD_BADGE_SIZE,
  },
  unreadBadgeText: {
    color: brandColors.white,
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 0,
    lineHeight: 15,
    textAlign: 'center',
  },
  logo: {
    height: 40,
    marginLeft: -3,
    width: 86,
  },
  logoRow: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 22,
  },
  notificationButton: {
    alignItems: 'center',
    height: 44,
    justifyContent: 'center',
    width: 44,
  },
  copyBlock: {
    gap: 6,
    marginTop: 12,
  },
  headline: {
    fontSize: 26,
    fontWeight: '800',
    letterSpacing: -0.4,
    lineHeight: 30,
    textAlign: 'left',
  },
  subline: {
    fontSize: 15,
    fontWeight: '700',
    letterSpacing: 0,
    lineHeight: 20,
    textAlign: 'left',
  },
  barLayout: {
    height: KNOB_SIZE + 6,
    justifyContent: 'center',
    marginTop: 8,
  },
  momentumLabelRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 12,
    justifyContent: 'space-between',
    marginTop: 14,
  },
  momentumLabel: {
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.9,
    lineHeight: 15,
  },
  momentumDetail: {
    flexShrink: 1,
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 0,
    lineHeight: 16,
    textAlign: 'right',
  },
  barTrack: {
    borderRadius: BAR_HEIGHT / 2,
    height: BAR_HEIGHT,
    overflow: 'hidden',
  },
  barFill: {
    borderRadius: BAR_HEIGHT / 2,
    height: BAR_HEIGHT,
  },
  barKnob: {
    alignItems: 'center',
    borderRadius: KNOB_SIZE / 2,
    elevation: 3,
    height: KNOB_SIZE,
    justifyContent: 'center',
    marginLeft: -KNOB_SIZE / 2,
    position: 'absolute',
    shadowOffset: {height: 3, width: 0},
    shadowOpacity: 0.9,
    shadowRadius: 8,
    top: 3,
    width: KNOB_SIZE,
  },
});
