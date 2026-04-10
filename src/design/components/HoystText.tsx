import React from 'react';
import {
  Text,
  type StyleProp,
  StyleSheet,
  type TextProps,
  type TextStyle,
} from 'react-native';

import {useHoystTheme} from '../theme/useHoystTheme';
import {typography} from '../tokens/typography';

type Variant = keyof typeof typography;

type HoystTextProps = TextProps & {
  tone?: 'primary' | 'muted' | 'success' | 'warning' | 'danger';
  variant?: Variant;
  style?: StyleProp<TextStyle>;
};

export function HoystText({
  children,
  tone = 'primary',
  variant = 'body',
  style,
  ...rest
}: HoystTextProps): React.JSX.Element {
  const theme = useHoystTheme();

  const color =
    tone === 'muted'
      ? theme.textMuted
      : tone === 'success'
        ? theme.success
        : tone === 'warning'
          ? theme.warning
          : tone === 'danger'
            ? theme.danger
            : theme.text;

  return (
    <Text
      {...rest}
      style={[
        styles.base,
        typography[variant],
        {
          color,
        },
        style,
      ]}>
      {children}
    </Text>
  );
}

const styles = StyleSheet.create({
  base: {
    fontFamily: 'System',
    includeFontPadding: false,
  },
});
