import React from 'react';
import {
  Image,
  StyleSheet,
  type ImageStyle,
  type StyleProp,
} from 'react-native';

import {getBrandIcon, getBrandLogo, getBrandRing} from '../brand/usage';

const LOGO_ASPECT_RATIO = 19 / 8;

type BrandMarkProps = {
  kind?: 'icon' | 'logo' | 'ring';
  isDark: boolean;
  style?: StyleProp<ImageStyle>;
};

export function BrandMark({
  kind = 'icon',
  isDark,
  style,
}: BrandMarkProps): React.JSX.Element {
  const source =
    kind === 'logo' ? getBrandLogo(isDark) : kind === 'ring' ? getBrandRing() : getBrandIcon(isDark);

  return (
    <Image
      resizeMode="contain"
      source={source}
      style={[kind === 'logo' ? styles.logo : undefined, style]}
    />
  );
}

const styles = StyleSheet.create({
  logo: {
    alignSelf: 'flex-start',
    aspectRatio: LOGO_ASPECT_RATIO,
  },
});
