import React from 'react';
import {
  type GestureResponderEvent,
  Image,
  Pressable,
  StyleSheet,
  View,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import {ChevronRight} from 'lucide-react-native';

import {triggerTapInPressHaptic} from '../../lib/haptics/tap-in-haptics';
import {getBrandIcon} from '../brand/usage';
import {actionMotion, actionShadow, touchTarget} from '../tokens/actions';
import {radius} from '../tokens/radius';
import {useHoystTheme} from '../theme/useHoystTheme';
import {HoystText} from './HoystText';
import {HoystTapInMark} from './HoystTapInMark';
import type {PulseRingState} from './pulse-ring-state';

type TapInPulseButtonVariant = 'card' | 'hero' | 'primary' | 'reference';

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
    iconOuterSize: 30,
    iconTranslateY: 0,
    labelSize: 14,
    labelLineHeight: 18,
    minWidth: 130,
    paddingBottom: 0,
    paddingHorizontal: 16,
    paddingTop: 0,
  },
  hero: {
    borderWidth: 1,
    gap: 12,
    height: 70,
    iconOuterSize: 58,
    iconTranslateY: 0,
    labelSize: 18,
    labelLineHeight: 22,
    minWidth: 172,
    paddingBottom: 0,
    paddingHorizontal: 16,
    paddingTop: 0,
  },
  primary: {
    borderWidth: 1.8,
    gap: 10,
    height: 58,
    iconOuterSize: 40,
    iconTranslateY: 0,
    labelSize: 16,
    labelLineHeight: 20,
    minWidth: 172,
    paddingBottom: 0,
    paddingHorizontal: 20,
    paddingTop: 0,
  },
  reference: {
    borderWidth: 1.8,
    gap: 12,
    height: 82,
    iconOuterSize: 72,
    iconTranslateY: 0,
    labelSize: 20,
    labelLineHeight: 24,
    minWidth: 172,
    paddingBottom: 0,
    paddingHorizontal: 12,
    paddingTop: 0,
  },
} as const;

export function TapInPulseButton({
  accessibilityLabel,
  disabled = false,
  label = 'Tap In',
  onPress,
  style,
  supportingText,
  variant = 'card',
}: TapInPulseButtonProps): React.JSX.Element {
  const theme = useHoystTheme();
  const [isPressed, setIsPressed] = React.useState(false);
  const [interactionKey, setInteractionKey] = React.useState(0);
  const spec = variantSpecs[variant];
  const hasSupportingText = Boolean(supportingText);
  const isHeroVariant = variant === 'hero';
  const frameBackgroundColor = isHeroVariant
    ? theme.isDark
      ? 'rgba(8,10,16,0.96)'
      : '#15171D'
    : theme.isDark
    ? 'rgba(17, 20, 32, 0.9)'
    : 'rgba(255, 255, 255, 0.96)';
  const frameBorderColor = isHeroVariant
    ? theme.isDark
      ? 'rgba(255,255,255,0.08)'
      : '#15171D'
    : theme.actionBorder;
  const labelColor = isHeroVariant ? '#FFFFFF' : theme.actionForeground;
  const supportingTextColor = isHeroVariant
    ? theme.isDark
      ? '#AEB4C2'
      : '#A9ADB7'
    : theme.textMuted;
  const frameBorderRadius = isHeroVariant ? radius.md : radius.pill;

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
          borderRadius: frameBorderRadius,
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
            backgroundColor: frameBackgroundColor,
            borderColor: frameBorderColor,
            borderRadius: frameBorderRadius,
            borderWidth: spec.borderWidth,
            height: spec.height,
          },
        ]}
        testID="tap-in-pulse-button-frame">
        <View
          style={[
            styles.fill,
            {
              borderRadius: frameBorderRadius,
              gap: spec.gap,
              height: spec.height - spec.borderWidth * 2,
              paddingBottom: spec.paddingBottom,
              paddingHorizontal: spec.paddingHorizontal,
              paddingTop: spec.paddingTop,
            },
          ]}>
          <View
            style={[
              styles.markWrap,
              {transform: [{translateY: spec.iconTranslateY}]},
            ]}
            testID="tap-in-pulse-button-mark-wrap">
            {isHeroVariant ? (
              <Image
                accessibilityIgnoresInvertColors
                resizeMode="contain"
                source={getBrandIcon(true)}
                style={{
                  height: spec.iconOuterSize,
                  width: spec.iconOuterSize,
                }}
                testID="tap-in-pulse-button-hero-logo"
              />
            ) : (
              <HoystTapInMark
                animated={!disabled}
                interactionKey={interactionKey}
                isPressed={isPressed}
                size={spec.iconOuterSize}
              />
            )}
          </View>
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
                  color: labelColor,
                  fontSize: spec.labelSize,
                  lineHeight: spec.labelLineHeight,
                },
              ]}
              variant="button">
              {label}
            </HoystText>
            {hasSupportingText ? (
              <HoystText
                numberOfLines={1}
                style={isHeroVariant ? {color: supportingTextColor} : undefined}
                tone={isHeroVariant ? undefined : 'muted'}
                variant="caption">
                {supportingText}
              </HoystText>
            ) : null}
          </View>
          {isHeroVariant ? (
            <View style={styles.heroChevron}>
              <ChevronRight color="#FFFFFF" size={22} strokeWidth={2.6} />
            </View>
          ) : null}
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
  heroChevron: {
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.14)',
    borderRadius: 999,
    flexShrink: 0,
    height: 42,
    justifyContent: 'center',
    width: 42,
  },
  markWrap: {
    flexShrink: 0,
  },
  pressable: {
    flexShrink: 0,
    overflow: 'visible',
    shadowOffset: actionShadow.offset,
    shadowRadius: actionShadow.compactRadius,
  },
});
