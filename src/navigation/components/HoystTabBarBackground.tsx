import React from 'react';
import {StyleSheet, View} from 'react-native';

import {useHoystTheme} from '../../design/theme/useHoystTheme';

export function HoystTabBarBackground(): React.JSX.Element {
  const theme = useHoystTheme();

  return (
    <View
      style={[
        StyleSheet.absoluteFill,
        styles.clip,
        {
          backgroundColor: theme.panelSurface,
          borderColor: theme.border,
        },
      ]}
      testID="hoyst-tab-bar-surface"
    />
  );
}

const styles = StyleSheet.create({
  clip: {
    borderRadius: 34,
    borderWidth: 1,
    overflow: 'hidden',
  },
});
