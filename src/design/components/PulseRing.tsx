import React, {useEffect, useRef, useState} from 'react';
import {
  AccessibilityInfo,
  Animated,
  Easing,
  StyleSheet,
  View,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import Svg, {
  Circle,
  ClipPath,
  Defs,
  G,
  LinearGradient as SvgLinearGradient,
  Path,
  Stop,
} from 'react-native-svg';

import {brandColors} from '../tokens/colors';
import {useHoystTheme} from '../theme/useHoystTheme';
import type {PulseRingState} from './pulse-ring-state';

type PulseRingProps = {
  animated?: boolean;
  isPressed?: boolean;
  size?: number;
  state?: PulseRingState;
  strokeWidth?: number;
  style?: StyleProp<ViewStyle>;
  testID?: string;
};

type RingStateConfig = {
  glowColor: string;
  glowPeakColor: string;
  glowPeakOpacity: number;
  haloColor: string;
  pulseColor: string;
  pulseDuration: number;
  restingGlowOpacity: number;
  scalePeak: number;
  trail: boolean;
};

type RingRibbonName =
  | 'yellow'
  | 'orange'
  | 'pink'
  | 'purple'
  | 'blue'
  | 'green';

type RingRibbon = {
  color: string;
  highlightColor: string;
  name: RingRibbonName;
  shadeColor: string;
  startAngle: number;
};

const RIBBON_BASE_SWEEP_DEGREES = 60;
const RIBBON_BLADE_OVERLAP_DEGREES = 14;
const RIBBON_CAP_SWEEP_DEGREES = 34;
const RIBBON_INNER_SKEW_DEGREES = 48;
const RIBBON_UNDERLAY_OVERLAP_DEGREES = 3.2;

const RING_RIBBONS: RingRibbon[] = [
  {
    color: brandColors.spectrumGreen,
    highlightColor: '#4AF186',
    name: 'green',
    shadeColor: '#009D44',
    startAngle: 270,
  },
  {
    color: brandColors.blue,
    highlightColor: '#67D8FF',
    name: 'blue',
    shadeColor: '#087BCD',
    startAngle: 210,
  },
  {
    color: brandColors.purple,
    highlightColor: '#8D54FF',
    name: 'purple',
    shadeColor: '#3A0FCE',
    startAngle: 150,
  },
  {
    color: '#FF1EA8',
    highlightColor: '#FF6ECD',
    name: 'pink',
    shadeColor: '#C7007C',
    startAngle: 90,
  },
  {
    color: brandColors.orangeStrong,
    highlightColor: '#FF9D32',
    name: 'orange',
    shadeColor: '#D84F00',
    startAngle: 30,
  },
  {
    color: brandColors.spectrumYellow,
    highlightColor: '#FFE36D',
    name: 'yellow',
    shadeColor: '#F5A900',
    startAngle: 330,
  },
];

const isTestEnvironment =
  typeof process !== 'undefined' && process.env.NODE_ENV === 'test';

function sanitizeId(value: string) {
  return value.replace(/[^a-zA-Z0-9]/g, '');
}

function getStateConfig(state: PulseRingState): RingStateConfig {
  if (state === 'active') {
    return {
      glowColor: 'rgba(16, 185, 103, 0.24)',
      glowPeakColor: 'rgba(0, 200, 83, 0.34)',
      glowPeakOpacity: 0.82,
      haloColor: 'rgba(16, 185, 103, 0.22)',
      pulseColor: brandColors.spectrumGreen,
      pulseDuration: 5200,
      restingGlowOpacity: 0.5,
      scalePeak: 1.026,
      trail: false,
    };
  }

  if (state === 'atRisk') {
    return {
      glowColor: 'rgba(255, 109, 0, 0.26)',
      glowPeakColor: 'rgba(255, 109, 0, 0.36)',
      glowPeakOpacity: 0.9,
      haloColor: 'rgba(255, 109, 0, 0.28)',
      pulseColor: brandColors.orangeStrong,
      pulseDuration: 1500,
      restingGlowOpacity: 0.58,
      scalePeak: 1.04,
      trail: false,
    };
  }

  if (state === 'streak') {
    return {
      glowColor: 'rgba(255, 30, 168, 0.24)',
      glowPeakColor: 'rgba(90, 28, 255, 0.34)',
      glowPeakOpacity: 0.92,
      haloColor: 'rgba(255, 30, 168, 0.24)',
      pulseColor: '#FF1EA8',
      pulseDuration: 2400,
      restingGlowOpacity: 0.72,
      scalePeak: 1.035,
      trail: true,
    };
  }

  return {
    glowColor: 'rgba(108, 116, 140, 0.16)',
    glowPeakColor: 'rgba(90, 28, 255, 0.18)',
    glowPeakOpacity: 0.44,
    haloColor: 'rgba(108, 116, 140, 0.14)',
    pulseColor: brandColors.graySoft,
    pulseDuration: 5600,
    restingGlowOpacity: 0.34,
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
  const largeArcFlag = endAngle - startAngle <= 180 ? '0' : '1';

  return `M ${start.x} ${start.y} A ${radius} ${radius} 0 ${largeArcFlag} 1 ${end.x} ${end.y}`;
}

function getLargeArcFlag(startAngle: number, endAngle: number) {
  return Math.abs(endAngle - startAngle) <= 180 ? '0' : '1';
}

function getAnnularSegmentPath({
  center,
  endAngle,
  innerRadius,
  outerRadius,
  startAngle,
}: {
  center: number;
  endAngle: number;
  innerRadius: number;
  outerRadius: number;
  startAngle: number;
}) {
  const outerStart = getPointOnCircle({
    angle: startAngle,
    center,
    radius: outerRadius,
  });
  const outerEnd = getPointOnCircle({
    angle: endAngle,
    center,
    radius: outerRadius,
  });
  const innerEnd = getPointOnCircle({
    angle: endAngle,
    center,
    radius: innerRadius,
  });
  const innerStart = getPointOnCircle({
    angle: startAngle,
    center,
    radius: innerRadius,
  });

  return [
    `M ${outerStart.x} ${outerStart.y}`,
    `A ${outerRadius} ${outerRadius} 0 ${getLargeArcFlag(
      startAngle,
      endAngle,
    )} 1 ${outerEnd.x} ${outerEnd.y}`,
    `L ${innerEnd.x} ${innerEnd.y}`,
    `A ${innerRadius} ${innerRadius} 0 ${getLargeArcFlag(
      startAngle,
      endAngle,
    )} 0 ${innerStart.x} ${innerStart.y}`,
    'Z',
  ].join(' ');
}

function getApertureBladePath({
  center,
  innerEndAngle,
  innerRadius,
  innerStartAngle,
  outerEndAngle,
  outerRadius,
  outerStartAngle,
  thickness,
}: {
  center: number;
  innerEndAngle: number;
  innerRadius: number;
  innerStartAngle: number;
  outerEndAngle: number;
  outerRadius: number;
  outerStartAngle: number;
  thickness: number;
}) {
  const bladeTipRadius = Math.max(1, innerRadius - thickness * 0.9);
  const shoulderRadius = innerRadius + thickness * 0.86;
  const outerControlRadius = outerRadius - thickness * 0.04;
  const outerStart = getPointOnCircle({
    angle: outerStartAngle,
    center,
    radius: outerRadius,
  });
  const outerEnd = getPointOnCircle({
    angle: outerEndAngle,
    center,
    radius: outerRadius,
  });
  const innerEnd = getPointOnCircle({
    angle: innerEndAngle,
    center,
    radius: bladeTipRadius,
  });
  const innerStart = getPointOnCircle({
    angle: innerStartAngle,
    center,
    radius: bladeTipRadius,
  });
  const endControlA = getPointOnCircle({
    angle: outerEndAngle + 18,
    center,
    radius: outerControlRadius,
  });
  const endControlB = getPointOnCircle({
    angle: innerEndAngle - 44,
    center,
    radius: shoulderRadius,
  });
  const innerControlA = getPointOnCircle({
    angle: innerEndAngle + 32,
    center,
    radius: bladeTipRadius,
  });
  const innerControlB = getPointOnCircle({
    angle: innerStartAngle - 32,
    center,
    radius: bladeTipRadius,
  });
  const startControlA = getPointOnCircle({
    angle: innerStartAngle + 44,
    center,
    radius: shoulderRadius,
  });
  const startControlB = getPointOnCircle({
    angle: outerStartAngle + 18,
    center,
    radius: outerControlRadius,
  });

  return [
    `M ${outerStart.x} ${outerStart.y}`,
    `A ${outerRadius} ${outerRadius} 0 ${getLargeArcFlag(
      outerStartAngle,
      outerEndAngle,
    )} 1 ${outerEnd.x} ${outerEnd.y}`,
    `C ${endControlA.x} ${endControlA.y} ${endControlB.x} ${endControlB.y} ${innerEnd.x} ${innerEnd.y}`,
    `C ${innerControlA.x} ${innerControlA.y} ${innerControlB.x} ${innerControlB.y} ${innerStart.x} ${innerStart.y}`,
    `C ${startControlA.x} ${startControlA.y} ${startControlB.x} ${startControlB.y} ${outerStart.x} ${outerStart.y}`,
    'Z',
  ].join(' ');
}

export function PulseRing({
  animated = true,
  isPressed = false,
  size = 72,
  state = 'idle',
  strokeWidth,
  style,
  testID,
}: PulseRingProps): React.JSX.Element {
  const theme = useHoystTheme();
  const rawId = React.useId();
  const id = sanitizeId(rawId);
  const config = getStateConfig(state);
  const [reduceMotion, setReduceMotion] = useState(isTestEnvironment);
  const breathProgress = useRef(new Animated.Value(0)).current;
  const pressProgress = useRef(new Animated.Value(0)).current;
  const effectiveStrokeWidth = Math.max(
    3,
    Math.min(10, strokeWidth ?? size * 0.12),
  );
  const canvasSize = size + Math.max(18, size * 0.28);
  const center = canvasSize / 2;
  const radius = size / 2 - effectiveStrokeWidth / 2;
  const ribbonOuterRadius = radius + effectiveStrokeWidth * 0.68;
  const ribbonInnerRadius = Math.max(1, radius - effectiveStrokeWidth * 0.72);
  const ribbonThickness = ribbonOuterRadius - ribbonInnerRadius;
  const rippleRadius = size / 2 + Math.max(3, size * 0.07);
  const trailGradientId = `pulseTrailGradient${id}`;
  const glassGradientId = `pulseGlassGradient${id}`;
  const innerGlowGradientId = `pulseInnerGlowGradient${id}`;
  const ribbonClipId = `pulseRingRibbonClip${id}`;
  const centerFillRadius =
    ribbonInnerRadius + Math.max(0.4, effectiveStrokeWidth * 0.08);
  const pulseScale = breathProgress.interpolate({
    inputRange: [0, 1],
    outputRange: [1, config.scalePeak],
  });
  const glowOpacity = breathProgress.interpolate({
    inputRange: [0, 1],
    outputRange: [config.restingGlowOpacity, config.glowPeakOpacity],
  });
  const rippleScale = pressProgress.interpolate({
    inputRange: [0, 1],
    outputRange: [0.84, 1.48],
  });
  const rippleOpacity = pressProgress.interpolate({
    inputRange: [0, 0.35, 1],
    outputRange: [0, state === 'idle' ? 0.2 : 0.42, 0],
  });
  const pressedGlowOpacity = pressProgress.interpolate({
    inputRange: [0, 0.45, 1],
    outputRange: [0, 0.9, 0],
  });
  const trailPath = getArcPath({
    center,
    endAngle: 118,
    radius: radius + effectiveStrokeWidth * 1.6,
    startAngle: 26,
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
          easing: Easing.inOut(Easing.sin),
          toValue: 1,
          useNativeDriver: true,
        }),
        Animated.timing(breathProgress, {
          duration: config.pulseDuration / 2,
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
  }, [animated, breathProgress, config.pulseDuration, reduceMotion, state]);

  useEffect(() => {
    pressProgress.stopAnimation();

    if (!isPressed || reduceMotion) {
      pressProgress.setValue(0);
      return;
    }

    pressProgress.setValue(0);
    Animated.timing(pressProgress, {
      duration: 350,
      easing: Easing.out(Easing.cubic),
      toValue: 1,
      useNativeDriver: true,
    }).start();
  }, [isPressed, pressProgress, reduceMotion]);

  return (
    <View
      testID={testID}
      style={[styles.wrap, {height: canvasSize, width: canvasSize}, style]}>
      <Animated.View
        pointerEvents="none"
        style={[
          styles.glow,
          {
            backgroundColor: config.glowColor,
            borderRadius: canvasSize / 2,
            height: size + Math.max(16, size * 0.22),
            opacity: glowOpacity,
            width: size + Math.max(16, size * 0.22),
          },
        ]}
      />
      <Animated.View
        pointerEvents="none"
        style={[
          styles.glow,
          {
            backgroundColor: config.glowPeakColor,
            borderRadius: canvasSize / 2,
            height: size + Math.max(22, size * 0.34),
            opacity: pressedGlowOpacity,
            transform: [{scale: rippleScale}],
            width: size + Math.max(22, size * 0.34),
          },
        ]}
      />
      <Animated.View
        pointerEvents="none"
        style={[
          styles.ripple,
          {
            borderColor: config.pulseColor,
            borderRadius: rippleRadius,
            height: rippleRadius * 2,
            opacity: rippleOpacity,
            transform: [{scale: rippleScale}],
            width: rippleRadius * 2,
          },
        ]}
      />
      <Animated.View style={{transform: [{scale: pulseScale}]}}>
        <Svg height={canvasSize} width={canvasSize}>
          <Defs>
            <SvgLinearGradient
              id={trailGradientId}
              x1={center - radius}
              x2={center + radius}
              y1={center}
              y2={center}
              gradientUnits="userSpaceOnUse">
              <Stop offset="0" stopColor="rgba(255, 30, 168, 0)" />
              <Stop offset="0.48" stopColor="#FF1EA8" />
              <Stop offset="1" stopColor={brandColors.orangeStrong} />
            </SvgLinearGradient>
            <ClipPath id={ribbonClipId}>
              <Circle cx={center} cy={center} r={ribbonOuterRadius} />
            </ClipPath>
            <SvgLinearGradient
              id={glassGradientId}
              x1="0"
              x2="0"
              y1="0"
              y2={canvasSize}
              gradientUnits="userSpaceOnUse">
              <Stop
                offset="0"
                stopColor={
                  theme.isDark
                    ? 'rgba(255, 255, 255, 0.38)'
                    : 'rgba(255, 255, 255, 0.96)'
                }
              />
              <Stop offset="0.48" stopColor="rgba(255, 255, 255, 0.1)" />
              <Stop
                offset="1"
                stopColor={
                  theme.isDark
                    ? 'rgba(255, 255, 255, 0.08)'
                    : 'rgba(16, 24, 40, 0.08)'
                }
              />
            </SvgLinearGradient>
            <SvgLinearGradient
              id={innerGlowGradientId}
              x1={center - ribbonOuterRadius}
              x2={center + ribbonOuterRadius}
              y1={center + ribbonOuterRadius}
              y2={center - ribbonOuterRadius}
              gradientUnits="userSpaceOnUse">
              <Stop offset="0" stopColor={brandColors.blue} />
              <Stop offset="0.22" stopColor={brandColors.purple} />
              <Stop offset="0.42" stopColor="#FF1EA8" />
              <Stop offset="0.58" stopColor={brandColors.orangeStrong} />
              <Stop offset="0.76" stopColor={brandColors.spectrumYellow} />
              <Stop offset="1" stopColor={brandColors.spectrumGreen} />
            </SvgLinearGradient>
            {RING_RIBBONS.map(ribbon => {
              const endAngle = ribbon.startAngle + RIBBON_BASE_SWEEP_DEGREES;
              const gradientStart = getPointOnCircle({
                angle: ribbon.startAngle,
                center,
                radius: ribbonInnerRadius,
              });
              const gradientEnd = getPointOnCircle({
                angle: endAngle,
                center,
                radius: ribbonOuterRadius,
              });

              return (
                <SvgLinearGradient
                  gradientUnits="userSpaceOnUse"
                  id={`pulseRingRibbon${ribbon.name}${id}`}
                  key={ribbon.name}
                  x1={gradientStart.x}
                  x2={gradientEnd.x}
                  y1={gradientStart.y}
                  y2={gradientEnd.y}>
                  <Stop offset="0" stopColor={ribbon.shadeColor} />
                  <Stop offset="0.48" stopColor={ribbon.color} />
                  <Stop offset="1" stopColor={ribbon.highlightColor} />
                </SvgLinearGradient>
              );
            })}
          </Defs>
          <Circle
            cx={center}
            cy={center}
            fill="none"
            opacity={state === 'idle' ? 0.34 : 0.48}
            r={radius + effectiveStrokeWidth * 0.7}
            stroke={config.haloColor}
            strokeWidth={Math.max(1, effectiveStrokeWidth * 0.55)}
          />
          <Circle
            cx={center}
            cy={center}
            fill="none"
            opacity={theme.isDark ? 0.26 : 0.18}
            r={radius}
            stroke={theme.ring}
            strokeWidth={effectiveStrokeWidth}
          />
          {RING_RIBBONS.map(ribbon => {
            const underlayStartAngle =
              ribbon.startAngle - RIBBON_UNDERLAY_OVERLAP_DEGREES / 2;
            const underlayEndAngle =
              ribbon.startAngle +
              RIBBON_BASE_SWEEP_DEGREES +
              RIBBON_UNDERLAY_OVERLAP_DEGREES / 2;

            return (
              <Path
                d={getAnnularSegmentPath({
                  center,
                  endAngle: underlayEndAngle,
                  innerRadius: ribbonInnerRadius,
                  outerRadius: ribbonOuterRadius,
                  startAngle: underlayStartAngle,
                })}
                fill={`url(#pulseRingRibbon${ribbon.name}${id})`}
                key={`underlay-${ribbon.name}`}
                testID={`pulse-ring-underlay-${ribbon.name}`}
              />
            );
          })}
          <G clipPath={`url(#${ribbonClipId})`}>
            {RING_RIBBONS.map(ribbon => {
              const outerStartAngle =
                ribbon.startAngle - RIBBON_BLADE_OVERLAP_DEGREES;
              const outerEndAngle =
                ribbon.startAngle +
                RIBBON_BASE_SWEEP_DEGREES +
                RIBBON_BLADE_OVERLAP_DEGREES;
              const innerStartAngle =
                ribbon.startAngle + RIBBON_INNER_SKEW_DEGREES;
              const innerEndAngle = innerStartAngle + RIBBON_BASE_SWEEP_DEGREES;

              return (
                <Path
                  d={getApertureBladePath({
                    center,
                    innerEndAngle,
                    innerRadius: ribbonInnerRadius,
                    innerStartAngle,
                    outerEndAngle,
                    outerRadius: ribbonOuterRadius,
                    outerStartAngle,
                    thickness: ribbonThickness,
                  })}
                  fill={`url(#pulseRingRibbon${ribbon.name}${id})`}
                  key={ribbon.name}
                  testID={`pulse-ring-ribbon-${ribbon.name}`}
                />
              );
            })}
            {RING_RIBBONS.map(ribbon => {
              const outerStartAngle =
                ribbon.startAngle - RIBBON_BLADE_OVERLAP_DEGREES;
              const outerEndAngle =
                ribbon.startAngle + RIBBON_CAP_SWEEP_DEGREES;
              const innerStartAngle =
                ribbon.startAngle + RIBBON_INNER_SKEW_DEGREES;
              const innerEndAngle = innerStartAngle + RIBBON_CAP_SWEEP_DEGREES;

              return (
                <Path
                  d={getApertureBladePath({
                    center,
                    innerEndAngle,
                    innerRadius: ribbonInnerRadius,
                    innerStartAngle,
                    outerEndAngle,
                    outerRadius: ribbonOuterRadius,
                    outerStartAngle,
                    thickness: ribbonThickness,
                  })}
                  fill={`url(#pulseRingRibbon${ribbon.name}${id})`}
                  key={`cap-${ribbon.name}`}
                  opacity={0.96}
                  testID={`pulse-ring-cap-${ribbon.name}`}
                />
              );
            })}
          </G>
          <Circle
            cx={center}
            cy={center}
            fill={brandColors.charcoal}
            r={centerFillRadius}
            testID="pulse-ring-center-fill"
          />
          <Circle
            cx={center}
            cy={center}
            fill="none"
            opacity={0.78}
            r={centerFillRadius}
            stroke={`url(#${innerGlowGradientId})`}
            strokeWidth={Math.max(1.4, effectiveStrokeWidth * 0.36)}
            testID="pulse-ring-inner-glow"
          />
          <Circle
            cx={center}
            cy={center}
            fill="none"
            opacity={0.5}
            r={radius + effectiveStrokeWidth * 0.34}
            stroke={`url(#${glassGradientId})`}
            strokeWidth={Math.max(1, effectiveStrokeWidth * 0.32)}
          />
          {config.trail ? (
            <G>
              <Path
                d={trailPath}
                fill="none"
                opacity={0.58}
                stroke={`url(#${trailGradientId})`}
                strokeLinecap="round"
                strokeWidth={Math.max(2, effectiveStrokeWidth * 0.74)}
              />
              {[35, 58, 82, 108].map((angle, index) => {
                const point = getPointOnCircle({
                  angle,
                  center,
                  radius: radius + effectiveStrokeWidth * (1.9 + index * 0.16),
                });

                return (
                  <Circle
                    cx={point.x}
                    cy={point.y}
                    fill={
                      index % 2 === 0
                        ? brandColors.orangeStrong
                        : brandColors.purpleBright
                    }
                    key={angle}
                    opacity={0.76 - index * 0.12}
                    r={Math.max(
                      1.4,
                      effectiveStrokeWidth * (0.26 - index * 0.02),
                    )}
                  />
                );
              })}
            </G>
          ) : null}
        </Svg>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  glow: {
    position: 'absolute',
  },
  ripple: {
    borderWidth: 1.2,
    position: 'absolute',
  },
  wrap: {
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'visible',
  },
});
