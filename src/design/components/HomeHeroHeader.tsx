import React, {useEffect, useRef, useState} from 'react';
import {
  Animated,
  Image,
  Platform,
  Pressable,
  StyleSheet,
  View,
  type ImageSourcePropType,
} from 'react-native';
import {useSafeAreaInsets} from 'react-native-safe-area-context';
import {BlurView} from '@react-native-community/blur';
import Svg, {Defs, G, LinearGradient, Path, Stop} from 'react-native-svg';

import type {HomeAvatarBadgeKind} from '../../features/home/services/home-hero-copy';
import type {HomeHeroCopy} from '../../features/home/services/home-hero-copy';
import type {MomentumStatus} from '../../types/models';
import {brandColors} from '../tokens/colors';
import {actionMotion} from '../tokens/actions';
import {useHoystTheme} from '../theme/useHoystTheme';
import {BrandMark} from './BrandMark';
import {HoystText} from './HoystText';
import {MomentumStageIcon} from './MomentumStageIcon';
import {getMomentumStatusVisualColor} from './MomentumStatusPill';

const AVATAR_SIZE = 46;
const AVATAR_BADGE_SIZE = 22;
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
    avatarRing: 'rgba(255,255,255,0.6)',
    avatarFallback: 'rgba(255,255,255,0.4)',
    avatarInitial: brandColors.blueVivid,
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
    avatarRing: 'rgba(40,42,64,0.6)',
    avatarFallback: 'rgba(60,62,90,0.5)',
    avatarInitial: brandColors.purpleBright,
    tailDot: 'rgba(74,77,116,0.78)',
    tailDotBorder: 'rgba(255,255,255,0.20)',
  },
} as const;

type HomeHeroHeaderProps = {
  avatarAccessibilityLabel: string;
  avatarSource?: ImageSourcePropType;
  badgeKind: HomeAvatarBadgeKind;
  bubbleText?: string;
  copy: HomeHeroCopy;
  initials: string;
  momentumPercent: number;
  momentumStatus: MomentumStatus;
  onAvatarPress: () => void;
  onMomentumPress: () => void;
  unreadBadgeText?: string;
};

const badgeVisuals: Record<
  HomeAvatarBadgeKind,
  {gradientStart: string; gradientStop: string}
> = {
  flame: {gradientStart: '#FF8A3D', gradientStop: '#F25B07'},
  heart: {gradientStart: '#FF5C8A', gradientStop: '#E91E55'},
  sparkle: {gradientStart: '#3D8BFF', gradientStop: '#1559E0'},
};

function useGradientId(name: string) {
  return `${React.useId().replace(/[^a-zA-Z0-9]/g, '')}-${name}`;
}

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

function AvatarBadgeIcon({kind}: {kind: HomeAvatarBadgeKind}) {
  const visual = badgeVisuals[kind];
  const gradientId = useGradientId(`avatar-badge-${kind}`);

  return (
    <Svg
      height={AVATAR_BADGE_SIZE}
      viewBox="0 0 32 32"
      width={AVATAR_BADGE_SIZE}>
      <Defs>
        <LinearGradient id={gradientId} x1="6" x2="26" y1="4" y2="28">
          <Stop offset="0" stopColor={visual.gradientStart} />
          <Stop offset="1" stopColor={visual.gradientStop} />
        </LinearGradient>
      </Defs>
      <Path
        d="M16 1.6c8 0 14.4 6.4 14.4 14.4S24 30.4 16 30.4 1.6 24 1.6 16 8 1.6 16 1.6Z"
        fill={`url(#${gradientId})`}
        stroke="#FFFFFF"
        strokeWidth={2.6}
      />
      {kind === 'flame' ? (
        <G translateY={1}>
          <Path
            d="M16.3 24.6c-4.2-.8-6.9-4-6.4-8 .3-2.6 2.1-4.5 3.9-6.3 1.6-1.5 2.3-3 1.9-4.9 4.4 2.2 6.7 5.9 5.5 10 1.9 1.1 2.6 3.2 1.7 5.2-1 2.4-3.8 4.4-6.6 4Z"
            fill="#FFFFFF"
          />
          <Path
            d="M16.5 21.8c-2.2-.4-3.5-2-3.2-4 .2-1.3 1.1-2.3 2-3.2.8-.8 1.2-1.5 1-2.5 2.3 1.2 3.5 3.2 2.8 5.3 1 .6 1.4 1.7 1 2.7-.6 1.3-2.1 2.1-3.6 1.7Z"
            fill={visual.gradientStop}
            opacity={0.45}
          />
        </G>
      ) : kind === 'heart' ? (
        <G translateY={-1}>
          <Path
            d="M16 24.4 8.9 17.2c-1.9-2-1.9-5.1 0-7 1.8-1.9 4.8-1.9 6.6 0l.5.5.5-.5c1.8-1.9 4.8-1.9 6.6 0 1.9 1.9 1.9 5 0 7L16 24.4Z"
            fill="#FFFFFF"
          />
        </G>
      ) : (
        <G translateY={2}>
          <Path
            d="M16 6.4c.9 4.8 2.9 6.8 7.6 7.6-4.7.8-6.7 2.8-7.6 7.6-.9-4.8-2.9-6.8-7.6-7.6 4.7-.8 6.7-2.8 7.6-7.6Z"
            fill="#FFFFFF"
          />
        </G>
      )}
    </Svg>
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

export function HomeHeroHeader({
  avatarAccessibilityLabel,
  avatarSource,
  badgeKind,
  bubbleText,
  copy,
  initials,
  momentumPercent,
  momentumStatus,
  onAvatarPress,
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
          accessibilityLabel={avatarAccessibilityLabel}
          accessibilityRole="button"
          hitSlop={8}
          onPress={onAvatarPress}
          style={({pressed}) => [
            styles.avatarCluster,
            {opacity: pressed ? 0.92 : 1},
          ]}>
          <View
            testID="home-hero-avatar-surface"
            style={[
              styles.avatarSurface,
              {
                shadowColor: theme.glassShadow,
              },
            ]}>
            <View
              style={[
                styles.avatarRing,
                {
                  backgroundColor: palette.avatarRing,
                  borderColor: theme.glassBorder,
                },
              ]}>
              <FrostedFill radius={(AVATAR_SIZE + 6) / 2} />
              <View
                testID="home-hero-avatar-frame"
                style={[
                  styles.avatarFrame,
                  {
                    backgroundColor: palette.avatarFallback,
                    borderColor: theme.isDark
                      ? 'rgba(255,255,255,0.18)'
                      : 'rgba(255,255,255,0.92)',
                  },
                ]}>
                {avatarSource ? (
                  <Image source={avatarSource} style={styles.avatarImage} />
                ) : (
                  <HoystText
                    style={[
                      styles.avatarInitials,
                      {color: palette.avatarInitial},
                    ]}
                    variant="bodyStrong">
                    {initials}
                  </HoystText>
                )}
              </View>
            </View>
          </View>
          <View style={styles.statusBadge}>
            <AvatarBadgeIcon kind={badgeKind} />
          </View>
          {unreadBadgeText ? (
            <View style={styles.unreadBadge}>
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
  avatarCluster: {
    height: AVATAR_SIZE + 6,
    width: AVATAR_SIZE + 6,
  },
  avatarSurface: {
    alignItems: 'center',
    elevation: 4,
    height: AVATAR_SIZE + 6,
    justifyContent: 'center',
    shadowOffset: {height: 6, width: 0},
    shadowOpacity: 0.72,
    shadowRadius: 14,
    width: AVATAR_SIZE + 6,
  },
  avatarRing: {
    alignItems: 'center',
    borderRadius: (AVATAR_SIZE + 6) / 2,
    borderWidth: 1,
    height: AVATAR_SIZE + 6,
    justifyContent: 'center',
    overflow: 'hidden',
    width: AVATAR_SIZE + 6,
  },
  avatarFrame: {
    alignItems: 'center',
    borderRadius: AVATAR_SIZE / 2,
    borderWidth: 1,
    height: AVATAR_SIZE,
    justifyContent: 'center',
    overflow: 'hidden',
    width: AVATAR_SIZE,
  },
  avatarImage: {
    borderRadius: (AVATAR_SIZE - 2) / 2,
    height: AVATAR_SIZE - 2,
    resizeMode: 'cover',
    width: AVATAR_SIZE - 2,
  },
  avatarInitials: {
    fontSize: 18,
    fontWeight: '700',
  },
  statusBadge: {
    position: 'absolute',
    right: -3,
    top: -3,
  },
  unreadBadge: {
    alignItems: 'center',
    backgroundColor: brandColors.red,
    borderColor: brandColors.white,
    borderRadius: AVATAR_BADGE_SIZE / 2,
    borderWidth: 2,
    bottom: -3,
    height: AVATAR_BADGE_SIZE,
    justifyContent: 'center',
    position: 'absolute',
    right: -3,
    width: AVATAR_BADGE_SIZE,
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
