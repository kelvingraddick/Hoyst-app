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
  Circle,
  Defs,
  G,
  LinearGradient as SvgLinearGradient,
  Path,
  Stop,
} from 'react-native-svg';

import {getBrandRing} from '../brand/usage';
import {useHoystTheme} from '../theme/useHoystTheme';
import {brandColors} from '../tokens/colors';
import type {PulseRingState} from './pulse-ring-state';

type PulseRingCenterTreatment = 'plain' | 'state';

type PulseRingProps = {
  animated?: boolean;
  centerTreatment?: PulseRingCenterTreatment;
  interactionKey?: number;
  isPressed?: boolean;
  showTrail?: boolean;
  size?: number;
  state?: PulseRingState;
  strokeWidth?: number;
  style?: StyleProp<ViewStyle>;
  testID?: string;
};

type RingStateConfig = {
  glowColor: string;
  glowOpacity: number;
  glowPeakOpacity: number;
  glowPeakColor: string;
  pulseColor: string;
  pulseDuration: number;
  rippleOpacity: number;
  scalePeak: number;
  trail: boolean;
};

const isTestEnvironment =
  typeof process !== 'undefined' && process.env.NODE_ENV === 'test';

function sanitizeId(value: string) {
  return value.replace(/[^a-zA-Z0-9]/g, '');
}

function getStateConfig(state: PulseRingState): RingStateConfig {
  if (state === 'active') {
    return {
      glowColor: 'rgba(16, 185, 103, 0.18)',
      glowOpacity: 0.18,
      glowPeakOpacity: 0.3,
      glowPeakColor: 'rgba(0, 200, 83, 0.2)',
      pulseColor: brandColors.spectrumGreen,
      pulseDuration: 5200,
      rippleOpacity: 0.2,
      scalePeak: 1.024,
      trail: false,
    };
  }

  if (state === 'atRisk') {
    return {
      glowColor: 'rgba(255, 109, 0, 0.2)',
      glowOpacity: 0.22,
      glowPeakOpacity: 0.34,
      glowPeakColor: 'rgba(255, 109, 0, 0.24)',
      pulseColor: brandColors.orangeStrong,
      pulseDuration: 4200,
      rippleOpacity: 0.22,
      scalePeak: 1.036,
      trail: false,
    };
  }

  if (state === 'streak') {
    return {
      glowColor: 'rgba(255, 30, 168, 0.18)',
      glowOpacity: 0.24,
      glowPeakOpacity: 0.36,
      glowPeakColor: 'rgba(122, 85, 255, 0.22)',
      pulseColor: '#FF1EA8',
      pulseDuration: 4800,
      rippleOpacity: 0.24,
      scalePeak: 1.03,
      trail: true,
    };
  }

  return {
    glowColor: 'rgba(15, 23, 42, 0.08)',
    glowOpacity: 0.1,
    glowPeakOpacity: 0.16,
    glowPeakColor: 'rgba(15, 23, 42, 0.1)',
    pulseColor: brandColors.graySoft,
    pulseDuration: 5200,
    rippleOpacity: 0.12,
    scalePeak: 1,
    trail: false,
  };
}

function getPointOnCircle({
  angle,
  center,
  radius,
}: {
  angle: number;
  center: number;
  radius: number;
}) {
  const radians = ((angle - 90) * Math.PI) / 180;

  return {
    x: center + radius * Math.cos(radians),
    y: center + radius * Math.sin(radians),
  };
}

function getArcPath({
  center,
  endAngle,
  radius,
  startAngle,
}: {
  center: number;
  endAngle: number;
  radius: number;
  startAngle: number;
}) {
  const start = getPointOnCircle({angle: startAngle, center, radius});
  const end = getPointOnCircle({angle: endAngle, center, radius});
  const largeArcFlag = Math.abs(endAngle - startAngle) > 180 ? '1' : '0';

  return `M ${start.x} ${start.y} A ${radius} ${radius} 0 ${largeArcFlag} 1 ${end.x} ${end.y}`;
}

export function PulseRing({
  animated = true,
  interactionKey = 0,
  isPressed = false,
  showTrail = true,
  size = 72,
  state = 'idle',
  strokeWidth,
  style,
  testID,
}: PulseRingProps): React.JSX.Element {
  const theme = useHoystTheme();
  const id = sanitizeId(React.useId());
  const config = getStateConfig(state);
  const [reduceMotion, setReduceMotion] = useState(isTestEnvironment);
  const breathProgress = useRef(new Animated.Value(0)).current;
  const interactionProgress = useRef(new Animated.Value(0)).current;
  const previousInteractionKey = useRef(interactionKey);
  const effectiveStrokeWidth = Math.max(
    3,
    Math.min(10, strokeWidth ?? size * 0.12),
  );
  const canvasPadding = Math.max(20, size * 0.34);
  const canvasSize = size + canvasPadding;
  const center = canvasSize / 2;
  const ringRadius = size / 2;
  const ringAssetSize = Math.round(size * 0.78);
  const rippleRadius = size / 2 + Math.max(4, size * 0.08);
  const trailGradientId = `pulseRingTrailGradient${id}`;
  const breathScale = breathProgress.interpolate({
    inputRange: [0, 1],
    outputRange: [1, config.scalePeak],
  });
  const breathGlowOpacity = breathProgress.interpolate({
    inputRange: [0, 1],
    outputRange: [config.glowOpacity, config.glowPeakOpacity],
  });
  const tapScale = interactionProgress.interpolate({
    inputRange: [0, 0.12, 0.22, 0.72, 1],
    outputRange: [1, 1.032, 0.96, 1.045, 1],
  });
  const rippleScale = interactionProgress.interpolate({
    inputRange: [0, 0.22, 0.5, 1],
    outputRange: [0.86, 0.92, 1.58, 1.72],
  });
  const rippleOpacity = interactionProgress.interpolate({
    inputRange: [0, 0.2, 0.42, 0.72, 1],
    outputRange: [0, 0, config.rippleOpacity, 0.12, 0],
  });
  const peakGlowOpacity = interactionProgress.interpolate({
    inputRange: [0, 0.45, 0.72, 1],
    outputRange: [0, 0, 0.92, 0],
  });
  const trailOpacity = interactionProgress.interpolate({
    inputRange: [0, 0.18, 0.36, 1],
    outputRange: [0.64, 0.86, 0.16, 0.5],
  });
  const ringAnimatedStyle = reduceMotion
    ? undefined
    : {
        transform: [{scale: Animated.multiply(breathScale, tapScale)}],
      };
  const trailPath = getArcPath({
    center,
    endAngle: 116,
    radius: ringRadius + effectiveStrokeWidth * 1.5,
    startAngle: 28,
  });

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
    breathProgress.stopAnimation();
    breathProgress.setValue(0);

    if (!animated || reduceMotion || state === 'idle') {
      return undefined;
    }

    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(breathProgress, {
          duration: config.pulseDuration / 2,
          easing:
            state === 'atRisk'
              ? Easing.out(Easing.cubic)
              : Easing.inOut(Easing.sin),
          toValue: 1,
          useNativeDriver: true,
        }),
        Animated.timing(breathProgress, {
          duration: config.pulseDuration / 2,
          easing:
            state === 'atRisk'
              ? Easing.in(Easing.cubic)
              : Easing.inOut(Easing.sin),
          toValue: 0,
          useNativeDriver: true,
        }),
      ]),
    );

    loop.start();

    return () => {
      loop.stop();
    };
  }, [
    animated,
    breathProgress,
    config.pulseDuration,
    reduceMotion,
    state,
  ]);

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
        duration: 150,
        easing: Easing.out(Easing.quad),
        toValue: 0.12,
        useNativeDriver: true,
      }),
      Animated.timing(interactionProgress, {
        duration: 100,
        easing: Easing.inOut(Easing.quad),
        toValue: 0.22,
        useNativeDriver: true,
      }),
      Animated.timing(interactionProgress, {
        duration: 350,
        easing: Easing.out(Easing.cubic),
        toValue: 0.5,
        useNativeDriver: true,
      }),
      Animated.timing(interactionProgress, {
        duration: 300,
        easing: Easing.out(Easing.cubic),
        toValue: 0.72,
        useNativeDriver: true,
      }),
      Animated.timing(interactionProgress, {
        duration: 300,
        easing: Easing.inOut(Easing.sin),
        toValue: 1,
        useNativeDriver: true,
      }),
    ]).start(({finished}) => {
      if (finished) {
        interactionProgress.setValue(0);
      }
    });
  }, [
    animated,
    interactionKey,
    interactionProgress,
    isPressed,
    reduceMotion,
  ]);

  return (
    <View
      testID={testID}
      style={[styles.wrap, {height: canvasSize, width: canvasSize}, style]}>
      <Animated.View
        pointerEvents="none"
        style={[
          styles.statusGlow,
          {
            backgroundColor: config.glowColor,
            borderRadius: canvasSize / 2,
            height: size * 1.18,
            opacity: reduceMotion ? config.glowOpacity : breathGlowOpacity,
            width: size * 1.18,
          },
        ]}
        testID="pulse-ring-status-glow"
      />
      <Animated.View
        pointerEvents="none"
        style={[
          styles.peakGlow,
          {
            backgroundColor: config.glowPeakColor,
            borderRadius: canvasSize / 2,
            height: size * 1.22,
            opacity: reduceMotion ? 0 : peakGlowOpacity,
            transform: reduceMotion ? undefined : [{scale: rippleScale}],
            width: size * 1.22,
          },
        ]}
        testID="pulse-ring-peak-glow"
      />
      <Animated.View
        pointerEvents="none"
        style={[
          styles.ripple,
          {
            borderColor: config.pulseColor,
            borderRadius: rippleRadius,
            height: rippleRadius * 2,
            opacity: reduceMotion ? 0 : rippleOpacity,
            transform: reduceMotion ? undefined : [{scale: rippleScale}],
            width: rippleRadius * 2,
          },
        ]}
        testID="pulse-ring-ripple"
      />
      {config.trail && showTrail ? (
        <Animated.View
          pointerEvents="none"
          style={[
            styles.trailLayer,
            {opacity: reduceMotion ? 0.58 : trailOpacity},
          ]}>
          <Svg height={canvasSize} width={canvasSize}>
            <Defs>
              <SvgLinearGradient
                gradientUnits="userSpaceOnUse"
                id={trailGradientId}
                x1={center - ringRadius}
                x2={center + ringRadius}
                y1={center}
                y2={center}>
                <Stop offset="0" stopColor="rgba(255, 30, 168, 0)" />
                <Stop offset="0.44" stopColor="#FF1EA8" />
                <Stop offset="1" stopColor={brandColors.purpleBright} />
              </SvgLinearGradient>
            </Defs>
            <G testID="pulse-ring-streak-trail">
              <Path
                d={trailPath}
                fill="none"
                stroke={`url(#${trailGradientId})`}
                strokeLinecap="round"
                strokeWidth={Math.max(2, effectiveStrokeWidth * 0.72)}
                testID="pulse-ring-trail-path"
              />
              {[32, 52, 76, 104, 132].map((angle, index) => {
                const point = getPointOnCircle({
                  angle,
                  center,
                  radius:
                    ringRadius + effectiveStrokeWidth * (1.7 + index * 0.18),
                });

                return (
                  <Circle
                    cx={point.x}
                    cy={point.y}
                    fill={
                      index % 2 === 0 ? '#FF1EA8' : brandColors.purpleBright
                    }
                    key={angle}
                    opacity={0.76 - index * 0.1}
                    r={Math.max(1.3, effectiveStrokeWidth * 0.24)}
                    testID={`pulse-ring-trail-particle-${index}`}
                  />
                );
              })}
            </G>
          </Svg>
        </Animated.View>
      ) : null}
      <Animated.View style={ringAnimatedStyle}>
        <View
          style={[
            styles.baseDisk,
            {
              backgroundColor: theme.isDark
                ? theme.surfaceStrong
                : brandColors.white,
              borderColor: theme.isDark
                ? 'rgba(255, 255, 255, 0.12)'
                : 'rgba(16, 24, 40, 0.06)',
              borderRadius: size / 2,
              height: size,
              shadowColor: theme.shadow,
              width: size,
            },
          ]}
          testID="pulse-ring-base">
          <Image
            accessibilityIgnoresInvertColors
            resizeMode="contain"
            source={getBrandRing()}
            style={{height: ringAssetSize, width: ringAssetSize}}
            testID="pulse-ring-brand-image"
          />
        </View>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  baseDisk: {
    alignItems: 'center',
    borderWidth: 1,
    elevation: 5,
    justifyContent: 'center',
    shadowOffset: {height: 4, width: 0},
    shadowOpacity: 0.13,
    shadowRadius: 12,
  },
  peakGlow: {
    position: 'absolute',
  },
  ripple: {
    borderWidth: 1.1,
    position: 'absolute',
  },
  statusGlow: {
    position: 'absolute',
  },
  trailLayer: {
    position: 'absolute',
  },
  wrap: {
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'visible',
  },
});
