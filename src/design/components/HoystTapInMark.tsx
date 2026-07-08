import React, {useEffect, useRef, useState} from 'react';
import {
  AccessibilityInfo,
  Animated,
  Easing,
  Image,
  StyleSheet,
  View,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import Svg, {
  Defs,
  Ellipse,
  RadialGradient as SvgRadialGradient,
  Stop,
} from 'react-native-svg';

import {getBrandIcon} from '../brand/usage';
import {useHoystTheme} from '../theme/useHoystTheme';

export type HoystTapInMarkProps = {
  animated?: boolean;
  interactionKey?: number;
  isPressed?: boolean;
  logoRotation?: Animated.AnimatedInterpolation<string | number>;
  size?: number;
  style?: StyleProp<ViewStyle>;
  testID?: string;
};

const isTestEnvironment =
  typeof process !== 'undefined' && process.env.NODE_ENV === 'test';

function sanitizeId(value: string) {
  return value.replace(/[^a-zA-Z0-9]/g, '');
}

export function HoystTapInMark({
  animated = true,
  interactionKey = 0,
  isPressed = false,
  logoRotation,
  size = 72,
  style,
  testID,
}: HoystTapInMarkProps): React.JSX.Element {
  const theme = useHoystTheme();
  const [reduceMotion, setReduceMotion] = useState(isTestEnvironment);
  const floatProgress = useRef(new Animated.Value(0)).current;
  const interactionProgress = useRef(new Animated.Value(0)).current;
  const previousInteractionKey = useRef(interactionKey);
  const shadowGradientId = `hoystTapInShadow${sanitizeId(React.useId())}`;
  const shadowHeight = Math.max(6, size * 0.12);
  const shadowWidth = size * 0.42;
  const shadowCanvasHeight = shadowHeight * 2.4;
  const shadowCanvasWidth = shadowWidth * 1.75;
  const canvasHeight = size + shadowHeight + Math.max(2, size * 0.04);
  const logoTranslateY = floatProgress.interpolate({
    inputRange: [0, 1],
    outputRange: [0, -Math.max(2, size * 0.07)],
  });
  const pressedTranslateY = interactionProgress.interpolate({
    inputRange: [0, 0.16, 0.42, 1],
    outputRange: [0, -Math.max(2, size * 0.06), 1, 0],
  });
  const logoScale = interactionProgress.interpolate({
    inputRange: [0, 0.16, 0.42, 1],
    outputRange: [1, 1.035, 0.98, 1],
  });
  const shadowScale = floatProgress.interpolate({
    inputRange: [0, 1],
    outputRange: [1, 0.78],
  });
  const shadowPressedScale = interactionProgress.interpolate({
    inputRange: [0, 0.16, 0.42, 1],
    outputRange: [1, 0.72, 1.08, 1],
  });
  const shadowOpacity = floatProgress.interpolate({
    inputRange: [0, 1],
    outputRange: [theme.isDark ? 0.42 : 0.32, theme.isDark ? 0.26 : 0.18],
  });
  const shadowCenterColor = theme.isDark
    ? 'rgba(255,255,255,0.46)'
    : 'rgba(18,24,38,0.44)';
  const shadowMidColor = theme.isDark
    ? 'rgba(255,255,255,0.2)'
    : 'rgba(18,24,38,0.18)';
  const shadowEdgeColor = theme.isDark
    ? 'rgba(255,255,255,0)'
    : 'rgba(18,24,38,0)';

  useEffect(() => {
    if (isTestEnvironment) {
      return undefined;
    }

    let isMounted = true;

    AccessibilityInfo.isReduceMotionEnabled()
      .then(enabled => {
        if (isMounted) {
          setReduceMotion(enabled);
        }
      })
      .catch(() => undefined);

    return () => {
      isMounted = false;
    };
  }, []);

  useEffect(() => {
    floatProgress.stopAnimation();
    floatProgress.setValue(0);

    if (!animated || reduceMotion) {
      return undefined;
    }

    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(floatProgress, {
          duration: 1550,
          easing: Easing.inOut(Easing.sin),
          toValue: 1,
          useNativeDriver: true,
        }),
        Animated.timing(floatProgress, {
          duration: 1550,
          easing: Easing.inOut(Easing.sin),
          toValue: 0,
          useNativeDriver: true,
        }),
      ]),
    );

    loop.start();

    return () => {
      loop.stop();
    };
  }, [animated, floatProgress, reduceMotion]);

  useEffect(() => {
    const interactionChanged =
      previousInteractionKey.current !== interactionKey;
    previousInteractionKey.current = interactionKey;

    if (!isPressed && !interactionChanged) {
      return;
    }

    interactionProgress.stopAnimation();

    if (!animated || reduceMotion) {
      interactionProgress.setValue(0);
      return;
    }

    interactionProgress.setValue(0);
    Animated.sequence([
      Animated.timing(interactionProgress, {
        duration: 140,
        easing: Easing.out(Easing.quad),
        toValue: 0.16,
        useNativeDriver: true,
      }),
      Animated.timing(interactionProgress, {
        duration: 180,
        easing: Easing.inOut(Easing.quad),
        toValue: 0.42,
        useNativeDriver: true,
      }),
      Animated.timing(interactionProgress, {
        duration: 260,
        easing: Easing.out(Easing.cubic),
        toValue: 1,
        useNativeDriver: true,
      }),
    ]).start(({finished}) => {
      if (finished) {
        interactionProgress.setValue(0);
      }
    });
  }, [animated, interactionKey, interactionProgress, isPressed, reduceMotion]);

  return (
    <View
      style={[styles.wrap, {height: canvasHeight, width: size}, style]}
      testID={testID}>
      <Animated.View
        pointerEvents="none"
        style={[
          styles.shadowDisk,
          {
            bottom: -shadowHeight * 0.28,
            height: shadowCanvasHeight,
            opacity: reduceMotion
              ? theme.isDark
                ? 0.32
                : 0.24
              : shadowOpacity,
            transform: reduceMotion
              ? undefined
              : [{scaleX: Animated.multiply(shadowScale, shadowPressedScale)}],
            width: shadowCanvasWidth,
          },
        ]}
        testID="hoyst-tap-in-mark-shadow">
        <Svg
          height={shadowCanvasHeight}
          viewBox={`0 0 ${shadowCanvasWidth} ${shadowCanvasHeight}`}
          width={shadowCanvasWidth}>
          <Defs>
            <SvgRadialGradient
              cx="50%"
              cy="50%"
              fx="50%"
              fy="50%"
              id={shadowGradientId}
              rx="50%"
              ry="50%">
              <Stop offset="0" stopColor={shadowCenterColor} />
              <Stop offset="0.48" stopColor={shadowMidColor} />
              <Stop offset="1" stopColor={shadowEdgeColor} />
            </SvgRadialGradient>
          </Defs>
          <Ellipse
            cx={shadowCanvasWidth / 2}
            cy={shadowCanvasHeight / 2}
            fill={`url(#${shadowGradientId})`}
            rx={shadowWidth / 2}
            ry={shadowHeight / 2}
            testID="hoyst-tap-in-mark-shadow-core"
          />
        </Svg>
      </Animated.View>
      <Animated.View
        pointerEvents="none"
        style={[
          styles.logoLayer,
          {
            height: size,
            transform: reduceMotion
              ? logoRotation
                ? [{rotate: logoRotation}]
                : undefined
              : [
                  {
                    translateY: Animated.add(logoTranslateY, pressedTranslateY),
                  },
                  {scale: logoScale},
                  ...(logoRotation ? [{rotate: logoRotation}] : []),
                ],
            width: size,
          },
        ]}
        testID="hoyst-tap-in-mark-logo">
        <Image
          accessibilityIgnoresInvertColors
          resizeMode="contain"
          source={getBrandIcon(theme.isDark)}
          style={{height: size, width: size}}
          testID="hoyst-tap-in-mark-image"
        />
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  logoLayer: {
    left: 0,
    position: 'absolute',
    top: 0,
  },
  shadowDisk: {
    alignSelf: 'center',
    position: 'absolute',
  },
  wrap: {
    alignItems: 'center',
    overflow: 'visible',
  },
});
