import React, {useEffect, useRef, useState} from 'react';
import {Alert, Pressable, StyleSheet, View} from 'react-native';
import {Check, CheckCircle2} from 'lucide-react-native';
import {usePreventRemove} from '@react-navigation/native';
import type {NativeStackScreenProps} from '@react-navigation/native-stack';
import {launchImageLibrary} from 'react-native-image-picker';
import {
  DSButton,
  DSInput,
  DSSurface,
  DSText,
  useSystemTheme,
} from '../../../design/system';
import type {RootStackParamList} from '../../../navigation/types';
import {useUserProfileStore} from '../../../store/profile-store';
import {useSessionStore} from '../../../store/session-store';
import {
  checkProfileUsername,
  updateProfileFields,
  uploadProfileAvatar,
} from '../../auth/services/account-service';
import {
  normalizeHandle,
  validateHandle,
} from '../../auth/services/profile-validation';
import {ProfileAvatar} from '../../profile/components/ProfileAvatar';
import {
  ProfileScaffold,
  ProfileTheme,
} from '../../profile/components/ProfileScaffold';
import {useProfilePreview} from '../../profile/components/ProfilePreviewContext';
import {
  normalizeProfileTint,
  profileTints,
} from '../../profile/services/profile-personalization';

type Props = NativeStackScreenProps<RootStackParamList, 'EditProfile'>;
export function EditProfileScreen(props: Props) {
  const account = useSessionStore(state => state.user?.uid);
  return (
    <ProfileTheme>
      <Editor key={account ?? 'guest'} {...props} />
    </ProfileTheme>
  );
}
function Editor({navigation, route}: Props) {
  const theme = useSystemTheme();
  const preview = useProfilePreview();
  const stored = useUserProfileStore(state => state.profile);
  const accountUid = useSessionStore(state => state.user?.uid);
  const fallbackPhoto = useSessionStore(state => state.user?.photoURL);
  const profile = preview
    ? preview.profile
    : stored?.id === accountUid
    ? stored
    : undefined;
  const [name, setName] = useState(profile?.name ?? '');
  const [handle, setHandle] = useState(profile?.handle ?? '');
  const [bio, setBio] = useState(profile?.bio ?? '');
  const [tint, setTint] = useState(normalizeProfileTint(profile?.profileTint));
  const [photoUri, setPhotoUri] = useState<string>();
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [discardAction, setDiscardAction] =
    useState<Parameters<typeof navigation.dispatch>[0]>();
  const [error, setError] = useState<string>();
  const [availabilityRetry, setAvailabilityRetry] = useState(0);
  const [availability, setAvailability] = useState<{
    handle: string;
    status: 'checking' | 'available' | 'taken' | 'error';
    error?: string;
  }>();
  const activeRef = useRef(true);
  useEffect(
    () => () => {
      activeRef.current = false;
    },
    [],
  );
  const currentHandle = profile?.handle;
  const normalized = normalizeHandle(handle);
  const validation = validateHandle(handle);
  const dirty = Boolean(
    profile &&
      (name.trim() !== profile.name ||
        normalized !== profile.handle ||
        bio.trim() !== (profile.bio ?? '') ||
        tint !== normalizeProfileTint(profile.profileTint) ||
        photoUri),
  );
  usePreventRemove((dirty || saving) && !saved && !discardAction, ({data}) => {
    if (saving) {
      Alert.alert('Saving changes', 'Please wait until your profile is saved.');
      return;
    }
    Alert.alert(
      'Discard changes?',
      'Your profile changes have not been saved.',
      [
        {text: 'Keep editing', style: 'cancel'},
        {
          text: 'Discard',
          style: 'destructive',
          onPress: () => setDiscardAction(data.action),
        },
      ],
    );
  });
  useEffect(() => {
    if (saved) navigation.goBack();
    else if (discardAction) navigation.dispatch(discardAction);
  }, [saved, discardAction, navigation]);
  useEffect(() => {
    if (!validation.isValid || !currentHandle) {
      setAvailability(undefined);
      return;
    }
    if (normalized === currentHandle || preview) {
      setAvailability({handle: normalized, status: 'available'});
      return;
    }
    let current = true;
    setAvailability({handle: normalized, status: 'checking'});
    const timer = setTimeout(() => {
      checkProfileUsername(normalized)
        .then(result => {
          if (current)
            setAvailability({
              handle: normalized,
              status: result.available ? 'available' : 'taken',
            });
        })
        .catch(reason => {
          if (current)
            setAvailability({
              handle: normalized,
              status: 'error',
              error:
                reason instanceof Error
                  ? reason.message
                  : 'Could not check username.',
            });
        });
    }, 350);
    return () => {
      current = false;
      clearTimeout(timer);
    };
  }, [
    normalized,
    validation.isValid,
    currentHandle,
    preview,
    availabilityRetry,
  ]);
  const choosePhoto = async () => {
    if (saving) return;
    const result = await launchImageLibrary({
      mediaType: 'photo',
      quality: 0.8,
      selectionLimit: 1,
    });
    if (!activeRef.current) return;
    if (result.errorCode || result.errorMessage) {
      setError(
        result.errorMessage ||
          'Photo access is unavailable. Check your device permissions.',
      );
      return;
    }
    if (result.assets?.[0]?.uri) {
      setPhotoUri(result.assets[0].uri);
      setError(undefined);
    }
  };
  useEffect(() => {
    if (!route.params?.focusPhoto || preview) return;
    const timer = setTimeout(() => {
      void choosePhoto().catch(reason => {
        if (activeRef.current) setError(reason.message);
      });
    }, 350);
    return () => clearTimeout(timer);
    // Open the picker once when this entry explicitly targets the photo action.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const canSave = Boolean(
    dirty &&
      name.trim() &&
      name.trim().length <= 60 &&
      validation.isValid &&
      availability?.handle === normalized &&
      availability.status === 'available' &&
      !saving,
  );
  const save = async () => {
    if (!canSave || !profile) return;
    setSaving(true);
    setError(undefined);
    try {
      if (preview) {
        preview.updateProfile?.({
          ...profile,
          name: name.trim(),
          handle: normalized,
          bio: bio.trim() || undefined,
          profileTint: tint,
        });
        setSaved(true);
        return;
      }
      const uid = useSessionStore.getState().user?.uid;
      if (uid !== profile.id)
        throw new Error('Your account changed. Please reopen Edit Profile.');
      const avatarUrl = photoUri
        ? await uploadProfileAvatar({uid, uri: photoUri, versioned: true})
        : profile.avatarUrl;
      if (useSessionStore.getState().user?.uid !== uid)
        throw new Error('Your account changed. Please try again.');
      const updated = await updateProfileFields({
        displayName: name.trim(),
        handle: normalized,
        bio: bio.trim() || null,
        ...(avatarUrl ? {avatarUrl} : {}),
        profileTint: tint,
      });
      if (activeRef.current && useSessionStore.getState().user?.uid === uid) {
        useUserProfileStore.getState().setProfile(updated);
        setSaved(true);
      }
    } catch (reason) {
      if (activeRef.current)
        setError(
          reason instanceof Error
            ? reason.message
            : 'Could not save your profile. Try again.',
        );
    } finally {
      if (activeRef.current) setSaving(false);
    }
  };
  const handleError = !validation.isValid
    ? validation.message
    : availability?.handle === normalized && availability.status === 'taken'
    ? 'That username is already taken.'
    : availability?.status === 'error'
    ? availability.error
    : undefined;
  if (!profile)
    return (
      <ProfileScaffold title="Edit profile" onBack={navigation.goBack}>
        <DSText>Your profile is unavailable. Sign in and try again.</DSText>
      </ProfileScaffold>
    );
  return (
    <ProfileScaffold
      title="Edit profile"
      tint={tint}
      onBack={navigation.goBack}>
      <View style={styles.photo}>
        <ProfileAvatar
          profile={profile}
          uri={photoUri}
          fallbackUrl={preview ? undefined : fallbackPhoto}
          size={88}
        />
        <DSButton
          label="Change photo"
          compact
          variant="quiet"
          disabled={saving}
          onPress={() =>
            void choosePhoto().catch(reason => setError(reason.message))
          }
          testID="edit-profile-photo"
        />
      </View>
      <DSInput
        label="Name"
        autoCapitalize="words"
        value={name}
        onChangeText={setName}
        maxLength={60}
        editable={!saving}
        testID="edit-profile-name"
      />
      <DSInput
        label="Username"
        autoCapitalize="none"
        autoCorrect={false}
        value={handle}
        onChangeText={setHandle}
        error={handleError}
        hint="3–20 letters, numbers, or underscores."
        editable={!saving}
        testID="edit-profile-username"
      />
      {availability?.status === 'error' ? (
        <DSButton
          label="Check username again"
          variant="quiet"
          onPress={() => setAvailabilityRetry(value => value + 1)}
        />
      ) : null}
      {validation.isValid &&
      availability?.handle === normalized &&
      !handleError ? (
        <View style={styles.available} accessibilityLiveRegion="polite">
          {availability.status === 'available' ? (
            <CheckCircle2 color={theme.success} size={16} />
          ) : null}
          <DSText
            variant="secondary"
            tone={availability.status === 'available' ? 'success' : 'muted'}>
            {availability.status === 'checking'
              ? 'Checking availability...'
              : 'Available'}
          </DSText>
        </View>
      ) : null}
      <DSInput
        label="Bio"
        multiline
        value={bio}
        onChangeText={setBio}
        textAlignVertical="top"
        editable={!saving}
        style={styles.bio}
        testID="edit-profile-bio"
      />
      <View style={styles.colors}>
        <DSText variant="heading">Profile color</DSText>
        <DSText variant="secondary" tone="muted">
          Choose your top tint.
        </DSText>
        <View style={styles.swatches}>
          {profileTints.map(option => (
            <Pressable
              key={option.value}
              disabled={saving}
              accessibilityRole="radio"
              accessibilityLabel={`${option.label} profile tint`}
              accessibilityState={{
                selected: tint === option.value,
                disabled: saving,
              }}
              onPress={() => setTint(option.value)}
              style={styles.swatchTarget}
              testID={`profile-tint-${option.value}`}>
              <View
                style={[
                  styles.swatchRing,
                  {
                    borderColor:
                      tint === option.value ? option.color : 'transparent',
                  },
                ]}>
                <View style={[styles.swatch, {backgroundColor: option.color}]}>
                  {tint === option.value ? (
                    <Check
                      size={20}
                      color={option.value === 'gold' ? '#070B1A' : '#FFFFFF'}
                    />
                  ) : null}
                </View>
              </View>
              <DSText variant="secondary" tone="muted">
                {option.label}
              </DSText>
            </Pressable>
          ))}
        </View>
      </View>
      <DSSurface
        style={[
          styles.preview,
          {
            backgroundColor: `${
              profileTints.find(option => option.value === tint)!.color
            }16`,
          },
        ]}>
        <DSText tone="muted" variant="secondary">
          Profile preview
        </DSText>
        <View style={styles.previewIdentity}>
          <ProfileAvatar
            profile={profile}
            uri={photoUri}
            fallbackUrl={preview ? undefined : fallbackPhoto}
            size={44}
          />
          <View style={styles.grow}>
            <DSText variant="title">{name.trim() || profile.name}</DSText>
            <DSText tone="muted" variant="secondary">
              @{normalized || profile.handle}
            </DSText>
            {bio.trim() ? (
              <DSText variant="secondary" tone="muted">
                {bio.trim()}
              </DSText>
            ) : null}
          </View>
        </View>
      </DSSurface>
      {error ? (
        <DSText
          tone="danger"
          accessibilityLiveRegion="polite"
          testID="edit-profile-error">
          {error}
        </DSText>
      ) : null}
      <DSButton
        label="Save changes"
        busy={saving}
        disabled={!canSave}
        onPress={() => void save()}
        testID="edit-profile-save"
      />
      <DSButton
        label="Cancel"
        variant="quiet"
        disabled={saving}
        onPress={navigation.goBack}
        testID="edit-profile-cancel"
      />
    </ProfileScaffold>
  );
}
const styles = StyleSheet.create({
  photo: {alignItems: 'center'},
  bio: {minHeight: 88},
  available: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: -8,
  },
  colors: {gap: 4},
  swatches: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    gap: 4,
    marginTop: 8,
  },
  swatchTarget: {alignItems: 'center', gap: 5, minWidth: 48, minHeight: 64},
  swatchRing: {borderWidth: 2, borderRadius: 25, padding: 3},
  swatch: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  preview: {gap: 8},
  previewIdentity: {flexDirection: 'row', alignItems: 'center', gap: 12},
  grow: {flex: 1, minWidth: 0},
});
