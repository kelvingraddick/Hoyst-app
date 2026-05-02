import React, {useState} from 'react';
import {Pressable, StyleSheet, View} from 'react-native';
import {ArrowLeft} from 'lucide-react-native';
import type {NativeStackScreenProps} from '@react-navigation/native-stack';

import {GlassPanel} from '../../../design/components/GlassPanel';
import {HoystButton} from '../../../design/components/HoystButton';
import {HoystInput} from '../../../design/components/HoystInput';
import {HoystScreen} from '../../../design/components/HoystScreen';
import {HoystText} from '../../../design/components/HoystText';
import {LayeredAvatar} from '../../../design/components/LayeredAvatar';
import {useHoystTheme} from '../../../design/theme/useHoystTheme';
import type {RootStackParamList} from '../../../navigation/types';
import {useUserProfileStore} from '../../../store/profile-store';

type Props = NativeStackScreenProps<RootStackParamList, 'EditProfile'>;

export function EditProfileScreen({navigation}: Props): React.JSX.Element {
  const theme = useHoystTheme();
  const profile = useUserProfileStore(state => state.profile);
  const updateProfile = useUserProfileStore(state => state.updateProfile);
  const [name, setName] = useState(profile.name);
  const [handle, setHandle] = useState(profile.handle);
  const [bio, setBio] = useState(profile.bio ?? '');
  const initials = profile.name
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map(part => part[0]?.toUpperCase() ?? '')
    .join('');

  const isSaveDisabled =
    !name.trim() ||
    !handle.trim() ||
    (name.trim() === profile.name &&
      handle.trim().replace(/^@+/, '') === profile.handle &&
      bio.trim() === (profile.bio ?? ''));

  const onSave = () => {
    if (isSaveDisabled) {
      return;
    }

    updateProfile({
      bio,
      handle,
      name,
    });
    navigation.goBack();
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
            imageSource={profile.avatarImage}
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
          Avatar and timezone editing will land later. This MVP keeps the core
          identity fields editable now.
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
            Handle
          </HoystText>
          <HoystInput
            autoCapitalize="none"
            onChangeText={setHandle}
            placeholder="@handle"
            value={handle}
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
        <HoystButton label="Save changes" onPress={onSave} />
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
