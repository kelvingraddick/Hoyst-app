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
import {actionMotion, actionShadow} from '../tokens/actions';
import {radius} from '../tokens/radius';
import {HoystText} from './HoystText';

type HoystButtonProps = {
  label: string;
  onPress?: () => void;
  accentIcon?: React.ReactNode;
  icon?: React.ReactNode;
  iconPosition?: 'leading' | 'trailing';
  disabled?: boolean;
  variant?: 'primary' | 'secondary' | 'ghost' | 'outline';
  backgroundColor?: string;
  borderColor?: string;
  style?: StyleProp<ViewStyle>;
  textColor?: string;
};

export function HoystButton({
  label,
  accentIcon,
  icon,
  iconPosition = 'leading',
  disabled,
  onPress,
  variant = 'primary',
  backgroundColor,
  borderColor,
  style,
  textColor,
}: HoystButtonProps): React.JSX.Element {
  const theme = useHoystTheme();
  const renderedIcon = accentIcon ?? icon;
  const backgroundStyle =
    variant === 'primary'
      ? {
          backgroundColor: 'transparent',
          borderColor: borderColor ?? theme.actionBorder,
          shadowColor: theme.actionShadowColor,
          shadowOffset: actionShadow.offset,
          shadowOpacity: theme.actionShadowOpacity,
          shadowRadius: actionShadow.largeRadius,
          elevation: actionShadow.elevation,
        }
      : variant === 'ghost'
      ? {
          backgroundColor: 'transparent',
          borderColor: borderColor ?? 'transparent',
        }
      : variant === 'outline'
      ? {
          backgroundColor: 'transparent',
          borderColor: borderColor ?? theme.borderStrong,
        }
      : {
          backgroundColor: 'transparent',
          borderColor: borderColor ?? 'transparent',
        };

  return (
    <Pressable
      accessibilityRole="button"
      disabled={disabled}
      onPress={disabled ? undefined : onPress}
      style={({pressed}) => [
        styles.base,
        backgroundStyle,
        {
          opacity: disabled ? 0.42 : pressed ? actionMotion.pressedOpacity : 1,
          transform: [
            {scale: pressed && !disabled ? actionMotion.pressedScale : 1},
          ],
        },
        style,
      ]}>
      {variant === 'secondary' ? (
        <LinearGradient
          colors={[...gradients.purpleButton]}
          style={styles.fill}>
          <View style={styles.content}>
            {iconPosition === 'leading' ? renderedIcon : null}
            <HoystText
              style={{color: textColor ?? theme.onPurpleAccent}}
              variant="button">
              {label}
            </HoystText>
            {iconPosition === 'trailing' ? renderedIcon : null}
          </View>
        </LinearGradient>
      ) : (
        <View
          style={[
            styles.fill,
            variant === 'primary'
              ? {backgroundColor: backgroundColor ?? theme.actionSurface}
              : variant === 'ghost'
              ? [
                  styles.ghostFill,
                  backgroundColor ? {backgroundColor} : undefined,
                ]
              : {backgroundColor: backgroundColor ?? theme.surfaceSoft},
          ]}>
          <View style={styles.content}>
            {iconPosition === 'leading' ? renderedIcon : null}
            <HoystText
              style={
                variant === 'primary'
                  ? {color: textColor ?? theme.actionForeground}
                  : variant === 'outline'
                  ? textColor
                    ? {color: textColor}
                    : undefined
                  : {color: textColor ?? theme.text}
              }
              variant="button">
              {label}
            </HoystText>
            {iconPosition === 'trailing' ? renderedIcon : null}
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
  },
  fill: {
    alignItems: 'center',
    borderRadius: radius.pill,
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
