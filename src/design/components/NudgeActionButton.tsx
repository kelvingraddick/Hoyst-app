import React from 'react';
import {
  type GestureResponderEvent,
  Pressable,
  StyleSheet,
  View,
  type StyleProp,
  type ViewStyle,
} from 'react-native';

import {useHoystTheme} from '../theme/useHoystTheme';
import {actionMotion, actionShadow, touchTarget} from '../tokens/actions';
import {brandColors} from '../tokens/colors';
import {radius} from '../tokens/radius';
import {HoystText} from './HoystText';
import {NudgeMark} from './NudgeMark';

type NudgeActionButtonSize = 'card' | 'compact';

type NudgeActionButtonProps = {
  accessibilityLabel?: string;
  disabled?: boolean;
  isLoading?: boolean;
  isSent?: boolean;
  label: string;
  onPress?: (event: GestureResponderEvent) => void;
  size?: NudgeActionButtonSize;
  style?: StyleProp<ViewStyle>;
  targetCount?: number;
};

const sizeSpecs = {
  card: {
    fontSize: 14,
    gap: 6,
    height: 44,
    iconSize: 17,
    iconSlotSize: 20,
    lineHeight: 18,
    minWidth: 136,
    paddingHorizontal: 14,
    showIcon: true,
    strokeWidth: 5,
  },
  compact: {
    fontSize: 14,
    gap: 6,
    height: 42,
    iconSize: 15,
    iconSlotSize: 17,
    lineHeight: 18,
    minWidth: 104,
    paddingHorizontal: 12,
    showIcon: true,
    strokeWidth: 5,
  },
} as const;

function getMemberCopy(targetCount: number) {
  return targetCount === 1 ? '1 member' : `${targetCount} members`;
}

function getAccessibilityLabel({
  fallback,
  isLoading,
  isSent,
  targetCount,
}: {
  fallback: string;
  isLoading: boolean;
  isSent: boolean;
  targetCount?: number;
}) {
  if (targetCount === undefined) {
    return fallback;
  }

  const memberCopy = getMemberCopy(targetCount);

  if (isLoading) {
    return `Sending nudge to ${memberCopy}`;
  }

  if (isSent) {
    return `Nudge sent to ${memberCopy}`;
  }

  return `Nudge ${memberCopy}`;
}

export function NudgeActionButton({
  accessibilityLabel,
  disabled = false,
  isLoading = false,
  isSent = false,
  label,
  onPress,
  size = 'card',
  style,
  targetCount,
}: NudgeActionButtonProps): React.JSX.Element {
  const theme = useHoystTheme();
  const spec = sizeSpecs[size];
  const isUnavailable = disabled || isLoading || isSent;
  const backgroundColor = theme.isDark
    ? 'rgba(122,85,255,0.16)'
    : 'rgba(90,28,255,0.08)';
  const borderColor = theme.isDark
    ? 'rgba(122,85,255,0.44)'
    : 'rgba(90,28,255,0.26)';
  const glowColor = theme.isDark
    ? brandColors.purpleBright
    : brandColors.purple;
  const foregroundColor = theme.accentSecondaryForeground;

  return (
    <Pressable
      accessibilityLabel={
        accessibilityLabel ??
        getAccessibilityLabel({fallback: label, isLoading, isSent, targetCount})
      }
      accessibilityRole="button"
      accessibilityState={{busy: isLoading, disabled: isUnavailable}}
      disabled={isUnavailable}
      onPress={isUnavailable ? undefined : onPress}
      style={({pressed}) => [
        styles.pressable,
        {
          minHeight: Math.max(touchTarget.minimum, spec.height),
          minWidth: spec.minWidth,
          opacity: isUnavailable ? (isSent ? 0.88 : 0.58) : pressed ? 0.96 : 1,
          shadowColor: glowColor,
          shadowOpacity: isUnavailable ? 0.08 : theme.isDark ? 0.28 : 0.18,
          transform: [
            {scale: pressed && !isUnavailable ? actionMotion.pressedScale : 1},
          ],
        },
        style,
      ]}>
      <View
        style={[
          styles.fill,
          {
            backgroundColor,
            borderColor,
            borderRadius: radius.pill,
            gap: spec.gap,
            height: spec.height,
            paddingHorizontal: spec.paddingHorizontal,
          },
        ]}>
        <View style={[styles.content, {gap: spec.gap}]}>
          {spec.showIcon ? (
            <View
              style={[
                styles.iconSlot,
                {
                  height: spec.iconSlotSize,
                  width: spec.iconSlotSize,
                },
              ]}>
              <NudgeMark
                color={foregroundColor}
                size={spec.iconSize}
                strokeWidth={spec.strokeWidth}
              />
            </View>
          ) : null}
          <HoystText
            adjustsFontSizeToFit
            minimumFontScale={0.84}
            numberOfLines={1}
            style={[
              styles.label,
              {
                color: foregroundColor,
                fontSize: spec.fontSize,
                lineHeight: spec.lineHeight,
              },
            ]}
            variant="button">
            {label}
          </HoystText>
        </View>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  content: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'center',
    minWidth: 0,
  },
  fill: {
    alignItems: 'center',
    borderWidth: 1.4,
    justifyContent: 'center',
    overflow: 'hidden',
    width: '100%',
  },
  iconSlot: {
    alignItems: 'center',
    flexShrink: 0,
    justifyContent: 'center',
  },
  label: {
    flexShrink: 1,
    letterSpacing: 0,
    minWidth: 0,
    textAlign: 'center',
  },
  pressable: {
    elevation: 5,
    flexShrink: 0,
    shadowOffset: actionShadow.offset,
    shadowRadius: actionShadow.compactRadius,
  },
});
