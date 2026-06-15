import React, {useEffect, useRef, useState} from 'react';
import {
  Animated,
  Image,
  Pressable,
  StyleSheet,
  View,
  type ImageSourcePropType,
} from 'react-native';
import {useSafeAreaInsets} from 'react-native-safe-area-context';
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
import {
  getMomentumStatusPillPalette,
  getMomentumStatusVisualColor,
} from './MomentumStatusPill';

const AVATAR_SIZE = 56;
const BADGE_SIZE = 26;
const BAR_HEIGHT = 13;
const KNOB_SIZE = 40;
const MOMENTUM_STAGE_ICON_BACKGROUND = '#FFF3DF';

export const homeHeroPalettes = {
  light: {
    background: '#F0EFEC',
    bubble: '#FFFFFF',
    bubbleText: '#1C2536',
    subline: '#1B87D8',
    track: '#E2E1DE',
    avatarRing: '#FFFFFF',
    avatarFallback: '#E5EBF3',
    watermarkOpacity: 0.05,
  },
  dark: {
    background: brandColors.backgroundDark,
    bubble: '#151827',
    bubbleText: '#E8ECF5',
    subline: brandColors.blue,
    track: '#222638',
    avatarRing: '#1E2434',
    avatarFallback: '#222B3F',
    watermarkOpacity: 0.06,
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

function AvatarBadgeIcon({kind}: {kind: HomeAvatarBadgeKind}) {
  const visual = badgeVisuals[kind];
  const gradientId = useGradientId(`avatar-badge-${kind}`);

  return (
    <Svg height={BADGE_SIZE} viewBox="0 0 32 32" width={BADGE_SIZE}>
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
  const momentumPalette = getMomentumStatusPillPalette(momentumStatus, theme);
  const momentumVisualColor = getMomentumStatusVisualColor(
    momentumStatus,
    theme,
  );

  return (
    <View
      style={[
        styles.header,
        {backgroundColor: palette.background, paddingTop: insets.top + 12},
      ]}>
      <View pointerEvents="none" style={styles.watermarkLayer}>
        <BrandMark
          isDark={theme.isDark}
          kind="icon"
          style={[styles.watermark, {opacity: palette.watermarkOpacity}]}
        />
      </View>

      <View style={styles.topRow}>
        <View
          style={[
            styles.bubble,
            {
              backgroundColor: palette.bubble,
              shadowColor: theme.shadow,
            },
          ]}>
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
        <View style={styles.bubbleTail}>
          <View
            style={[styles.tailDotLarge, {backgroundColor: palette.bubble}]}
          />
          <View
            style={[styles.tailDotSmall, {backgroundColor: palette.bubble}]}
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
            style={[
              styles.avatarRing,
              {backgroundColor: palette.avatarRing, shadowColor: theme.shadow},
            ]}>
            <View
              style={[
                styles.avatarFrame,
                {backgroundColor: palette.avatarFallback},
              ]}>
              {avatarSource ? (
                <Image source={avatarSource} style={styles.avatarImage} />
              ) : (
                <HoystText style={styles.avatarInitials} variant="bodyStrong">
                  {initials}
                </HoystText>
              )}
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
        <HoystText style={styles.headline}>{copy.headline}</HoystText>
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
                shadowColor: theme.shadow,
              },
            ]}>
            <MomentumStageIcon
              size={30}
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
    overflow: 'hidden',
    paddingBottom: 39,
    paddingHorizontal: 20,
  },
  watermarkLayer: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
  },
  watermark: {
    height: 300,
    width: 300,
  },
  topRow: {
    alignItems: 'flex-start',
    flexDirection: 'row',
    justifyContent: 'flex-end',
  },
  bubble: {
    borderRadius: 18,
    elevation: 3,
    flexShrink: 1,
    maxWidth: 250,
    paddingHorizontal: 14,
    paddingVertical: 11,
    shadowOffset: {height: 4, width: 0},
    shadowOpacity: 0.5,
    shadowRadius: 10,
  },
  bubbleText: {
    fontSize: 14.5,
    fontWeight: '600',
    letterSpacing: 0,
    lineHeight: 19,
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
    marginTop: 23,
  },
  tailDotLarge: {
    borderRadius: 6.5,
    height: 13,
    width: 13,
  },
  tailDotSmall: {
    borderRadius: 4,
    height: 8,
    marginTop: 9,
    width: 8,
  },
  avatarCluster: {
    height: AVATAR_SIZE + 8,
    width: AVATAR_SIZE + 8,
  },
  avatarRing: {
    alignItems: 'center',
    borderRadius: (AVATAR_SIZE + 8) / 2,
    elevation: 3,
    height: AVATAR_SIZE + 8,
    justifyContent: 'center',
    shadowOffset: {height: 4, width: 0},
    shadowOpacity: 0.4,
    shadowRadius: 9,
    width: AVATAR_SIZE + 8,
  },
  avatarFrame: {
    alignItems: 'center',
    borderRadius: AVATAR_SIZE / 2,
    height: AVATAR_SIZE,
    justifyContent: 'center',
    overflow: 'hidden',
    width: AVATAR_SIZE,
  },
  avatarImage: {
    height: AVATAR_SIZE,
    resizeMode: 'cover',
    width: AVATAR_SIZE,
  },
  avatarInitials: {
    fontSize: 18,
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
    borderRadius: 11,
    borderWidth: 2,
    bottom: -3,
    height: 22,
    justifyContent: 'center',
    minWidth: 22,
    paddingHorizontal: 5,
    position: 'absolute',
    right: -3,
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
    alignSelf: 'center',
    height: 56,
    marginTop: 10,
    width: 134,
  },
  copyBlock: {
    gap: 4,
    marginTop: 12,
  },
  headline: {
    fontSize: 21,
    fontWeight: '800',
    letterSpacing: 0,
    lineHeight: 26,
    textAlign: 'center',
  },
  subline: {
    fontSize: 15,
    fontWeight: '700',
    letterSpacing: 0,
    lineHeight: 20,
    textAlign: 'center',
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
    backgroundColor: brandColors.orangeStrong,
    borderRadius: BAR_HEIGHT / 2,
    height: BAR_HEIGHT,
  },
  barKnob: {
    alignItems: 'center',
    backgroundColor: MOMENTUM_STAGE_ICON_BACKGROUND,
    borderRadius: KNOB_SIZE / 2,
    elevation: 3,
    height: KNOB_SIZE,
    justifyContent: 'center',
    marginLeft: -KNOB_SIZE / 2,
    position: 'absolute',
    shadowOffset: {height: 3, width: 0},
    shadowOpacity: 0.35,
    shadowRadius: 8,
    top: 3,
    width: KNOB_SIZE,
  },
});
