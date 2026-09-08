import React from 'react';
import {Pressable, StyleSheet, useWindowDimensions, View} from 'react-native';
import {useSafeAreaInsets} from 'react-native-safe-area-context';
import LinearGradient from 'react-native-linear-gradient';
import {
  Bell,
  Clock3,
  Ellipsis,
  LockKeyhole,
  Sparkles,
  Check,
  TriangleAlert,
} from 'lucide-react-native';
import Svg, {Path} from 'react-native-svg';
import {homeTypography} from '../tokens/home';
import type {HoyState} from '../../features/home/services/hoy-state';
import {useHoystTheme} from '../theme/useHoystTheme';
import {BrandMark} from './BrandMark';
import {HoystText} from './HoystText';
import {HoyOrb} from './HoyOrb';

export const homeHoyVisuals = {
  locked: {tint: '#B4BCD1', accent: '#7785A2', Icon: LockKeyhole},
  thinking: {tint: '#C8B5FA', accent: '#9171DB', Icon: Ellipsis},
  momentum_building: {tint: '#C8B5FA', accent: '#9470E8', Icon: Sparkles},
  momentum_strong: {tint: '#9CDEFF', accent: '#18B9FF', Icon: Sparkles},
  momentum_peak: {tint: '#A2EBC5', accent: '#10B967', Icon: Sparkles},
  celebrating: {tint: '#A2EBC5', accent: '#10B967', Icon: Sparkles},
  risk_attention: {tint: '#FFE69A', accent: '#E8A600', Icon: TriangleAlert},
  tap_in_needed: {tint: '#FFD4AE', accent: '#FF8A3D', Icon: Clock3},
} as const;

export function getHomeMessageParts(text: string, emphasis: readonly string[]) {
  const spans = emphasis
    .filter(Boolean)
    .flatMap(value => {
      const start = text.indexOf(value);
      return start < 0 ? [] : [{start, end: start + value.length}];
    })
    .sort((a, b) => a.start - b.start);
  const result: {text: string; bold: boolean}[] = [];
  let cursor = 0;
  for (const span of spans) {
    if (span.start < cursor) {
      continue;
    }
    if (span.start > cursor) {
      result.push({text: text.slice(cursor, span.start), bold: false});
    }
    result.push({text: text.slice(span.start, span.end), bold: true});
    cursor = span.end;
  }
  if (cursor < text.length) {
    result.push({text: text.slice(cursor), bold: false});
  }
  return result;
}

export function HomeHeroHeader({
  bubbleText,
  emphasis = [],
  hoyAccessibilityLabel,
  hoyCelebrationKey,
  hoyState,
  isHoyActionDisabled = false,
  onHoyActionPress,
  notification,
  surfaceColor: _surfaceColor,
}: {
  bubbleText?: string;
  emphasis?: readonly string[];
  hoyAccessibilityLabel: string;
  hoyCelebrationKey?: number;
  hoyState?: HoyState;
  isHoyActionDisabled?: boolean;
  onHoyActionPress: () => void;
  notification?: React.ReactNode;
  surfaceColor: string;
}) {
  const theme = useHoystTheme();
  const {width, fontScale} = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const state = hoyState ?? 'thinking';
  const visual = homeHoyVisuals[state];
  const Icon = visual.Icon;
  const orbSize = width < 390 ? 68 : 72;
  const bubbleColor = theme.isDark ? '#252527' : '#FFFFFF';
  const stacked = fontScale >= 1.6;
  const messageOpacity = isHoyActionDisabled ? 0.8 : 1;
  const bubbleShadow = theme.isDark ? '#000000' : '#92723E';
  return (
    <View style={[styles.header, {paddingTop: insets.top + 4}]}>
      <LinearGradient
        pointerEvents="none"
        colors={[
          `${visual.tint}${theme.isDark ? '26' : 'A6'}`,
          `${visual.tint}00`,
        ]}
        style={StyleSheet.absoluteFill}
        testID="home-hoy-context-tint"
      />
      <View style={styles.topRow}>
        <BrandMark isDark={theme.isDark} kind="logo" style={styles.logo} />
        {notification}
      </View>
      <View style={[styles.heroRow, stacked && styles.heroStacked]}>
        <Pressable
          accessibilityLabel={hoyAccessibilityLabel}
          accessibilityRole="button"
          disabled={isHoyActionDisabled}
          onPress={onHoyActionPress}
          style={[
            styles.bubbleSurface,
            {
              opacity: messageOpacity,
              width: stacked ? width - 44 : width - 44 - orbSize - 12 - 16,
              shadowColor: bubbleShadow,
              backgroundColor: bubbleColor,
            },
          ]}
          testID="home-hero-hoy-action">
          <View testID="home-hero-bubble-surface">
            <View testID="home-hero-bubble-fill">
              {bubbleText ? (
                <HoystText style={styles.message}>
                  {getHomeMessageParts(bubbleText, emphasis).map(
                    (part, index) => (
                      <HoystText
                        key={index}
                        style={[
                          styles.message,
                          part.bold && styles.messageBold,
                        ]}>
                        {part.text}
                      </HoystText>
                    ),
                  )}
                </HoystText>
              ) : (
                <View
                  accessibilityElementsHidden
                  style={styles.skeleton}
                  testID="home-hero-bubble-skeleton">
                  <View
                    style={[
                      styles.skeletonLine,
                      {backgroundColor: theme.borderStrong},
                    ]}
                  />
                  <View
                    style={[
                      styles.skeletonLine,
                      {backgroundColor: theme.borderStrong},
                      styles.skeletonShort,
                    ]}
                  />
                </View>
              )}
            </View>
          </View>
          {!stacked && (
            <View
              pointerEvents="none"
              style={[styles.tail, {borderLeftColor: bubbleColor}]}
            />
          )}
        </Pressable>
        <View
          accessibilityElementsHidden
          importantForAccessibility="no-hide-descendants"
          style={[
            styles.hoyCluster,
            {width: orbSize + 12, height: orbSize + 12},
          ]}>
          {hoyState ? (
            <HoyOrb
              presentation="home"
              shadowTone={theme.isDark ? 'dark' : 'light'}
              celebrationKey={hoyCelebrationKey}
              size={orbSize}
              state={hoyState}
              testID="home-hero-hoy-orb"
            />
          ) : (
            <View
              testID="home-hero-hoy-placeholder"
              style={{
                width: orbSize,
                height: orbSize,
                borderRadius: orbSize / 2,
                backgroundColor: theme.borderStrong,
              }}
            />
          )}
          {hoyState && (
            <>
              <View
                style={styles.decorLeft}
                testID={`home-hoy-decoration-${state}`}>
                {[
                  'momentum_building',
                  'momentum_strong',
                  'momentum_peak',
                  'celebrating',
                ].includes(state) ? (
                  <Svg width={16} height={16} viewBox="0 0 16 16">
                    <Path
                      fill={visual.accent}
                      d="M8 0 C9.3 5.3 10.7 6.7 16 8 C10.7 9.3 9.3 10.7 8 16 C6.7 10.7 5.3 9.3 0 8 C5.3 6.7 6.7 5.3 8 0Z"
                    />
                  </Svg>
                ) : (
                  <Icon color={visual.accent} size={16} strokeWidth={1.8} />
                )}
              </View>
              {state !== 'locked' && state !== 'thinking' && (
                <View style={styles.decorRight}>
                  {state === 'momentum_peak' ? (
                    <Check size={16} color={visual.accent} strokeWidth={2} />
                  ) : (
                    <Svg width={20} height={20} viewBox="0 0 20 20">
                      <Path
                        d="M3 8 L3 2 M9 10 L13 4 M12 16 L18 13"
                        stroke={
                          state === 'risk_attention' ? '#18B9FF' : visual.accent
                        }
                        strokeWidth={1.8}
                        strokeLinecap="round"
                        fill="none"
                      />
                    </Svg>
                  )}
                </View>
              )}
            </>
          )}
        </View>
      </View>
    </View>
  );
}

export function HomeNotificationButton({
  accessibilityLabel,
  badgeText,
  onPress,
}: {
  accessibilityLabel: string;
  badgeText?: string;
  onPress: () => void;
}) {
  const theme = useHoystTheme();
  return (
    <Pressable
      accessibilityLabel={accessibilityLabel}
      accessibilityRole="button"
      onPress={onPress}
      style={styles.notification}
      testID="home-hero-notification-button">
      <View style={styles.notificationGlyph}>
        <Bell color={theme.text} size={22} strokeWidth={2} />
        {badgeText ? (
          <View
            style={styles.badge}
            testID="home-hero-notification-unread-badge">
            <HoystText allowFontScaling={false} style={styles.badgeText}>
              {badgeText}
            </HoystText>
          </View>
        ) : null}
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  skeletonShort: {width: '70%'},
  header: {paddingHorizontal: 22, paddingBottom: 8},
  topRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  logo: {width: 92, height: 44},
  heroRow: {flexDirection: 'row', alignItems: 'center', gap: 16, marginTop: 12},
  heroStacked: {flexDirection: 'column-reverse', alignItems: 'stretch'},
  bubbleSurface: {
    flexShrink: 1,
    borderRadius: 18,
    padding: 16,
    minHeight: 80,
    justifyContent: 'center',
    shadowOffset: {width: 0, height: 6},
    shadowOpacity: 0.1,
    shadowRadius: 12,
    elevation: 3,
  },
  message: homeTypography.message,
  messageBold: {fontWeight: '700'},
  tail: {
    position: 'absolute',
    right: -9,
    top: '48%',
    borderTopWidth: 7,
    borderBottomWidth: 7,
    borderLeftWidth: 10,
    borderTopColor: 'transparent',
    borderBottomColor: 'transparent',
  },
  hoyCluster: {
    justifyContent: 'center',
    alignItems: 'center',
    alignSelf: 'center',
  },
  decorLeft: {
    position: 'absolute',
    top: -2,
    left: 0,
    transform: [{rotate: '-12deg'}],
  },
  decorRight: {
    position: 'absolute',
    right: -5,
    top: -5,
    transform: [{rotate: '12deg'}],
  },
  notification: {
    minWidth: 44,
    minHeight: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  notificationGlyph: {
    width: 22,
    height: 22,
    transform: [{translateY: -2}],
  },
  badge: {
    position: 'absolute',
    right: -8,
    top: -7,
    minWidth: 19,
    height: 19,
    borderRadius: 10,
    backgroundColor: '#FF3B30',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 3,
  },
  badgeText: {
    fontSize: 11,
    lineHeight: 14,
    color: '#FFFFFF',
    fontWeight: '700',
  },
  skeleton: {gap: 12},
  skeletonLine: {height: 12, borderRadius: 6, width: '100%'},
});
