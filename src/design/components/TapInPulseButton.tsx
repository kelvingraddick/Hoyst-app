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
import {radius} from '../tokens/radius';
import {useHoystTheme} from '../theme/useHoystTheme';
import {HoystText} from './HoystText';
import {TapInRingMark} from './TapInRingMark';
import type {PulseRingState} from './pulse-ring-state';

type TapInPulseButtonVariant = 'card' | 'primary' | 'reference';

type TapInPulseButtonProps = {
  accessibilityLabel?: string;
  disabled?: boolean;
  label?: string;
  onPress?: (event: GestureResponderEvent) => void;
  ringState?: PulseRingState;
  style?: StyleProp<ViewStyle>;
  supportingText?: string;
  variant?: TapInPulseButtonVariant;
};

const variantSpecs = {
  card: {
    borderWidth: 1.5,
    gap: 8,
    height: 48,
    iconInnerSize: 17,
    iconOuterSize: 30,
    labelSize: 14,
    labelLineHeight: 18,
    minWidth: 130,
    paddingHorizontal: 16,
  },
  primary: {
    borderWidth: 1.8,
    gap: 10,
    height: 58,
    iconInnerSize: 22,
    iconOuterSize: 40,
    labelSize: 16,
    labelLineHeight: 20,
    minWidth: 172,
    paddingHorizontal: 20,
  },
  reference: {
    borderWidth: 1.8,
    gap: 12,
    height: 82,
    iconInnerSize: 42,
    iconOuterSize: 72,
    labelSize: 20,
    labelLineHeight: 24,
    minWidth: 172,
    paddingHorizontal: 12,
  },
} as const;

export function TapInPulseButton({
  accessibilityLabel,
  disabled = false,
  label = 'Tap In',
  onPress,
  ringState = 'active',
  style,
  supportingText,
  variant = 'card',
}: TapInPulseButtonProps): React.JSX.Element {
  const theme = useHoystTheme();
  const [isPressed, setIsPressed] = React.useState(false);
  const [interactionKey, setInteractionKey] = React.useState(0);
  const spec = variantSpecs[variant];
  const hasSupportingText = Boolean(supportingText);

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
        setInteractionKey(current => current + 1);
        triggerTapInPressHaptic();
      }}
      onPressOut={() => setIsPressed(false)}
      style={({pressed}) => [
        styles.pressable,
        variant !== 'card' ? styles.elevatedPressable : undefined,
        {
          borderRadius: radius.pill,
          height: spec.height,
          minHeight: Math.max(touchTarget.minimum, spec.height),
          minWidth: spec.minWidth,
          opacity: disabled ? 0.42 : pressed ? actionMotion.pressedOpacity : 1,
          shadowColor: theme.actionShadowColor,
          shadowOpacity:
            variant === 'card'
              ? theme.actionShadowOpacity * 0.65
              : theme.actionShadowOpacity,
          transform: [{scale: pressed && !disabled ? 0.96 : 1}],
        },
        style,
      ]}>
      <View
        style={[
          styles.frame,
          {
            backgroundColor: theme.isDark
              ? 'rgba(17, 20, 32, 0.9)'
              : 'rgba(255, 255, 255, 0.96)',
            borderColor: theme.actionBorder,
            borderRadius: radius.pill,
            borderWidth: spec.borderWidth,
            height: spec.height,
          },
        ]}
        testID="tap-in-pulse-button-frame">
        <View
          style={[
            styles.fill,
            {
              borderRadius: radius.pill,
              gap: spec.gap,
              height: spec.height - spec.borderWidth * 2,
              paddingHorizontal: spec.paddingHorizontal,
            },
          ]}>
          <TapInRingMark
            animated={!disabled}
            centerTreatment="state"
            innerSize={spec.iconInnerSize}
            interactionKey={interactionKey}
            isPressed={isPressed}
            outerSize={spec.iconOuterSize}
            state={ringState}
          />
          <View
            style={[
              styles.copy,
              hasSupportingText ? styles.copyWithSupportingText : undefined,
            ]}>
            <HoystText
              numberOfLines={1}
              style={[
                styles.label,
                hasSupportingText ? styles.labelWithSupportingText : undefined,
                {
                  color: theme.actionForeground,
                  fontSize: spec.labelSize,
                  lineHeight: spec.labelLineHeight,
                },
              ]}
              variant="button">
              {label}
            </HoystText>
            {hasSupportingText ? (
              <HoystText numberOfLines={1} tone="muted" variant="caption">
                {supportingText}
              </HoystText>
            ) : null}
          </View>
        </View>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  copy: {
    flexShrink: 1,
    minWidth: 0,
  },
  copyWithSupportingText: {
    flex: 1,
    gap: 2,
  },
  elevatedPressable: {
    elevation: actionShadow.elevation,
    shadowOffset: actionShadow.offset,
    shadowRadius: actionShadow.compactRadius,
    width: '100%',
  },
  fill: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'center',
  },
  frame: {
    justifyContent: 'center',
    overflow: 'visible',
  },
  label: {
    flexShrink: 1,
    textAlign: 'center',
  },
  labelWithSupportingText: {
    textAlign: 'left',
  },
  pressable: {
    flexShrink: 0,
    overflow: 'visible',
    shadowOffset: actionShadow.offset,
    shadowRadius: actionShadow.compactRadius,
  },
});
