import React from 'react';
import {Image, StyleSheet, View} from 'react-native';
import type {ImageSourcePropType} from 'react-native';

import {useHoystTheme} from '../theme/useHoystTheme';
import {getBrandRing} from '../brand/usage';
import {getBrandAvatarRingSize} from './avatarRingSizing';
import {GradientRing} from './GradientRing';
import {HoystText} from './HoystText';

type HoystAvatarProps = {
  initials: string;
  imageSource?: ImageSourcePropType;
  imageUrl?: string;
  size?: number;
  tone?: 'gradient' | 'green' | 'purple' | 'muted';
  useBrandRing?: boolean;
};

export function HoystAvatar({
  initials,
  imageSource,
  imageUrl,
  size = 52,
  tone = 'gradient',
  useBrandRing,
}: HoystAvatarProps): React.JSX.Element {
  const theme = useHoystTheme();
  const resolvedImageSource =
    imageSource ?? (imageUrl ? {uri: imageUrl} : undefined);
  const imageSize = size - 12;
  const brandRingSize = getBrandAvatarRingSize(imageSize);
  const shouldUseBrandRing = useBrandRing ?? tone === 'green';
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
      {shouldUseBrandRing ? (
        <Image
          source={getBrandRing()}
          style={[styles.brandRing, {height: brandRingSize, width: brandRingSize}]}
        />
      ) : (
        <GradientRing flatColor={ringColor} size={size} strokeWidth={6} />
      )}
      <View
        style={[
          styles.inner,
          {
            backgroundColor: theme.surfaceStrong,
            width: imageSize,
            height: imageSize,
            borderRadius: imageSize / 2,
          },
        ]}>
        {resolvedImageSource ? (
          <Image
            source={resolvedImageSource}
            style={[
              styles.image,
              {
                width: imageSize,
                height: imageSize,
                borderRadius: imageSize / 2,
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
  brandRing: {
    position: 'absolute',
    resizeMode: 'contain',
  },
  image: {
    resizeMode: 'cover',
  },
  initials: {
    fontSize: 14,
    fontWeight: '700',
  },
});
