import React, {useCallback, useEffect, useRef, useState} from 'react';
import {Alert, Image, Pressable, StyleSheet, View} from 'react-native';
import {
  Camera,
  ChevronDown,
  ChevronUp,
  ImagePlus,
  Pencil,
  RefreshCw,
  Trash2,
  UploadCloud,
} from 'lucide-react-native';
import {launchCamera, launchImageLibrary} from 'react-native-image-picker';

import {GlassPanel} from '../../../design/components/GlassPanel';
import {HoystInput} from '../../../design/components/HoystInput';
import {HoystText} from '../../../design/components/HoystText';
import {TapInActionButton} from '../../../design/components/TapInActionButton';
import {actionMotion} from '../../../design/tokens/actions';
import {radius} from '../../../design/tokens/radius';
import {useHoystTheme} from '../../../design/theme/useHoystTheme';
import {useSessionStore} from '../../../store/session-store';
import {
  updateTapInDetails,
  uploadTapInPhoto,
} from '../services/check-in-service';

export type SavedTapInDetails = {
  note?: string;
  photoUrl?: string;
};

type Props = {
  autoSaveInitialPhoto?: boolean;
  circleId: string;
  dateKey: string;
  initialNote?: string;
  initialPhotoUrl?: string;
  onDirtyChange?: (isDirty: boolean) => void;
  onSaved?: (details: SavedTapInDetails) => void;
};

function isRemotePhoto(value?: string) {
  return Boolean(value && /^https?:\/\//i.test(value));
}

export function TapInDetailsSection({
  autoSaveInitialPhoto = false,
  circleId,
  dateKey,
  initialNote,
  initialPhotoUrl,
  onDirtyChange,
  onSaved,
}: Props): React.JSX.Element {
  const theme = useHoystTheme();
  const user = useSessionStore(state => state.user);
  const [isExpanded, setIsExpanded] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState<string>();
  const [persistedNote, setPersistedNote] = useState(initialNote ?? '');
  const [persistedPhotoUrl, setPersistedPhotoUrl] = useState(
    isRemotePhoto(initialPhotoUrl) ? initialPhotoUrl : undefined,
  );
  const [noteDraft, setNoteDraft] = useState(initialNote ?? '');
  const [localPhotoUri, setLocalPhotoUri] = useState<string | undefined>(
    isRemotePhoto(initialPhotoUrl) ? undefined : initialPhotoUrl,
  );
  const [isPhotoRemoved, setIsPhotoRemoved] = useState(false);
  const savedNote = persistedNote.trim();
  const savedPhotoUrl = persistedPhotoUrl;
  const visiblePhotoUri =
    localPhotoUri ?? (isPhotoRemoved ? undefined : savedPhotoUrl);
  const trimmedDraft = noteDraft.trim();
  const hasSavedDetails = Boolean(savedNote || savedPhotoUrl);
  const isDirty =
    trimmedDraft !== savedNote ||
    Boolean(localPhotoUri) ||
    (isPhotoRemoved && Boolean(savedPhotoUrl));
  const isDirtyRef = useRef(isDirty);
  const isExpandedRef = useRef(isExpanded);
  const autoSaveAttemptedPhotoRef = useRef<string | undefined>(undefined);

  isDirtyRef.current = isDirty;
  isExpandedRef.current = isExpanded;

  useEffect(() => {
    onDirtyChange?.(isDirty);

    return () => onDirtyChange?.(false);
  }, [isDirty, onDirtyChange]);

  useEffect(() => {
    if (isExpandedRef.current && isDirtyRef.current) {
      return;
    }

    const nextNote = initialNote ?? '';
    const nextPhotoUrl = isRemotePhoto(initialPhotoUrl)
      ? initialPhotoUrl
      : undefined;

    setPersistedNote(nextNote);
    setPersistedPhotoUrl(nextPhotoUrl);
    setNoteDraft(nextNote);
    setLocalPhotoUri(
      isRemotePhoto(initialPhotoUrl) ? undefined : initialPhotoUrl,
    );
    setIsPhotoRemoved(false);
    setSaveError(undefined);
  }, [initialNote, initialPhotoUrl]);

  const resetDraft = () => {
    setNoteDraft(savedNote);
    setLocalPhotoUri(undefined);
    setIsPhotoRemoved(false);
    setSaveError(undefined);
  };

  const closeEditor = () => {
    if (!isDirty || isSaving) {
      setIsExpanded(false);
      return;
    }

    Alert.alert('Discard detail changes?', 'Your note or photo is not saved.', [
      {style: 'cancel', text: 'Keep editing'},
      {
        onPress: () => {
          resetDraft();
          setIsExpanded(false);
        },
        style: 'destructive',
        text: 'Discard',
      },
    ]);
  };

  const choosePhoto = async () => {
    const response = await launchImageLibrary({
      mediaType: 'photo',
      quality: 0.8,
      selectionLimit: 1,
    });
    const uri = response.assets?.[0]?.uri;

    if (uri) {
      setLocalPhotoUri(uri);
      setIsPhotoRemoved(false);
      setSaveError(undefined);
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
      setLocalPhotoUri(uri);
      setIsPhotoRemoved(false);
      setSaveError(undefined);
    }
  };

  const saveDetails = useCallback(
    async ({
      collapseOnSuccess = true,
      showAlertOnError = true,
    }: {
      collapseOnSuccess?: boolean;
      showAlertOnError?: boolean;
    } = {}) => {
      if (!user?.uid) {
        const message = 'Sign in before saving Tap In details.';

        setSaveError(message);
        if (showAlertOnError) {
          Alert.alert('Sign in required', message);
        }
        return;
      }

      setIsSaving(true);
      setSaveError(undefined);
      try {
        let nextPhotoUrl = isPhotoRemoved ? null : savedPhotoUrl ?? null;

        if (localPhotoUri) {
          nextPhotoUrl = await uploadTapInPhoto({
            circleId,
            dateKey,
            uid: user.uid,
            uri: localPhotoUri,
          });
        }

        const result = await updateTapInDetails({
          circleId,
          note: trimmedDraft.length > 0 ? trimmedDraft : null,
          photoUrl: nextPhotoUrl,
        });
        const details = {
          ...(result.note ? {note: result.note} : {}),
          ...(result.photoUrl ? {photoUrl: result.photoUrl} : {}),
        };

        setLocalPhotoUri(undefined);
        setIsPhotoRemoved(false);
        setPersistedNote(result.note ?? '');
        setPersistedPhotoUrl(result.photoUrl ?? undefined);
        setNoteDraft(result.note ?? '');
        if (collapseOnSuccess) {
          setIsExpanded(false);
        }
        onSaved?.(details);
      } catch (error) {
        const message =
          (error as {message?: string}).message ?? 'Try again in a moment.';

        setSaveError(message);
        if (showAlertOnError) {
          Alert.alert('Could not save details', message);
        }
      } finally {
        setIsSaving(false);
      }
    },
    [
      circleId,
      dateKey,
      isPhotoRemoved,
      localPhotoUri,
      onSaved,
      savedPhotoUrl,
      trimmedDraft,
      user?.uid,
    ],
  );

  useEffect(() => {
    if (
      !autoSaveInitialPhoto ||
      !localPhotoUri ||
      autoSaveAttemptedPhotoRef.current === localPhotoUri
    ) {
      return;
    }

    autoSaveAttemptedPhotoRef.current = localPhotoUri;
    saveDetails({collapseOnSuccess: false, showAlertOnError: false}).catch(
      () => undefined,
    );
  }, [autoSaveInitialPhoto, localPhotoUri, saveDetails]);

  const isRetryingInitialPhoto = Boolean(saveError && localPhotoUri);
  const disclosureTitle = isSaving
    ? 'Saving photo...'
    : isRetryingInitialPhoto
    ? 'Retry photo upload'
    : hasSavedDetails
    ? 'Edit details'
    : 'Add details';
  const disclosureSubtitle = isSaving
    ? 'Your Tap In is already saved'
    : isRetryingInitialPhoto
    ? 'Tap In saved. Photo needs another try.'
    : 'Optional note or photo';
  const openDetails = () => {
    if (isSaving) {
      return;
    }

    if (isRetryingInitialPhoto) {
      saveDetails({collapseOnSuccess: false, showAlertOnError: false}).catch(
        () => undefined,
      );
      return;
    }

    setIsExpanded(true);
  };

  if (!isExpanded) {
    return (
      <Pressable
        accessibilityLabel={disclosureTitle}
        accessibilityRole="button"
        disabled={isSaving}
        onPress={openDetails}
        style={({pressed}) => [
          styles.disclosurePressable,
          {opacity: pressed ? actionMotion.pressedOpacity : 1},
        ]}
        testID="tap-in-details-disclosure">
        <View
          style={[
            styles.disclosureSurface,
            {
              backgroundColor: theme.actionSurface,
              borderColor: theme.actionBorder,
              shadowColor: theme.actionShadowColor,
            },
          ]}
          testID="tap-in-details-disclosure-surface">
          <View
            style={[
              styles.disclosureIcon,
              {
                backgroundColor: theme.isDark
                  ? 'rgba(122,85,255,0.20)'
                  : 'rgba(122,85,255,0.10)',
              },
            ]}>
            {isSaving ? (
              <UploadCloud
                color={theme.accentSecondaryForeground}
                size={18}
                strokeWidth={2.3}
              />
            ) : isRetryingInitialPhoto ? (
              <RefreshCw
                color={theme.warningForeground}
                size={18}
                strokeWidth={2.3}
              />
            ) : (
              <Pencil
                color={theme.accentSecondaryForeground}
                size={17}
                strokeWidth={2.3}
              />
            )}
          </View>

          <View style={styles.disclosureCopy}>
            <HoystText style={styles.disclosureTitle}>
              {disclosureTitle}
            </HoystText>
            <HoystText tone="muted" variant="caption">
              {disclosureSubtitle}
            </HoystText>
          </View>

          <View
            style={[
              styles.disclosureChevron,
              {backgroundColor: theme.surfaceSoft},
            ]}>
            <ChevronDown color={theme.textMuted} size={20} strokeWidth={2.2} />
          </View>
        </View>
      </Pressable>
    );
  }

  return (
    <GlassPanel style={styles.editorPanel}>
      <View style={styles.editorHeader}>
        <View style={styles.editorHeaderCopy}>
          <HoystText style={styles.editorTitle}>
            {hasSavedDetails ? 'Edit Tap In details' : 'Add Tap In details'}
          </HoystText>
          <HoystText tone="muted" variant="caption">
            Add context now or update it later today.
          </HoystText>
        </View>
        <Pressable
          accessibilityLabel="Close details editor"
          accessibilityRole="button"
          hitSlop={8}
          onPress={closeEditor}
          style={styles.collapseButton}>
          <ChevronUp color={theme.textMuted} size={21} strokeWidth={2.2} />
        </Pressable>
      </View>

      <View style={styles.fieldBlock}>
        <HoystText tone="muted" variant="label">
          Optional Note
        </HoystText>
        <HoystInput
          maxLength={1000}
          multiline
          numberOfLines={4}
          onChangeText={setNoteDraft}
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
          value={noteDraft}
        />
      </View>

      <View style={styles.photoActions}>
        <Pressable
          accessibilityLabel="Take photo"
          accessibilityRole="button"
          onPress={() => takePhoto().catch(() => undefined)}
          style={({pressed}) => [
            styles.photoAction,
            {
              backgroundColor: theme.surfaceHigh,
              borderColor: theme.border,
              opacity: pressed ? actionMotion.pressedOpacity : 1,
            },
          ]}>
          <Camera
            color={theme.accentSecondaryForeground}
            size={20}
            strokeWidth={2.2}
          />
          <HoystText style={styles.photoActionLabel}>Take Photo</HoystText>
        </Pressable>
        <Pressable
          accessibilityLabel="Choose photo"
          accessibilityRole="button"
          onPress={() => choosePhoto().catch(() => undefined)}
          style={({pressed}) => [
            styles.photoAction,
            {
              backgroundColor: theme.surfaceHigh,
              borderColor: theme.border,
              opacity: pressed ? actionMotion.pressedOpacity : 1,
            },
          ]}>
          <ImagePlus
            color={theme.accentSecondaryForeground}
            size={20}
            strokeWidth={2.2}
          />
          <HoystText style={styles.photoActionLabel}>Choose Photo</HoystText>
        </Pressable>
      </View>

      {visiblePhotoUri ? (
        <View
          style={[
            styles.previewWrap,
            {backgroundColor: theme.surfaceHigh, borderColor: theme.border},
          ]}>
          <Image
            resizeMode="cover"
            source={{uri: visiblePhotoUri}}
            style={styles.previewImage}
            testID="tap-in-details-photo-preview"
          />
          <Pressable
            accessibilityLabel="Remove photo"
            accessibilityRole="button"
            onPress={() => {
              setLocalPhotoUri(undefined);
              setIsPhotoRemoved(true);
              setSaveError(undefined);
            }}
            style={styles.removePhotoButton}>
            <Trash2 color="#FFFFFF" size={16} strokeWidth={2.3} />
          </Pressable>
        </View>
      ) : null}

      <TapInActionButton
        disabled={isSaving || !isDirty}
        label={isSaving ? 'Saving Details...' : 'Save Details'}
        onPress={
          isSaving || !isDirty
            ? undefined
            : () => saveDetails().catch(() => undefined)
        }
        testID="tap-in-details-save"
        variant="primary"
      />
    </GlassPanel>
  );
}

const styles = StyleSheet.create({
  collapseButton: {
    alignItems: 'center',
    height: 42,
    justifyContent: 'center',
    width: 42,
  },
  disclosurePressable: {
    alignSelf: 'stretch',
    borderRadius: radius.lg,
  },
  disclosureSurface: {
    alignItems: 'center',
    alignSelf: 'stretch',
    borderRadius: radius.lg,
    borderWidth: 1,
    elevation: 4,
    flexDirection: 'row',
    gap: 12,
    minHeight: 72,
    paddingHorizontal: 16,
    paddingVertical: 11,
    shadowOffset: {height: 6, width: 0},
    shadowOpacity: 0.1,
    shadowRadius: 12,
  },
  disclosureChevron: {
    alignItems: 'center',
    borderRadius: radius.pill,
    flexShrink: 0,
    height: 32,
    justifyContent: 'center',
    width: 32,
  },
  disclosureCopy: {
    flex: 1,
    gap: 2,
    minWidth: 0,
  },
  disclosureIcon: {
    alignItems: 'center',
    borderRadius: radius.pill,
    flexShrink: 0,
    height: 36,
    justifyContent: 'center',
    width: 36,
  },
  disclosureTitle: {
    fontSize: 15,
    fontWeight: '800',
    lineHeight: 19,
  },
  editorHeader: {
    alignItems: 'flex-start',
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  editorHeaderCopy: {
    flex: 1,
    gap: 4,
    minWidth: 0,
  },
  editorPanel: {
    gap: 16,
  },
  editorTitle: {
    fontSize: 17,
    fontWeight: '800',
    lineHeight: 21,
  },
  fieldBlock: {
    gap: 9,
  },
  noteInput: {
    borderRadius: radius.md,
    fontSize: 15,
    fontWeight: '600',
    lineHeight: 21,
    minHeight: 108,
    paddingHorizontal: 15,
    paddingTop: 14,
  },
  photoAction: {
    alignItems: 'center',
    borderRadius: radius.md,
    borderWidth: 1,
    flex: 1,
    flexDirection: 'row',
    gap: 8,
    justifyContent: 'center',
    minHeight: 52,
    paddingHorizontal: 12,
  },
  photoActionLabel: {
    fontSize: 13,
    fontWeight: '800',
    lineHeight: 17,
  },
  photoActions: {
    flexDirection: 'row',
    gap: 10,
  },
  previewImage: {
    height: '100%',
    width: '100%',
  },
  previewWrap: {
    borderRadius: radius.md,
    borderWidth: 1,
    height: 168,
    overflow: 'hidden',
  },
  removePhotoButton: {
    alignItems: 'center',
    backgroundColor: 'rgba(47,35,22,0.9)',
    borderRadius: radius.pill,
    height: 32,
    justifyContent: 'center',
    position: 'absolute',
    right: 10,
    top: 10,
    width: 32,
  },
});
