import React from 'react';
import {Image, StyleSheet, View} from 'react-native';
import type {ImageSourcePropType} from 'react-native';

import {useHoystTheme} from '../theme/useHoystTheme';
import {GradientRing} from './GradientRing';
import {HoystText} from './HoystText';

type HoystAvatarProps = {
  initials: string;
  imageSource?: ImageSourcePropType;
  size?: number;
  tone?: 'gradient' | 'green' | 'purple' | 'muted';
};

export function HoystAvatar({
  initials,
  imageSource,
  size = 52,
  tone = 'gradient',
}: HoystAvatarProps): React.JSX.Element {
  const theme = useHoystTheme();
  const ringColor =
    tone === 'green'
      ? theme.success
      : tone === 'purple'
      ? theme.accent
      : tone === 'muted'
      ? 'rgba(255,255,255,0.14)'
      : undefined;

  return (
    <View style={[styles.root, {width: size, height: size}]}>
      <GradientRing flatColor={ringColor} size={size} strokeWidth={6} />
      <View
        style={[
          styles.inner,
          {
            backgroundColor: theme.surfaceStrong,
            width: size - 12,
            height: size - 12,
            borderRadius: (size - 12) / 2,
          },
        ]}>
        {imageSource ? (
          <Image
            source={imageSource}
            style={[
              styles.image,
              {
                width: size - 12,
                height: size - 12,
                borderRadius: (size - 12) / 2,
              },
            ]}
          />
        ) : (
          <HoystText style={styles.initials}>{initials}</HoystText>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  inner: {
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    position: 'absolute',
  },
  image: {
    resizeMode: 'cover',
  },
  initials: {
    fontSize: 14,
    fontWeight: '700',
  },
});
