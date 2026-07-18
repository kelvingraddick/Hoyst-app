import React, {useEffect, useState} from 'react';
import {Alert, Image, Pressable, StyleSheet, View} from 'react-native';
import type {LayoutChangeEvent} from 'react-native';
import {
  Camera,
  Flame,
  ImagePlus,
  Minus,
  Plus,
  Share2,
  Trash2,
  X,
} from 'lucide-react-native';
import {launchCamera, launchImageLibrary} from 'react-native-image-picker';
import type {NativeStackScreenProps} from '@react-navigation/native-stack';

import {FrostedBackdrop} from '../../../design/components/FrostedBackdrop';
import {GlassPanel} from '../../../design/components/GlassPanel';
import {HoystChip} from '../../../design/components/HoystChip';
import {HoystInput} from '../../../design/components/HoystInput';
import {HoystScreen} from '../../../design/components/HoystScreen';
import {HoystText} from '../../../design/components/HoystText';
import {CircleCategoryPill} from '../../../design/components/CircleCategoryIcon';
import {HoystTapInMark} from '../../../design/components/HoystTapInMark';
import {TapInActionButton} from '../../../design/components/TapInActionButton';
import {actionMotion} from '../../../design/tokens/actions';
import {brandColors} from '../../../design/tokens/colors';
import {radius} from '../../../design/tokens/radius';
import {useHoystTheme} from '../../../design/theme/useHoystTheme';
import {triggerTapInSuccessHaptic} from '../../../lib/haptics/tap-in-haptics';
import {removeTapIn, submitTapIn} from '../services/check-in-service';
import type {
  CheckInStatus,
  CircleDetailModel,
  TapInDraft,
} from '../../../types/models';
import type {RootStackParamList} from '../../../navigation/types';
import {useUserProfileStore} from '../../../store/profile-store';
import {useSessionStore} from '../../../store/session-store';
import {subscribeToMemberCircleDetail} from '../../home/services/home-data-service';
import {
  formatQuantityLabel,
  formatQuantityValue,
  getCheckInStatusForCoverage,
  getCommitmentType,
  getCoverageStatusForValue,
  getQuantityConfig,
  isSingleTapInCommitment,
} from '../../commitments/commitment-logic';

type Props = NativeStackScreenProps<RootStackParamList, 'TapInComposer'>;

const initialTapInDraft: TapInDraft = {
  note: '',
};
const PHOTO_ACTION_GAP = 12;

export function TapInComposerScreen({
  navigation,
  route,
}: Props): React.JSX.Element {
  const theme = useHoystTheme();
  const [draft, setDraft] = useState<TapInDraft>(initialTapInDraft);
  const [detail, setDetail] = useState<CircleDetailModel | undefined>();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isRemovingTapIn, setIsRemovingTapIn] = useState(false);
  const [formFieldWidth, setFormFieldWidth] = useState(0);
  const [quantityInput, setQuantityInput] = useState('0');
  const [hasEditedQuantity, setHasEditedQuantity] = useState(false);
  const profile = useUserProfileStore(state => state.profile);
  const status = useSessionStore(state => state.status);
  const user = useSessionStore(state => state.user);
  const timezone = profile?.timezone ?? 'UTC';
  const canLoadDetail = status === 'authenticatedReady' && Boolean(user?.uid);

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
    if (!detail || hasEditedQuantity) {
      return;
    }

    const savedValue =
      detail.viewerTodayCheckIn?.currentValue ?? detail.currentValue ?? 0;
    setQuantityInput(formatQuantityValue(Math.round(savedValue)));
  }, [
    detail,
    detail?.currentValue,
    detail?.viewerTodayCheckIn?.currentValue,
    hasEditedQuantity,
  ]);

  const resetAndClose = () => {
    setDraft(initialTapInDraft);
    if (route.params.source === 'tap_in') {
      navigation.replace('TapInPicker');
      return;
    }

    navigation.goBack();
  };

  if (!detail) {
    return (
      <HoystScreen
        background={<FrostedBackdrop />}
        contentContainerStyle={styles.content}>
        <View style={styles.closeRow}>
          <Pressable
            accessibilityLabel="Close Tap In composer"
            accessibilityRole="button"
            hitSlop={8}
            onPress={resetAndClose}
            style={({pressed}) => [
              styles.closeButton,
              {
                backgroundColor: theme.surfaceSoft,
                borderColor: theme.border,
                opacity: pressed ? 0.92 : 1,
              },
            ]}>
            <X color={theme.text} size={22} strokeWidth={2.5} />
          </Pressable>
        </View>
        <GlassPanel style={styles.contextPanel}>
          <HoystText variant="title">Circle unavailable</HoystText>
          <HoystText tone="muted">
            This Tap In needs a real active Circle before you can submit.
          </HoystText>
        </GlassPanel>
      </HoystScreen>
    );
  }

  const trimmedNote = draft.note.trim();
  const hasPreviewNote = trimmedNote.length > 0;
  const hasPreviewPhoto = Boolean(draft.photoUri);
  const shouldShowPreview = hasPreviewNote || hasPreviewPhoto;
  const commitmentType = getCommitmentType(detail);
  const quantityConfig = getQuantityConfig(detail);
  const isQuantityTapIn =
    commitmentType === 'limit' ||
    (commitmentType === 'build' && !isSingleTapInCommitment(detail));
  const parsedQuantityValue = Number.parseFloat(quantityInput);
  const quantityValue = Number.isFinite(parsedQuantityValue)
    ? Math.max(0, Math.round(parsedQuantityValue))
    : 0;
  const quantityCoverageStatus = getCoverageStatusForValue({
    circle: detail,
    currentValue: quantityValue,
  });
  const quantityStatusCopy =
    commitmentType === 'limit'
      ? quantityCoverageStatus === 'covered'
        ? 'Within range'
        : 'Outside range'
      : quantityCoverageStatus === 'covered'
      ? 'Goal covered'
      : 'Progress saved';
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
  const quantityFieldLabel =
    commitmentType === 'limit' ? 'Current used today' : 'Current total today';
  const isBuildProgress =
    commitmentType === 'build' && quantityCoverageStatus === 'partial';
  const submitActionLabel =
    isBuildProgress && detail.viewerHasTappedInToday
      ? 'Update Progress'
      : isBuildProgress
      ? 'Log Progress'
      : isQuantityTapIn && detail.viewerHasTappedInToday
      ? 'Update Tap In'
      : isQuantityTapIn
      ? 'Tap In'
      : 'Confirm Tap In';
  const progressLabel = detail.progressLabel ?? `${detail.completionRate}% in`;
  const remainingPeriodCopy =
    detail.commitmentCadence === 'daily' ? 'today' : 'this week';
  const statusLabel =
    detail.state === 'risk'
      ? 'Group streak at risk'
      : detail.viewerTodayStatus === 'skip'
      ? 'Skipped today'
      : detail.viewerHasTappedInToday
      ? 'Already tapped in'
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
  const canShareStoryFromCheckedIn = detail.viewerTodayStatus === 'done';
  const removeActionLabel =
    detail.viewerTodayStatus === 'skip' ? 'Remove Skip' : 'Remove Tap In';
  const viewerTodayCheckIn =
    detail.viewerTodayCheckIn?.status === detail.viewerTodayStatus
      ? detail.viewerTodayCheckIn
      : undefined;
  const viewerTodayNote = viewerTodayCheckIn?.note?.trim();
  const viewerTodayPhotoUrl = viewerTodayCheckIn?.photoUrl;
  const loggedTapInRemoveCopy =
    "Removing this will reopen today's Tap In and lower this Circle's Progression.";
  const quantityTapInRemoveCopy =
    "Removing this will delete today's saved quantity and reopen this Tap In.";
  const checkedInStatusCopy =
    detail.viewerTodayStatus === 'skip'
      ? 'Your grace skip is covering today for this Circle.'
      : isViewingLoggedTapIn
      ? 'Your Tap In is logged for today.'
      : detail.viewerHasCheckedIn
      ? 'You are covered right now for this Circle.'
      : detail.commitmentCadence === 'daily'
      ? 'Your Tap In is counted for today.'
      : 'Your Tap In is counted for today. Keep going this week.';
  const removeProgressionCopy =
    isQuantityTapIn && hasRemovableTodayCheckIn
      ? quantityTapInRemoveCopy
      : isViewingLoggedTapIn
    ? loggedTapInRemoveCopy
    : detail.commitmentCadence === 'daily'
    ? "This will undo today's Progression for this Circle."
    : "This will undo this week's Progression for this Circle.";
  const heroTitle =
    isBuildProgress && detail.viewerHasTappedInToday
      ? 'Update Progress'
      : isBuildProgress
      ? 'Log Progress'
      : isQuantityTapIn && detail.viewerHasTappedInToday
      ? 'Update Tap In'
      : isViewingLoggedTapIn
      ? 'Tap In logged'
      : 'Tap In';
  const heroSubtitle =
    isViewingLoggedTapIn || isQuantityTapIn
      ? undefined
      : "Share today's proof, context, or momentum with your Circle.";
  const photoActionWidth = Math.max(0, (formFieldWidth - PHOTO_ACTION_GAP) / 2);
  const hasMeasuredFormField = formFieldWidth > 0;
  const photoActionMeasuredStyle = hasMeasuredFormField
    ? {width: photoActionWidth}
    : styles.photoActionFlex;
  const photoActionsMeasuredStyle = hasMeasuredFormField
    ? {width: formFieldWidth}
    : undefined;
  const handleFormFieldLayout = (event: LayoutChangeEvent) => {
    const measuredWidth = event.nativeEvent.layout.width;
    setFormFieldWidth(currentWidth =>
      Math.abs(currentWidth - measuredWidth) < 1 ? currentWidth : measuredWidth,
    );
  };
  const hasDirtyTapInDraft =
    hasPreviewNote || hasPreviewPhoto || (isQuantityTapIn && hasEditedQuantity);
  const requestClose = () => {
    if (!hasDirtyTapInDraft || isSubmitting) {
      resetAndClose();
      return;
    }

    Alert.alert('Discard changes?', 'Your Tap In edits are not saved yet.', [
      {style: 'cancel', text: 'Keep editing'},
      {
        onPress: resetAndClose,
        style: 'destructive',
        text: 'Discard',
      },
    ]);
  };
  const stepQuantity = (direction: -1 | 1) => {
    const nextValue = Math.max(0, quantityValue + direction);

    setHasEditedQuantity(true);
    setQuantityInput(formatQuantityValue(nextValue));
  };

  const handleChoosePhoto = async () => {
    const response = await launchImageLibrary({
      mediaType: 'photo',
      quality: 0.8,
      selectionLimit: 1,
    });

    const uri = response.assets?.[0]?.uri;
    if (uri) {
      setDraft(current => ({...current, photoUri: uri}));
    }
  };

  const handleTakePhoto = async () => {
    const response = await launchCamera({
      mediaType: 'photo',
      quality: 0.8,
      saveToPhotos: false,
    });

    const uri = response.assets?.[0]?.uri;
    if (uri) {
      setDraft(current => ({...current, photoUri: uri}));
    }
  };

  const handleConfirm = async (
    checkInStatus: Extract<CheckInStatus, 'done' | 'skip'> = 'done',
  ) => {
    const note = draft.note.trim();

    setIsSubmitting(true);
    try {
      const result = await submitTapIn({
        circleId: route.params.circleId,
        ...(checkInStatus === 'done' && isQuantityTapIn
          ? {currentValue: quantityValue}
          : {}),
        note: note.length > 0 ? note : undefined,
        photoUrl: draft.photoUri,
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
        ...(isQuantityTapIn
          ? {
              commitmentType,
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
        inviteUrl: detail.inviteUrl,
        memberCount: detail.memberCount,
        periodTapInCount: detail.periodTapInCount,
        progressLabel: detail.progressLabel,
        source: route.params.source,
        status: completionStatus,
        streakDays: detail.streakDays,
        streakLabel: detail.streakLabel,
        completionMomentum: result.momentum,
        note: note.length > 0 ? note : undefined,
        photoUri: draft.photoUri,
      });
    } catch (error) {
      const message =
        (error as {message?: string}).message ??
        'Could not submit your Tap In. Try again.';
      Alert.alert('Tap In failed', message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleRemoveTapIn = async () => {
    setIsRemovingTapIn(true);
    try {
      await removeTapIn({circleId: route.params.circleId});
      setIsRemovingTapIn(false);
      resetAndClose();
    } catch (error) {
      setIsRemovingTapIn(false);
      const message =
        (error as {message?: string}).message ??
        'Could not remove your Tap In. Try again.';
      Alert.alert('Remove failed', message);
    }
  };

  const confirmRemoveTapIn = () => {
    Alert.alert('Remove today?', removeProgressionCopy, [
      {style: 'cancel', text: 'Keep'},
      {
        onPress: () => {
          handleRemoveTapIn().catch(() => undefined);
        },
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
      periodTapInCount: detail.periodTapInCount,
      progressLabel: detail.progressLabel,
      source: route.params.source,
      streakDays: detail.streakDays,
      streakLabel: detail.streakLabel,
      note: viewerTodayNote || undefined,
      photoUri: viewerTodayPhotoUrl,
    });
  };

  return (
    <HoystScreen
      background={<FrostedBackdrop />}
      contentContainerStyle={styles.content}
      keyboardAvoiding
      keyboardDismissMode="interactive"
      keyboardShouldPersistTaps="handled">
      <View
        style={[
          styles.topSection,
          isViewingLoggedTapIn ? styles.loggedTopSection : null,
        ]}>
        <View
          style={[
            styles.closeRow,
            isViewingLoggedTapIn ? styles.loggedCloseRow : null,
          ]}>
          <Pressable
            accessibilityLabel="Close Tap In composer"
            accessibilityRole="button"
            hitSlop={16}
            onPress={requestClose}
            style={({pressed}) => [
              styles.closeButton,
              {
                backgroundColor: theme.surfaceSoft,
                borderColor: theme.border,
                opacity: pressed ? 0.92 : 1,
              },
            ]}>
            <X color={theme.text} size={22} strokeWidth={2.5} />
          </Pressable>
        </View>

        <View
          style={[
            styles.heroPanel,
            isViewingLoggedTapIn ? styles.loggedHeroPanel : null,
          ]}>
          <HoystTapInMark
            size={isViewingLoggedTapIn ? 54 : 78}
            testID="tap-in-composer-logo"
          />
          <View
            style={[
              styles.heroCopy,
              isViewingLoggedTapIn ? styles.loggedHeroCopy : null,
            ]}>
            <HoystText
              style={[
                styles.heroTitle,
                isViewingLoggedTapIn ? styles.loggedHeroTitle : null,
              ]}>
              {heroTitle}
            </HoystText>
            {heroSubtitle ? (
              <HoystText
                style={[styles.heroSubtitle, {color: theme.textMuted}]}>
                {heroSubtitle}
              </HoystText>
            ) : null}
          </View>
          <View
            style={[
              styles.summaryChips,
              isViewingLoggedTapIn ? styles.loggedSummaryChips : null,
            ]}>
            <CircleCategoryPill category={detail.category} uppercase />
            <HoystChip
              label={progressLabel}
              style={styles.summaryChip}
              tone="green"
            />
            {isViewingLoggedTapIn ? null : (
              <HoystChip
                label={statusLabel}
                style={styles.statusChip}
                tone="orange"
              />
            )}
          </View>
        </View>
      </View>

      <GlassPanel style={styles.contextPanel}>
        <View style={styles.sectionHeader}>
          <HoystText tone="muted" variant="label">
            Circle Commitment
          </HoystText>
          <View style={styles.streakPill}>
            <Flame
              color={theme.successForeground}
              size={14}
              strokeWidth={2.6}
            />
            <HoystText
              style={[
                styles.streakPillLabel,
                {color: theme.successForeground},
              ]}>
              {detail.streakDays ?? 0}d streak
            </HoystText>
          </View>
        </View>
        <View style={styles.contextCopy}>
          <HoystText style={styles.contextTitle}>{detail.title}</HoystText>
          <HoystText style={styles.contextSubtitle} tone="muted">
            {detail.commitment}
          </HoystText>
        </View>
      </GlassPanel>

      <View style={styles.formPanel}>
        {shouldShowCheckedInReview ? (
          <View style={styles.checkedInState}>
            <GlassPanel style={styles.coveredPanel}>
              <View style={styles.previewHeader}>
                <HoystTapInMark size={42} />
                <View style={styles.previewHeaderCopy}>
                  <HoystText style={styles.previewTitle}>
                    {isViewingLoggedTapIn
                      ? "Today's proof"
                      : 'Today is covered'}
                  </HoystText>
                  <HoystText tone="muted" variant="caption">
                    {checkedInStatusCopy}
                  </HoystText>
                </View>
              </View>
              {isViewingLoggedTapIn ? (
                <>
                  <HoystText
                    style={styles.previewBody}
                    tone={viewerTodayNote ? 'primary' : 'muted'}>
                    {viewerTodayNote ||
                      'No note added. Your Tap In still counts.'}
                  </HoystText>
                  {viewerTodayPhotoUrl ? (
                    <View
                      style={[
                        styles.previewImageWrap,
                        {
                          backgroundColor: theme.surfaceHigh,
                          borderColor: theme.border,
                        },
                      ]}>
                      <Image
                        resizeMode="cover"
                        source={{uri: viewerTodayPhotoUrl}}
                        style={styles.previewImage}
                        testID="tap-in-view-proof-image"
                      />
                    </View>
                  ) : null}
                </>
              ) : null}
              <HoystText style={styles.previewBody} tone="muted">
                {removeProgressionCopy}
              </HoystText>
            </GlassPanel>
            <View style={styles.actionStack}>
              {canShareStoryFromCheckedIn ? (
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
              <TapInActionButton
                label="Close"
                onPress={resetAndClose}
                variant="text"
              />
            </View>
          </View>
        ) : (
          <>
            <View style={styles.formStack}>
              {isQuantityTapIn ? (
                <View style={styles.fieldBlock}>
                  <View style={styles.quantityHeader}>
                    <View style={styles.quantityHeaderCopy}>
                      <HoystText tone="muted" variant="label">
                        {quantityFieldLabel}
                      </HoystText>
                      <HoystText tone="muted" variant="caption">
                        {quantityTargetCopy}
                      </HoystText>
                    </View>
                    <HoystChip
                      label={quantityStatusCopy}
                      style={styles.statusChip}
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
                        styles.quantityStepButton,
                        {
                          backgroundColor: theme.surfaceHigh,
                          borderColor: theme.border,
                          opacity:
                            quantityValue <= 0
                              ? 0.42
                              : pressed
                              ? actionMotion.pressedOpacity
                              : 1,
                          transform: [
                            {scale: pressed ? actionMotion.pressedScale : 1},
                          ],
                        },
                      ]}>
                      <Minus
                        color={theme.actionForeground}
                        size={22}
                        strokeWidth={2.5}
                      />
                    </Pressable>
                    <View style={styles.quantityInputWrap}>
                      <View
                        accessibilityLabel={`${quantityFieldLabel}: ${quantityValue}`}
                        accessible
                        style={[
                          styles.quantityValueDisplay,
                          {
                            backgroundColor: theme.surfaceHigh,
                            borderColor: theme.border,
                          },
                        ]}>
                        <HoystText
                          adjustsFontSizeToFit
                          allowFontScaling={false}
                          minimumFontScale={0.7}
                          numberOfLines={1}
                          style={styles.quantityValueText}>
                          {formatQuantityValue(quantityValue)}
                        </HoystText>
                      </View>
                      <HoystText
                        numberOfLines={1}
                        style={styles.quantityUnitLabel}
                        tone="muted"
                        variant="caption">
                        {quantityConfig.unitLabel}
                      </HoystText>
                    </View>
                    <Pressable
                      accessibilityLabel="Increase quantity"
                      accessibilityRole="button"
                      onPress={() => stepQuantity(1)}
                      style={({pressed}) => [
                        styles.quantityStepButton,
                        {
                          backgroundColor: theme.surfaceHigh,
                          borderColor: theme.border,
                          opacity: pressed ? actionMotion.pressedOpacity : 1,
                          transform: [
                            {scale: pressed ? actionMotion.pressedScale : 1},
                          ],
                        },
                      ]}>
                      <Plus
                        color={theme.actionForeground}
                        size={22}
                        strokeWidth={2.5}
                      />
                    </Pressable>
                  </View>
                </View>
              ) : null}

              <View style={styles.fieldBlock}>
                <HoystText tone="muted" variant="label">
                  Optional Note
                </HoystText>
                <HoystInput
                  multiline
                  numberOfLines={5}
                  onChangeText={value =>
                    setDraft(current => ({...current, note: value}))
                  }
                  onLayout={handleFormFieldLayout}
                  placeholder="Share what you did, how it went, or what your Circle should know."
                  placeholderTextColor={theme.isDark ? '#8D96AD' : '#918CAE'}
                  style={[
                    styles.noteInput,
                    {
                      backgroundColor: theme.glassSurfaceStrong,
                      borderColor: theme.glassBorder,
                    },
                  ]}
                  textAlignVertical="top"
                  value={draft.note}
                />
              </View>

              <View style={styles.fieldBlock}>
                <HoystText tone="muted" variant="label">
                  Photo
                </HoystText>
                <View style={[styles.photoActions, photoActionsMeasuredStyle]}>
                  <Pressable
                    onPress={handleTakePhoto}
                    style={({pressed}) => [
                      styles.photoActionPressable,
                      photoActionMeasuredStyle,
                      {
                        opacity: pressed ? actionMotion.pressedOpacity : 1,
                        transform: [
                          {scale: pressed ? actionMotion.pressedScale : 1},
                        ],
                      },
                    ]}>
                    <GlassPanel
                      padding="none"
                      style={[
                        styles.photoActionPanel,
                        hasMeasuredFormField ? {width: photoActionWidth} : null,
                      ]}>
                      <View style={styles.photoActionFill}>
                        <View
                          style={[
                            styles.photoActionIcon,
                            {
                              backgroundColor: theme.isDark
                                ? 'rgba(122,85,255,0.22)'
                                : 'rgba(200,194,255,0.38)',
                            },
                          ]}>
                          <Camera
                            color={
                              theme.isDark
                                ? brandColors.purpleBright
                                : brandColors.purple
                            }
                            size={22}
                            strokeWidth={2.1}
                          />
                        </View>
                        <View style={styles.photoActionCopy}>
                          <HoystText
                            numberOfLines={1}
                            style={styles.photoActionLabel}
                            variant="button">
                            Take Photo
                          </HoystText>
                          <HoystText
                            numberOfLines={1}
                            tone="muted"
                            variant="caption">
                            Open camera
                          </HoystText>
                        </View>
                      </View>
                    </GlassPanel>
                  </Pressable>
                  <View pointerEvents="none" style={styles.photoActionGap} />
                  <Pressable
                    onPress={handleChoosePhoto}
                    style={({pressed}) => [
                      styles.photoActionPressable,
                      photoActionMeasuredStyle,
                      {
                        opacity: pressed ? actionMotion.pressedOpacity : 1,
                        transform: [
                          {scale: pressed ? actionMotion.pressedScale : 1},
                        ],
                      },
                    ]}>
                    <GlassPanel
                      padding="none"
                      style={[
                        styles.photoActionPanel,
                        hasMeasuredFormField ? {width: photoActionWidth} : null,
                      ]}>
                      <View style={styles.photoActionFill}>
                        <View
                          style={[
                            styles.photoActionIcon,
                            {
                              backgroundColor: theme.isDark
                                ? 'rgba(104,184,232,0.18)'
                                : 'rgba(220,230,255,0.72)',
                            },
                          ]}>
                          <ImagePlus
                            color={theme.accentTertiaryForeground}
                            size={22}
                            strokeWidth={2.1}
                          />
                        </View>
                        <View style={styles.photoActionCopy}>
                          <HoystText
                            numberOfLines={1}
                            style={styles.photoActionLabel}
                            variant="button">
                            Library
                          </HoystText>
                          <HoystText
                            numberOfLines={1}
                            tone="muted"
                            variant="caption">
                            Choose saved
                          </HoystText>
                        </View>
                      </View>
                    </GlassPanel>
                  </Pressable>
                </View>
              </View>

              {shouldShowPreview ? (
                <View style={styles.fieldBlock}>
                  <HoystText tone="muted" variant="label">
                    Preview
                  </HoystText>
                  <GlassPanel style={styles.previewCard}>
                    <View style={styles.previewHeader}>
                      <HoystTapInMark size={42} />
                      <View style={styles.previewHeaderCopy}>
                        <HoystText style={styles.previewTitle}>
                          {detail.title}
                        </HoystText>
                        <HoystText tone="muted" variant="caption">
                          {detail.commitment}
                        </HoystText>
                      </View>
                    </View>
                    {hasPreviewNote ? (
                      <HoystText>{trimmedNote}</HoystText>
                    ) : null}
                    {draft.photoUri ? (
                      <View
                        style={[
                          styles.previewImageWrap,
                          {
                            backgroundColor: theme.surfaceHigh,
                            borderColor: theme.border,
                          },
                        ]}>
                        <Image
                          source={{uri: draft.photoUri}}
                          style={styles.previewImage}
                        />
                        <Pressable
                          onPress={() =>
                            setDraft(current => ({
                              ...current,
                              photoUri: undefined,
                            }))
                          }
                          style={styles.removePhotoButton}>
                          <X color={theme.text} size={14} strokeWidth={2.2} />
                        </Pressable>
                      </View>
                    ) : null}
                  </GlassPanel>
                </View>
              ) : null}
            </View>

            <View style={styles.actionStack}>
              <TapInActionButton
                disabled={isSubmitting || !canSubmitTapIn}
                label={
                  isSubmitting
                    ? 'Submitting...'
                    : canSubmitTapIn
                    ? submitActionLabel
                    : 'Today already covered'
                }
                onPress={
                  isSubmitting || !canSubmitTapIn
                    ? undefined
                    : () => {
                        handleConfirm().catch(() => undefined);
                      }
                }
                testID="tap-in-composer-confirm-action"
                variant="primary"
              />
              {shouldShowSkipAction ? (
                <TapInActionButton
                  disabled={isSubmitting || !canSkip}
                  label={skipActionLabel}
                  onPress={
                    isSubmitting || !canSkip
                      ? undefined
                      : () => {
                          handleConfirm('skip').catch(() => undefined);
                        }
                  }
                  variant="warmOutline"
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
                  onPress={
                    isRemovingTapIn ? undefined : confirmRemoveTapIn
                  }
                  variant="dangerOutline"
                />
              ) : null}
              <TapInActionButton
                label="Discard"
                onPress={requestClose}
                variant="text"
              />
            </View>
          </>
        )}
      </View>
    </HoystScreen>
  );
}

const styles = StyleSheet.create({
  actionStack: {
    gap: 10,
    marginTop: 6,
  },
  checkedInState: {
    gap: 18,
  },
  closeButton: {
    alignItems: 'center',
    borderRadius: radius.pill,
    borderWidth: 1,
    height: 46,
    justifyContent: 'center',
    width: 46,
  },
  closeRow: {
    alignItems: 'flex-end',
    minHeight: 46,
    paddingRight: 4,
  },
  content: {
    paddingBottom: 60,
  },
  contextCopy: {
    gap: 6,
  },
  contextPanel: {
    minHeight: 118,
  },
  contextSubtitle: {
    fontSize: 14,
    fontWeight: '600',
    letterSpacing: 0,
    lineHeight: 18,
  },
  contextTitle: {
    fontSize: 21,
    fontWeight: '800',
    letterSpacing: 0,
    lineHeight: 25,
  },
  coveredPanel: {
    minHeight: 116,
  },
  fieldBlock: {
    alignSelf: 'stretch',
    gap: 10,
    width: '100%',
  },
  formPanel: {
    alignSelf: 'stretch',
    gap: 18,
    width: '100%',
  },
  formStack: {
    alignSelf: 'stretch',
    gap: 18,
    width: '100%',
  },
  heroCopy: {
    alignItems: 'center',
    gap: 6,
  },
  heroPanel: {
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 8,
    paddingTop: 2,
  },
  heroSubtitle: {
    color: '#7A789A',
    fontSize: 13,
    fontWeight: '500',
    letterSpacing: 0,
    lineHeight: 18,
    maxWidth: 280,
    textAlign: 'center',
  },
  heroTitle: {
    fontSize: 28,
    fontWeight: '800',
    letterSpacing: 0,
    lineHeight: 32,
    textAlign: 'center',
  },
  loggedHeroCopy: {
    gap: 0,
  },
  loggedHeroPanel: {
    gap: 6,
    paddingTop: 0,
  },
  loggedHeroTitle: {
    fontSize: 25,
    lineHeight: 29,
  },
  loggedSummaryChips: {
    gap: 8,
  },
  loggedCloseRow: {
    minHeight: 44,
  },
  loggedTopSection: {
    paddingTop: 8,
  },
  noteInput: {
    borderRadius: radius.lg,
    fontSize: 16,
    fontWeight: '600',
    lineHeight: 22,
    minHeight: 126,
    paddingHorizontal: 16,
    paddingTop: 16,
  },
  photoActionCopy: {
    gap: 2,
    minWidth: 0,
    width: '100%',
  },
  photoActionFill: {
    alignItems: 'flex-start',
    gap: 10,
    justifyContent: 'center',
    minHeight: 96,
    minWidth: 0,
    paddingHorizontal: 16,
    paddingVertical: 14,
    width: '100%',
  },
  photoActionIcon: {
    alignItems: 'center',
    borderRadius: 13,
    height: 34,
    justifyContent: 'center',
    width: 34,
  },
  photoActionLabel: {
    fontSize: 14,
    fontWeight: '800',
    letterSpacing: 0,
    lineHeight: 18,
  },
  photoActionFlex: {
    flex: 1,
  },
  photoActionPressable: {
    alignSelf: 'stretch',
    borderRadius: radius.lg,
    flexShrink: 0,
    minWidth: 0,
  },
  photoActionPanel: {
    flex: 1,
    minHeight: 96,
    width: '100%',
  },
  photoActionGap: {
    flexShrink: 0,
    width: PHOTO_ACTION_GAP,
  },
  photoActions: {
    alignSelf: 'stretch',
    alignItems: 'stretch',
    flexDirection: 'row',
    width: '100%',
  },
  previewBody: {
    fontSize: 14,
    fontWeight: '600',
    letterSpacing: 0,
    lineHeight: 19,
  },
  previewCard: {
    minHeight: 118,
  },
  previewHeader: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 10,
  },
  previewHeaderCopy: {
    flex: 1,
    gap: 3,
    minWidth: 0,
  },
  previewImage: {
    height: '100%',
    width: '100%',
  },
  previewImageWrap: {
    borderRadius: radius.md,
    borderWidth: 1,
    height: 168,
    overflow: 'hidden',
  },
  previewTitle: {
    fontSize: 17,
    fontWeight: '800',
    letterSpacing: 0,
    lineHeight: 21,
  },
  quantityControls: {
    alignItems: 'center',
    borderRadius: radius.lg,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 10,
    padding: 10,
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
  },
  quantityValueDisplay: {
    alignItems: 'center',
    borderRadius: radius.md,
    borderWidth: 1,
    justifyContent: 'center',
    minHeight: 54,
    paddingHorizontal: 10,
    paddingVertical: 10,
  },
  quantityValueText: {
    fontSize: 22,
    fontWeight: '800',
    letterSpacing: 0,
    lineHeight: 27,
    textAlign: 'center',
  },
  quantityInputWrap: {
    flex: 1,
    gap: 6,
  },
  quantityStepButton: {
    alignItems: 'center',
    borderRadius: radius.pill,
    borderWidth: 1,
    height: 50,
    justifyContent: 'center',
    width: 50,
  },
  quantityUnitLabel: {
    textAlign: 'center',
  },
  removePhotoButton: {
    alignItems: 'center',
    backgroundColor: 'rgba(47, 35, 22, 0.9)',
    borderRadius: radius.pill,
    height: 24,
    justifyContent: 'center',
    position: 'absolute',
    right: 8,
    top: 8,
    width: 24,
  },
  sectionHeader: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  statusChip: {
    alignSelf: 'center',
  },
  streakPill: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 5,
  },
  streakPillLabel: {
    fontSize: 14,
    fontWeight: '800',
    letterSpacing: 0,
    lineHeight: 18,
  },
  summaryChip: {
    alignSelf: 'center',
  },
  summaryChips: {
    alignSelf: 'center',
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    justifyContent: 'center',
    maxWidth: 360,
  },
  topSection: {
    gap: 0,
  },
});
