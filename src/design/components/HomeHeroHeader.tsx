import React, {useEffect, useRef, useState} from 'react';
import {
  Animated,
  Platform,
  Pressable,
  StyleSheet,
  View,
} from 'react-native';
import {useSafeAreaInsets} from 'react-native-safe-area-context';
import {BlurView} from '@react-native-community/blur';

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
    bubble: 'rgba(255,255,255,0.6)',
    bubbleText: '#16181D',
    bubbleSubtle: '#5B5B86',
    subline: brandColors.blueVivid,
    track: 'rgba(124,111,240,0.18)',
    tailDot: 'rgba(255,255,255,0.6)',
    tailDotBorder: 'rgba(255,255,255,0)',
  },
  dark: {
    background: brandColors.backgroundDark,
    bubble: 'rgba(26,27,44,0.6)',
    bubbleText: '#E8ECF5',
    bubbleSubtle: '#9292B4',
    subline: brandColors.blue,
    track: 'rgba(124,111,240,0.24)',
    tailDot: 'rgba(74,77,116,0.78)',
    tailDotBorder: 'rgba(255,255,255,0.20)',
  },
} as const;

type HomeHeroHeaderProps = {
  bubbleText?: string;
  copy: HomeHeroCopy;
  hoyAccessibilityLabel: string;
  hoyCelebrationKey?: number;
  hoyState?: HoyState;
  momentumPercent: number;
  momentumStatus: MomentumStatus;
  onHoyPress: () => void;
  onMomentumPress: () => void;
  unreadBadgeText?: string;
};

function FrostedFill({radius}: {radius: number}) {
  const theme = useHoystTheme();

  if (Platform.OS !== 'ios') {
    return null;
  }

  return (
    <BlurView
      blurAmount={18}
      blurType={theme.isDark ? 'dark' : 'light'}
      reducedTransparencyFallbackColor={theme.glassSurfaceStrong}
      style={[StyleSheet.absoluteFill, {borderRadius: radius}]}
    />
  );
}

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
          backgroundColor: theme.glassSurfaceStrong,
          borderColor: theme.glassBorder,
          shadowColor: theme.glassShadow,
        },
      ]}
      testID="home-hero-hoy-placeholder">
      <FrostedFill radius={HOY_SIZE / 2} />
    </View>
  );
}

export function HomeHeroHeader({
  bubbleText,
  copy,
  hoyAccessibilityLabel,
  hoyCelebrationKey,
  hoyState,
  momentumPercent,
  momentumStatus,
  onHoyPress,
  onMomentumPress,
  unreadBadgeText,
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
      <View style={styles.topRow}>
        <View
          testID="home-hero-bubble-surface"
          style={[
            styles.bubbleSurface,
            {
              shadowColor: theme.glassShadow,
            },
          ]}>
          <View
            style={[
              styles.bubble,
              {
                backgroundColor: palette.bubble,
                borderColor: theme.glassBorder,
              },
            ]}>
            <FrostedFill radius={18} />
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
                backgroundColor: palette.tailDot,
                borderColor: palette.tailDotBorder,
                shadowColor: theme.glassShadow,
              },
            ]}
          />
          <View
            testID="home-hero-tail-dot-small"
            style={[
              styles.tailDotSmall,
              {
                backgroundColor: palette.tailDot,
                borderColor: palette.tailDotBorder,
                shadowColor: theme.glassShadow,
              },
            ]}
          />
        </View>
        <Pressable
          accessibilityLabel={hoyAccessibilityLabel}
          accessibilityRole="button"
          hitSlop={8}
          onPress={onHoyPress}
          style={({pressed}) => [
            styles.hoyCluster,
            {opacity: pressed ? 0.9 : 1},
          ]}
          testID="home-hero-hoy-button">
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
          {unreadBadgeText ? (
            <View
              style={styles.unreadBadge}
              testID="home-hero-hoy-unread-badge">
              <HoystText
                allowFontScaling={false}
                numberOfLines={1}
                style={styles.unreadBadgeText}>
                {unreadBadgeText}
              </HoystText>
            </View>
          ) : null}
        </Pressable>
      </View>

      <BrandMark isDark={theme.isDark} kind="logo" style={styles.logo} />

      <View style={styles.copyBlock}>
        <HoystText style={[styles.headline, {color: theme.text}]}>
          {copy.headline}
        </HoystText>
        <HoystText style={[styles.subline, {color: palette.subline}]}>
          {copy.subline}
        </HoystText>
      </View>

      <Pressable
        accessibilityLabel={`Your momentum, ${clampedPercent}%`}
        accessibilityRole="button"
        onPress={onMomentumPress}
        style={({pressed}) => [
          {
            opacity: pressed ? actionMotion.pressedOpacity : 1,
            transform: [{scale: pressed ? actionMotion.pressedScale : 1}],
          },
        ]}>
        <View style={styles.barLayout}>
          <View style={[styles.barTrack, {backgroundColor: palette.track}]}>
            <View
              testID="home-momentum-bar-fill"
              style={[
                styles.barFill,
                {
                  backgroundColor: momentumVisualColor,
                  width: `${knobPercent}%`,
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
    opacity: 0.78,
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
    bottom: -3,
    height: UNREAD_BADGE_SIZE,
    justifyContent: 'center',
    position: 'absolute',
    right: -3,
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
    alignSelf: 'flex-start',
    height: 40,
    marginLeft: -3,
    marginTop: 22,
    width: 86,
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
