import React, {useCallback, useEffect, useMemo, useRef, useState} from 'react';
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
import {Flame, Share2} from 'lucide-react-native';
import type {NativeStackScreenProps} from '@react-navigation/native-stack';

import {FrostedBackdrop} from '../../../design/components/FrostedBackdrop';
import {CommitmentTypePill} from '../../../design/components/CommitmentTypeVisual';
import {HoystButton} from '../../../design/components/HoystButton';
import {HoystScreen} from '../../../design/components/HoystScreen';
import {HoystText} from '../../../design/components/HoystText';
import {HoystTapInMark} from '../../../design/components/HoystTapInMark';
import {radius} from '../../../design/tokens/radius';
import {useHoystTheme} from '../../../design/theme/useHoystTheme';
import type {RootStackParamList} from '../../../navigation/types';
import type {
  CheckInCoverageStatus,
  CircleDetailModel,
  CommitmentType,
} from '../../../types/models';
import {useUserProfileStore} from '../../../store/profile-store';
import {useSessionStore} from '../../../store/session-store';
import {subscribeToMemberCircleDetail} from '../../home/services/home-data-service';
import {
  formatQuantityLabel,
  formatQuantityValue,
} from '../../commitments/commitment-logic';
import {canShareTapInStory} from '../services/tap-in-story-share';
import {
  TapInDetailsSection,
  type SavedTapInDetails,
} from '../components/TapInDetailsSection';

type Props = NativeStackScreenProps<RootStackParamList, 'TapInComplete'>;

type ParticleConfig = {
  left?: number;
  right?: number;
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
    Pick<
      CircleDetailModel,
      | 'inviteUrl'
      | 'memberCount'
      | 'periodTapInCount'
      | 'progressLabel'
      | 'streakDays'
      | 'streakLabel'
    >
  >;

const particleConfigs: ParticleConfig[] = [
  {left: 32, size: 14, top: 56, travelX: -58, travelY: -48},
  {right: 34, size: 12, top: 72, travelX: 54, travelY: -42},
  {left: 48, size: 9, top: 146, travelX: -42, travelY: 48},
  {right: 52, size: 10, top: 156, travelX: 46, travelY: 52},
  {left: 108, size: 11, top: 28, travelX: -16, travelY: -66},
  {right: 106, size: 7, top: 184, travelX: 22, travelY: 62},
];

const completionMarkSize = 112;
const completionMarkStageSize = 190;

function cleanOptionalText(value?: string) {
  const trimmed = value?.trim();
  return trimmed && trimmed.length > 0 ? trimmed : undefined;
}

function isRemotePhoto(value?: string) {
  return Boolean(value && /^https?:\/\//i.test(value));
}

function formatDayCount(value: number) {
  return `${value} ${value === 1 ? 'day' : 'days'}`;
}

function cleanQuantityValue(value?: number) {
  return typeof value === 'number' && Number.isFinite(value)
    ? Math.max(0, Math.round(value))
    : undefined;
}

function getQuantityCoverageStatus({
  coverageStatus,
  status,
}: {
  coverageStatus?: CheckInCoverageStatus;
  status?: RootStackParamList['TapInComplete']['status'];
}): CheckInCoverageStatus | undefined {
  if (coverageStatus) {
    return coverageStatus;
  }

  if (status === 'partial' || status === 'failed') {
    return status;
  }

  if (status === 'done') {
    return 'covered';
  }

  return undefined;
}

function getQuantityOutcomeCopy({
  commitmentType,
  coverageStatus,
}: {
  commitmentType?: CommitmentType;
  coverageStatus?: CheckInCoverageStatus;
}) {
  if (!commitmentType || commitmentType === 'avoid' || !coverageStatus) {
    return undefined;
  }

  if (coverageStatus === 'failed') {
    return {
      headerTitle: 'Tap In Saved',
      lead: 'Outside range',
      trailing: undefined,
    };
  }

  if (coverageStatus === 'partial') {
    return {
      headerTitle: 'Progress Saved',
      lead: 'Keep building',
      trailing: undefined,
    };
  }

  return {
    headerTitle: 'Tap In Complete',
    lead: commitmentType === 'limit' ? 'Within range' : 'Goal covered',
    trailing: undefined,
  };
}

function getQuantityContextCopy({
  commitmentType,
  maximumValue,
  minimumValue,
  targetValue,
  unitLabel,
}: {
  commitmentType?: CommitmentType;
  maximumValue?: number;
  minimumValue?: number;
  targetValue?: number;
  unitLabel: string;
}) {
  const cleanMaximum = cleanQuantityValue(maximumValue);
  const cleanMinimum = cleanQuantityValue(minimumValue);
  const cleanTarget = cleanQuantityValue(targetValue);

  if (commitmentType === 'limit' && typeof cleanMaximum === 'number') {
    if (typeof cleanMinimum === 'number') {
      return `Range ${formatQuantityValue(
        cleanMinimum,
      )} to ${formatQuantityLabel(cleanMaximum, unitLabel)}`;
    }

    return `Max ${formatQuantityLabel(cleanMaximum, unitLabel)}`;
  }

  if (commitmentType === 'build' && typeof cleanTarget === 'number') {
    return `Goal ${formatQuantityLabel(cleanTarget, unitLabel)}`;
  }

  return undefined;
}

function getStatusCopy({
  isSkip,
  momentum,
  streakLabel,
}: {
  isSkip: boolean;
  momentum?: RootStackParamList['TapInComplete']['completionMomentum'];
  streakLabel?: string;
}) {
  if (isSkip) {
    const currentStreak = momentum?.currentStreak ?? 0;

    return {
      lead: 'Grace skip used',
      trailing:
        currentStreak > 0
          ? `${formatDayCount(currentStreak)} streak held`
          : 'streak held',
    };
  }

  if (momentum) {
    const currentStreak = Math.max(0, momentum.currentStreak);
    const streakDelta = Math.max(0, momentum.streakDelta);

    return {
      lead:
        streakDelta > 0
          ? `+${formatDayCount(streakDelta)} streak`
          : currentStreak > 0
          ? 'Streak held'
          : 'Momentum saved',
      trailing: currentStreak > 0 ? `${currentStreak} now` : undefined,
    };
  }

  return {
    lead: cleanOptionalText(streakLabel) ?? 'Momentum saved',
    trailing: undefined,
  };
}

export function TapInCompleteScreen({
  navigation,
  route,
}: Props): React.JSX.Element {
  const theme = useHoystTheme();
  const haloProgress = useRef(new Animated.Value(0)).current;
  const logoProgress = useRef(new Animated.Value(0)).current;
  const logoSpinProgress = useRef(new Animated.Value(0)).current;
  const contentProgress = useRef(new Animated.Value(0)).current;
  const particleProgresses = useRef(
    particleConfigs.map(() => new Animated.Value(0)),
  ).current;
  const [detail, setDetail] = useState<CircleDetailModel | undefined>();
  const [hasLaidOut, setHasLaidOut] = useState(false);
  const [hasSettledNavigation, setHasSettledNavigation] = useState(false);
  const [hasResolvedDetail, setHasResolvedDetail] = useState(false);
  const [hasDirtyDetails, setHasDirtyDetails] = useState(false);
  const [pendingPhotoUri, setPendingPhotoUri] = useState<string | undefined>(
    isRemotePhoto(route.params.photoUri) ? undefined : route.params.photoUri,
  );
  const [savedDetails, setSavedDetails] = useState<SavedTapInDetails>(() => ({
    ...(route.params.note?.trim() ? {note: route.params.note.trim()} : {}),
    ...(isRemotePhoto(route.params.photoUri)
      ? {photoUrl: route.params.photoUri}
      : {}),
  }));
  const profile = useUserProfileStore(state => state.profile);
  const status = useSessionStore(state => state.status);
  const user = useSessionStore(state => state.user);
  const timezone = profile?.timezone ?? 'UTC';
  const canLoadDetail = status === 'authenticatedReady' && Boolean(user?.uid);
  const note = savedDetails.note?.trim();
  const hasNote = Boolean(note);
  const visiblePhotoUri = pendingPhotoUri ?? savedDetails.photoUrl;
  const isSkip = route.params.status === 'skip';
  const quantityValue = cleanQuantityValue(route.params.currentValue);
  const isQuantityCompletion =
    route.params.commitmentType !== undefined &&
    route.params.commitmentType !== 'avoid' &&
    typeof quantityValue === 'number';
  const quantityCoverageStatus = isQuantityCompletion
    ? getQuantityCoverageStatus({
        coverageStatus: route.params.coverageStatus,
        status: route.params.status,
      })
    : undefined;
  const quantityUnitLabel =
    route.params.unitLabel?.trim() || (isQuantityCompletion ? 'unit' : '');
  const quantitySummaryCopy =
    isQuantityCompletion && typeof quantityValue === 'number'
      ? `${formatQuantityLabel(quantityValue, quantityUnitLabel)} logged`
      : undefined;
  const quantityContextCopy = isQuantityCompletion
    ? getQuantityContextCopy({
        commitmentType: route.params.commitmentType,
        maximumValue: route.params.maximumValue,
        minimumValue: route.params.minimumValue,
        targetValue: route.params.targetValue,
        unitLabel: quantityUnitLabel,
      })
    : undefined;
  const quantityOutcomeCopy = isQuantityCompletion
    ? getQuantityOutcomeCopy({
        commitmentType: route.params.commitmentType,
        coverageStatus: quantityCoverageStatus,
      })
    : undefined;
  const completionTone = isSkip
    ? 'skip'
    : quantityCoverageStatus === 'failed'
    ? 'failed'
    : quantityCoverageStatus === 'partial'
    ? 'partial'
    : 'covered';
  const snapshotDetail = useMemo<CompletionDetailSnapshot | undefined>(() => {
    const title = cleanOptionalText(route.params.circleTitle);
    const commitment = cleanOptionalText(route.params.commitment);
    const progressLabel = cleanOptionalText(route.params.progressLabel);
    const streakLabel = cleanOptionalText(route.params.streakLabel);
    const inviteUrl = cleanOptionalText(route.params.inviteUrl);
    const memberCount = route.params.memberCount;
    const periodTapInCount = route.params.periodTapInCount;
    const streakDays = route.params.streakDays;

    if (
      !title &&
      !commitment &&
      !progressLabel &&
      !streakLabel &&
      !inviteUrl &&
      typeof memberCount !== 'number' &&
      typeof periodTapInCount !== 'number' &&
      typeof streakDays !== 'number'
    ) {
      return undefined;
    }

    return {
      commitment: commitment ?? "Today's Tap In",
      ...(inviteUrl ? {inviteUrl} : {}),
      ...(typeof memberCount === 'number' ? {memberCount} : {}),
      ...(typeof periodTapInCount === 'number' ? {periodTapInCount} : {}),
      ...(progressLabel ? {progressLabel} : {}),
      ...(typeof streakDays === 'number' ? {streakDays} : {}),
      ...(streakLabel ? {streakLabel} : {}),
      title: title ?? 'Hoyst Circle',
    };
  }, [
    route.params.circleTitle,
    route.params.commitment,
    route.params.inviteUrl,
    route.params.memberCount,
    route.params.periodTapInCount,
    route.params.progressLabel,
    route.params.streakDays,
    route.params.streakLabel,
  ]);
  const displayDetail = detail ?? snapshotDetail;
  const hasCompletionContent = hasResolvedDetail || Boolean(snapshotDetail);
  const isReadyForCelebration =
    hasLaidOut && hasSettledNavigation && hasCompletionContent;
  const canShowStoryShare = canShareTapInStory(route.params.status);

  useEffect(() => {
    return navigation.addListener('beforeRemove', event => {
      if (!hasDirtyDetails) {
        return;
      }

      event.preventDefault();
      Alert.alert(
        'Discard detail changes?',
        'Your note or photo is not saved yet.',
        [
          {style: 'cancel', text: 'Keep editing'},
          {
            onPress: () => navigation.dispatch(event.data.action),
            style: 'destructive',
            text: 'Discard',
          },
        ],
      );
    });
  }, [hasDirtyDetails, navigation]);

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
    const viewerTodayCheckIn = detail?.viewerTodayCheckIn;

    if (!viewerTodayCheckIn || viewerTodayCheckIn.status === 'skip') {
      return;
    }

    setSavedDetails({
      ...(viewerTodayCheckIn.note?.trim()
        ? {note: viewerTodayCheckIn.note.trim()}
        : {}),
      ...(viewerTodayCheckIn.photoUrl
        ? {photoUrl: viewerTodayCheckIn.photoUrl}
        : {}),
    });
  }, [detail?.viewerTodayCheckIn]);

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
    logoProgress.setValue(0);
    logoSpinProgress.setValue(0);
    contentProgress.setValue(0);
    particleProgresses.forEach(progress => progress.setValue(0));

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
          logoProgress.setValue(1);
          logoSpinProgress.setValue(1);
          contentProgress.setValue(1);
          particleProgresses.forEach(progress => progress.setValue(1));
          return;
        }

        entranceAnimation = Animated.sequence([
          Animated.delay(120),
          Animated.parallel([
            Animated.timing(haloProgress, {
              duration: 3400,
              easing: Easing.out(Easing.cubic),
              toValue: 1,
              useNativeDriver: true,
            }),
            Animated.timing(logoProgress, {
              duration: 1000,
              easing: Easing.out(Easing.back(1.22)),
              toValue: 1,
              useNativeDriver: true,
            }),
            Animated.timing(logoSpinProgress, {
              duration: 1700,
              easing: Easing.out(Easing.cubic),
              toValue: 1,
              useNativeDriver: true,
            }),
            Animated.timing(contentProgress, {
              delay: 560,
              duration: 560,
              easing: Easing.out(Easing.cubic),
              toValue: 1,
              useNativeDriver: true,
            }),
            Animated.stagger(
              90,
              particleProgresses.map(progress =>
                Animated.timing(progress, {
                  delay: 140,
                  duration: isSkip ? 2600 : 2900,
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
        logoProgress.setValue(1);
        logoSpinProgress.setValue(1);
        contentProgress.setValue(1);
        particleProgresses.forEach(progress => progress.setValue(1));
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
    logoProgress,
    logoSpinProgress,
    particleProgresses,
  ]);

  const finish = () => {
    if (navigation.canGoBack()) {
      navigation.goBack();
      return;
    }

    navigation.replace('MainTabs', {screen: 'Home'});
  };
  const handleDetailsSaved = useCallback((details: SavedTapInDetails) => {
    setSavedDetails(details);
    setPendingPhotoUri(undefined);
  }, []);
  const shareStory = () => {
    navigation.navigate('TapInStoryShare', {
      circleId: route.params.circleId,
      circleTitle: displayDetail?.title ?? route.params.circleTitle,
      commitment: displayDetail?.commitment ?? route.params.commitment,
      inviteUrl: displayDetail?.inviteUrl ?? route.params.inviteUrl,
      memberCount: displayDetail?.memberCount ?? route.params.memberCount,
      periodTapInCount:
        displayDetail?.periodTapInCount ?? route.params.periodTapInCount,
      progressLabel: displayDetail?.progressLabel ?? route.params.progressLabel,
      source: route.params.source,
      streakDays: displayDetail?.streakDays ?? route.params.streakDays,
      streakLabel: displayDetail?.streakLabel ?? route.params.streakLabel,
      note: savedDetails.note,
      photoUri: visiblePhotoUri,
    });
  };
  const commitment = hasCompletionContent
    ? displayDetail?.commitment ?? "Today's Tap In"
    : 'Loading Tap In details';
  const headerTitle = isReadyForCelebration
    ? isSkip
      ? 'Skip Recorded'
      : quantityOutcomeCopy
      ? quantityOutcomeCopy.headerTitle
      : 'Tap In Complete'
    : 'Finalizing Tap In';
  const loadingCopy = hasCompletionContent
    ? 'Getting the screen ready.'
    : 'Loading your circle.';
  const statusCopy =
    quantityOutcomeCopy ??
    getStatusCopy({
      isSkip,
      momentum: route.params.completionMomentum,
      streakLabel: displayDetail?.streakLabel,
    });
  const particleColors =
    completionTone === 'failed'
      ? [
          theme.danger,
          theme.warning,
          theme.accentSecondary,
          theme.accentTertiary,
        ]
      : completionTone === 'skip' || completionTone === 'partial'
      ? [
          theme.warning,
          theme.accentWarmSoft,
          theme.accentSecondary,
          theme.accentTertiary,
        ]
      : [
          theme.success,
          theme.accentSecondary,
          theme.accentTertiary,
          theme.accent,
        ];
  const outcomeBackgroundColor =
    completionTone === 'failed'
      ? theme.danger
      : completionTone === 'skip' || completionTone === 'partial'
      ? theme.warning
      : theme.success;
  const outcomeForegroundColor =
    completionTone === 'failed'
      ? theme.dangerForeground
      : completionTone === 'skip' || completionTone === 'partial'
      ? theme.warningForeground
      : theme.successForeground;
  const statusIconColor =
    completionTone === 'covered'
      ? theme.accentWarmSoft
      : outcomeForegroundColor;
  const statusLeadColor =
    completionTone === 'covered'
      ? theme.isDark
        ? theme.textMuted
        : '#8F8CB2'
      : outcomeForegroundColor;
  const statusDotColor =
    completionTone === 'covered' ? theme.accentWarm : outcomeForegroundColor;
  const statusTrailingColor =
    completionTone === 'covered'
      ? theme.accentWarmForeground
      : outcomeForegroundColor;
  const emptyNoteCopy = isSkip
    ? 'No note added. Your grace skip still counts.'
    : quantityCoverageStatus === 'failed'
    ? 'No note added. Your Tap In was saved.'
    : quantityCoverageStatus === 'partial'
    ? 'No note added. Your progress was saved.'
    : 'No note added. Your Tap In still counts.';
  const haloAnimatedStyle = {
    opacity: haloProgress.interpolate({
      inputRange: [0, 0.18, 0.6, 1],
      outputRange: [0, isSkip ? 0.22 : 0.3, isSkip ? 0.1 : 0.16, 0],
    }),
    transform: [
      {
        scale: haloProgress.interpolate({
          inputRange: [0, 0.35, 0.7, 1],
          outputRange: [0.58, 1.18, 1.04, 1.34],
        }),
      },
    ],
  };
  const logoAnimatedStyle = {
    opacity: isReadyForCelebration ? logoProgress : 0.46,
    transform: [
      {
        scale: isReadyForCelebration
          ? logoProgress.interpolate({
              inputRange: [0, 0.72, 1],
              outputRange: [0.72, 1.08, 1],
            })
          : 1,
      },
    ],
  };
  const logoRotation = logoSpinProgress.interpolate({
    inputRange: [0, 1],
    outputRange: ['-720deg', '0deg'],
  });
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
    <HoystScreen
      background={<FrostedBackdrop />}
      contentContainerStyle={styles.content}>
      <View
        onLayout={() => {
          setHasLaidOut(true);
        }}
        style={styles.screenFrame}>
        <View style={styles.mainStack}>
          <View style={styles.heroStack}>
            <View style={styles.markStage}>
              <Animated.View
                pointerEvents="none"
                style={[
                  styles.halo,
                  {
                    backgroundColor: `${outcomeBackgroundColor}20`,
                    borderColor: `${outcomeForegroundColor}36`,
                  },
                  haloAnimatedStyle,
                ]}
              />
              <View pointerEvents="none" style={styles.markParticleLayer}>
                {particleConfigs.map((particle, index) => {
                  const progress = particleProgresses[index];
                  const particlePositionStyle = {
                    left: particle.left,
                    right: particle.right,
                    top: particle.top,
                  };
                  const particleStyle = {
                    backgroundColor:
                      particleColors[index % particleColors.length],
                    height: particle.size,
                    opacity: progress.interpolate({
                      inputRange: [0, 0.18, 0.74, 1],
                      outputRange: [0, 1, 0.92, 0],
                    }),
                    transform: [
                      {
                        scale: progress.interpolate({
                          inputRange: [0, 0.28, 1],
                          outputRange: [0.56, 1.72, 0.84],
                        }),
                      },
                      {
                        translateX: progress.interpolate({
                          inputRange: [0, 1],
                          outputRange: [0, particle.travelX],
                        }),
                      },
                      {
                        translateY: progress.interpolate({
                          inputRange: [0, 1],
                          outputRange: [0, particle.travelY],
                        }),
                      },
                    ],
                    width: particle.size,
                  };

                  return (
                    <Animated.View
                      key={index}
                      pointerEvents="none"
                      style={[
                        styles.particle,
                        particlePositionStyle,
                        particleStyle,
                      ]}
                    />
                  );
                })}
              </View>
              <Animated.View
                style={[styles.logoWrap, logoAnimatedStyle]}
                testID="tap-in-complete-logo-wrap">
                <HoystTapInMark
                  logoRotation={logoRotation}
                  size={completionMarkSize}
                  testID="tap-in-complete-logo"
                />
              </Animated.View>
            </View>

            <Animated.View style={[styles.titleBlock, contentAnimatedStyle]}>
              <HoystText
                numberOfLines={1}
                style={styles.completeTitle}
                variant="headline">
                {headerTitle}
              </HoystText>
              {isReadyForCelebration ? (
                <View style={styles.statusRow}>
                  <Flame color={statusIconColor} size={16} strokeWidth={2.7} />
                  <HoystText
                    numberOfLines={1}
                    style={[styles.statusLead, {color: statusLeadColor}]}>
                    {statusCopy.lead}
                  </HoystText>
                  {statusCopy.trailing ? (
                    <>
                      <View
                        style={[
                          styles.statusDot,
                          {backgroundColor: statusDotColor},
                        ]}
                      />
                      <HoystText
                        numberOfLines={1}
                        style={[
                          styles.statusTrailing,
                          {color: statusTrailingColor},
                        ]}>
                        {statusCopy.trailing}
                      </HoystText>
                    </>
                  ) : null}
                </View>
              ) : (
                <HoystText style={styles.centerText} tone="muted">
                  {loadingCopy}
                </HoystText>
              )}
            </Animated.View>
          </View>

          <Animated.View style={[styles.bodyStack, contentAnimatedStyle]}>
            <View
              style={[
                styles.summaryCard,
                {
                  backgroundColor: theme.isDark
                    ? 'rgba(17,20,32,0.76)'
                    : 'rgba(255,255,255,0.58)',
                  borderColor: theme.glassBorder,
                },
              ]}>
              <View style={styles.summaryHeader}>
                <HoystText tone="muted" variant="label">
                  Circle Commitment
                </HoystText>
                {route.params.commitmentType ? (
                  <CommitmentTypePill
                    commitmentType={route.params.commitmentType}
                    density="compact"
                    uppercase
                  />
                ) : null}
              </View>
              <HoystText numberOfLines={2} style={styles.summaryTitle}>
                {commitment}
              </HoystText>
              {quantitySummaryCopy ? (
                <View style={styles.quantitySummary}>
                  <HoystText
                    numberOfLines={1}
                    style={styles.quantitySummaryValue}>
                    {quantitySummaryCopy}
                  </HoystText>
                  {quantityContextCopy ? (
                    <HoystText tone="muted" variant="caption">
                      {quantityContextCopy}
                    </HoystText>
                  ) : null}
                </View>
              ) : null}
              <HoystText
                style={styles.summaryNote}
                tone={hasNote ? 'primary' : 'muted'}>
                {hasNote ? note : emptyNoteCopy}
              </HoystText>
              {visiblePhotoUri ? (
                <Image
                  resizeMode="cover"
                  source={{uri: visiblePhotoUri}}
                  style={styles.summaryImage}
                />
              ) : null}
            </View>

            {!isSkip ? (
              <TapInDetailsSection
                autoSaveInitialPhoto={Boolean(pendingPhotoUri)}
                circleId={route.params.circleId}
                dateKey={route.params.dateKey}
                initialNote={savedDetails.note}
                initialPhotoUrl={visiblePhotoUri}
                onDirtyChange={setHasDirtyDetails}
                onSaved={handleDetailsSaved}
              />
            ) : null}

            {canShowStoryShare ? (
              <HoystButton
                borderColor={
                  isReadyForCelebration
                    ? `${theme.accentSecondary}55`
                    : theme.borderStrong
                }
                backgroundColor={
                  theme.isDark
                    ? 'rgba(122,85,255,0.14)'
                    : 'rgba(122,85,255,0.12)'
                }
                disabled={!isReadyForCelebration}
                icon={
                  <Share2
                    color={
                      isReadyForCelebration
                        ? theme.accentSecondaryForeground
                        : theme.textMuted
                    }
                    size={19}
                    strokeWidth={2.45}
                  />
                }
                label="Share Story"
                onPress={shareStory}
                style={styles.shareButton}
                textColor={
                  isReadyForCelebration
                    ? theme.accentSecondaryForeground
                    : theme.textMuted
                }
                variant="outline"
              />
            ) : null}
          </Animated.View>
        </View>

        <View style={styles.bottomAction}>
          <HoystButton
            backgroundColor={theme.isDark ? theme.actionSurface : '#15171D'}
            borderColor="transparent"
            label="Done"
            onPress={finish}
            style={styles.doneButton}
            textColor="#FFFFFF"
          />
        </View>
      </View>
    </HoystScreen>
  );
}

const styles = StyleSheet.create({
  bodyStack: {
    alignSelf: 'stretch',
    gap: 18,
  },
  bottomAction: {
    alignSelf: 'stretch',
    paddingTop: 18,
  },
  centerText: {
    textAlign: 'center',
  },
  completeTitle: {
    fontSize: 28,
    fontWeight: '800',
    letterSpacing: 0,
    lineHeight: 32,
    textAlign: 'center',
  },
  content: {
    flexGrow: 1,
    minHeight: '100%',
    paddingBottom: 24,
    paddingTop: 8,
  },
  doneButton: {
    minHeight: 58,
  },
  halo: {
    borderRadius: 78,
    borderWidth: 1,
    height: 156,
    position: 'absolute',
    width: 156,
  },
  heroStack: {
    alignItems: 'center',
    gap: 16,
  },
  logoWrap: {
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 2,
  },
  mainStack: {
    alignSelf: 'stretch',
    flexGrow: 1,
    gap: 28,
    justifyContent: 'center',
    paddingBottom: 20,
    paddingTop: 56,
  },
  markParticleLayer: {
    height: completionMarkStageSize,
    overflow: 'visible',
    position: 'absolute',
    width: completionMarkStageSize,
    zIndex: 1,
  },
  markStage: {
    alignItems: 'center',
    height: completionMarkStageSize,
    justifyContent: 'center',
    overflow: 'visible',
    width: completionMarkStageSize,
  },
  particle: {
    borderRadius: radius.pill,
    position: 'absolute',
  },
  quantitySummary: {
    gap: 3,
  },
  quantitySummaryValue: {
    fontSize: 16,
    fontWeight: '800',
    letterSpacing: 0,
    lineHeight: 20,
  },
  screenFrame: {
    justifyContent: 'space-between',
    minHeight: '100%',
    overflow: 'visible',
    width: '100%',
  },
  shareButton: {
    minHeight: 58,
  },
  titleBlock: {
    alignItems: 'center',
    gap: 8,
  },
  statusDot: {
    borderRadius: radius.pill,
    height: 3,
    width: 3,
  },
  statusLead: {
    flexShrink: 1,
    fontSize: 15,
    fontWeight: '800',
    letterSpacing: 0,
    lineHeight: 19,
  },
  statusRow: {
    alignItems: 'center',
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    justifyContent: 'center',
    maxWidth: 320,
  },
  statusTrailing: {
    flexShrink: 1,
    fontSize: 15,
    fontWeight: '800',
    letterSpacing: 0,
    lineHeight: 19,
  },
  summaryCard: {
    borderRadius: radius.lg,
    borderWidth: 1,
    gap: 12,
    paddingHorizontal: 24,
    paddingVertical: 22,
  },
  summaryImage: {
    borderRadius: radius.md,
    height: 168,
    marginTop: 4,
    width: '100%',
  },
  summaryHeader: {
    alignItems: 'center',
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    justifyContent: 'space-between',
  },
  summaryNote: {
    fontSize: 14,
    fontWeight: '600',
    letterSpacing: 0,
    lineHeight: 19,
  },
  summaryTitle: {
    fontSize: 18,
    fontWeight: '800',
    letterSpacing: 0,
    lineHeight: 22,
  },
});
