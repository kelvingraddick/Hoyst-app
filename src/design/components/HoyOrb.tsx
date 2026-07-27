import React, {useEffect, useMemo, useRef, useState} from 'react';
import {
  AccessibilityInfo,
  Animated,
  Easing,
  StyleSheet,
  View,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import {
  Check,
  CircleAlert,
  LockKeyhole,
  TriangleAlert,
} from 'lucide-react-native';

import type {HoyState} from '../../features/home/services/hoy-state';
import {brandColors} from '../tokens/colors';

const DEFAULT_SIZE = 52;
const STATE_TRANSITION_DURATION = 210;
const CELEBRATION_DURATION = 2200;
const IS_TEST_ENVIRONMENT = process.env.NODE_ENV === 'test';

const hoyAssetSources: Record<HoyState, number> = {
  default: require('../../assets/hoy/default.png'),
  tap_in_needed: require('../../assets/hoy/tap-in-needed.png'),
  streak_active: require('../../assets/hoy/streak-active.png'),
  goal_completed: require('../../assets/hoy/goal-completed.png'),
  thinking: require('../../assets/hoy/thinking.png'),
  celebrating: require('../../assets/hoy/celebrating.png'),
  locked: require('../../assets/hoy/locked.png'),
  risk_attention: require('../../assets/hoy/risk-attention.png'),
};

const confettiSource = require('../../assets/hoy/confetti.png');

export type HoyOrbProps = {
  animated?: boolean;
  celebrationKey?: number;
  size?: number;
  state: HoyState;
  style?: StyleProp<ViewStyle>;
  testID?: string;
};

export function getHoyAssetSource(state: HoyState) {
  return hoyAssetSources[state];
}

function getLoopDuration(state: HoyState) {
  switch (state) {
    case 'thinking':
      return 2600;
    case 'risk_attention':
      return 2800;
    case 'tap_in_needed':
      return 4200;
    case 'goal_completed':
      return 3200;
    case 'streak_active':
      return 2800;
    case 'default':
      return 3400;
    default:
      return 0;
  }
}

function getGlyph(state: HoyState, size: number) {
  const iconSize = Math.max(10, Math.round(size * 0.22));

  switch (state) {
    case 'tap_in_needed':
      return (
        <CircleAlert
          color={brandColors.orangeStrong}
          size={iconSize}
          strokeWidth={3}
        />
      );
    case 'goal_completed':
      return (
        <Check color={brandColors.green} size={iconSize} strokeWidth={3.2} />
      );
    case 'locked':
      return (
        <LockKeyhole
          color={brandColors.blueVivid}
          size={iconSize}
          strokeWidth={3}
        />
      );
    case 'risk_attention':
      return (
        <TriangleAlert
          color={brandColors.orangeStrong}
          size={iconSize}
          strokeWidth={3}
        />
      );
    default:
      return null;
  }
}

export function HoyOrb({
  animated = true,
  celebrationKey = 0,
  size = DEFAULT_SIZE,
  state,
  style,
  testID = 'hoy-orb',
}: HoyOrbProps): React.JSX.Element {
  const [reduceMotion, setReduceMotion] = useState(IS_TEST_ENVIRONMENT);
  const [displayedState, setDisplayedState] = useState(state);
  const [previousState, setPreviousState] = useState<HoyState>();
  const displayedStateRef = useRef(state);
  const loopProgress = useRef(new Animated.Value(0)).current;
  const transitionProgress = useRef(new Animated.Value(1)).current;
  const celebrationProgress = useRef(new Animated.Value(0)).current;
  const glyph = getGlyph(displayedState, size);
  const motionEnabled = animated && !reduceMotion;

  useEffect(() => {
    if (IS_TEST_ENVIRONMENT) {
      return undefined;
    }

    let isActive = true;

    AccessibilityInfo.isReduceMotionEnabled()
      .then(enabled => {
        if (isActive) {
          setReduceMotion(enabled);
        }
      })
      .catch(() => undefined);
    const subscription = AccessibilityInfo.addEventListener(
      'reduceMotionChanged',
      setReduceMotion,
    );

    return () => {
      isActive = false;
      subscription.remove();
    };
  }, []);

  useEffect(() => {
    if (state === displayedStateRef.current) {
      if (!animated || reduceMotion) {
        transitionProgress.stopAnimation();
        transitionProgress.setValue(1);
        setPreviousState(undefined);
      }
      return undefined;
    }

    if (!animated || reduceMotion) {
      transitionProgress.setValue(1);
      setPreviousState(undefined);
      displayedStateRef.current = state;
      setDisplayedState(state);
      return undefined;
    }

    setPreviousState(displayedStateRef.current);
    displayedStateRef.current = state;
    setDisplayedState(state);
    transitionProgress.setValue(0);

    const transition = Animated.timing(transitionProgress, {
      duration: STATE_TRANSITION_DURATION,
      easing: Easing.out(Easing.cubic),
      toValue: 1,
      useNativeDriver: true,
    });

    transition.start(({finished}) => {
      if (finished) {
        setPreviousState(undefined);
      }
    });

    return () => transition.stop();
  }, [
    animated,
    reduceMotion,
    state,
    transitionProgress,
  ]);

  useEffect(() => {
    loopProgress.stopAnimation();
    loopProgress.setValue(0);

    const duration = getLoopDuration(displayedState);
    if (!motionEnabled || duration === 0) {
      return undefined;
    }

    const loop = Animated.loop(
      Animated.timing(loopProgress, {
        duration,
        easing: Easing.inOut(Easing.sin),
        toValue: 1,
        useNativeDriver: true,
      }),
    );

    loop.start();

    return () => loop.stop();
  }, [displayedState, loopProgress, motionEnabled]);

  useEffect(() => {
    celebrationProgress.stopAnimation();
    celebrationProgress.setValue(0);

    if (
      displayedState !== 'celebrating' ||
      celebrationKey <= 0 ||
      !motionEnabled
    ) {
      return undefined;
    }

    const celebration = Animated.timing(celebrationProgress, {
      duration: CELEBRATION_DURATION,
      easing: Easing.out(Easing.cubic),
      toValue: 1,
      useNativeDriver: true,
    });

    celebration.start();

    return () => celebration.stop();
  }, [
    celebrationKey,
    celebrationProgress,
    displayedState,
    motionEnabled,
  ]);

  const loopStyle = useMemo(() => {
    if (!motionEnabled) {
      return undefined;
    }

    switch (displayedState) {
      case 'thinking':
        return {
          transform: [
            {
              rotate: loopProgress.interpolate({
                inputRange: [0, 0.5, 1],
                outputRange: ['-2deg', '2deg', '-2deg'],
              }),
            },
            {
              scale: loopProgress.interpolate({
                inputRange: [0, 0.5, 1],
                outputRange: [1, 1.018, 1],
              }),
            },
          ],
        };
      case 'tap_in_needed':
        return {
          transform: [
            {
              translateX: loopProgress.interpolate({
                inputRange: [0, 0.06, 0.12, 0.18, 0.26, 1],
                outputRange: [0, -1.6, 1.6, -1.1, 0, 0],
              }),
            },
          ],
        };
      case 'risk_attention':
        return {
          transform: [
            {
              scale: loopProgress.interpolate({
                inputRange: [0, 0.5, 1],
                outputRange: [1, 1.032, 1],
              }),
            },
          ],
        };
      case 'goal_completed':
        return {
          transform: [
            {
              scale: loopProgress.interpolate({
                inputRange: [0, 0.5, 1],
                outputRange: [1, 1.014, 1],
              }),
            },
          ],
        };
      case 'streak_active':
        return {
          transform: [
            {
              translateY: loopProgress.interpolate({
                inputRange: [0, 0.5, 1],
                outputRange: [0, -2.2, 0],
              }),
            },
            {
              scale: loopProgress.interpolate({
                inputRange: [0, 0.5, 1],
                outputRange: [1, 1.018, 1],
              }),
            },
          ],
        };
      case 'default':
        return {
          transform: [
            {
              translateY: loopProgress.interpolate({
                inputRange: [0, 0.5, 1],
                outputRange: [0, -1.6, 0],
              }),
            },
            {
              scale: loopProgress.interpolate({
                inputRange: [0, 0.5, 1],
                outputRange: [1, 1.012, 1],
              }),
            },
          ],
        };
      default:
        return undefined;
    }
  }, [displayedState, loopProgress, motionEnabled]);

  const celebrationStyle =
    displayedState === 'celebrating' && motionEnabled
      ? {
          transform: [
            {
              translateY: celebrationProgress.interpolate({
                inputRange: [0, 0.12, 0.34, 1],
                outputRange: [0, -4, 1, 0],
              }),
            },
            {
              scale: celebrationProgress.interpolate({
                inputRange: [0, 0.12, 0.34, 1],
                outputRange: [1, 1.12, 0.98, 1],
              }),
            },
          ],
        }
      : undefined;
  const glyphSize = Math.max(17, Math.round(size * 0.34));
  const imageSize = size * 1.16;
  const imageOffset = (size - imageSize) / 2;
  const currentImageTransitionStyle = previousState
    ? {
        opacity: transitionProgress,
        transform: [
          {
            scale: transitionProgress.interpolate({
              inputRange: [0, 1],
              outputRange: [0.94, 1],
            }),
          },
        ],
      }
    : styles.visibleImage;
  const confettiAnimationStyle = motionEnabled
    ? {
        opacity: celebrationProgress.interpolate({
          inputRange: [0, 0.08, 0.72, 1],
          outputRange: [0, 1, 0.8, 0],
        }),
        transform: [
          {
            scale: celebrationProgress.interpolate({
              inputRange: [0, 0.18, 1],
              outputRange: [0.55, 1.04, 1.18],
            }),
          },
        ],
      }
    : styles.staticConfetti;

  return (
    <View
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      pointerEvents="none"
      style={[styles.root, {height: size, width: size}, style]}
      testID={testID}>
      <Animated.View
        testID={`${testID}-animated-surface`}
        style={[styles.orbSurface, loopStyle, celebrationStyle]}>
        <View
          style={[
            styles.hoverShadow,
            {
              borderRadius: size * 0.28,
              bottom: size * 0.025,
              height: size * 0.1,
              left: size * 0.22,
              width: size * 0.56,
            },
          ]}
        />
        {previousState ? (
          <Animated.Image
            accessibilityIgnoresInvertColors
            resizeMode="contain"
            source={getHoyAssetSource(previousState)}
            style={[
              styles.orbImage,
              {
                height: imageSize,
                left: imageOffset,
                opacity: transitionProgress.interpolate({
                  inputRange: [0, 1],
                  outputRange: [1, 0],
                }),
                transform: [
                  {
                    scale: transitionProgress.interpolate({
                      inputRange: [0, 1],
                      outputRange: [1, 0.94],
                    }),
                  },
                ],
                top: imageOffset,
                width: imageSize,
              },
            ]}
            testID={`${testID}-previous-image`}
          />
        ) : null}
        <Animated.Image
          accessibilityIgnoresInvertColors
          resizeMode="contain"
          source={getHoyAssetSource(displayedState)}
          style={[
            styles.orbImage,
            {
              height: imageSize,
              left: imageOffset,
              top: imageOffset,
              width: imageSize,
            },
            currentImageTransitionStyle,
          ]}
          testID={`${testID}-${displayedState}-image`}
        />
      </Animated.View>

      {displayedState === 'celebrating' ? (
        <Animated.Image
          accessibilityIgnoresInvertColors
          resizeMode="contain"
          source={confettiSource}
          style={[
            styles.confetti,
            {
              height: size * 1.62,
              left: -size * 0.31,
              top: -size * 0.31,
              width: size * 1.62,
            },
            confettiAnimationStyle,
          ]}
          testID={`${testID}-confetti`}
        />
      ) : null}

      {glyph ? (
        <View
          style={[
            styles.glyph,
            {
              borderRadius: glyphSize / 2,
              height: glyphSize,
              right: -size * 0.045,
              top: -size * 0.045,
              width: glyphSize,
            },
          ]}
          testID={`${testID}-glyph`}>
          {glyph}
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    overflow: 'visible',
  },
  orbSurface: {
    ...StyleSheet.absoluteFillObject,
  },
  hoverShadow: {
    backgroundColor: 'rgba(10,14,28,0.13)',
    position: 'absolute',
    shadowColor: '#0A0E1C',
    shadowOffset: {height: 2, width: 0},
    shadowOpacity: 0.28,
    shadowRadius: 5,
    transform: [{scaleX: 1.25}],
  },
  orbImage: {
    position: 'absolute',
  },
  visibleImage: {
    opacity: 1,
  },
  confetti: {
    position: 'absolute',
  },
  staticConfetti: {
    opacity: 1,
  },
  glyph: {
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.94)',
    borderColor: 'rgba(255,255,255,0.96)',
    borderWidth: 1.5,
    elevation: 3,
    justifyContent: 'center',
    position: 'absolute',
    shadowColor: '#101426',
    shadowOffset: {height: 2, width: 0},
    shadowOpacity: 0.2,
    shadowRadius: 4,
  },
});
