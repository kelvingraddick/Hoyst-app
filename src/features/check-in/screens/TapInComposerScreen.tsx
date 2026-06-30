import React, {useEffect, useState} from 'react';
import {Alert, Image, Pressable, StyleSheet, View} from 'react-native';
import {Camera, ImagePlus, Trash2, X} from 'lucide-react-native';
import {launchCamera, launchImageLibrary} from 'react-native-image-picker';
import type {NativeStackScreenProps} from '@react-navigation/native-stack';

import {GlassPanel} from '../../../design/components/GlassPanel';
import {HoystButton} from '../../../design/components/HoystButton';
import {HoystChip} from '../../../design/components/HoystChip';
import {HoystInput} from '../../../design/components/HoystInput';
import {HoystScreen} from '../../../design/components/HoystScreen';
import {HoystText} from '../../../design/components/HoystText';
import {CircleCategoryPill} from '../../../design/components/CircleCategoryIcon';
import {TapInRingMark} from '../../../design/components/TapInRingMark';
import {TapInPulseButton} from '../../../design/components/TapInPulseButton';
import {
  getPulseRingStateForCircle,
  type PulseRingState,
} from '../../../design/components/pulse-ring-state';
import {actionMotion} from '../../../design/tokens/actions';
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

type Props = NativeStackScreenProps<RootStackParamList, 'TapInComposer'>;

const initialTapInDraft: TapInDraft = {
  note: '',
};

type ComposerActionProps = {
  disabled?: boolean;
  label: string;
  onPress?: () => void;
  ringState?: PulseRingState;
};

function ComposerPrimaryAction({
  disabled,
  label,
  onPress,
  ringState = 'active',
}: ComposerActionProps): React.JSX.Element {
  return (
    <TapInPulseButton
      disabled={disabled}
      label={label}
      onPress={onPress}
      ringState={ringState}
      variant="primary"
    />
  );
}

type ComposerUtilityActionProps = ComposerActionProps & {
  tone?: 'muted' | 'skip';
};

function ComposerUtilityAction({
  disabled,
  label,
  onPress,
  tone = 'muted',
}: ComposerUtilityActionProps): React.JSX.Element {
  const theme = useHoystTheme();
  const isSkip = tone === 'skip';
  const labelColor = isSkip ? theme.warningForeground : theme.textSubtle;

  return (
    <Pressable
      accessibilityRole="button"
      disabled={disabled}
      onPress={disabled ? undefined : onPress}
      style={({pressed}) => [
        styles.composerUtilityPressable,
        {
          opacity: disabled ? 0.42 : pressed ? actionMotion.pressedOpacity : 1,
          transform: [
            {scale: pressed && !disabled ? actionMotion.pressedScale : 1},
          ],
        },
      ]}>
      <View
        style={[
          styles.composerUtilityFill,
          {
            backgroundColor: isSkip ? theme.surfaceSoft : 'transparent',
            borderColor: isSkip ? theme.warningForeground : theme.border,
          },
        ]}>
        <HoystText
          numberOfLines={1}
          style={[styles.composerUtilityLabel, {color: labelColor}]}
          variant="button">
          {label}
        </HoystText>
      </View>
    </Pressable>
  );
}

export function TapInComposerScreen({
  navigation,
  route,
}: Props): React.JSX.Element {
  const theme = useHoystTheme();
  const [draft, setDraft] = useState<TapInDraft>(initialTapInDraft);
  const [detail, setDetail] = useState<CircleDetailModel | undefined>();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isRemovingTapIn, setIsRemovingTapIn] = useState(false);
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
      <HoystScreen contentContainerStyle={styles.content}>
        <View style={styles.closeRow}>
          <Pressable
            onPress={resetAndClose}
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
  const canSubmitTapIn = !detail.viewerHasTappedInToday;
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
  const canRemoveTodayCheckIn =
    detail.viewerTodayStatus === 'done' || detail.viewerTodayStatus === 'skip';
  const composerPulseRingState = getPulseRingStateForCircle(detail);
  const removeActionLabel =
    detail.viewerTodayStatus === 'skip' ? 'Remove Skip' : 'Remove Tap In';
  const checkedInStatusCopy =
    detail.viewerTodayStatus === 'skip'
      ? 'Your grace skip is covering today for this Circle.'
      : detail.viewerHasCheckedIn
      ? 'You are covered right now for this Circle.'
      : detail.commitmentCadence === 'daily'
      ? 'Your Tap In is counted for today.'
      : 'Your Tap In is counted for today. Keep going this week.';
  const removeProgressionCopy =
    detail.commitmentCadence === 'daily'
      ? "This will undo today's Progression for this Circle."
      : "This will undo this week's Progression for this Circle.";

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
      await submitTapIn({
        circleId: route.params.circleId,
        note: note.length > 0 ? note : undefined,
        photoUrl: draft.photoUri,
        status: checkInStatus,
      });

      if (checkInStatus === 'done') {
        triggerTapInSuccessHaptic();
      }

      navigation.replace('TapInComplete', {
        circleId: route.params.circleId,
        circleTitle: detail.title,
        commitment: detail.commitment,
        inviteUrl: detail.inviteUrl,
        progressLabel: detail.progressLabel,
        source: route.params.source,
        status: checkInStatus,
        streakLabel: detail.streakLabel,
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

  return (
    <HoystScreen contentContainerStyle={styles.content}>
      <View style={styles.closeRow}>
        <Pressable
          onPress={resetAndClose}
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
      </View>

      <GlassPanel style={styles.heroPanel}>
        <View style={styles.heroHeader}>
          <TapInRingMark
            centerTreatment="state"
            innerSize={44}
            outerSize={78}
            state={composerPulseRingState}
          />
          <View style={styles.heroCopy}>
            <HoystText style={styles.heroTitle} variant="display">
              Tap In
            </HoystText>
            <HoystText style={styles.centerText} tone="muted">
              Share today's proof, context, or momentum with your Circle.
            </HoystText>
          </View>
          <View style={styles.summaryChips}>
            <CircleCategoryPill category={detail.category} uppercase />
            <HoystChip label={progressLabel} tone="green" />
            <HoystChip label={statusLabel} tone="orange" />
          </View>
        </View>
      </GlassPanel>

      <GlassPanel style={styles.contextPanel}>
        <View style={styles.sectionHeader}>
          <HoystText tone="muted" variant="label">
            Circle Commitment
          </HoystText>
          <HoystText style={{color: theme.successForeground}} variant="caption">
            {detail.streakDays ?? 0}d streak
          </HoystText>
        </View>
        <View style={styles.contextCopy}>
          <HoystText style={styles.contextTitle}>{detail.title}</HoystText>
          <HoystText tone="muted">{detail.commitment}</HoystText>
        </View>
      </GlassPanel>

      <GlassPanel style={styles.formPanel}>
        {canRemoveTodayCheckIn ? (
          <View style={styles.checkedInState}>
            <View
              style={[
                styles.previewCard,
                {
                  backgroundColor: theme.surfaceSoft,
                  borderColor: theme.borderStrong,
                },
              ]}>
              <View style={styles.previewHeader}>
                <TapInRingMark
                  centerTreatment="state"
                  innerSize={22}
                  outerSize={40}
                  state={composerPulseRingState}
                />
                <View style={styles.previewHeaderCopy}>
                  <HoystText style={styles.previewTitle}>
                    Today is covered
                  </HoystText>
                  <HoystText tone="muted" variant="caption">
                    {checkedInStatusCopy}
                  </HoystText>
                </View>
              </View>
              <HoystText tone="muted">{removeProgressionCopy}</HoystText>
            </View>
            <View style={styles.actionStack}>
              <HoystButton
                borderColor={theme.dangerForeground}
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
                textColor={theme.dangerForeground}
                variant="outline"
              />
              <Pressable onPress={resetAndClose} style={styles.textAction}>
                <HoystText
                  style={styles.centerText}
                  tone="muted"
                  variant="bodyStrong">
                  Close
                </HoystText>
              </Pressable>
            </View>
          </View>
        ) : (
          <>
            <View style={styles.formStack}>
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
                  placeholder="Share what you did, how it went, or what your Circle should know."
                  style={styles.noteInput}
                  textAlignVertical="top"
                  value={draft.note}
                />
              </View>

              <View style={styles.fieldBlock}>
                <HoystText tone="muted" variant="label">
                  Photo
                </HoystText>
                <View style={styles.photoActions}>
                  <Pressable
                    onPress={handleTakePhoto}
                    style={({pressed}) => [
                      styles.photoActionPressable,
                      {
                        opacity: pressed ? actionMotion.pressedOpacity : 1,
                        transform: [
                          {scale: pressed ? actionMotion.pressedScale : 1},
                        ],
                      },
                    ]}>
                    <View
                      style={[
                        styles.photoActionFill,
                        {
                          backgroundColor: theme.surfaceHigh,
                          borderColor: theme.borderStrong,
                        },
                      ]}>
                      <View style={styles.photoActionIcon}>
                        <Camera
                          color={theme.textSubtle}
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
                  </Pressable>
                  <Pressable
                    onPress={handleChoosePhoto}
                    style={({pressed}) => [
                      styles.photoActionPressable,
                      {
                        opacity: pressed ? actionMotion.pressedOpacity : 1,
                        transform: [
                          {scale: pressed ? actionMotion.pressedScale : 1},
                        ],
                      },
                    ]}>
                    <View
                      style={[
                        styles.photoActionFill,
                        {
                          backgroundColor: theme.surfaceHigh,
                          borderColor: theme.borderStrong,
                        },
                      ]}>
                      <View style={styles.photoActionIcon}>
                        <ImagePlus
                          color={theme.textSubtle}
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
                  </Pressable>
                </View>
              </View>

              {shouldShowPreview ? (
                <View style={styles.fieldBlock}>
                  <HoystText tone="muted" variant="label">
                    Preview
                  </HoystText>
                  <View
                    style={[
                      styles.previewCard,
                      {
                        backgroundColor: theme.surfaceSoft,
                        borderColor: theme.borderStrong,
                      },
                    ]}>
                    <View style={styles.previewHeader}>
                      <TapInRingMark
                        centerTreatment="state"
                        innerSize={22}
                        outerSize={40}
                        state={composerPulseRingState}
                      />
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
                  </View>
                </View>
              ) : null}
            </View>

            <View style={styles.actionStack}>
              <ComposerPrimaryAction
                disabled={isSubmitting || !canSubmitTapIn}
                label={
                  isSubmitting
                    ? 'Submitting...'
                    : canSubmitTapIn
                    ? 'Confirm Tap In'
                    : 'Today already covered'
                }
                onPress={
                  isSubmitting || !canSubmitTapIn
                    ? undefined
                    : () => {
                        handleConfirm().catch(() => undefined);
                      }
                }
                ringState={composerPulseRingState}
              />
              {shouldShowSkipAction ? (
                <ComposerUtilityAction
                  disabled={isSubmitting || !canSkip}
                  label={skipActionLabel}
                  onPress={
                    isSubmitting || !canSkip
                      ? undefined
                      : () => {
                          handleConfirm('skip').catch(() => undefined);
                        }
                  }
                  tone="skip"
                />
              ) : null}
              <ComposerUtilityAction label="Discard" onPress={resetAndClose} />
            </View>
          </>
        )}
      </GlassPanel>
    </HoystScreen>
  );
}

const styles = StyleSheet.create({
  content: {
    paddingBottom: 60,
  },
  closeRow: {
    alignItems: 'flex-end',
  },
  closeButton: {
    alignItems: 'center',
    borderRadius: 16,
    borderWidth: 1,
    height: 34,
    justifyContent: 'center',
    width: 34,
  },
  heroPanel: {
    minHeight: 160,
  },
  heroHeader: {
    alignItems: 'center',
    gap: 10,
  },
  centerText: {
    textAlign: 'center',
  },
  heroCopy: {
    alignItems: 'center',
    gap: 6,
  },
  heroTitle: {
    textAlign: 'center',
  },
  summaryChips: {
    alignSelf: 'center',
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    justifyContent: 'center',
  },
  contextPanel: {
    minHeight: 118,
  },
  sectionHeader: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  contextCopy: {
    gap: 8,
  },
  contextTitle: {
    fontSize: 24,
    fontWeight: '800',
    lineHeight: 27,
  },
  formPanel: {
    minHeight: 420,
  },
  formStack: {
    gap: 18,
  },
  fieldBlock: {
    gap: 10,
  },
  checkedInState: {
    gap: 18,
  },
  actionStack: {
    gap: 10,
    marginTop: 6,
  },
  composerUtilityPressable: {
    borderRadius: radius.md,
    width: '100%',
  },
  composerUtilityFill: {
    alignItems: 'center',
    borderRadius: radius.md,
    borderWidth: 1,
    justifyContent: 'center',
    minHeight: 52,
    paddingHorizontal: 18,
    width: '100%',
  },
  composerUtilityLabel: {
    flexShrink: 1,
    fontSize: 15,
    fontWeight: '800',
    lineHeight: 19,
    textAlign: 'center',
  },
  textAction: {
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 44,
  },
  noteInput: {
    minHeight: 136,
    paddingTop: 16,
  },
  photoActions: {
    alignSelf: 'stretch',
    flexDirection: 'row',
    gap: 10,
    width: '100%',
  },
  photoActionPressable: {
    alignSelf: 'stretch',
    borderRadius: radius.md,
    flex: 1,
    flexBasis: 0,
    minWidth: 0,
  },
  photoActionFill: {
    alignItems: 'flex-start',
    borderRadius: radius.md,
    borderWidth: 1,
    justifyContent: 'center',
    gap: 10,
    minHeight: 86,
    minWidth: 0,
    paddingHorizontal: 14,
    paddingVertical: 12,
    width: '100%',
  },
  photoActionIcon: {
    alignItems: 'center',
    height: 24,
    justifyContent: 'center',
    width: 24,
  },
  photoActionCopy: {
    gap: 2,
    minWidth: 0,
    width: '100%',
  },
  photoActionLabel: {
    fontSize: 14,
    lineHeight: 18,
  },
  previewCard: {
    borderRadius: radius.md,
    borderWidth: 1,
    gap: 12,
    padding: 14,
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
  previewTitle: {
    fontSize: 18,
    fontWeight: '800',
    lineHeight: 22,
  },
  previewImageWrap: {
    borderRadius: radius.md,
    borderWidth: 1,
    height: 168,
    overflow: 'hidden',
  },
  previewImage: {
    height: '100%',
    width: '100%',
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
});
