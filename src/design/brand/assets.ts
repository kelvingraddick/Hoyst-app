import type {ImageSourcePropType} from 'react-native';

export const brandAssets = {
  ring: require('../../assets/brand/Ring.png'),
  iconWhite: require('../../assets/brand/icon-white.png'),
  iconBlack: require('../../assets/brand/icon-black.png'),
  logoWhite: require('../../assets/brand/logo-white.png'),
  logoBlack: require('../../assets/brand/logo-black.png'),
} satisfies Record<string, ImageSourcePropType>;

export type BrandAssetKey = keyof typeof brandAssets;
