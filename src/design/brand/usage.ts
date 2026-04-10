import type {ImageSourcePropType} from 'react-native';

import {brandAssets} from './assets';

export function getBrandIcon(isDark: boolean): ImageSourcePropType {
  return isDark ? brandAssets.iconWhite : brandAssets.iconBlack;
}

export function getBrandLogo(isDark: boolean): ImageSourcePropType {
  return isDark ? brandAssets.logoWhite : brandAssets.logoBlack;
}

export function getBrandRing(): ImageSourcePropType {
  return brandAssets.ring;
}
