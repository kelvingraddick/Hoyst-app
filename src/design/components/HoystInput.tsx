import React from 'react';
import {
  StyleSheet,
  TextInput,
  type StyleProp,
  type TextInputProps,
  type ViewStyle,
} from 'react-native';

import {useHoystTheme} from '../theme/useHoystTheme';
import {radius} from '../tokens/radius';

type HoystInputProps = TextInputProps & {
  containerStyle?: StyleProp<ViewStyle>;
};

export function HoystInput({
  containerStyle,
  placeholderTextColor,
  style,
  ...rest
}: HoystInputProps): React.JSX.Element {
  const theme = useHoystTheme();

  return (
    <TextInput
      {...rest}
      placeholderTextColor={placeholderTextColor ?? theme.textMuted}
      style={[
        styles.input,
        {
          backgroundColor: theme.surfaceHigh,
          borderColor: theme.border,
          color: theme.text,
        },
        containerStyle,
        style,
      ]}
    />
  );
}

const styles = StyleSheet.create({
  input: {
    borderRadius: radius.md,
    borderWidth: 1,
    fontSize: 16,
    minHeight: 56,
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
});
