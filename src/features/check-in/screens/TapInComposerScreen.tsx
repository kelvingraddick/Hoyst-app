import {DateTime} from 'luxon';
import {getTapInProofRequirement} from '../../../shared/tap-in-proof';
import {useProgress} from '../../progress/hooks/useProgress';
import React, {useCallback, useEffect, useMemo, useRef, useState} from 'react';
import {Alert, Image, View} from 'react-native';
import {Share2, Trash2} from 'lucide-react-native';
import {launchCamera, launchImageLibrary} from 'react-native-image-picker';
import type {NativeStackScreenProps} from '@react-navigation/native-stack';
import {getCircleCategoryVisual} from '../../../design/components/CircleCategoryIcon';
import {
  DesignSystemProvider,
  DSButton,
  DSFeedback,
  DSSurface,
  DSText,
  useSystemTheme,
} from '../../../design/system';
import {triggerTapInSuccessHaptic} from '../../../lib/haptics/tap-in-haptics';
import type {RootStackParamList} from '../../../navigation/types';
import {useHoyFeedbackStore} from '../../../store/hoy-feedback-store';
import {useUserProfileStore} from '../../../store/profile-store';
import {useSessionStore} from '../../../store/session-store';
import {useSettingsStore} from '../../../store/settings-store';
import type {CheckInStatus, CircleDetailModel} from '../../../types/models';
import {
  formatQuantityValue,
  getCheckInStatusForCoverage,
  getCommitmentType,
  getCoverageStatusForValue,
  getQuantityConfig,
  isSingleTapInCommitment,
} from '../../commitments/commitment-logic';
import {subscribeToMemberCircleDetail} from '../../home/services/home-data-service';
import {TapInDetailsSection} from '../components/TapInDetailsSection';
import {
  ComposerAction,
  ComposerDisclosure,
  ComposerHeader,
  ComposerPhoto,
  ComposerQuantity,
  ComposerQuietAction,
  ComposerSheet,
  composerStyles as styles,
} from '../components/TapInComposerPresentation';
import {
  removeTapIn,
  submitTapIn,
  uploadTapInPhoto,
} from '../services/check-in-service';

type Props = NativeStackScreenProps<RootStackParamList, 'TapInComposer'>;

export function TapInComposerScreen(props: Props): React.JSX.Element {
  const appearance = useSettingsStore(state => state.appearance);
  return (
    <DesignSystemProvider scheme={appearance}>
      <TapInComposerController {...props} />
    </DesignSystemProvider>
  );
}

function TapInComposerController({
  navigation,
  route,
}: Props): React.JSX.Element {
  const theme = useSystemTheme();
  const [active, setActive] = useState(navigation.isFocused?.() ?? true);
  const [reloadAttempt, setReloadAttempt] = useState(0);
  const [detailsScrollResetKey, setDetailsScrollResetKey] = useState(0);
  const handleDetailsExpansionChange = useCallback(
    () => setDetailsScrollResetKey(previousKey => previousKey + 1),
    [],
  );
  const uploadedPhoto = useRef<
    {uri: string; dateKey: string; url: string} | undefined
  >(undefined);
  const submissionLock = useRef(false);
  const removalLock = useRef(false);
  useEffect(() => {
    const focus = navigation.addListener('focus', () => setActive(true));
    const blur = navigation.addListener('blur', () => setActive(false));
    return () => {
      focus();
      blur();
    };
  }, [navigation]);
  const [liveDetail, setDetail] = useState<CircleDetailModel | undefined>();
  const submissionView = useRef<
    | {
        detail: CircleDetailModel;
        rewardState: ReturnType<typeof useProgress>;
      }
    | undefined
  >(undefined);
  const [hasResolvedDetail, setHasResolvedDetail] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isRemovingTapIn, setIsRemovingTapIn] = useState(false);
  const [hasDirtyDetails, setHasDirtyDetails] = useState(false);
  const [selectedPhotoUri, setSelectedPhotoUri] = useState<string>();
  const [quantityDraft, setQuantityDraft] = useState({text: '0', value: 0});
  const [hasEditedQuantity, setHasEditedQuantity] = useState(false);
  const liveRewardState = useProgress();
  const detail = submissionView.current?.detail ?? liveDetail;
  const rewardState = submissionView.current?.rewardState ?? liveRewardState;
  const profile = useUserProfileStore(state => state.profile);
  const status = useSessionStore(state => state.status);
  const user = useSessionStore(state => state.user);
  const queueHoyTapInCelebration = useHoyFeedbackStore(
    state => state.queueTapInCelebration,
  );
  const timezone = profile?.timezone ?? 'UTC';
  const canLoadDetail = status === 'authenticatedReady' && Boolean(user?.uid);

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
  }, [
    canLoadDetail,
    route.params.circleId,
    timezone,
    user?.uid,
    reloadAttempt,
  ]);

  const savedQuantityValue = useMemo(() => {
    const saved =
      detail?.viewerTodayCheckIn?.currentValue ?? detail?.currentValue ?? 0;
    return Number.isFinite(saved)
      ? Math.min(Number.MAX_SAFE_INTEGER, Math.max(0, Math.round(saved)))
      : 0;
  }, [detail?.currentValue, detail?.viewerTodayCheckIn?.currentValue]);

  useEffect(() => {
    if (!detail || hasEditedQuantity) {
      return;
    }

    setQuantityDraft({
      text: formatQuantityValue(savedQuantityValue),
      value: savedQuantityValue,
    });
  }, [detail, hasEditedQuantity, savedQuantityValue]);

  const resetAndClose = () => {
    navigation.goBack();
  };

  const quantityValue = quantityDraft.value;
  const hasValidQuantityInput = quantityDraft.text !== '';
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
          ? 'Discard Progress changes?'
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
      <ComposerSheet navigation={navigation}>
        <ComposerHeader onClose={resetAndClose} />
        <View style={styles.body}>
          <DSFeedback
            kind={hasResolvedDetail ? 'error' : 'loading'}
            title={hasResolvedDetail ? 'Circle unavailable' : 'Loading Tap In'}
            message={
              hasResolvedDetail
                ? 'This Tap In needs a real active Circle before you can submit.'
                : 'Getting today’s commitment ready.'
            }
            action={
              hasResolvedDetail ? (
                <DSButton
                  label="Try again"
                  variant="outline"
                  onPress={() => setReloadAttempt(value => value + 1)}
                />
              ) : undefined
            }
          />
        </View>
      </ComposerSheet>
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
  const submitActionLabel =
    isQuantityTapIn && detail.viewerHasTappedInToday
      ? 'Update Progress'
      : isQuantityTapIn
      ? 'Log Progress'
      : 'Tap In';
  const remainingPeriodCopy =
    detail.commitmentCadence === 'daily'
      ? 'today'
      : detail.commitmentCadence === 'monthly'
      ? 'this month'
      : 'this week';
  const viewerCycleRequiredCount = detail.viewerCycleRequiredCount ?? 0;
  const viewerCycleCoveredCount = detail.viewerCycleCoveredCount ?? 0;
  const cycleGoalMet =
    detail.commitmentCadence !== 'daily' &&
    viewerCycleRequiredCount > 0 &&
    viewerCycleCoveredCount >= viewerCycleRequiredCount;
  const statusLabel =
    detail.state === 'risk'
      ? 'Streak at risk'
      : cycleGoalMet
      ? detail.commitmentCadence === 'monthly'
        ? 'Monthly goal met'
        : 'Weekly goal met'
      : detail.viewerTodayStatus === 'skip'
      ? 'Skipped today'
      : detail.viewerHasTappedInToday
      ? 'Saved today'
      : detail.viewerHasCheckedIn
      ? 'Commitment complete'
      : detail.remainingCheckIns === 1
      ? `1 Tap In left ${remainingPeriodCopy}`
      : `${detail.remainingCheckIns ?? 0} Tap Ins left ${remainingPeriodCopy}`;
  const availableSkips = rewardState.summary?.inventory.skips;
  const isSkipAvailabilityKnown = typeof availableSkips === 'number';
  const canSubmitTapIn =
    !detail.viewerHasTappedInToday ||
    detail.viewerTodayStatus === 'skip' ||
    isQuantityTapIn;
  const canSkip =
    !detail.viewerHasCheckedIn &&
    rewardState.summary?.flags.inventory === true &&
    canSubmitTapIn &&
    isSkipAvailabilityKnown &&
    availableSkips > 0;
  const shouldShowSkipAction = !detail.viewerHasCheckedIn && canSubmitTapIn;
  const skipActionLabel = !isSkipAvailabilityKnown
    ? 'Loading your skips'
    : availableSkips > 0
    ? `Use Skip (${availableSkips} left)`
    : 'No skips left';
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
  const proofRequirement = getTapInProofRequirement(detail, viewerTodayCheckIn);
  const needsPhotoForCompletion =
    proofRequirement === 'photo' &&
    (!isQuantityTapIn || quantityCoverageStatus === 'covered');
  const isMissingRequiredPhoto =
    needsPhotoForCompletion && !selectedPhotoUri && !viewerTodayPhotoUrl;
  const removeActionLabel =
    detail.viewerTodayStatus === 'skip' ? 'Remove Skip' : 'Remove Tap In';
  const removeProgressCopy =
    isQuantityTapIn && hasRemovableTodayCheckIn
      ? "Removing this will delete today's saved quantity and reopen this Opportunity."
      : isViewingLoggedTapIn
      ? "Removing this will reopen today's Opportunity and lower this Circle's Progress."
      : 'This will undo Progress for this Cycle.';
  const quantityStep = Math.max(1, Math.round(quantityConfig.stepValue ?? 1));

  const stepQuantity = (direction: -1 | 1) => {
    setHasEditedQuantity(true);
    setQuantityDraft(previous => {
      const value = Math.min(
        Number.MAX_SAFE_INTEGER,
        Math.max(0, previous.value + direction * quantityStep),
      );
      return {text: formatQuantityValue(value), value};
    });
  };

  const editQuantity = (text: string) => {
    if (
      !/^\d*$/.test(text) ||
      (text !== '' && !Number.isSafeInteger(Number(text)))
    ) {
      return;
    }
    setHasEditedQuantity(true);
    setQuantityDraft(previous => ({
      text,
      value: text === '' ? previous.value : Number(text),
    }));
  };

  const finishQuantityEditing = () => {
    setQuantityDraft(previous => ({
      ...previous,
      text: formatQuantityValue(previous.value),
    }));
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
    if (
      submissionLock.current ||
      removalLock.current ||
      !canSubmitTapIn ||
      (checkInStatus === 'done' &&
        (isMissingRequiredPhoto || hasDirtyDetails)) ||
      (checkInStatus === 'done' && isQuantityTapIn && !hasValidQuantityInput) ||
      (checkInStatus === 'skip' && !canSkip)
    ) {
      return;
    }
    submissionLock.current = true;
    submissionView.current = {detail, rewardState};
    setIsSubmitting(true);
    const submittedAt = Date.now();
    let didNavigate = false;
    try {
      let savedPhotoUrl = viewerTodayPhotoUrl;
      // Optional confirmation photos retain the post-completion upload flow.
      if (
        checkInStatus === 'done' &&
        selectedPhotoUri &&
        (proofRequirement === 'photo' || isQuantityTapIn)
      ) {
        if (!user?.uid) {
          throw new Error('Sign in before uploading Photo proof.');
        }
        const dateKey = DateTime.now()
          .setZone(detail.timezone ?? timezone)
          .toISODate();
        if (!dateKey) {
          throw new Error('Could not determine today’s Tap In date.');
        }
        if (
          uploadedPhoto.current?.uri !== selectedPhotoUri ||
          uploadedPhoto.current.dateKey !== dateKey
        ) {
          const url = await uploadTapInPhoto({
            circleId: route.params.circleId,
            dateKey,
            uid: user.uid,
            uri: selectedPhotoUri,
          });
          uploadedPhoto.current = {uri: selectedPhotoUri, dateKey, url};
        }
        savedPhotoUrl = uploadedPhoto.current.url;
      }
      const result = await submitTapIn(
        {
          ...(checkInStatus === 'done' && savedPhotoUrl
            ? {photoUrl: savedPhotoUrl}
            : {}),
          circleId: route.params.circleId,
          ...(checkInStatus === 'done' && isQuantityTapIn
            ? {currentValue: quantityValue}
            : {}),
          status: checkInStatus,
        },
        {mode: detail.circleMode, cadence: detail.commitmentCadence},
      );

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
      const viewerWasAlreadyCovered =
        detail.viewerTodayStatus === 'done' &&
        (detail.viewerTodayCheckIn?.coverageStatus === undefined ||
          detail.viewerTodayCheckIn.coverageStatus === 'covered');

      if (
        checkInStatus === 'done' &&
        completionStatus === 'done' &&
        !viewerWasAlreadyCovered &&
        user?.uid
      ) {
        queueHoyTapInCelebration({
          circleId: route.params.circleId,
          dateKey: result.dateKey,
          uid: user.uid,
        });
      }

      navigation.replace('TapInComplete', {
        ...(result.completionId
          ? {completionId: result.completionId, completionOwnerUid: user?.uid}
          : {}),
        submittedAt,
        proofRequirement: result.proofRequirement ?? proofRequirement,
        category: detail.category,
        appearance: detail.appearance,
        circleId: route.params.circleId,
        circleMode: detail.circleMode,
        commitmentCadence: detail.commitmentCadence,
        timezone: detail.timezone,
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
        circleProgress: result.circleProgress,
        completionMomentum: result.momentum,
        completionProgress: result.progress,
        dateKey: result.dateKey,
        inviteUrl: detail.inviteUrl,
        memberCount: detail.memberCount,
        members: detail.members,
        periodTapInCount: detail.periodTapInCount,
        progressLabel: detail.progressLabel,
        source: route.params.source,
        status: completionStatus,
        streakDays: detail.streakDays,
        streakLabel: detail.streakLabel,
        ...(checkInStatus === 'done' &&
        (result.photoUrl || savedPhotoUrl || selectedPhotoUri)
          ? {photoUri: result.photoUrl || savedPhotoUrl || selectedPhotoUri}
          : {}),
      });
      didNavigate = true;
    } catch (error) {
      const reason = (error as {details?: {reason?: string}}).details?.reason;
      if (
        reason === 'invalid-photo-proof' ||
        reason === 'photo-proof-required'
      ) {
        uploadedPhoto.current = undefined;
        setReloadAttempt(value => value + 1);
      }
      Alert.alert(
        'Tap In failed',
        (error as {message?: string}).message ??
          'Could not submit your Tap In. Try again.',
      );
    } finally {
      if (!didNavigate) {
        submissionLock.current = false;
        submissionView.current = undefined;
        setIsSubmitting(false);
      }
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
    if (removalLock.current || submissionLock.current) {
      return;
    }
    removalLock.current = true;
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
      removalLock.current = false;
      setIsRemovingTapIn(false);
    }
  };

  const confirmRemoveTapIn = () => {
    Alert.alert('Remove today?', removeProgressCopy, [
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
      category: detail.category,
      appearance: detail.appearance,
      circleId: route.params.circleId,
      circleTitle: detail.title,
      commitment: detail.commitment,
      commitmentType,
      inviteUrl: detail.inviteUrl,
      memberCount: detail.memberCount,
      members: detail.members,
      circleMode: detail.circleMode,
      commitmentCadence: detail.commitmentCadence,
      timezone: detail.timezone,
      dateKey:
        viewerTodayCheckIn?.dateKey ??
        DateTime.now()
          .setZone(detail.timezone ?? timezone)
          .toISODate()!,
      status: viewerTodayCheckIn?.status,
      coverageStatus: viewerTodayCheckIn?.coverageStatus,
      currentValue: viewerTodayCheckIn?.currentValue,
      minimumValue: viewerTodayCheckIn?.minimumValue ?? detail.minimumValue,
      maximumValue: viewerTodayCheckIn?.maximumValue ?? detail.maximumValue,
      targetValue: viewerTodayCheckIn?.targetValue ?? detail.targetValue,
      unitLabel: viewerTodayCheckIn?.unitLabel ?? detail.unitLabel,
      photoUri: viewerTodayPhotoUrl,
      source: route.params.source,
    });
  };

  const category = getCircleCategoryVisual(
    detail.category,
    detail.appearance,
  ).tone;
  const blocked = isSubmitting || isRemovingTapIn;
  const detailsEditor =
    viewerTodayCheckIn?.dateKey && detail.viewerTodayStatus !== 'skip' ? (
      <TapInDetailsSection
        circleId={route.params.circleId}
        dateKey={viewerTodayCheckIn.dateKey}
        initialNote={viewerTodayNote}
        initialPhotoUrl={viewerTodayPhotoUrl}
        photoRequired={
          proofRequirement === 'photo' && viewerTodayCheckIn.status === 'done'
        }
        proofRequiredForCompletion={proofRequirement === 'photo'}
        presentation="composer"
        category={category}
        onDirtyChange={setHasDirtyDetails}
        onExpansionChange={handleDetailsExpansionChange}
      />
    ) : null;
  const removeAction = (
    <ComposerDisclosure
      title={isRemovingTapIn ? 'Removing...' : removeActionLabel}
      busy={isRemovingTapIn}
      disabled={blocked}
      onPress={confirmRemoveTapIn}
      tone="danger"
      showChevron={false}
      testID="tap-in-composer-remove-action"
      leading={<Trash2 color={theme.danger} size={20} />}
    />
  );

  return (
    <ComposerSheet
      navigation={navigation}
      scrollResetKey={detailsScrollResetKey}
      footer={
        !shouldShowCheckedInReview ? (
          <View
            style={styles.footerActions}
            testID="tap-in-composer-action-footer">
            <ComposerAction
              category={category}
              active={active}
              busy={isSubmitting}
              disabled={
                blocked ||
                !canSubmitTapIn ||
                isMissingRequiredPhoto ||
                hasDirtyDetails ||
                (isQuantityTapIn && !hasValidQuantityInput)
              }
              label={
                isSubmitting
                  ? 'Submitting...'
                  : canSubmitTapIn
                  ? submitActionLabel
                  : 'Today already covered'
              }
              onPress={() => handleConfirm().catch(() => undefined)}
            />
            {shouldShowSkipAction ? (
              <ComposerQuietAction
                label={skipActionLabel}
                disabled={blocked || !canSkip}
                onPress={confirmSkip}
              />
            ) : null}
          </View>
        ) : undefined
      }>
      <ComposerHeader
        detail={detail}
        status={statusLabel}
        onClose={resetAndClose}
      />
      <View style={styles.body}>
        {shouldShowCheckedInReview ? (
          <View style={styles.stack}>
            <DSSurface kind="message">
              <View style={styles.statusRow}>
                <DSText variant="title">
                  {detail.viewerTodayStatus === 'skip'
                    ? 'Today is covered'
                    : "Today's proof"}
                </DSText>
                <DSText
                  variant="secondary"
                  tone={
                    detail.viewerTodayStatus === 'skip' ? 'warning' : 'success'
                  }>
                  {detail.viewerTodayStatus === 'skip' ? 'Skipped' : 'Saved'}
                </DSText>
              </View>
              <DSText tone={viewerTodayNote ? 'text' : 'muted'}>
                {detail.viewerTodayStatus === 'skip'
                  ? 'Your skip protects today for this Circle.'
                  : viewerTodayNote ||
                    'No note added. Your Tap In still counts.'}
              </DSText>
              {viewerTodayPhotoUrl ? (
                <Image
                  source={{uri: viewerTodayPhotoUrl}}
                  resizeMode="cover"
                  style={styles.proofImage}
                  testID="tap-in-view-proof-image"
                  accessibilityLabel="Saved Tap In photo"
                />
              ) : null}
            </DSSurface>
            {detailsEditor}
            {isViewingLoggedTapIn ? (
              <ComposerDisclosure
                title="Share Story"
                onPress={shareStory}
                testID="tap-in-composer-share-story"
                leading={<Share2 color={theme.muted} size={20} />}
              />
            ) : null}
            {removeAction}
          </View>
        ) : (
          <>
            {isQuantityTapIn ? (
              <ComposerQuantity
                detail={detail}
                value={quantityValue}
                inputText={quantityDraft.text}
                onChangeText={editQuantity}
                onEndEditing={finishQuantityEditing}
                active={active}
                onDecrease={() => stepQuantity(-1)}
                onIncrease={() => stepQuantity(1)}
                disabled={blocked}
                saved={detail.viewerHasTappedInToday && !hasDirtyQuantity}
              />
            ) : null}
            {!isQuantityTapIn || !viewerTodayCheckIn ? (
              <ComposerPhoto
                uri={selectedPhotoUri}
                required={proofRequirement === 'photo'}
                onAdd={openPhotoPicker}
                onRemove={() => setSelectedPhotoUri(undefined)}
                disabled={blocked}
              />
            ) : null}
            {isMissingRequiredPhoto ? (
              <DSText
                variant="secondary"
                tone="muted"
                accessibilityLiveRegion="polite">
                Add Photo proof before completing this Tap In.
              </DSText>
            ) : null}
            {isQuantityTapIn ? detailsEditor : null}
            {isQuantityTapIn && hasRemovableTodayCheckIn ? removeAction : null}
          </>
        )}
      </View>
    </ComposerSheet>
  );
}
