import React, {useState} from 'react';
import {Alert, Pressable, StyleSheet, View} from 'react-native';
import {ArrowLeft} from 'lucide-react-native';
import type {NativeStackScreenProps} from '@react-navigation/native-stack';

import {GlassPanel} from '../../../design/components/GlassPanel';
import {HoystButton} from '../../../design/components/HoystButton';
import {HoystInput} from '../../../design/components/HoystInput';
import {HoystScreen} from '../../../design/components/HoystScreen';
import {HoystText} from '../../../design/components/HoystText';
import {LayeredAvatar} from '../../../design/components/LayeredAvatar';
import {actionShadow} from '../../../design/tokens/actions';
import {useHoystTheme} from '../../../design/theme/useHoystTheme';
import {updateProfileFields} from '../../auth/services/account-service';
import type {RootStackParamList} from '../../../navigation/types';
import {useUserProfileStore} from '../../../store/profile-store';
import {useSessionStore} from '../../../store/session-store';
import {
  getProfileAvatarSource,
  getProfileInitials,
} from '../../profile/services/profile-display';

type Props = NativeStackScreenProps<RootStackParamList, 'EditProfile'>;

export function EditProfileScreen({navigation}: Props): React.JSX.Element {
  const theme = useHoystTheme();
  const profile = useUserProfileStore(state => state.profile);
  const updateProfile = useUserProfileStore(state => state.updateProfile);
  const user = useSessionStore(state => state.user);
  const [name, setName] = useState(profile?.name ?? '');
  const [bio, setBio] = useState(profile?.bio ?? '');
  const [isSaving, setIsSaving] = useState(false);

  const isSaveDisabled =
    !profile ||
    !name.trim() ||
    isSaving ||
    (name.trim() === profile.name && bio.trim() === (profile.bio ?? ''));

  const onSave = async () => {
    if (isSaveDisabled || !profile) {
      return;
    }

    setIsSaving(true);
    try {
      const avatarUrl = profile.avatarUrl ?? user?.photoURL;

      await updateProfileFields({
        avatarUrl,
        bio: bio.trim() || undefined,
        displayName: name.trim(),
      });
      updateProfile({
        avatarUrl,
        bio,
        name,
      });
      navigation.goBack();
    } catch (error) {
      const message =
        (error as {message?: string}).message ??
        'Could not save profile changes.';
      Alert.alert('Save failed', message);
    } finally {
      setIsSaving(false);
    }
  };

  if (!profile) {
    return (
      <HoystScreen contentContainerStyle={styles.content}>
        <View style={styles.header}>
          <Pressable
            onPress={() => navigation.goBack()}
            style={({pressed}) => [
              styles.backButton,
              {
                backgroundColor: theme.surfaceSoft,
                borderColor: theme.border,
                opacity: pressed ? 0.92 : 1,
              },
            ]}>
            <ArrowLeft color={theme.text} size={22} strokeWidth={2.3} />
          </Pressable>
          <HoystText variant="headline">Edit Profile</HoystText>
        </View>

        <GlassPanel>
          <HoystText variant="title">Profile unavailable</HoystText>
          <HoystText tone="muted">
            Sign in and complete your profile before editing account details.
          </HoystText>
          <HoystButton
            label="Back to settings"
            onPress={() => navigation.goBack()}
            variant="outline"
          />
        </GlassPanel>
      </HoystScreen>
    );
  }

  const initials = getProfileInitials(profile);
  const avatarSource = getProfileAvatarSource(profile, user?.photoURL);

  return (
    <HoystScreen contentContainerStyle={styles.content}>
      <View style={styles.header}>
        <Pressable
          onPress={() => navigation.goBack()}
          style={({pressed}) => [
            styles.backButton,
            {
              backgroundColor: theme.surfaceSoft,
              borderColor: theme.border,
              opacity: pressed ? 0.92 : 1,
            },
          ]}>
          <ArrowLeft color={theme.text} size={22} strokeWidth={2.3} />
        </Pressable>
        <HoystText variant="headline">Edit Profile</HoystText>
      </View>

      <GlassPanel>
        <View style={styles.hero}>
          <LayeredAvatar
            imageSource={avatarSource}
            initials={initials}
            size={68}
            state="done"
          />
          <View style={styles.heroCopy}>
            <HoystText variant="title">{profile.name}</HoystText>
            <HoystText tone="muted">@{profile.handle}</HoystText>
            <HoystText tone="muted">{profile.timezone}</HoystText>
          </View>
        </View>
        <HoystText tone="muted" variant="caption">
          Handles are immutable after onboarding. Avatar and timezone editing
          will land later.
        </HoystText>
      </GlassPanel>

      <GlassPanel>
        <View style={styles.fieldGroup}>
          <HoystText tone="muted" variant="label">
            Name
          </HoystText>
          <HoystInput
            autoCapitalize="words"
            onChangeText={setName}
            placeholder="Your name"
            value={name}
          />
        </View>
        <View style={styles.fieldGroup}>
          <HoystText tone="muted" variant="label">
            Bio
          </HoystText>
          <HoystInput
            multiline
            onChangeText={setBio}
            placeholder="Tell your circles what keeps you moving."
            style={styles.bioInput}
            textAlignVertical="top"
            value={bio}
          />
        </View>
        <HoystButton
          label={isSaving ? 'Saving...' : 'Save changes'}
          onPress={
            isSaveDisabled
              ? undefined
              : () => {
                  onSave().catch(() => undefined);
                }
          }
          style={[
            styles.confirmGlow,
            {
              shadowColor: theme.success,
            },
          ]}
        />
        <HoystButton
          label="Cancel"
          onPress={() => navigation.goBack()}
          variant="outline"
        />
      </GlassPanel>
    </HoystScreen>
  );
}

const styles = StyleSheet.create({
  content: {
    paddingBottom: 180,
  },
  header: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 12,
  },
  backButton: {
    alignItems: 'center',
    borderRadius: 16,
    borderWidth: 1,
    height: 40,
    justifyContent: 'center',
    width: 40,
  },
  hero: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 16,
  },
  heroCopy: {
    flex: 1,
    gap: 4,
  },
  fieldGroup: {
    gap: 8,
  },
  bioInput: {
    minHeight: 124,
    paddingTop: 14,
  },
  confirmGlow: {
    elevation: actionShadow.elevation,
    shadowOffset: actionShadow.offset,
    shadowOpacity: 0.34,
    shadowRadius: 28,
  },
});
