import React from 'react';
import {
  type GestureResponderEvent,
  type LayoutChangeEvent,
  Pressable,
  StyleSheet,
  View,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import Svg, {
  Circle,
  Defs,
  LinearGradient as SvgLinearGradient,
  Rect,
  Stop,
} from 'react-native-svg';

import {useHoystTheme} from '../theme/useHoystTheme';
import {actionMotion, touchTarget} from '../tokens/actions';
import {brandColors} from '../tokens/colors';
import {gradients} from '../tokens/gradients';
import {radius} from '../tokens/radius';
import {HoystText} from './HoystText';

type CircleCardTapInButtonProps = {
  disabled?: boolean;
  label?: string;
  onPress?: (event: GestureResponderEvent) => void;
  style?: StyleProp<ViewStyle>;
};

const BORDER_WIDTH = 1.5;
const BUTTON_HEIGHT = 48;
const ICON_SIZE = 20;
const MIN_WIDTH = 130;

function gradientId(prefix: string, suffix: string) {
  return `${prefix.replace(/[^a-zA-Z0-9]/g, '')}-${suffix}`;
}

function TapInRingIcon({
  gradientPrefix,
  size,
}: {
  gradientPrefix: string;
  size: number;
}) {
  const center = size / 2;
  const strokeWidth = Math.max(2.4, size * 0.13);
  const ringRadius = center - strokeWidth / 2;
  const ringGradientId = gradientId(gradientPrefix, 'ring');

  return (
    <Svg height={size} width={size}>
      <Defs>
        <SvgLinearGradient id={ringGradientId} x1="0" x2="1" y1="0" y2="1">
          <Stop offset="0" stopColor={brandColors.spectrumGreen} />
          <Stop offset="0.18" stopColor={brandColors.spectrumYellow} />
          <Stop offset="0.38" stopColor={brandColors.orangeStrong} />
          <Stop offset="0.58" stopColor="#FF1EA8" />
          <Stop offset="0.78" stopColor={brandColors.purple} />
          <Stop offset="1" stopColor={brandColors.blue} />
        </SvgLinearGradient>
      </Defs>
      <Circle
        cx={center}
        cy={center}
        fill="none"
        r={ringRadius}
        stroke={`url(#${ringGradientId})`}
        strokeLinecap="round"
        strokeWidth={strokeWidth}
      />
    </Svg>
  );
}

export function CircleCardTapInButton({
  disabled = false,
  label = 'Tap In',
  onPress,
  style,
}: CircleCardTapInButtonProps): React.JSX.Element {
  const theme = useHoystTheme();
  const gradientPrefix = React.useId();
  const [buttonWidth, setButtonWidth] = React.useState(0);
  const outlineGradientId = gradientId(gradientPrefix, 'outline');
  const outlineInset = BORDER_WIDTH / 2;
  const outlineWidth = Math.max(0, buttonWidth - BORDER_WIDTH);
  const outlineHeight = BUTTON_HEIGHT - BORDER_WIDTH;
  const outlineRadius = outlineHeight / 2;
  const handleLayout = React.useCallback((event: LayoutChangeEvent) => {
    const nextWidth = event.nativeEvent.layout.width;

    setButtonWidth(currentWidth =>
      Math.abs(currentWidth - nextWidth) > 0.5 ? nextWidth : currentWidth,
    );
  }, []);

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{disabled}}
      disabled={disabled}
      onLayout={handleLayout}
      onPress={disabled ? undefined : onPress}
      style={({pressed}) => [
        styles.pressable,
        {
          opacity: disabled ? 0.42 : pressed ? actionMotion.pressedOpacity : 1,
          transform: [
            {scale: pressed && !disabled ? actionMotion.pressedScale : 1},
          ],
        },
        style,
      ]}>
      <View
        style={[
          styles.fill,
          {
            backgroundColor: theme.isDark
              ? theme.surfaceHigh
              : brandColors.white,
          },
        ]}>
        {buttonWidth > 0 ? (
          <Svg
            height={BUTTON_HEIGHT}
            pointerEvents="none"
            style={styles.outline}
            width={buttonWidth}>
            <Defs>
              <SvgLinearGradient
                id={outlineGradientId}
                x1="0"
                x2={buttonWidth}
                y1="0"
                y2={BUTTON_HEIGHT}
                gradientUnits="userSpaceOnUse">
                {gradients.primaryRing.map((color, index) => (
                  <Stop
                    key={`${color}-${index}`}
                    offset={`${
                      (index / (gradients.primaryRing.length - 1)) * 100
                    }%`}
                    stopColor={color}
                  />
                ))}
              </SvgLinearGradient>
            </Defs>
            <Rect
              fill="none"
              height={outlineHeight}
              rx={outlineRadius}
              stroke={`url(#${outlineGradientId})`}
              strokeWidth={BORDER_WIDTH}
              width={outlineWidth}
              x={outlineInset}
              y={outlineInset}
            />
          </Svg>
        ) : null}
        <TapInRingIcon gradientPrefix={gradientPrefix} size={ICON_SIZE} />
        <HoystText
          numberOfLines={1}
          style={[styles.label, {color: theme.actionForeground}]}
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
    flexDirection: 'row',
    gap: 10,
    height: BUTTON_HEIGHT,
    justifyContent: 'center',
    paddingHorizontal: 18,
  },
  label: {
    fontSize: 14,
    lineHeight: 18,
  },
  outline: {
    left: 0,
    position: 'absolute',
    top: 0,
  },
  pressable: {
    borderRadius: radius.pill,
    flexShrink: 0,
    height: BUTTON_HEIGHT,
    minHeight: Math.max(touchTarget.minimum, BUTTON_HEIGHT),
    minWidth: MIN_WIDTH,
  },
});
