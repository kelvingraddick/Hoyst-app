import React, {useEffect, useMemo, useRef, useState} from 'react';
import {
  AccessibilityInfo,
  Alert,
  Animated,
  Easing,
  Image,
  InteractionManager,
  StyleSheet,
  View,
} from 'react-native';
import {Share2, Sparkles} from 'lucide-react-native';
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
import {
  TapInStoryShareCard,
  tapInStoryShareCardSize,
} from '../components/TapInStoryShareCard';
import {
  buildTapInStoryShareData,
  canShareTapInStory,
  shareTapInStoryImage,
} from '../services/tap-in-story-share';

type Props = NativeStackScreenProps<RootStackParamList, 'TapInComplete'>;

type SparkleConfig = {
  bottom?: number;
  left?: number;
  right?: number;
  rotation: number;
  size: number;
  travelX: number;
  travelY: number;
  top?: number;
};

type CompletionDetailSnapshot = Pick<
  CircleDetailModel,
  'commitment' | 'title'
> &
  Partial<
    Pick<CircleDetailModel, 'inviteUrl' | 'progressLabel' | 'streakLabel'>
  >;

const sparkleConfigs: SparkleConfig[] = [
  {left: 18, rotation: 38, size: 18, top: 14, travelX: 16, travelY: -42},
  {right: 28, rotation: -28, size: 22, top: 34, travelX: -22, travelY: -38},
  {left: 124, rotation: 48, size: 15, top: 78, travelX: 12, travelY: -32},
  {right: 112, rotation: -44, size: 17, top: 118, travelX: -18, travelY: -40},
  {left: 36, rotation: -24, size: 21, top: 182, travelX: 26, travelY: -54},
  {right: 46, rotation: 36, size: 16, top: 218, travelX: -28, travelY: -46},
  {left: 92, rotation: 32, size: 13, top: 292, travelX: 20, travelY: -36},
  {right: 88, rotation: -36, size: 20, top: 330, travelX: -18, travelY: -50},
  {bottom: 246, left: 24, rotation: 42, size: 16, travelX: 22, travelY: -34},
  {bottom: 214, right: 26, rotation: -30, size: 23, travelX: -24, travelY: -48},
  {bottom: 152, left: 118, rotation: -40, size: 14, travelX: 16, travelY: -32},
  {bottom: 126, right: 132, rotation: 34, size: 18, travelX: -12, travelY: -38},
  {bottom: 76, left: 44, rotation: 28, size: 21, travelX: 30, travelY: -42},
  {bottom: 58, right: 52, rotation: -48, size: 16, travelX: -24, travelY: -36},
  {bottom: 18, left: 142, rotation: 44, size: 18, travelX: 18, travelY: -40},
  {bottom: 16, right: 148, rotation: -34, size: 14, travelX: -16, travelY: -32},
];

function cleanOptionalText(value?: string) {
  const trimmed = value?.trim();
  return trimmed && trimmed.length > 0 ? trimmed : undefined;
}

export function TapInCompleteScreen({
  navigation,
  route,
}: Props): React.JSX.Element {
  const theme = useHoystTheme();
  const haloProgress = useRef(new Animated.Value(0)).current;
  const ringProgress = useRef(new Animated.Value(0)).current;
  const ringBreathProgress = useRef(new Animated.Value(0)).current;
  const ringSpinProgress = useRef(new Animated.Value(0)).current;
  const contentProgress = useRef(new Animated.Value(0)).current;
  const storyCardRef = useRef<View>(null);
  const sparkleProgresses = useRef(
    sparkleConfigs.map(() => new Animated.Value(0)),
  ).current;
  const [detail, setDetail] = useState<CircleDetailModel | undefined>();
  const [hasLaidOut, setHasLaidOut] = useState(false);
  const [hasSettledNavigation, setHasSettledNavigation] = useState(false);
  const [hasResolvedDetail, setHasResolvedDetail] = useState(false);
  const [isSharingStory, setIsSharingStory] = useState(false);
  const [isStoryPhotoSettled, setIsStoryPhotoSettled] = useState(false);
  const profile = useUserProfileStore(state => state.profile);
  const status = useSessionStore(state => state.status);
  const user = useSessionStore(state => state.user);
  const timezone = profile?.timezone ?? 'UTC';
  const canLoadDetail = status === 'authenticatedReady' && Boolean(user?.uid);
  const note = route.params.note?.trim();
  const hasNote = Boolean(note);
  const isSkip = route.params.status === 'skip';
  const snapshotDetail = useMemo<CompletionDetailSnapshot | undefined>(() => {
    const title = cleanOptionalText(route.params.circleTitle);
    const commitment = cleanOptionalText(route.params.commitment);
    const progressLabel = cleanOptionalText(route.params.progressLabel);
    const streakLabel = cleanOptionalText(route.params.streakLabel);
    const inviteUrl = cleanOptionalText(route.params.inviteUrl);

    if (!title && !commitment && !progressLabel && !streakLabel && !inviteUrl) {
      return undefined;
    }

    return {
      commitment: commitment ?? "Today's Tap In",
      ...(inviteUrl ? {inviteUrl} : {}),
      ...(progressLabel ? {progressLabel} : {}),
      ...(streakLabel ? {streakLabel} : {}),
      title: title ?? 'Hoyst Circle',
    };
  }, [
    route.params.circleTitle,
    route.params.commitment,
    route.params.inviteUrl,
    route.params.progressLabel,
    route.params.streakLabel,
  ]);
  const displayDetail = detail ?? snapshotDetail;
  const hasCompletionContent = hasResolvedDetail || Boolean(snapshotDetail);
  const isReadyForCelebration =
    hasLaidOut && hasSettledNavigation && hasCompletionContent;
  const canShowStoryShare = canShareTapInStory(route.params.status);
  const storyData = useMemo(
    () =>
      buildTapInStoryShareData({
        detail: displayDetail,
        note,
        photoUri: route.params.photoUri,
      }),
    [displayDetail, note, route.params.photoUri],
  );
  const canGenerateStory =
    isReadyForCelebration && (!storyData.photoUri || isStoryPhotoSettled);

  useEffect(() => {
    setIsStoryPhotoSettled(!storyData.photoUri);
  }, [storyData.photoUri]);

  useEffect(() => {
    setHasResolvedDetail(false);

    if (!canLoadDetail || !user?.uid) {
      setDetail(undefined);
      setHasResolvedDetail(true);
      return undefined;
    }

    return subscribeToMemberCircleDetail({
      circleId: route.params.circleId,
      onDetail: nextDetail => {
        setDetail(nextDetail);
        setHasResolvedDetail(true);
      },
      onError: () => {
        setDetail(undefined);
        setHasResolvedDetail(true);
      },
      timezone,
      uid: user.uid,
    });
  }, [canLoadDetail, route.params.circleId, timezone, user?.uid]);

  useEffect(() => {
    let isMounted = true;
    setHasSettledNavigation(false);

    const interactionTask = InteractionManager.runAfterInteractions(() => {
      if (isMounted) {
        setHasSettledNavigation(true);
      }
    });

    return () => {
      isMounted = false;
      interactionTask.cancel();
    };
  }, [route.params.circleId]);

  useEffect(() => {
    let isMounted = true;
    let entranceAnimation: Animated.CompositeAnimation | undefined;

    haloProgress.setValue(0);
    ringProgress.setValue(0);
    ringBreathProgress.setValue(0);
    ringSpinProgress.setValue(0);
    contentProgress.setValue(0);
    sparkleProgresses.forEach(progress => progress.setValue(0));

    if (!isReadyForCelebration) {
      return () => {
        isMounted = false;
        entranceAnimation?.stop();
      };
    }

    AccessibilityInfo.isReduceMotionEnabled()
      .then(reduceMotionEnabled => {
        if (!isMounted) {
          return;
        }

        if (reduceMotionEnabled) {
          haloProgress.setValue(1);
          ringProgress.setValue(1);
          ringBreathProgress.setValue(1);
          ringSpinProgress.setValue(1);
          contentProgress.setValue(1);
          sparkleProgresses.forEach(progress => progress.setValue(1));
          return;
        }

        entranceAnimation = Animated.sequence([
          Animated.delay(160),
          Animated.parallel([
            Animated.timing(haloProgress, {
              duration: 3000,
              easing: Easing.out(Easing.cubic),
              toValue: 1,
              useNativeDriver: true,
            }),
            Animated.sequence([
              Animated.timing(ringProgress, {
                duration: 520,
                easing: Easing.out(Easing.back(1.35)),
                toValue: 1,
                useNativeDriver: true,
              }),
              Animated.timing(ringBreathProgress, {
                duration: 2480,
                easing: Easing.inOut(Easing.sin),
                toValue: 1,
                useNativeDriver: true,
              }),
            ]),
            Animated.sequence([
              Animated.timing(ringSpinProgress, {
                duration: 640,
                easing: Easing.in(Easing.cubic),
                toValue: 0.42,
                useNativeDriver: true,
              }),
              Animated.timing(ringSpinProgress, {
                duration: 2360,
                easing: Easing.out(Easing.cubic),
                toValue: 1,
                useNativeDriver: true,
              }),
            ]),
            Animated.timing(contentProgress, {
              delay: 780,
              duration: 640,
              easing: Easing.out(Easing.cubic),
              toValue: 1,
              useNativeDriver: true,
            }),
            Animated.stagger(
              70,
              sparkleProgresses.map(progress =>
                Animated.timing(progress, {
                  delay: 280,
                  duration: isSkip ? 2300 : 2500,
                  easing: Easing.out(Easing.cubic),
                  toValue: 1,
                  useNativeDriver: true,
                }),
              ),
            ),
          ]),
        ]);

        entranceAnimation.start();
      })
      .catch(() => {
        haloProgress.setValue(1);
        ringProgress.setValue(1);
        ringBreathProgress.setValue(1);
        ringSpinProgress.setValue(1);
        contentProgress.setValue(1);
        sparkleProgresses.forEach(progress => progress.setValue(1));
      });

    return () => {
      isMounted = false;
      entranceAnimation?.stop();
    };
  }, [
    contentProgress,
    haloProgress,
    isReadyForCelebration,
    isSkip,
    ringBreathProgress,
    ringProgress,
    ringSpinProgress,
    sparkleProgresses,
  ]);

  const finish = () => {
    if (navigation.canGoBack()) {
      navigation.goBack();
      return;
    }

    navigation.replace('MainTabs', {screen: 'Home'});
  };
  const shareStory = async () => {
    if (!storyCardRef.current || !canGenerateStory) {
      Alert.alert(
        'Story is getting ready',
        'Give the image one more moment, then try sharing again.',
      );
      return;
    }

    setIsSharingStory(true);
    try {
      await shareTapInStoryImage(storyCardRef, storyData.shareMessage);
    } catch (error) {
      const message =
        (error as {message?: string}).message ??
        'The story image could not be shared. Try again in a moment.';
      Alert.alert('Could not share story', message);
    } finally {
      setIsSharingStory(false);
    }
  };
  const commitment = hasCompletionContent
    ? displayDetail?.commitment ?? "Today's Tap In"
    : 'Loading Tap In details';
  const headerTitle = isReadyForCelebration
    ? isSkip
      ? 'Skip Recorded'
      : 'Tap In Complete'
    : 'Finalizing Tap In';
  const statusLabel = isSkip ? 'Skip recorded' : 'Update sent';
  const loadingCopy = hasCompletionContent
    ? 'Getting the screen ready.'
    : 'Loading your circle.';
  const sparkleColors = [
    theme.success,
    theme.warning,
    theme.accentSecondary,
    theme.accentTertiary,
    theme.accentWarmSoft,
  ];
  const haloAnimatedStyle = {
    opacity: haloProgress.interpolate({
      inputRange: [0, 0.18, 0.6, 1],
      outputRange: [0, isSkip ? 0.22 : 0.34, isSkip ? 0.1 : 0.18, 0],
    }),
    transform: [
      {
        scale: haloProgress.interpolate({
          inputRange: [0, 0.35, 0.7, 1],
          outputRange: [0.54, 1.28, 1.06, 1.42],
        }),
      },
    ],
  };
  const ringAnimatedStyle = {
    opacity: isReadyForCelebration ? ringProgress : 0.42,
    transform: [
      {
        scale: isReadyForCelebration
          ? ringProgress.interpolate({
              inputRange: [0, 0.72, 1],
              outputRange: [isSkip ? 0.84 : 0.68, isSkip ? 1.05 : 1.18, 1],
            })
          : 1,
      },
      {
        scale: isReadyForCelebration
          ? ringBreathProgress.interpolate({
              inputRange: [0, 0.48, 1],
              outputRange: [1, isSkip ? 1.03 : 1.07, 1],
            })
          : 1,
      },
    ],
  };
  const ringSpinAnimatedStyle = {
    transform: [
      {
        rotate: ringSpinProgress.interpolate({
          inputRange: [0, 0.42, 1],
          outputRange: ['0deg', '720deg', '1440deg'],
        }),
      },
    ],
  };
  const contentAnimatedStyle = isReadyForCelebration
    ? {
        opacity: contentProgress,
        transform: [
          {
            translateY: contentProgress.interpolate({
              inputRange: [0, 1],
              outputRange: [12, 0],
            }),
          },
        ],
      }
    : {
        opacity: 1,
        transform: [{translateY: 0}],
      };

  return (
    <HoystScreen contentContainerStyle={styles.content}>
      <View
        onLayout={() => {
          setHasLaidOut(true);
        }}
        style={styles.screenFrame}>
        {canShowStoryShare ? (
          <View pointerEvents="none" style={styles.captureLayer}>
            <View
              collapsable={false}
              ref={storyCardRef}
              style={styles.captureCard}>
              <TapInStoryShareCard
                onPhotoSettled={() => {
                  setIsStoryPhotoSettled(true);
                }}
                story={storyData}
              />
            </View>
          </View>
        ) : null}

        <View pointerEvents="none" style={styles.screenSparkleLayer}>
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
                inputRange: [0, 0.16, 0.72, 1],
                outputRange: [0, 1, 0.68, 0],
              }),
              transform: [
                {
                  scale: progress.interpolate({
                    inputRange: [0, 0.24, 0.7, 1],
                    outputRange: [0.34, 1.32, 0.92, 0.68],
                  }),
                },
                {
                  translateX: progress.interpolate({
                    inputRange: [0, 1],
                    outputRange: [0, sparkle.travelX],
                  }),
                },
                {
                  translateY: progress.interpolate({
                    inputRange: [0, 1],
                    outputRange: [18, sparkle.travelY],
                  }),
                },
                {
                  rotate: progress.interpolate({
                    inputRange: [0, 1],
                    outputRange: ['-18deg', `${sparkle.rotation}deg`],
                  }),
                },
              ],
            };

            return (
              <Animated.View
                key={index}
                pointerEvents="none"
                style={[styles.sparkle, sparklePositionStyle, sparkleStyle]}>
                <Sparkles
                  color={sparkleColors[index % sparkleColors.length]}
                  size={sparkle.size}
                  strokeWidth={2.2}
                />
              </Animated.View>
            );
          })}
        </View>

        <GlassPanel style={styles.panel}>
          <Animated.View style={[styles.iconWrap, ringAnimatedStyle]}>
            <Animated.View
              pointerEvents="none"
              style={[
                styles.halo,
                {
                  backgroundColor: isSkip
                    ? `${theme.warning}24`
                    : `${theme.success}24`,
                  borderColor: isSkip
                    ? theme.warningForeground
                    : theme.successForeground,
                },
                haloAnimatedStyle,
              ]}
            />
            <Animated.View style={ringSpinAnimatedStyle}>
              <TapInRingMark
                centerTreatment="state"
                innerSize={52}
                outerSize={92}
                showTrail={false}
                state={isSkip ? 'atRisk' : 'streak'}
              />
            </Animated.View>
          </Animated.View>

          <Animated.View
            style={[styles.celebrationStack, contentAnimatedStyle]}>
            <View style={styles.titleBlock}>
              <HoystText style={styles.completeTitle} variant="headline">
                {headerTitle}
              </HoystText>
              {isReadyForCelebration ? (
                <View
                  style={[
                    styles.statusBlock,
                    {
                      backgroundColor: isSkip
                        ? `${theme.warning}14`
                        : `${theme.success}14`,
                      borderColor: isSkip
                        ? `${theme.warningForeground}55`
                        : `${theme.successForeground}55`,
                    },
                  ]}>
                  <HoystText
                    style={{
                      color: isSkip
                        ? theme.warningForeground
                        : theme.successForeground,
                    }}
                    variant="caption">
                    {statusLabel}
                  </HoystText>
                </View>
              ) : (
                <HoystText style={styles.centerText} tone="muted">
                  {loadingCopy}
                </HoystText>
              )}
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
                    Circle Commitment
                  </HoystText>
                  <HoystText style={styles.summaryTitle}>
                    {commitment}
                  </HoystText>
                </View>
                <HoystText
                  style={{color: theme.successForeground}}
                  variant="caption">
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

            <View style={styles.actionStack}>
              {canShowStoryShare ? (
                <HoystButton
                  disabled={!canGenerateStory || isSharingStory}
                  icon={
                    <Share2
                      color={
                        canGenerateStory && !isSharingStory
                          ? theme.text
                          : theme.textMuted
                      }
                      size={18}
                      strokeWidth={2.3}
                    />
                  }
                  label={isSharingStory ? 'Preparing Story...' : 'Share Story'}
                  onPress={() => {
                    shareStory().catch(() => undefined);
                  }}
                  variant="outline"
                />
              ) : null}
              <HoystButton label="Done" onPress={finish} />
            </View>
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
    justifyContent: 'center',
    minHeight: '100%',
    overflow: 'visible',
    width: '100%',
  },
  panel: {
    width: '100%',
    zIndex: 2,
  },
  iconWrap: {
    alignItems: 'center',
    alignSelf: 'center',
    justifyContent: 'center',
    marginBottom: 4,
    minHeight: 104,
    width: 136,
  },
  halo: {
    borderRadius: 59,
    borderWidth: 1,
    height: 118,
    position: 'absolute',
    width: 118,
  },
  celebrationStack: {
    gap: 14,
  },
  actionStack: {
    gap: 10,
  },
  captureCard: {
    height: tapInStoryShareCardSize.height,
    width: tapInStoryShareCardSize.width,
  },
  captureLayer: {
    height: tapInStoryShareCardSize.height,
    left: -1200,
    position: 'absolute',
    top: 0,
    width: tapInStoryShareCardSize.width,
  },
  screenSparkleLayer: {
    bottom: -24,
    left: -18,
    overflow: 'hidden',
    position: 'absolute',
    right: -18,
    top: -24,
    zIndex: 1,
  },
  sparkle: {
    position: 'absolute',
  },
  titleBlock: {
    alignItems: 'center',
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
  statusBlock: {
    alignItems: 'center',
    alignSelf: 'center',
    borderRadius: radius.pill,
    borderWidth: 1,
    marginTop: 8,
    paddingHorizontal: 12,
    paddingVertical: 7,
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
