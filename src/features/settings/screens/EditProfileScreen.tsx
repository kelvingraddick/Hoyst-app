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
import {useHoystTheme} from '../../../design/theme/useHoystTheme';
import {updateProfileFields} from '../../auth/services/account-service';
import type {RootStackParamList} from '../../../navigation/types';
import {useUserProfileStore} from '../../../store/profile-store';

type Props = NativeStackScreenProps<RootStackParamList, 'EditProfile'>;

export function EditProfileScreen({navigation}: Props): React.JSX.Element {
  const theme = useHoystTheme();
  const displayProfile = useUserProfileStore(state => state.getDisplayProfile());
  const updateProfile = useUserProfileStore(state => state.updateProfile);
  const [name, setName] = useState(displayProfile.name);
  const [bio, setBio] = useState(displayProfile.bio ?? '');
  const [isSaving, setIsSaving] = useState(false);
  const initials = displayProfile.name
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map(part => part[0]?.toUpperCase() ?? '')
    .join('');

  const isSaveDisabled =
    !name.trim() ||
    isSaving ||
    (name.trim() === displayProfile.name &&
      bio.trim() === (displayProfile.bio ?? ''));

  const onSave = async () => {
    if (isSaveDisabled) {
      return;
    }

    setIsSaving(true);
    try {
      await updateProfileFields({
        avatarUrl: displayProfile.avatarUrl,
        bio: bio.trim() || undefined,
        displayName: name.trim(),
      });
      updateProfile({
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
            imageSource={displayProfile.avatarImage}
            initials={initials}
            size={68}
            state="done"
          />
          <View style={styles.heroCopy}>
            <HoystText variant="title">{displayProfile.name}</HoystText>
            <HoystText tone="muted">@{displayProfile.handle}</HoystText>
            <HoystText tone="muted">{displayProfile.timezone}</HoystText>
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
});
