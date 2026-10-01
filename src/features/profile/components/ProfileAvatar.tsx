import React, {useEffect, useMemo, useState} from 'react';
import {Image, StyleSheet, View} from 'react-native';
import {DSText, useSystemTheme} from '../../../design/system';
import type {UserProfile} from '../../../types/models';
import {
  getProfileAvatarSource,
  getProfileInitials,
} from '../services/profile-display';
export function ProfileAvatar({
  profile,
  size = 104,
  fallbackUrl,
  uri,
  onReady,
}: {
  profile?: UserProfile;
  size?: number;
  fallbackUrl?: string;
  uri?: string;
  onReady?: () => void;
}) {
  const theme = useSystemTheme();
  const avatarUrl = profile?.avatarUrl;
  const avatarImage = profile?.avatarImage;
  const source = useMemo(
    () =>
      uri
        ? {uri}
        : getProfileAvatarSource({avatarUrl, avatarImage}, fallbackUrl),
    [uri, avatarUrl, avatarImage, fallbackUrl],
  );
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    setFailed(false);
    if (!source) onReady?.();
  }, [source, onReady]);
  return (
    <View
      accessibilityLabel={`${profile?.name ?? 'Your'} profile photo`}
      accessible
      style={[
        styles.avatar,
        {
          width: size,
          height: size,
          borderRadius: size / 2,
          backgroundColor: theme.mutedSurface,
          borderColor: theme.surface,
        },
      ]}>
      {source && !failed ? (
        <Image
          source={source}
          resizeMode="cover"
          onLoadEnd={onReady}
          onError={() => {
            setFailed(true);
            onReady?.();
          }}
          style={{width: size - 4, height: size - 4, borderRadius: size / 2}}
        />
      ) : (
        <DSText variant="heading">{getProfileInitials(profile)}</DSText>
      )}
    </View>
  );
}
const styles = StyleSheet.create({
  avatar: {
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
});
