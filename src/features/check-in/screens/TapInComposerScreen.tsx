import React, {useEffect, useMemo, useState} from 'react';
import {
  Alert,
  Image,
  Pressable,
  StyleSheet,
  View,
  useWindowDimensions,
} from 'react-native';
import {Flame, Minus, Plus, Share2, Trash2, X} from 'lucide-react-native';
import {launchCamera, launchImageLibrary} from 'react-native-image-picker';
import type {NativeStackScreenProps} from '@react-navigation/native-stack';
import {useSafeAreaInsets} from 'react-native-safe-area-context';

import {CircleCategoryPill} from '../../../design/components/CircleCategoryIcon';
import {CommitmentTypePill} from '../../../design/components/CommitmentTypeVisual';
import {FrostedBackdrop} from '../../../design/components/FrostedBackdrop';
import {GlassPanel} from '../../../design/components/GlassPanel';
import {HoystChip} from '../../../design/components/HoystChip';
import {HoystScreen} from '../../../design/components/HoystScreen';
import {HoystTapInMark} from '../../../design/components/HoystTapInMark';
import {HoystText} from '../../../design/components/HoystText';
import {PhotoPickerTile} from '../../../design/components/PhotoPickerTile';
import {TapInActionButton} from '../../../design/components/TapInActionButton';
import {actionMotion} from '../../../design/tokens/actions';
import {radius} from '../../../design/tokens/radius';
import {useHoystTheme} from '../../../design/theme/useHoystTheme';
import {triggerTapInSuccessHaptic} from '../../../lib/haptics/tap-in-haptics';
import {TAP_IN_SHEET_DETENTS} from '../../../navigation/tap-in-sheet-options';
import type {RootStackParamList} from '../../../navigation/types';
import {useUserProfileStore} from '../../../store/profile-store';
import {useSessionStore} from '../../../store/session-store';
import type {CheckInStatus, CircleDetailModel} from '../../../types/models';
import {
  formatQuantityLabel,
  formatQuantityValue,
  getCheckInStatusForCoverage,
  getCommitmentType,
  getCoverageStatusForValue,
  getQuantityConfig,
  isSingleTapInCommitment,
} from '../../commitments/commitment-logic';
import {subscribeToMemberCircleDetail} from '../../home/services/home-data-service';
import {TapInDetailsSection} from '../components/TapInDetailsSection';
import {removeTapIn, submitTapIn} from '../services/check-in-service';

type Props = NativeStackScreenProps<RootStackParamList, 'TapInComposer'>;

type TapInComposerActionFooterProps = {
  canSkip: boolean;
  disabled: boolean;
  label: string;
  onConfirm: () => void;
  onSkip: () => void;
  showSkip: boolean;
  skipLabel: string;
};

function TapInComposerActionFooter({
  canSkip,
  disabled,
  label,
  onConfirm,
  onSkip,
  showSkip,
  skipLabel,
}: TapInComposerActionFooterProps): React.JSX.Element {
  const theme = useHoystTheme();

  return (
    <View
      style={styles.actionFooter}
      testID="tap-in-composer-action-footer">
      <TapInActionButton
        disabled={disabled}
        emphasis="spectrumBreathing"
        label={label}
        onPress={disabled ? undefined : onConfirm}
        testID="tap-in-composer-confirm-action"
        variant="primary"
      />

      {showSkip ? (
        <Pressable
          accessibilityLabel={skipLabel}
          accessibilityRole="button"
          disabled={disabled || !canSkip}
          onPress={onSkip}
          style={({pressed}) => [
            styles.skipAction,
            {
              opacity:
                disabled || !canSkip
                  ? 0.42
                  : pressed
                  ? actionMotion.pressedOpacity
                  : 1,
            },
          ]}>
          <HoystText
            style={[
              styles.skipActionLabel,
              {color: theme.warningForeground},
            ]}
            variant="button">
            {skipLabel}
          </HoystText>
        </Pressable>
      ) : null}
    </View>
  );
}

export function TapInComposerScreen({
  navigation,
  route,
}: Props): React.JSX.Element {
  const theme = useHoystTheme();
  const safeAreaInsets = useSafeAreaInsets();
  const {height: windowHeight} = useWindowDimensions();
  const [sheetDetentIndex, setSheetDetentIndex] = useState(0);
  const [detail, setDetail] = useState<CircleDetailModel | undefined>();
  const [hasResolvedDetail, setHasResolvedDetail] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isRemovingTapIn, setIsRemovingTapIn] = useState(false);
  const [hasDirtyDetails, setHasDirtyDetails] = useState(false);
  const [selectedPhotoUri, setSelectedPhotoUri] = useState<string>();
  const [quantityInput, setQuantityInput] = useState('0');
  const [hasEditedQuantity, setHasEditedQuantity] = useState(false);
  const profile = useUserProfileStore(state => state.profile);
  const status = useSessionStore(state => state.status);
  const user = useSessionStore(state => state.user);
  const timezone = profile?.timezone ?? 'UTC';
  const canLoadDetail = status === 'authenticatedReady' && Boolean(user?.uid);

  const activeSheetDetent =
    TAP_IN_SHEET_DETENTS[
      Math.min(sheetDetentIndex, TAP_IN_SHEET_DETENTS.length - 1)
    ];
  const maximumSheetHeight = Math.max(
    0,
    windowHeight - safeAreaInsets.top - safeAreaInsets.bottom / 2,
  );
  const sheetHeight = Math.round(maximumSheetHeight * activeSheetDetent);

  useEffect(() => {
    return navigation.addListener('sheetDetentChange', event => {
      if (event.data.stable) {
        setSheetDetentIndex(event.data.index);
      }
    });
  }, [navigation]);

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

  const savedQuantityValue = useMemo(
    () =>
      Math.round(
        detail?.viewerTodayCheckIn?.currentValue ?? detail?.currentValue ?? 0,
      ),
    [detail?.currentValue, detail?.viewerTodayCheckIn?.currentValue],
  );

  useEffect(() => {
    if (!detail || hasEditedQuantity) {
      return;
    }

    setQuantityInput(formatQuantityValue(savedQuantityValue));
  }, [detail, hasEditedQuantity, savedQuantityValue]);

  const resetAndClose = () => {
    navigation.goBack();
  };

  const parsedQuantityValue = Number.parseFloat(quantityInput);
  const quantityValue = Number.isFinite(parsedQuantityValue)
    ? Math.max(0, Math.round(parsedQuantityValue))
    : 0;
  const hasDirtyQuantity =
    hasEditedQuantity && quantityValue !== savedQuantityValue;
  const hasSelectedPhoto = Boolean(selectedPhotoUri);

  useEffect(() => {
    return navigation.addListener('beforeRemove', event => {
      if (
        (!hasDirtyQuantity && !hasDirtyDetails && !hasSelectedPhoto) ||
        isSubmitting ||
        isRemovingTapIn
      ) {
        return;
      }

      event.preventDefault();
      Alert.alert(
        hasDirtyQuantity
          ? 'Discard progress changes?'
          : hasSelectedPhoto
          ? 'Discard selected photo?'
          : 'Discard detail changes?',
        hasDirtyQuantity
          ? 'Your updated quantity is not saved yet.'
          : hasSelectedPhoto
          ? 'This photo has not been added to your Tap In yet.'
          : 'Your note or photo is not saved yet.',
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
  }, [
    hasDirtyDetails,
    hasDirtyQuantity,
    hasSelectedPhoto,
    isRemovingTapIn,
    isSubmitting,
    navigation,
  ]);

  if (!detail) {
    return (
      <HoystScreen
        background={<FrostedBackdrop />}
        contentContainerStyle={styles.content}
        stackStyle={styles.screenStack}>
        <View style={styles.closeRow}>
          <Pressable
            accessibilityLabel="Close Tap In composer"
            accessibilityRole="button"
            hitSlop={12}
            onPress={resetAndClose}
            style={({pressed}) => [
              styles.closePressable,
              {opacity: pressed ? actionMotion.pressedOpacity : 1},
            ]}>
            <View
              style={[
                styles.closeButton,
                {
                  backgroundColor: theme.surfaceSoft,
                  borderColor: theme.border,
                },
              ]}>
              <X color={theme.textMuted} size={21} strokeWidth={2.4} />
            </View>
          </Pressable>
        </View>
        <View style={styles.emptyState}>
          <HoystTapInMark size={58} />
          <HoystText style={styles.emptyTitle}>
            {hasResolvedDetail ? 'Circle unavailable' : 'Loading Tap In'}
          </HoystText>
          <HoystText style={styles.emptyCopy} tone="muted">
            {hasResolvedDetail
              ? 'This Tap In needs a real active Circle before you can submit.'
              : 'Getting today’s commitment ready.'}
          </HoystText>
        </View>
      </HoystScreen>
    );
  }

  const commitmentType = getCommitmentType(detail);
  const quantityConfig = getQuantityConfig(detail);
  const isQuantityTapIn =
    commitmentType === 'limit' ||
    (commitmentType === 'build' && !isSingleTapInCommitment(detail));
  const quantityCoverageStatus = getCoverageStatusForValue({
    circle: detail,
    currentValue: quantityValue,
  });
  const quantityStatusCopy =
    detail.viewerHasTappedInToday && !hasDirtyQuantity
      ? 'Saved'
      : commitmentType === 'limit'
      ? quantityCoverageStatus === 'covered'
        ? 'Within range'
        : 'Outside range'
      : quantityCoverageStatus === 'covered'
      ? 'Goal covered'
      : 'Ready to save';
  const quantityTargetCopy =
    commitmentType === 'limit'
      ? typeof quantityConfig.minimumValue === 'number'
        ? `${formatQuantityValue(
            quantityConfig.minimumValue,
          )} to ${formatQuantityLabel(
            quantityConfig.maximumValue ?? 1,
            quantityConfig.unitLabel,
          )}`
        : `Max ${formatQuantityLabel(
            quantityConfig.maximumValue ?? 1,
            quantityConfig.unitLabel,
          )}`
      : `Goal ${formatQuantityLabel(
          quantityConfig.targetValue ?? 1,
          quantityConfig.unitLabel,
        )}`;
  const quantityRingTarget =
    commitmentType === 'limit'
      ? quantityConfig.maximumValue
      : quantityConfig.targetValue;
  const quantityRingCaption =
    typeof quantityRingTarget === 'number'
      ? commitmentType === 'limit'
        ? `MAX ${formatQuantityValue(quantityRingTarget)}`
        : `OF ${formatQuantityValue(quantityRingTarget)}`
      : 'TODAY';
  const submitActionLabel =
    isQuantityTapIn && detail.viewerHasTappedInToday
      ? 'Update Progress'
      : isQuantityTapIn
      ? 'Log Progress'
      : 'Tap In';
  const remainingPeriodCopy =
    detail.commitmentCadence === 'daily' ? 'today' : 'this week';
  const statusLabel =
    detail.state === 'risk'
      ? 'Streak at risk'
      : detail.viewerTodayStatus === 'skip'
      ? 'Skipped today'
      : detail.viewerHasTappedInToday
      ? 'Saved today'
      : detail.viewerHasCheckedIn
      ? 'Commitment complete'
      : detail.remainingCheckIns === 1
      ? `1 Tap In left ${remainingPeriodCopy}`
      : `${detail.remainingCheckIns ?? 0} Tap Ins left ${remainingPeriodCopy}`;
  const skipGraceRule = detail.graceRules?.skip;
  const skipAllowance = skipGraceRule?.allowance ?? 0;
  const skipWindowDays = skipGraceRule?.windowDays ?? 1;
  const availableSkips = detail.viewerAvailableSkips;
  const isSkipAvailabilityKnown = typeof availableSkips === 'number';
  const hasSkipRule = skipAllowance > 0;
  const canSubmitTapIn =
    !detail.viewerHasTappedInToday ||
    (isQuantityTapIn && detail.viewerTodayStatus !== 'skip');
  const canSkip =
    !detail.viewerHasCheckedIn &&
    canSubmitTapIn &&
    hasSkipRule &&
    isSkipAvailabilityKnown &&
    availableSkips > 0;
  const shouldShowSkipAction =
    !detail.viewerHasCheckedIn && canSubmitTapIn && hasSkipRule;
  const skipActionLabel = !isSkipAvailabilityKnown
    ? `Checking skips (${skipAllowance} per ${skipWindowDays} days)`
    : availableSkips > 0
    ? `Use Skip (${availableSkips} left)`
    : `No skips left (${skipAllowance} per ${skipWindowDays} days)`;
  const hasRemovableTodayCheckIn =
    detail.viewerHasTappedInToday &&
    Boolean(detail.viewerTodayStatus) &&
    detail.viewerTodayStatus !== 'rest';
  const shouldShowCheckedInReview =
    detail.viewerTodayStatus === 'skip' ||
    (!isQuantityTapIn && detail.viewerTodayStatus === 'done');
  const isViewingLoggedTapIn = detail.viewerTodayStatus === 'done';
  const viewerTodayCheckIn =
    detail.viewerTodayCheckIn?.status === detail.viewerTodayStatus
      ? detail.viewerTodayCheckIn
      : undefined;
  const viewerTodayNote = viewerTodayCheckIn?.note?.trim();
  const viewerTodayPhotoUrl = viewerTodayCheckIn?.photoUrl;
  const removeActionLabel =
    detail.viewerTodayStatus === 'skip' ? 'Remove Skip' : 'Remove Tap In';
  const removeProgressionCopy =
    isQuantityTapIn && hasRemovableTodayCheckIn
      ? "Removing this will delete today's saved quantity and reopen this Tap In."
      : isViewingLoggedTapIn
      ? "Removing this will reopen today's Tap In and lower this Circle's Progression."
      : detail.commitmentCadence === 'daily'
      ? "This will undo today's Progression for this Circle."
      : "This will undo this week's Progression for this Circle.";
  const quantityStep = Math.max(1, Math.round(quantityConfig.stepValue ?? 1));

  const stepQuantity = (direction: -1 | 1) => {
    const nextValue = Math.max(0, quantityValue + direction * quantityStep);

    setHasEditedQuantity(true);
    setQuantityInput(formatQuantityValue(nextValue));
  };

  const choosePhoto = async () => {
    const response = await launchImageLibrary({
      mediaType: 'photo',
      quality: 0.8,
      selectionLimit: 1,
    });
    const uri = response.assets?.[0]?.uri;

    if (uri) {
      setSelectedPhotoUri(uri);
    }
  };

  const takePhoto = async () => {
    const response = await launchCamera({
      mediaType: 'photo',
      quality: 0.8,
      saveToPhotos: false,
    });
    const uri = response.assets?.[0]?.uri;

    if (uri) {
      setSelectedPhotoUri(uri);
    }
  };

  const openPhotoPicker = () => {
    Alert.alert('Add Photo', 'Choose a photo source.', [
      {
        onPress: () => takePhoto().catch(() => undefined),
        text: 'Take Photo',
      },
      {
        onPress: () => choosePhoto().catch(() => undefined),
        text: 'Choose from Library',
      },
      {style: 'cancel', text: 'Cancel'},
    ]);
  };

  const handleConfirm = async (
    checkInStatus: Extract<CheckInStatus, 'done' | 'skip'> = 'done',
  ) => {
    setIsSubmitting(true);
    try {
      const result = await submitTapIn({
        circleId: route.params.circleId,
        ...(checkInStatus === 'done' && isQuantityTapIn
          ? {currentValue: quantityValue}
          : {}),
        status: checkInStatus,
      });

      if (checkInStatus === 'done' && result.status !== 'failed') {
        triggerTapInSuccessHaptic();
      }

      const completionCoverageStatus =
        checkInStatus === 'done' && isQuantityTapIn
          ? result.coverageStatus ?? quantityCoverageStatus
          : undefined;
      const completionStatus =
        result.status === 'skip'
          ? 'skip'
          : completionCoverageStatus
          ? getCheckInStatusForCoverage(completionCoverageStatus)
          : 'done';

      navigation.replace('TapInComplete', {
        circleId: route.params.circleId,
        circleTitle: detail.title,
        commitment: detail.commitment,
        commitmentType,
        ...(isQuantityTapIn
          ? {
              coverageStatus: completionCoverageStatus,
              currentValue: result.currentValue ?? quantityValue,
              ...(typeof quantityConfig.maximumValue === 'number'
                ? {maximumValue: quantityConfig.maximumValue}
                : {}),
              ...(typeof quantityConfig.minimumValue === 'number'
                ? {minimumValue: quantityConfig.minimumValue}
                : {}),
              ...(typeof quantityConfig.targetValue === 'number'
                ? {targetValue: quantityConfig.targetValue}
                : {}),
              unitLabel: quantityConfig.unitLabel,
            }
          : {}),
        completionMomentum: result.momentum,
        dateKey: result.dateKey,
        inviteUrl: detail.inviteUrl,
        memberCount: detail.memberCount,
        periodTapInCount: detail.periodTapInCount,
        progressLabel: detail.progressLabel,
        source: route.params.source,
        status: completionStatus,
        streakDays: detail.streakDays,
        streakLabel: detail.streakLabel,
        ...(checkInStatus === 'done' && !isQuantityTapIn && selectedPhotoUri
          ? {photoUri: selectedPhotoUri}
          : {}),
      });
    } catch (error) {
      Alert.alert(
        'Tap In failed',
        (error as {message?: string}).message ??
          'Could not submit your Tap In. Try again.',
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  const confirmSkip = () => {
    if (!selectedPhotoUri) {
      handleConfirm('skip').catch(() => undefined);
      return;
    }

    Alert.alert(
      'Use Skip without photo?',
      'Photos are only saved with completed Tap Ins. Your selected photo will be discarded.',
      [
        {style: 'cancel', text: 'Keep Photo'},
        {
          onPress: () => {
            setSelectedPhotoUri(undefined);
            handleConfirm('skip').catch(() => undefined);
          },
          style: 'destructive',
          text: 'Use Skip',
        },
      ],
    );
  };

  const handleRemoveTapIn = async () => {
    setIsRemovingTapIn(true);
    try {
      await removeTapIn({circleId: route.params.circleId});
      navigation.goBack();
    } catch (error) {
      Alert.alert(
        'Remove failed',
        (error as {message?: string}).message ??
          'Could not remove your Tap In. Try again.',
      );
    } finally {
      setIsRemovingTapIn(false);
    }
  };

  const confirmRemoveTapIn = () => {
    Alert.alert('Remove today?', removeProgressionCopy, [
      {style: 'cancel', text: 'Keep'},
      {
        onPress: () => handleRemoveTapIn().catch(() => undefined),
        style: 'destructive',
        text: 'Remove',
      },
    ]);
  };

  const shareStory = () => {
    navigation.navigate('TapInStoryShare', {
      circleId: route.params.circleId,
      circleTitle: detail.title,
      commitment: detail.commitment,
      inviteUrl: detail.inviteUrl,
      memberCount: detail.memberCount,
      note: viewerTodayNote || undefined,
      periodTapInCount: detail.periodTapInCount,
      photoUri: viewerTodayPhotoUrl,
      progressLabel: detail.progressLabel,
      source: route.params.source,
      streakDays: detail.streakDays,
      streakLabel: detail.streakLabel,
    });
  };

  return (
    <View
      style={{height: sheetHeight}}
      testID="tap-in-composer-sheet-frame">
      <HoystScreen
        background={<FrostedBackdrop />}
        contentContainerStyle={[
          styles.content,
          !shouldShowCheckedInReview ? styles.contentWithActionFooter : null,
        ]}
        keyboardAvoiding
        keyboardDismissMode="interactive"
        keyboardShouldPersistTaps="handled"
        stackStyle={styles.screenStack}>
      <View style={styles.closeRow} testID="tap-in-composer-close-row">
        <Pressable
          accessibilityLabel="Close Tap In composer"
          accessibilityRole="button"
          hitSlop={12}
          onPress={resetAndClose}
          style={({pressed}) => [
            styles.closePressable,
            {opacity: pressed ? actionMotion.pressedOpacity : 1},
          ]}>
          <View
            style={[
              styles.closeButton,
              {
                backgroundColor: theme.surfaceSoft,
                borderColor: theme.border,
              },
            ]}>
            <X color={theme.textMuted} size={21} strokeWidth={2.4} />
          </View>
        </Pressable>
      </View>

      <View style={styles.heroPanel}>
        <HoystTapInMark size={44} testID="tap-in-composer-logo" />
        <HoystText
          numberOfLines={2}
          style={styles.heroTitle}
          testID="tap-in-composer-circle-title">
          {detail.title}
        </HoystText>
        <HoystText
          numberOfLines={2}
          style={styles.heroCommitment}
          testID="tap-in-composer-commitment"
          tone="muted">
          {detail.commitment}
        </HoystText>
        <View style={styles.summaryChips}>
          <CommitmentTypePill
            commitmentType={commitmentType}
            density="compact"
            uppercase
          />
          <CircleCategoryPill category={detail.category} uppercase />
          <HoystChip
            density="compact"
            label={statusLabel.toUpperCase()}
            tone={detail.state === 'risk' ? 'orange' : 'green'}
          />
        </View>
        <View style={styles.heroStreak}>
          <Flame color={theme.successForeground} size={13} strokeWidth={2.5} />
          <HoystText
            style={[styles.heroStreakLabel, {color: theme.successForeground}]}>
            {detail.streakLabel ?? `${detail.streakDays ?? 0}d streak`}
          </HoystText>
        </View>
      </View>

      {shouldShowCheckedInReview ? (
        <View style={styles.reviewStack}>
          <GlassPanel padding="compact" style={styles.reviewPanel}>
            <View style={styles.reviewHeader}>
              <HoystText style={styles.reviewTitle}>
                {detail.viewerTodayStatus === 'skip'
                  ? 'Today is covered'
                  : "Today's proof"}
              </HoystText>
              <HoystChip
                density="compact"
                label={
                  detail.viewerTodayStatus === 'skip' ? 'SKIPPED' : 'SAVED'
                }
                tone={detail.viewerTodayStatus === 'skip' ? 'orange' : 'green'}
              />
            </View>
            <HoystText
              style={styles.reviewBody}
              tone={viewerTodayNote ? 'primary' : 'muted'}>
              {detail.viewerTodayStatus === 'skip'
                ? 'Your grace skip is covering today for this Circle.'
                : viewerTodayNote || 'No note added. Your Tap In still counts.'}
            </HoystText>
            {viewerTodayPhotoUrl ? (
              <Image
                resizeMode="cover"
                source={{uri: viewerTodayPhotoUrl}}
                style={styles.reviewImage}
                testID="tap-in-view-proof-image"
              />
            ) : null}
          </GlassPanel>

          {detail.viewerTodayStatus !== 'skip' &&
          viewerTodayCheckIn?.dateKey ? (
            <TapInDetailsSection
              circleId={route.params.circleId}
              dateKey={viewerTodayCheckIn.dateKey}
              initialNote={viewerTodayNote}
              initialPhotoUrl={viewerTodayPhotoUrl}
              onDirtyChange={setHasDirtyDetails}
            />
          ) : null}

          {isViewingLoggedTapIn ? (
            <TapInActionButton
              icon={
                <Share2
                  color={theme.accentSecondaryForeground}
                  size={18}
                  strokeWidth={2.3}
                />
              }
              label="Share Story"
              onPress={shareStory}
              variant="accentOutline"
            />
          ) : null}
          <TapInActionButton
            disabled={isRemovingTapIn}
            icon={
              <Trash2
                color={theme.dangerForeground}
                size={18}
                strokeWidth={2.3}
              />
            }
            label={isRemovingTapIn ? 'Removing...' : removeActionLabel}
            onPress={confirmRemoveTapIn}
            variant="dangerOutline"
          />
        </View>
      ) : (
        <View style={styles.actionFlow}>
          {isQuantityTapIn ? (
            <View style={styles.quantityBlock}>
              <View style={styles.quantityHeader}>
                <View style={styles.quantityHeaderCopy}>
                  <HoystText tone="muted" variant="label">
                    {"Today's Progress"}
                  </HoystText>
                  <HoystText tone="muted" variant="caption">
                    {quantityTargetCopy}
                  </HoystText>
                </View>
                <HoystChip
                  density="compact"
                  label={quantityStatusCopy}
                  tone={
                    quantityCoverageStatus === 'failed' ? 'orange' : 'green'
                  }
                />
              </View>
              <View
                style={[
                  styles.quantityControls,
                  {
                    backgroundColor: theme.glassSurfaceStrong,
                    borderColor: theme.glassBorder,
                  },
                ]}>
                <Pressable
                  accessibilityLabel="Decrease quantity"
                  accessibilityRole="button"
                  disabled={quantityValue <= 0}
                  onPress={() => stepQuantity(-1)}
                  style={({pressed}) => [
                    styles.quantityStepPressable,
                    {
                      opacity:
                        quantityValue <= 0
                          ? 0.4
                          : pressed
                          ? actionMotion.pressedOpacity
                          : 1,
                      transform: [
                        {scale: pressed ? actionMotion.pressedScale : 1},
                      ],
                    },
                  ]}>
                  <View
                    style={[
                      styles.quantityStepButton,
                      theme.isDark
                        ? styles.quantityStepButtonMutedDark
                        : styles.quantityStepButtonMutedLight,
                    ]}>
                    <Minus
                      color={theme.actionForeground}
                      size={24}
                      strokeWidth={2.6}
                    />
                  </View>
                </Pressable>

                <View
                  accessibilityLabel={`Current value: ${quantityValue}. ${quantityRingCaption}`}
                  accessible
                  style={[
                    styles.quantityValueRing,
                    {
                      backgroundColor: theme.surfaceSoft,
                      borderColor:
                        quantityCoverageStatus === 'failed'
                          ? `${theme.warning}38`
                          : `${theme.success}28`,
                    },
                  ]}>
                  <HoystText
                    allowFontScaling={false}
                    style={styles.quantityValueText}>
                    {formatQuantityValue(quantityValue)}
                  </HoystText>
                  <HoystText
                    allowFontScaling={false}
                    style={styles.quantityValueCaption}
                    tone="muted">
                    {quantityRingCaption}
                  </HoystText>
                </View>

                <Pressable
                  accessibilityLabel="Increase quantity"
                  accessibilityRole="button"
                  onPress={() => stepQuantity(1)}
                  style={({pressed}) => [
                    styles.quantityStepPressable,
                    {
                      opacity: pressed ? actionMotion.pressedOpacity : 1,
                      transform: [
                        {scale: pressed ? actionMotion.pressedScale : 1},
                      ],
                    },
                  ]}>
                  <View
                    style={[
                      styles.quantityStepButton,
                      styles.quantityStepButtonPrimary,
                    ]}>
                    <Plus color="#FFFFFF" size={25} strokeWidth={2.7} />
                  </View>
                </Pressable>
              </View>
            </View>
          ) : (
            <PhotoPickerTile
              onAddPhoto={openPhotoPicker}
              onRemovePhoto={() => setSelectedPhotoUri(undefined)}
              photoUri={selectedPhotoUri}
            />
          )}

          {isQuantityTapIn && viewerTodayCheckIn?.dateKey ? (
            <TapInDetailsSection
              circleId={route.params.circleId}
              dateKey={viewerTodayCheckIn.dateKey}
              initialNote={viewerTodayNote}
              initialPhotoUrl={viewerTodayPhotoUrl}
              onDirtyChange={setHasDirtyDetails}
            />
          ) : null}

          {isQuantityTapIn && hasRemovableTodayCheckIn ? (
            <TapInActionButton
              disabled={isRemovingTapIn}
              icon={
                <Trash2
                  color={theme.dangerForeground}
                  size={18}
                  strokeWidth={2.3}
                />
              }
              label={isRemovingTapIn ? 'Removing...' : removeActionLabel}
              onPress={confirmRemoveTapIn}
              variant="dangerOutline"
            />
          ) : null}
        </View>
      )}
      </HoystScreen>
      {!shouldShowCheckedInReview ? (
        <View
          style={[
            styles.actionFooterPosition,
            {paddingBottom: safeAreaInsets.bottom + 8},
          ]}
          testID="tap-in-composer-action-footer-position">
          <TapInComposerActionFooter
            canSkip={canSkip}
            disabled={isSubmitting || !canSubmitTapIn}
            label={
              isSubmitting
                ? 'Submitting...'
                : canSubmitTapIn
                ? submitActionLabel
                : 'Today already covered'
            }
            onConfirm={() => handleConfirm().catch(() => undefined)}
            onSkip={confirmSkip}
            showSkip={shouldShowSkipAction}
            skipLabel={skipActionLabel}
          />
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  actionFooter: {
    gap: 24,
  },
  actionFooterPosition: {
    flexShrink: 0,
    paddingHorizontal: 20,
    paddingTop: 10,
    zIndex: 3,
  },
  actionFlow: {
    alignSelf: 'stretch',
    gap: 12,
  },
  closeButton: {
    alignItems: 'center',
    borderRadius: radius.pill,
    borderWidth: 1,
    height: 38,
    justifyContent: 'center',
    width: 38,
  },
  closePressable: {
    borderRadius: radius.pill,
    height: 38,
    width: 38,
  },
  closeRow: {
    alignItems: 'flex-end',
    height: 54,
    marginBottom: -38,
    paddingTop: 16,
    zIndex: 2,
  },
  content: {
    paddingBottom: 12,
    paddingTop: 0,
  },
  contentWithActionFooter: {
    paddingBottom: 24,
  },
  emptyCopy: {
    fontSize: 14,
    lineHeight: 20,
    maxWidth: 280,
    textAlign: 'center',
  },
  emptyState: {
    alignItems: 'center',
    flex: 1,
    gap: 10,
    justifyContent: 'center',
    minHeight: 320,
  },
  emptyTitle: {
    fontSize: 24,
    fontWeight: '800',
    lineHeight: 29,
  },
  heroPanel: {
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 4,
  },
  heroCommitment: {
    fontSize: 14,
    fontWeight: '600',
    lineHeight: 19,
    maxWidth: 320,
    textAlign: 'center',
  },
  heroStreak: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 5,
    marginTop: 1,
  },
  heroStreakLabel: {
    fontSize: 12,
    fontWeight: '800',
    lineHeight: 16,
  },
  heroTitle: {
    fontSize: 28,
    fontWeight: '800',
    lineHeight: 33,
    maxWidth: 340,
    textAlign: 'center',
  },
  quantityBlock: {
    alignSelf: 'stretch',
    gap: 8,
  },
  quantityControls: {
    alignItems: 'center',
    borderRadius: radius.lg,
    borderWidth: 1,
    flexDirection: 'row',
    justifyContent: 'space-around',
    minHeight: 112,
    paddingHorizontal: 18,
    paddingVertical: 8,
  },
  quantityHeader: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 12,
    justifyContent: 'space-between',
  },
  quantityHeaderCopy: {
    flex: 1,
    gap: 3,
    minWidth: 0,
  },
  quantityStepButton: {
    alignItems: 'center',
    borderRadius: radius.pill,
    borderWidth: 1,
    height: 48,
    justifyContent: 'center',
    width: 48,
  },
  quantityStepButtonPrimary: {
    backgroundColor: '#15171D',
    borderColor: '#15171D',
  },
  quantityStepButtonMutedDark: {
    backgroundColor: 'rgba(255,255,255,0.10)',
    borderColor: 'transparent',
  },
  quantityStepButtonMutedLight: {
    backgroundColor: '#ECECF4',
    borderColor: 'transparent',
  },
  quantityStepPressable: {
    borderRadius: radius.pill,
    height: 48,
    width: 48,
  },
  quantityValueCaption: {
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.3,
    lineHeight: 14,
  },
  quantityValueRing: {
    alignItems: 'center',
    borderRadius: radius.pill,
    borderWidth: 9,
    height: 84,
    justifyContent: 'center',
    width: 84,
  },
  quantityValueText: {
    fontSize: 30,
    fontWeight: '800',
    lineHeight: 38,
  },
  reviewBody: {
    fontSize: 14,
    fontWeight: '600',
    lineHeight: 20,
  },
  reviewHeader: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 12,
    justifyContent: 'space-between',
  },
  reviewImage: {
    borderRadius: radius.md,
    height: 156,
    width: '100%',
  },
  reviewPanel: {
    minHeight: 92,
  },
  reviewStack: {
    gap: 12,
  },
  reviewTitle: {
    fontSize: 17,
    fontWeight: '800',
    lineHeight: 21,
  },
  screenStack: {
    gap: 12,
  },
  summaryChips: {
    alignItems: 'center',
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 7,
    justifyContent: 'center',
  },
  skipAction: {
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 44,
  },
  skipActionLabel: {
    fontSize: 15,
    fontWeight: '800',
    lineHeight: 19,
    textAlign: 'center',
  },
});
