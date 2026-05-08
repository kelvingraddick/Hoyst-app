import React, {useEffect, useState} from 'react';
import {Alert, Image, Pressable, StyleSheet, View} from 'react-native';
import {Camera, ImagePlus, X} from 'lucide-react-native';
import {launchCamera, launchImageLibrary} from 'react-native-image-picker';
import type {NativeStackScreenProps} from '@react-navigation/native-stack';

import {GlassPanel} from '../../../design/components/GlassPanel';
import {HoystButton} from '../../../design/components/HoystButton';
import {HoystChip} from '../../../design/components/HoystChip';
import {HoystInput} from '../../../design/components/HoystInput';
import {HoystScreen} from '../../../design/components/HoystScreen';
import {HoystText} from '../../../design/components/HoystText';
import {TapInRingMark} from '../../../design/components/TapInRingMark';
import {radius} from '../../../design/tokens/radius';
import {useHoystTheme} from '../../../design/theme/useHoystTheme';
import {submitTapIn} from '../services/check-in-service';
import type {CircleDetailModel, TapInDraft} from '../../../types/models';
import type {RootStackParamList} from '../../../navigation/types';
import {useUserProfileStore} from '../../../store/profile-store';
import {useSessionStore} from '../../../store/session-store';
import {subscribeToMemberCircleDetail} from '../../home/services/home-data-service';

type Props = NativeStackScreenProps<RootStackParamList, 'TapInComposer'>;

const initialTapInDraft: TapInDraft = {
  note: '',
};

export function TapInComposerScreen({
  navigation,
  route,
}: Props): React.JSX.Element {
  const theme = useHoystTheme();
  const [draft, setDraft] = useState<TapInDraft>(initialTapInDraft);
  const [detail, setDetail] = useState<CircleDetailModel | undefined>();
  const [isSubmitting, setIsSubmitting] = useState(false);
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
            This Tap In needs a real active circle before you can submit.
          </HoystText>
        </GlassPanel>
      </HoystScreen>
    );
  }

  const notePreview =
    draft.note.trim().length > 0
      ? draft.note.trim()
      : 'Your circle will see the note you add here.';
  const statusLabel =
    detail.state === 'risk'
      ? 'Group streak at risk'
      : detail.viewerHasCheckedIn
        ? 'Already tapped in'
        : `${detail.remainingCheckIns ?? 0} pending today`;

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

  const handleConfirm = async () => {
    const note = draft.note.trim();

    setIsSubmitting(true);
    try {
      await submitTapIn({
        circleId: route.params.circleId,
        note: note.length > 0 ? note : undefined,
        photoUrl: draft.photoUri,
      });

      navigation.replace('TapInComplete', {
        circleId: route.params.circleId,
        source: route.params.source,
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
        <View style={styles.iconWrap}>
          <TapInRingMark innerSize={56} outerSize={100} />
        </View>
        <View style={styles.titleBlock}>
          <HoystText style={styles.centerText} variant="display">
            Tap In
          </HoystText>
          <HoystText style={styles.centerText} tone="muted">
            Give your circle the useful proof, context, or momentum from today.
          </HoystText>
        </View>
        <View style={styles.summaryChips}>
          <HoystChip label={detail.category.toUpperCase()} tone="neutral" />
          <HoystChip label={`${detail.completionRate}% in`} tone="green" />
          <HoystChip label={statusLabel} tone="orange" />
        </View>
      </GlassPanel>

      <GlassPanel style={styles.contextPanel}>
        <View style={styles.sectionHeader}>
          <HoystText tone="muted" variant="label">
            Today's Circle
          </HoystText>
          <HoystText style={{color: theme.success}} variant="caption">
            {detail.streakDays ?? 0}d streak
          </HoystText>
        </View>
        <View style={styles.contextCopy}>
          <HoystText style={styles.contextTitle}>{detail.title}</HoystText>
          <HoystText tone="muted">{detail.dailyTask}</HoystText>
        </View>
      </GlassPanel>

      <GlassPanel style={styles.formPanel}>
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
            placeholder="Share what you did, how it went, or what your circle should know."
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
                styles.photoAction,
                {
                  backgroundColor: theme.surfaceSoft,
                  borderColor: theme.border,
                  opacity: pressed ? 0.92 : 1,
                },
              ]}>
              <Camera color={theme.textSubtle} size={22} strokeWidth={2.1} />
              <HoystText tone="muted" variant="tiny">
                Take Photo
              </HoystText>
            </Pressable>
            <Pressable
              onPress={handleChoosePhoto}
              style={({pressed}) => [
                styles.photoAction,
                {
                  backgroundColor: theme.surfaceSoft,
                  borderColor: theme.border,
                  opacity: pressed ? 0.92 : 1,
                },
              ]}>
              <ImagePlus color={theme.textSubtle} size={22} strokeWidth={2.1} />
              <HoystText tone="muted" variant="tiny">
                Library
              </HoystText>
            </Pressable>
          </View>
        </View>

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
              <TapInRingMark innerSize={22} outerSize={40} />
              <View style={styles.previewHeaderCopy}>
                <HoystText style={styles.previewTitle}>
                  {detail.title}
                </HoystText>
                <HoystText tone="muted" variant="caption">
                  {detail.dailyTask}
                </HoystText>
              </View>
            </View>
            <HoystText tone={draft.note.trim() ? 'primary' : 'muted'}>
              {notePreview}
            </HoystText>
            <View
              style={[
                styles.previewImageWrap,
                {
                  backgroundColor: theme.surfaceHigh,
                  borderColor: theme.border,
                },
              ]}>
              {draft.photoUri ? (
                <>
                  <Image
                    source={{uri: draft.photoUri}}
                    style={styles.previewImage}
                  />
                  <Pressable
                    onPress={() =>
                      setDraft(current => ({...current, photoUri: undefined}))
                    }
                    style={styles.removePhotoButton}>
                    <X color={theme.text} size={14} strokeWidth={2.2} />
                  </Pressable>
                </>
              ) : (
                <View style={styles.previewEmpty}>
                  <ImagePlus
                    color={theme.textSubtle}
                    size={20}
                    strokeWidth={2.1}
                  />
                  <HoystText tone="muted" variant="caption">
                    Add a photo to include it here.
                  </HoystText>
                </View>
              )}
            </View>
          </View>
        </View>

        <HoystButton
          label={isSubmitting ? 'Submitting...' : 'Confirm Tap In'}
          onPress={
            isSubmitting
              ? undefined
              : () => {
                  handleConfirm().catch(() => undefined);
                }
          }
          variant="secondary"
        />
        <Pressable onPress={resetAndClose}>
          <HoystText style={styles.centerText} tone="muted" variant="bodyStrong">
            Discard
          </HoystText>
        </Pressable>
      </GlassPanel>
    </HoystScreen>
  );
}

const styles = StyleSheet.create({
  content: {
    paddingBottom: 168,
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
    minHeight: 238,
  },
  iconWrap: {
    alignItems: 'center',
  },
  titleBlock: {
    gap: 8,
  },
  centerText: {
    textAlign: 'center',
  },
  summaryChips: {
    alignSelf: 'center',
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    justifyContent: 'center',
  },
  contextPanel: {
    minHeight: 130,
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
    minHeight: 480,
  },
  fieldBlock: {
    gap: 10,
  },
  noteInput: {
    minHeight: 136,
    paddingTop: 16,
  },
  photoActions: {
    flexDirection: 'row',
    gap: 14,
  },
  photoAction: {
    alignItems: 'center',
    borderRadius: radius.md,
    borderWidth: 1,
    flex: 1,
    gap: 10,
    justifyContent: 'center',
    minHeight: 92,
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
    minHeight: 168,
    overflow: 'hidden',
  },
  previewImage: {
    height: '100%',
    width: '100%',
  },
  previewEmpty: {
    alignItems: 'center',
    flex: 1,
    gap: 8,
    justifyContent: 'center',
    minHeight: 168,
    padding: 16,
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
