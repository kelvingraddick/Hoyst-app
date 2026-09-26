import React, {useEffect, useId, useRef, useState} from 'react';
import {
  AccessibilityInfo,
  Animated,
  Easing,
  StyleSheet,
  View,
} from 'react-native';
import Svg, {Defs, Ellipse, RadialGradient, Stop} from 'react-native-svg';

export function ExploreSearchingHoy({
  searching,
  dark = false,
}: {
  searching: boolean;
  dark?: boolean;
}) {
  // Stay still until the native accessibility preference has resolved.
  const [reduceMotion, setReduceMotion] = useState(true);
  const angle = useRef(new Animated.Value(0)).current;
  const shadowId = `explore-hoy-shadow-${useId().replace(/:/g, '')}`;

  useEffect(() => {
    let mounted = true;
    let preferenceChanged = false;
    const subscription = AccessibilityInfo.addEventListener(
      'reduceMotionChanged',
      enabled => {
        preferenceChanged = true;
        setReduceMotion(enabled);
      },
    );
    AccessibilityInfo.isReduceMotionEnabled()
      .then(enabled => {
        if (mounted && !preferenceChanged) {
          setReduceMotion(enabled);
        }
      })
      .catch(() => undefined);
    return () => {
      mounted = false;
      subscription.remove();
    };
  }, []);

  useEffect(() => {
    angle.stopAnimation();
    angle.setValue(0);
    if (!searching || reduceMotion) {
      return;
    }
    const timing = (toValue: number, duration: number) =>
      Animated.timing(angle, {
        toValue,
        duration,
        easing: Easing.inOut(Easing.sin),
        useNativeDriver: true,
      });
    const motion = Animated.loop(
      Animated.sequence([timing(3, 300), timing(-3, 600), timing(0, 300)]),
    );
    motion.start();
    return () => {
      motion.stop();
      angle.stopAnimation();
      angle.setValue(0);
    };
  }, [angle, searching, reduceMotion]);

  return (
    <View
      style={styles.frame}
      pointerEvents="none"
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants">
      <Svg width={52} height={10.4} style={styles.shadow}>
        <Defs>
          <RadialGradient id={shadowId} cx="50%" cy="50%" rx="50%" ry="50%">
            <Stop
              offset="0"
              stopColor={dark ? '#000000' : '#6B5128'}
              stopOpacity={dark ? 0.5 : 0.34}
            />
            <Stop
              offset="0.45"
              stopColor={dark ? '#000000' : '#6B5128'}
              stopOpacity={dark ? 0.25 : 0.16}
            />
            <Stop
              offset="1"
              stopColor={dark ? '#000000' : '#6B5128'}
              stopOpacity={0}
            />
          </RadialGradient>
        </Defs>
        <Ellipse
          cx={26}
          cy={5.2}
          rx={19.76}
          ry={3.64}
          fill={`url(#${shadowId})`}
        />
      </Svg>
      <Animated.Image
        testID="explore-searching-hoy"
        accessible={false}
        accessibilityElementsHidden
        importantForAccessibility="no-hide-descendants"
        source={require('../../../assets/hoy/explore-searching.png')}
        resizeMode="contain"
        style={[
          styles.hoy,
          {
            transform: [
              {
                rotate: angle.interpolate({
                  inputRange: [-3, 3],
                  outputRange: ['-3deg', '3deg'],
                }),
              },
            ],
          },
        ]}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  frame: {width: 52, height: 60},
  shadow: {position: 'absolute', bottom: 0, left: 0},
  hoy: {width: 52, height: 52, position: 'absolute', top: 0, left: 0},
});
