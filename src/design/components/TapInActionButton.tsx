import React from 'react';
import {
  Pressable,
  StyleSheet,
  View,
  type StyleProp,
  type ViewStyle,
} from 'react-native';

import {actionMotion, actionShadow, touchTarget} from '../tokens/actions';
import {brandColors} from '../tokens/colors';
import {radius} from '../tokens/radius';
import {useHoystTheme} from '../theme/useHoystTheme';
import {HoystText} from './HoystText';

export type TapInActionButtonVariant =
  | 'dangerOutline'
  | 'primary'
  | 'text'
  | 'warmOutline';

type TapInActionButtonProps = {
  accessibilityLabel?: string;
  disabled?: boolean;
  icon?: React.ReactNode;
  label: string;
  onPress?: () => void;
  style?: StyleProp<ViewStyle>;
  testID?: string;
  variant: TapInActionButtonVariant;
};

export function TapInActionButton({
  accessibilityLabel,
  disabled = false,
  icon,
  label,
  onPress,
  style,
  testID,
  variant,
}: TapInActionButtonProps): React.JSX.Element {
  const theme = useHoystTheme();
  const isText = variant === 'text';
  const palette =
    variant === 'primary'
      ? {
          backgroundColor: '#15171D',
          borderColor: '#15171D',
          color: brandColors.white,
          shadowColor: theme.actionShadowColor,
        }
      : variant === 'dangerOutline'
      ? {
          backgroundColor: `${theme.danger}12`,
          borderColor: `${theme.dangerForeground}66`,
          color: theme.dangerForeground,
          shadowColor: 'transparent',
        }
      : variant === 'warmOutline'
      ? {
          backgroundColor: theme.isDark
            ? 'rgba(255,138,61,0.12)'
            : 'rgba(255,138,61,0.08)',
          borderColor: theme.isDark
            ? 'rgba(255,138,61,0.48)'
            : 'rgba(255,138,61,0.42)',
          color: theme.warningForeground,
          shadowColor: 'transparent',
        }
      : {
          backgroundColor: 'transparent',
          borderColor: 'transparent',
          color: theme.textSubtle,
          shadowColor: 'transparent',
        };

  return (
    <Pressable
      accessibilityLabel={accessibilityLabel ?? label}
      accessibilityRole="button"
      accessibilityState={{disabled}}
      disabled={disabled}
      onPress={disabled ? undefined : onPress}
      style={({pressed}) => [
        styles.pressable,
        isText ? styles.textPressable : styles.filledPressable,
        variant === 'primary' ? styles.primaryShadow : undefined,
        {
          opacity: disabled ? 0.42 : pressed ? actionMotion.pressedOpacity : 1,
          shadowColor: palette.shadowColor,
          transform: [
            {scale: pressed && !disabled ? actionMotion.pressedScale : 1},
          ],
        },
        style,
      ]}
      testID={testID}>
      <View
        style={[
          styles.fill,
          isText ? styles.textFill : styles.filledFill,
          {
            backgroundColor: palette.backgroundColor,
            borderColor: palette.borderColor,
          },
        ]}
        testID={testID ? `${testID}-fill` : undefined}>
        {icon ? <View style={styles.icon}>{icon}</View> : null}
        <HoystText
          numberOfLines={1}
          style={[
            styles.label,
            isText ? styles.textLabel : undefined,
            {color: palette.color},
          ]}
          variant="button">
          {label}
        </HoystText>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  fill: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'center',
    width: '100%',
  },
  filledFill: {
    borderRadius: radius.pill,
    borderWidth: 1.4,
    gap: 8,
    minHeight: 56,
    paddingHorizontal: 20,
  },
  filledPressable: {
    borderRadius: radius.pill,
    minHeight: 56,
  },
  icon: {
    alignItems: 'center',
    flexShrink: 0,
    justifyContent: 'center',
  },
  label: {
    flexShrink: 1,
    fontSize: 15,
    fontWeight: '800',
    letterSpacing: 0,
    lineHeight: 19,
    textAlign: 'center',
  },
  pressable: {
    alignSelf: 'stretch',
    justifyContent: 'center',
    minHeight: touchTarget.minimum,
  },
  primaryShadow: {
    elevation: actionShadow.elevation,
    shadowOffset: {height: 12, width: 0},
    shadowOpacity: 0.16,
    shadowRadius: 20,
  },
  textFill: {
    borderRadius: radius.pill,
    borderWidth: 0,
    minHeight: 42,
    paddingHorizontal: 12,
  },
  textLabel: {
    fontSize: 14,
    lineHeight: 18,
  },
  textPressable: {
    borderRadius: radius.pill,
    minHeight: 42,
  },
});
