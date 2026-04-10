import React from 'react';
import {
  Pressable,
  StyleSheet,
  View,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import LinearGradient from 'react-native-linear-gradient';

import {useHoystTheme} from '../theme/useHoystTheme';
import {gradients} from '../tokens/gradients';
import {radius} from '../tokens/radius';
import {HoystText} from './HoystText';

type HoystButtonProps = {
  label: string;
  onPress?: () => void;
  icon?: React.ReactNode;
  variant?: 'primary' | 'secondary' | 'ghost' | 'outline';
  style?: StyleProp<ViewStyle>;
};

export function HoystButton({
  label,
  icon,
  onPress,
  variant = 'primary',
  style,
}: HoystButtonProps): React.JSX.Element {
  const theme = useHoystTheme();
  const gradientTextColor = variant === 'secondary' ? theme.text : '#0B0B0C';
  const backgroundStyle =
    variant === 'ghost'
      ? {backgroundColor: 'transparent', borderColor: 'transparent'}
      : variant === 'outline'
        ? {backgroundColor: 'transparent', borderColor: theme.borderStrong}
        : {backgroundColor: 'transparent', borderColor: 'transparent'};

  return (
    <Pressable
      onPress={onPress}
      style={({pressed}) => [
        styles.base,
        backgroundStyle,
        {opacity: pressed ? 0.9 : 1, transform: [{scale: pressed ? 0.985 : 1}]},
        style,
      ]}>
      {variant === 'primary' || variant === 'secondary' ? (
        <LinearGradient
          colors={[
            variant === 'primary' ? gradients.orangeButton : gradients.purpleButton,
          ].flat()}
          style={styles.fill}>
          <View style={styles.content}>
            {icon}
            <HoystText
              style={{color: gradientTextColor}}
              variant="button">
              {label}
            </HoystText>
          </View>
        </LinearGradient>
      ) : (
        <View
          style={[
            styles.fill,
            variant === 'ghost'
              ? styles.ghostFill
              : {backgroundColor: theme.surfaceSoft},
          ]}>
          <View style={styles.content}>
            {icon}
            <HoystText
              style={variant === 'outline' ? undefined : {color: theme.text}}
              variant="button">
              {label}
            </HoystText>
          </View>
        </View>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    borderRadius: radius.pill,
    borderWidth: 1,
    minHeight: 54,
    overflow: 'hidden',
  },
  fill: {
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 54,
    paddingHorizontal: 22,
    width: '100%',
  },
  ghostFill: {
    backgroundColor: 'transparent',
  },
  content: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 10,
    justifyContent: 'center',
  },
});
