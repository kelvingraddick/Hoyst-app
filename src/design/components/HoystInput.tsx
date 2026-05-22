import React, {useState} from 'react';
import {
  Pressable,
  StyleSheet,
  TextInput,
  View,
  type StyleProp,
  type TextInputProps,
  type ViewStyle,
} from 'react-native';
import {Eye, EyeOff} from 'lucide-react-native';

import {useHoystTheme} from '../theme/useHoystTheme';
import {radius} from '../tokens/radius';

type HoystInputProps = TextInputProps & {
  containerStyle?: StyleProp<ViewStyle>;
  showSecureTextToggle?: boolean;
};

export function HoystInput({
  containerStyle,
  placeholderTextColor,
  secureTextEntry,
  showSecureTextToggle,
  style,
  ...rest
}: HoystInputProps): React.JSX.Element {
  const theme = useHoystTheme();
  const [isSecureTextVisible, setIsSecureTextVisible] = useState(false);
  const shouldShowSecureTextToggle = Boolean(
    secureTextEntry && showSecureTextToggle,
  );

  if (shouldShowSecureTextToggle) {
    const ToggleIcon = isSecureTextVisible ? EyeOff : Eye;

    return (
      <View
        style={[
          styles.input,
          styles.inputWithToggle,
          {
            backgroundColor: theme.surfaceHigh,
            borderColor: theme.border,
          },
          containerStyle,
        ]}>
        <TextInput
          {...rest}
          placeholderTextColor={placeholderTextColor ?? theme.textMuted}
          secureTextEntry={!isSecureTextVisible}
          style={[styles.secureTextInput, {color: theme.text}, style]}
        />
        <Pressable
          accessibilityLabel={
            isSecureTextVisible ? 'Hide password' : 'Show password'
          }
          accessibilityRole="button"
          hitSlop={8}
          onPress={() => setIsSecureTextVisible(current => !current)}
          style={({pressed}) => [
            styles.secureTextToggle,
            {opacity: pressed ? 0.68 : 1},
          ]}>
          <ToggleIcon color={theme.textMuted} size={20} strokeWidth={2.2} />
        </Pressable>
      </View>
    );
  }

  return (
    <TextInput
      {...rest}
      placeholderTextColor={placeholderTextColor ?? theme.textMuted}
      secureTextEntry={secureTextEntry}
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
  inputWithToggle: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 8,
    paddingRight: 8,
    paddingVertical: 0,
  },
  secureTextInput: {
    flex: 1,
    fontSize: 16,
    minHeight: 54,
    paddingVertical: 14,
  },
  secureTextToggle: {
    alignItems: 'center',
    borderRadius: radius.pill,
    height: 44,
    justifyContent: 'center',
    width: 44,
  },
});
