import React from 'react';
import {StyleSheet, View, type StyleProp, type ViewStyle} from 'react-native';

import {BrandMark} from './BrandMark';
import {useHoystTheme} from '../theme/useHoystTheme';

type TapInRingMarkProps = {
  innerSize?: number;
  outerSize?: number;
  style?: StyleProp<ViewStyle>;
};

export function TapInRingMark({
  innerSize = 45,
  outerSize = 81,
  style,
}: TapInRingMarkProps): React.JSX.Element {
  const theme = useHoystTheme();
  const wrapSize = outerSize + 3;
  const wrapSizeStyle = {height: wrapSize, width: wrapSize};
  const outerRingSizeStyle = {height: outerSize, width: outerSize};
  const innerRingSizeStyle = {height: innerSize, width: innerSize};

  return (
    <View style={[styles.wrap, wrapSizeStyle, style]}>
      <BrandMark
        isDark={theme.isDark}
        kind="ring"
        style={outerRingSizeStyle}
      />
      <BrandMark
        isDark={theme.isDark}
        kind="ring"
        style={[styles.innerRing, innerRingSizeStyle]}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  innerRing: {
    height: 45,
    position: 'absolute',
    width: 45,
  },
  wrap: {
    alignItems: 'center',
    justifyContent: 'center',
  },
});
