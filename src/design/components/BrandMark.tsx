import React from 'react';
import {
  Image,
  StyleSheet,
  View,
  type ImageStyle,
  type StyleProp,
} from 'react-native';

import {getBrandIcon, getBrandLogo, getBrandRing} from '../brand/usage';

const LOGO_ASPECT_RATIO = 19 / 8;

type BrandMarkProps = {
  kind?: 'icon' | 'logo' | 'ring';
  isDark: boolean;
  style?: StyleProp<ImageStyle>;
  testID?: string;
};

export function BrandMark({
  kind = 'icon',
  isDark,
  style,
  testID,
}: BrandMarkProps): React.JSX.Element {
  if (kind === 'ring') {
    return (
      <Image
        accessibilityIgnoresInvertColors
        resizeMode="contain"
        source={getBrandRing()}
        style={style}
        testID={testID}
      />
    );
  }

  // The icon assets name their disk color. Their H is a transparent cutout,
  // so use the opposite disk and an explicit backing for the letter color.
  const getSource =
    kind === 'logo' ? getBrandLogo : (dark: boolean) => getBrandIcon(!dark);

  return (
    <View
      pointerEvents="none"
      style={[kind === 'logo' ? styles.logo : undefined, style]}
      testID={testID}>
      {kind === 'icon' ? (
        <View
          style={[
            styles.letterBacking,
            isDark ? styles.whiteBacking : styles.blackBacking,
          ]}
          testID={testID ? `${testID}-letter-backing` : undefined}
        />
      ) : null}
      {/* Keep each native image source fixed. Theme changes only affect
          visibility, so an in-flight image load cannot restore the old variant. */}
      <View
        style={[
          StyleSheet.absoluteFill,
          isDark ? styles.hidden : styles.visible,
        ]}>
        <Image
          accessibilityIgnoresInvertColors
          resizeMode="contain"
          source={getSource(false)}
          style={styles.image}
          testID={testID ? `${testID}-light` : undefined}
        />
      </View>
      <View
        style={[
          StyleSheet.absoluteFill,
          isDark ? styles.visible : styles.hidden,
        ]}>
        <Image
          accessibilityIgnoresInvertColors
          resizeMode="contain"
          source={getSource(true)}
          style={styles.image}
          testID={testID ? `${testID}-dark` : undefined}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  image: {width: '100%', height: '100%'},
  letterBacking: {
    position: 'absolute',
    left: '17%',
    top: '17%',
    width: '66%',
    height: '66%',
    borderRadius: 999,
  },
  whiteBacking: {backgroundColor: '#FFFFFF'},
  blackBacking: {backgroundColor: '#0B0B0B'},
  hidden: {opacity: 0},
  visible: {opacity: 1},
  logo: {
    alignSelf: 'flex-start',
    aspectRatio: LOGO_ASPECT_RATIO,
  },
});
