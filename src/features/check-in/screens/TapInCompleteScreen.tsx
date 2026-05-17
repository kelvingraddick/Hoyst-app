import React, {useEffect, useRef, useState} from 'react';
import {
  AccessibilityInfo,
  Animated,
  Easing,
  Image,
  Pressable,
  StyleSheet,
  View,
} from 'react-native';
import {Sparkles, X} from 'lucide-react-native';
import type {NativeStackScreenProps} from '@react-navigation/native-stack';

import {GlassPanel} from '../../../design/components/GlassPanel';
import {HoystButton} from '../../../design/components/HoystButton';
import {HoystScreen} from '../../../design/components/HoystScreen';
import {HoystText} from '../../../design/components/HoystText';
import {TapInRingMark} from '../../../design/components/TapInRingMark';
import {radius} from '../../../design/tokens/radius';
import {useHoystTheme} from '../../../design/theme/useHoystTheme';
import type {RootStackParamList} from '../../../navigation/types';
import type {CircleDetailModel} from '../../../types/models';
import {useUserProfileStore} from '../../../store/profile-store';
import {useSessionStore} from '../../../store/session-store';
import {subscribeToMemberCircleDetail} from '../../home/services/home-data-service';

type Props = NativeStackScreenProps<RootStackParamList, 'TapInComplete'>;

type SparkleConfig = {
  bottom?: number;
  left?: number;
  right?: number;
  size: number;
  top?: number;
};

const sparkleConfigs: SparkleConfig[] = [
  {left: 24, size: 16, top: 2},
  {right: 16, size: 14, top: 28},
  {bottom: 20, left: 32, size: 12},
  {bottom: 10, right: 36, size: 13},
];

export function TapInCompleteScreen({
  navigation,
  route,
}: Props): React.JSX.Element {
  const theme = useHoystTheme();
  const ringProgress = useRef(new Animated.Value(0)).current;
  const contentProgress = useRef(new Animated.Value(0)).current;
  const sparkleProgresses = useRef(
    sparkleConfigs.map(() => new Animated.Value(0)),
  ).current;
  const [detail, setDetail] = useState<CircleDetailModel | undefined>();
  const profile = useUserProfileStore(state => state.profile);
  const status = useSessionStore(state => state.status);
  const user = useSessionStore(state => state.user);
  const timezone = profile?.timezone ?? 'UTC';
  const canLoadDetail = status === 'authenticatedReady' && Boolean(user?.uid);
  const note = route.params.note?.trim();
  const hasNote = Boolean(note);
  const isSkip = route.params.status === 'skip';

  useEffect(() => {
    if (!canLoadDetail || !user?.uid) {
      setDetail(undefined);
      return undefined;
    }

    return subscribeToMemberCircleDetail({
      circleId: route.params.circleId,
      onDetail: setDetail,
      onError: () => setDetail(undefined),
      timezone,
      uid: user.uid,
    });
  }, [canLoadDetail, route.params.circleId, timezone, user?.uid]);

  useEffect(() => {
    let isMounted = true;
    let entranceAnimation: Animated.CompositeAnimation | undefined;

    ringProgress.setValue(0);
    contentProgress.setValue(0);
    sparkleProgresses.forEach(progress => progress.setValue(0));

    AccessibilityInfo.isReduceMotionEnabled()
      .then(reduceMotionEnabled => {
        if (!isMounted) {
          return;
        }

        if (reduceMotionEnabled) {
          ringProgress.setValue(1);
          contentProgress.setValue(1);
          sparkleProgresses.forEach(progress => progress.setValue(1));
          return;
        }

        entranceAnimation = Animated.parallel([
          Animated.spring(ringProgress, {
            friction: isSkip ? 8 : 6,
            tension: isSkip ? 82 : 108,
            toValue: 1,
            useNativeDriver: true,
          }),
          Animated.timing(contentProgress, {
            delay: 120,
            duration: 360,
            easing: Easing.out(Easing.cubic),
            toValue: 1,
            useNativeDriver: true,
          }),
          Animated.stagger(
            isSkip ? 70 : 44,
            sparkleProgresses
              .slice(0, isSkip ? 2 : sparkleProgresses.length)
              .map(progress =>
                Animated.timing(progress, {
                  duration: isSkip ? 520 : 680,
                  easing: Easing.out(Easing.cubic),
                  toValue: 1,
                  useNativeDriver: true,
                }),
              ),
          ),
        ]);

        entranceAnimation.start();
      })
      .catch(() => {
        ringProgress.setValue(1);
        contentProgress.setValue(1);
        sparkleProgresses.forEach(progress => progress.setValue(1));
      });

    return () => {
      isMounted = false;
      entranceAnimation?.stop();
    };
  }, [contentProgress, isSkip, ringProgress, sparkleProgresses]);

  const finish = () => {
    navigation.replace('TapInPicker');
  };
  const title = detail?.title ?? 'Your circle';
  const dailyTask = detail?.dailyTask ?? "Today's Tap In";
  const ringAnimatedStyle = {
    opacity: ringProgress,
    transform: [
      {
        scale: ringProgress.interpolate({
          inputRange: [0, 1],
          outputRange: [isSkip ? 0.92 : 0.78, 1],
        }),
      },
    ],
  };
  const contentAnimatedStyle = {
    opacity: contentProgress,
    transform: [
      {
        translateY: contentProgress.interpolate({
          inputRange: [0, 1],
          outputRange: [12, 0],
        }),
      },
    ],
  };

  return (
    <HoystScreen contentContainerStyle={styles.content}>
      <View style={styles.screenFrame}>
        <Pressable
          accessibilityLabel="Close Tap In complete"
          onPress={finish}
          style={({pressed}) => [
            styles.closeButton,
            {
              backgroundColor: theme.surfaceSoft,
              borderColor: theme.border,
              opacity: pressed ? 0.92 : 1,
            },
          ]}>
          <X color={theme.text} size={18} strokeWidth={2.4} />
        </Pressable>

        <GlassPanel style={styles.panel}>
          <Animated.View style={[styles.iconWrap, ringAnimatedStyle]}>
            <TapInRingMark innerSize={52} outerSize={92} />
            {sparkleConfigs.map((sparkle, index) => {
              const progress = sparkleProgresses[index];
              const sparklePositionStyle = {
                bottom: sparkle.bottom,
                left: sparkle.left,
                right: sparkle.right,
                top: sparkle.top,
              };
              const sparkleStyle = {
                opacity: progress.interpolate({
                  inputRange: [0, 0.28, 1],
                  outputRange: [0, isSkip ? 0.55 : 1, 0],
                }),
                transform: [
                  {
                    scale: progress.interpolate({
                      inputRange: [0, 0.5, 1],
                      outputRange: [0.52, isSkip ? 0.9 : 1.14, 0.82],
                    }),
                  },
                  {
                    translateY: progress.interpolate({
                      inputRange: [0, 1],
                      outputRange: [isSkip ? 4 : 8, isSkip ? -8 : -18],
                    }),
                  },
                ],
              };

              return (
                <Animated.View
                  key={index}
                  pointerEvents="none"
                  style={[
                    styles.sparkle,
                    sparklePositionStyle,
                    sparkleStyle,
                  ]}>
                  <Sparkles
                    color={isSkip ? theme.textMuted : theme.success}
                    size={sparkle.size}
                    strokeWidth={2.2}
                  />
                </Animated.View>
              );
            })}
          </Animated.View>

          <Animated.View style={[styles.celebrationStack, contentAnimatedStyle]}>
            <View style={styles.titleBlock}>
              <HoystText style={styles.completeTitle} variant="headline">
                {isSkip ? 'Skip Recorded' : 'Tap In Complete'}
              </HoystText>
              <HoystText style={[styles.centerText, {color: theme.success}]}>
                {isSkip
                  ? `${title} kept your streak covered today.`
                  : `${title} has your update for today.`}
              </HoystText>
            </View>

            <View
              style={[
                styles.summaryCard,
                {
                  backgroundColor: theme.surfaceSoft,
                  borderColor: theme.borderStrong,
                },
              ]}>
              <View style={styles.summaryHeader}>
                <View style={styles.summaryCopy}>
                  <HoystText tone="muted" variant="label">
                    Today's Tap In
                  </HoystText>
                  <HoystText style={styles.summaryTitle}>{dailyTask}</HoystText>
                </View>
                <HoystText style={{color: theme.success}} variant="caption">
                  {isSkip ? 'Skipped' : 'Sent'}
                </HoystText>
              </View>
              <HoystText tone={hasNote ? 'primary' : 'muted'}>
                {hasNote
                  ? note
                  : isSkip
                    ? 'No note added. Your grace skip still counts.'
                    : 'No note added. Your Tap In still counts.'}
              </HoystText>
              {route.params.photoUri ? (
                <Image
                  source={{uri: route.params.photoUri}}
                  style={styles.summaryImage}
                />
              ) : null}
            </View>

            <HoystButton label="Done" onPress={finish} />
          </Animated.View>
        </GlassPanel>
      </View>
    </HoystScreen>
  );
}

const styles = StyleSheet.create({
  content: {
    justifyContent: 'center',
    minHeight: '100%',
    paddingBottom: 24,
    paddingTop: 24,
  },
  screenFrame: {
    width: '100%',
  },
  closeButton: {
    alignItems: 'center',
    borderRadius: 16,
    borderWidth: 1,
    height: 34,
    justifyContent: 'center',
    position: 'absolute',
    right: 0,
    top: -48,
    zIndex: 2,
    width: 34,
  },
  panel: {
    width: '100%',
  },
  iconWrap: {
    alignItems: 'center',
    alignSelf: 'center',
    justifyContent: 'center',
    marginBottom: 4,
    minHeight: 104,
    width: 136,
  },
  celebrationStack: {
    gap: 14,
  },
  sparkle: {
    position: 'absolute',
  },
  titleBlock: {
    gap: 8,
  },
  centerText: {
    textAlign: 'center',
  },
  completeTitle: {
    fontSize: 28,
    letterSpacing: 0,
    lineHeight: 31,
    textAlign: 'center',
  },
  summaryCard: {
    borderRadius: radius.md,
    borderWidth: 1,
    gap: 12,
    padding: 14,
  },
  summaryHeader: {
    alignItems: 'flex-start',
    flexDirection: 'row',
    gap: 12,
    justifyContent: 'space-between',
  },
  summaryCopy: {
    flex: 1,
    gap: 6,
    minWidth: 0,
  },
  summaryTitle: {
    fontSize: 18,
    fontWeight: '800',
    letterSpacing: 0,
    lineHeight: 22,
  },
  summaryImage: {
    borderRadius: radius.md,
    height: 168,
    width: '100%',
  },
});
