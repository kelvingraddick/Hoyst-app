import React from 'react';
import {
  AccessibilityInfo,
  Animated,
  Easing,
  Pressable,
  StyleSheet,
  View,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import LinearGradient from 'react-native-linear-gradient';

import {actionMotion, actionShadow, touchTarget} from '../tokens/actions';
import {brandColors} from '../tokens/colors';
import {gradients} from '../tokens/gradients';
import {radius} from '../tokens/radius';
import {useHoystTheme} from '../theme/useHoystTheme';
import {HoystText} from './HoystText';

export type TapInActionButtonVariant =
  | 'accentOutline'
  | 'dangerOutline'
  | 'primary'
  | 'surface'
  | 'text'
  | 'warmOutline';

export type TapInActionButtonEmphasis = 'spectrumBreathing';

const isTestEnvironment = process.env.NODE_ENV === 'test';

type TapInActionButtonProps = {
  accessibilityLabel?: string;
  disabled?: boolean;
  emphasis?: TapInActionButtonEmphasis;
  icon?: React.ReactNode;
  label: string;
  onPress?: () => void;
  style?: StyleProp<ViewStyle>;
  testID?: string;
  variant: TapInActionButtonVariant;
};

export function TapInActionButton({
  accessibilityLabel,
  disabled = false,
  emphasis,
  icon,
  label,
  onPress,
  style,
  testID,
  variant,
}: TapInActionButtonProps): React.JSX.Element {
  const theme = useHoystTheme();
  const breathProgress = React.useRef(new Animated.Value(0)).current;
  const [reduceMotion, setReduceMotion] = React.useState(isTestEnvironment);
  const isText = variant === 'text';
  const hasSpectrumEmphasis =
    emphasis === 'spectrumBreathing' && variant === 'primary';
  const palette =
    variant === 'primary'
      ? {
          backgroundColor: '#15171D',
          borderColor: '#15171D',
          color: brandColors.white,
          shadowColor: theme.actionShadowColor,
        }
      : variant === 'dangerOutline'
      ? {
          backgroundColor: `${theme.danger}12`,
          borderColor: `${theme.dangerForeground}66`,
          color: theme.dangerForeground,
          shadowColor: 'transparent',
        }
      : variant === 'accentOutline'
      ? {
          backgroundColor: theme.isDark
            ? 'rgba(122,85,255,0.14)'
            : 'rgba(122,85,255,0.10)',
          borderColor: theme.isDark
            ? 'rgba(122,85,255,0.50)'
            : 'rgba(122,85,255,0.36)',
          color: theme.accentSecondaryForeground,
          shadowColor: 'transparent',
        }
      : variant === 'warmOutline'
      ? {
          backgroundColor: theme.isDark
            ? 'rgba(255,138,61,0.12)'
            : 'rgba(255,138,61,0.08)',
          borderColor: theme.isDark
            ? 'rgba(255,138,61,0.48)'
            : 'rgba(255,138,61,0.42)',
          color: theme.warningForeground,
          shadowColor: 'transparent',
        }
      : variant === 'surface'
      ? {
          backgroundColor: theme.actionSurface,
          borderColor: theme.actionBorder,
          color: theme.actionForeground,
          shadowColor: theme.actionShadowColor,
        }
      : {
          backgroundColor: 'transparent',
          borderColor: 'transparent',
          color: theme.textSubtle,
          shadowColor: 'transparent',
        };

  React.useEffect(() => {
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

  React.useEffect(() => {
    breathProgress.stopAnimation();
    breathProgress.setValue(0);

    if (!hasSpectrumEmphasis || disabled || reduceMotion) {
      return undefined;
    }

    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(breathProgress, {
          duration: 1550,
          easing: Easing.inOut(Easing.sin),
          toValue: 1,
          useNativeDriver: true,
        }),
        Animated.timing(breathProgress, {
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
  }, [breathProgress, disabled, hasSpectrumEmphasis, reduceMotion]);

  const spectrumHaloStyle = {
    opacity: disabled
      ? 0
      : reduceMotion
      ? 0.34
      : breathProgress.interpolate({
          inputRange: [0, 1],
          outputRange: [0.24, 0.58],
        }),
    transform: [
      {
        scale:
          disabled || reduceMotion
            ? 1.012
            : breathProgress.interpolate({
                inputRange: [0, 1],
                outputRange: [1.012, 1.04],
              }),
      },
    ],
  };

  const content = (
    <>
      {icon ? <View style={styles.icon}>{icon}</View> : null}
      <HoystText
        numberOfLines={1}
        style={[
          styles.label,
          variant === 'primary' ? styles.primaryLabel : undefined,
          isText ? styles.textLabel : undefined,
          {color: palette.color},
        ]}
        variant="button">
        {label}
      </HoystText>
    </>
  );

  return (
    <Pressable
      accessibilityLabel={accessibilityLabel ?? label}
      accessibilityRole="button"
      accessibilityState={{disabled}}
      disabled={disabled}
      onPress={disabled ? undefined : onPress}
      style={({pressed}) => [
        styles.pressable,
        isText ? styles.textPressable : styles.filledPressable,
        variant === 'primary' ? styles.primaryShadow : undefined,
        variant === 'surface' ? styles.surfaceShadow : undefined,
        {
          opacity: disabled ? 0.42 : pressed ? actionMotion.pressedOpacity : 1,
          shadowColor: hasSpectrumEmphasis
            ? brandColors.purple
            : palette.shadowColor,
          transform: [
            {scale: pressed && !disabled ? actionMotion.pressedScale : 1},
          ],
        },
        style,
      ]}
      testID={testID}>
      {hasSpectrumEmphasis ? (
        <>
          <Animated.View
            pointerEvents="none"
            style={[styles.spectrumHalo, spectrumHaloStyle]}
            testID={testID ? `${testID}-spectrum-halo` : undefined}>
            <LinearGradient
              colors={[...gradients.spectrumGlow]}
              end={{x: 1, y: 1}}
              start={{x: 0, y: 0}}
              style={styles.spectrumLayer}
              testID={
                testID ? `${testID}-spectrum-halo-gradient` : undefined
              }
            />
          </Animated.View>
          <View
            style={[
              styles.fill,
              styles.filledFill,
              {
                backgroundColor: palette.backgroundColor,
                borderColor: palette.borderColor,
              },
            ]}
            testID={testID ? `${testID}-fill` : undefined}>
            {content}
          </View>
        </>
      ) : (
        <View
          style={[
            styles.fill,
            isText ? styles.textFill : styles.filledFill,
            {
              backgroundColor: palette.backgroundColor,
              borderColor: palette.borderColor,
            },
          ]}
          testID={testID ? `${testID}-fill` : undefined}>
          {content}
        </View>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  fill: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'center',
    width: '100%',
  },
  filledFill: {
    borderRadius: radius.pill,
    borderWidth: 1.4,
    gap: 8,
    minHeight: 56,
    paddingHorizontal: 20,
  },
  filledPressable: {
    borderRadius: radius.pill,
    minHeight: 56,
  },
  icon: {
    alignItems: 'center',
    flexShrink: 0,
    justifyContent: 'center',
  },
  label: {
    flexShrink: 1,
    fontSize: 15,
    fontWeight: '800',
    letterSpacing: 0,
    lineHeight: 19,
    textAlign: 'center',
  },
  primaryLabel: {
    fontSize: 18,
    lineHeight: 23,
  },
  pressable: {
    alignSelf: 'stretch',
    justifyContent: 'center',
    minHeight: touchTarget.minimum,
    overflow: 'visible',
  },
  primaryShadow: {
    elevation: actionShadow.elevation,
    shadowOffset: {height: 12, width: 0},
    shadowOpacity: 0.16,
    shadowRadius: 20,
  },
  spectrumHalo: {
    bottom: -8,
    left: -8,
    position: 'absolute',
    right: -8,
    top: -8,
  },
  spectrumLayer: {
    borderRadius: radius.pill,
    height: '100%',
    width: '100%',
  },
  surfaceShadow: {
    elevation: 6,
    shadowOffset: {height: 7, width: 0},
    shadowOpacity: 0.12,
    shadowRadius: 14,
  },
  textFill: {
    borderRadius: radius.pill,
    borderWidth: 0,
    minHeight: 42,
    paddingHorizontal: 12,
  },
  textLabel: {
    fontSize: 14,
    lineHeight: 18,
  },
  textPressable: {
    borderRadius: radius.pill,
    minHeight: 42,
  },
});
