import React from 'react';
import {
  type GestureResponderEvent,
  Pressable,
  StyleSheet,
  View,
  type StyleProp,
  type ViewStyle,
} from 'react-native';

import {triggerTapInPressHaptic} from '../../lib/haptics/tap-in-haptics';
import {actionMotion, actionShadow, touchTarget} from '../tokens/actions';
import {brandColors} from '../tokens/colors';
import {radius} from '../tokens/radius';
import {useHoystTheme} from '../theme/useHoystTheme';
import {HoystText} from './HoystText';
import {TapInRingMark} from './TapInRingMark';
import type {PulseRingState} from './pulse-ring-state';

type TapInPulseButtonVariant = 'card' | 'primary';

type TapInPulseButtonProps = {
  accessibilityLabel?: string;
  disabled?: boolean;
  label?: string;
  onPress?: (event: GestureResponderEvent) => void;
  ringState?: PulseRingState;
  style?: StyleProp<ViewStyle>;
  variant?: TapInPulseButtonVariant;
};

const variantSpecs = {
  card: {
    height: 48,
    iconInnerSize: 17,
    iconOuterSize: 30,
    labelSize: 14,
    labelLineHeight: 18,
    minWidth: 130,
    paddingHorizontal: 16,
  },
  primary: {
    height: 58,
    iconInnerSize: 22,
    iconOuterSize: 40,
    labelSize: 16,
    labelLineHeight: 20,
    minWidth: 172,
    paddingHorizontal: 20,
  },
} as const;

export function TapInPulseButton({
  accessibilityLabel,
  disabled = false,
  label = 'Tap In',
  onPress,
  ringState = 'active',
  style,
  variant = 'card',
}: TapInPulseButtonProps): React.JSX.Element {
  const theme = useHoystTheme();
  const [isPressed, setIsPressed] = React.useState(false);
  const spec = variantSpecs[variant];

  return (
    <Pressable
      accessibilityLabel={accessibilityLabel ?? label}
      accessibilityRole="button"
      accessibilityState={{disabled}}
      disabled={disabled}
      onPress={disabled ? undefined : onPress}
      onPressIn={() => {
        if (disabled) {
          return;
        }

        setIsPressed(true);
        triggerTapInPressHaptic();
      }}
      onPressOut={() => setIsPressed(false)}
      style={({pressed}) => [
        styles.pressable,
        variant === 'primary' ? styles.primaryPressable : undefined,
        {
          borderRadius: radius.pill,
          height: spec.height,
          minHeight: Math.max(touchTarget.minimum, spec.height),
          minWidth: spec.minWidth,
          opacity: disabled ? 0.42 : pressed ? actionMotion.pressedOpacity : 1,
          transform: [
            {scale: pressed && !disabled ? actionMotion.pressedScale : 1},
          ],
        },
        variant === 'primary'
          ? {
              shadowColor: theme.actionShadowColor,
              shadowOpacity: theme.actionShadowOpacity,
            }
          : undefined,
        style,
      ]}>
      <View
        style={[
          styles.fill,
          {
            backgroundColor:
              variant === 'card' && !theme.isDark
                ? brandColors.white
                : theme.actionSurface,
            borderColor: theme.actionBorder,
            height: spec.height,
            paddingHorizontal: spec.paddingHorizontal,
          },
        ]}>
        <TapInRingMark
          animated={!disabled}
          innerSize={spec.iconInnerSize}
          isPressed={isPressed}
          outerSize={spec.iconOuterSize}
          state={ringState}
        />
        <HoystText
          numberOfLines={1}
          style={[
            styles.label,
            {
              color: theme.actionForeground,
              fontSize: spec.labelSize,
              lineHeight: spec.labelLineHeight,
            },
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
    borderRadius: radius.pill,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 8,
    justifyContent: 'center',
  },
  label: {
    flexShrink: 1,
    textAlign: 'center',
  },
  pressable: {
    flexShrink: 0,
  },
  primaryPressable: {
    elevation: actionShadow.elevation,
    shadowOffset: actionShadow.offset,
    shadowRadius: actionShadow.compactRadius,
    width: '100%',
  },
});
