import React from 'react';
import {
  Image,
  StyleSheet,
  View,
  type ImageSourcePropType,
} from 'react-native';

import type {CircleMemberState} from '../../types/models';
import {getBrandRing} from '../brand/usage';
import {useHoystTheme} from '../theme/useHoystTheme';
import {getBrandAvatarRingSize} from './avatarRingSizing';
import {HoystText} from './HoystText';

type LayeredAvatarProps = {
  imageSource?: ImageSourcePropType;
  imageUrl?: string;
  initials: string;
  size?: number;
  state?: CircleMemberState;
};

function getLayeredAvatarPalette(
  theme: ReturnType<typeof useHoystTheme>,
  state: CircleMemberState,
) {
  if (state === 'done') {
    return {
      glow: 'transparent',
      outerRing: 'rgba(34,115,48,0.96)',
      innerRing: theme.success,
      separator: 'rgba(10,10,10,0.96)',
      background: '#101010',
      text: '#dff7e5',
    };
  }

  if (state === 'pending') {
    return {
      glow: 'rgba(255,255,255,0.04)',
      outerRing: 'rgba(255,255,255,0.14)',
      innerRing: 'rgba(255,255,255,0.22)',
      separator: 'rgba(15,15,15,0.96)',
      background: '#202020',
      text: theme.textMuted,
    };
  }

  if (state === 'skipped') {
    return {
      glow: 'rgba(255,138,61,0.08)',
      outerRing: 'rgba(255,138,61,0.42)',
      innerRing: theme.warning,
      separator: 'rgba(15,15,15,0.96)',
      background: '#21160f',
      text: '#ffd8bd',
    };
  }

  return {
    glow: 'rgba(255,255,255,0.03)',
    outerRing: 'rgba(255,255,255,0.1)',
    innerRing: 'rgba(255,255,255,0.16)',
    separator: 'rgba(15,15,15,0.96)',
    background: '#181818',
    text: theme.textSubtle,
  };
}

export function LayeredAvatar({
  imageSource,
  imageUrl,
  initials,
  size = 42,
  state = 'done',
}: LayeredAvatarProps): React.JSX.Element {
  const theme = useHoystTheme();
  const resolvedImageSource =
    imageSource ?? (imageUrl ? {uri: imageUrl} : undefined);
  const palette = getLayeredAvatarPalette(theme, state);
  const isDone = state === 'done';
  const glowSize = size + 6;
  const outerSize = size + 2;
  const innerSize = size - 2;
  const frameSize = size - 8;
  const imageSize = size - 10;
  const doneRingSize = getBrandAvatarRingSize(frameSize);
  const ringWidth = size >= 56 ? 1.5 : 1.2;
  const stateRingWidth = isDone ? 0 : ringWidth;
  const frameWidth = size >= 56 ? 1.4 : 1.2;

  return (
    <View
      style={[
        styles.glow,
        {
          backgroundColor: palette.glow,
          borderRadius: glowSize / 2,
          height: glowSize,
          width: glowSize,
        },
      ]}>
      <View
        style={[
          styles.outerRing,
          isDone ? styles.doneRingWrap : undefined,
          {
            borderColor: palette.outerRing,
            borderRadius: outerSize / 2,
            borderWidth: stateRingWidth,
            height: outerSize,
            width: outerSize,
          },
        ]}>
        {isDone ? (
          <Image
            source={getBrandRing()}
            style={[
              styles.doneRing,
              {
                height: doneRingSize,
                width: doneRingSize,
              },
            ]}
          />
        ) : null}
        <View
          style={[
            styles.innerRing,
            {
              borderColor: palette.innerRing,
              borderRadius: innerSize / 2,
              borderWidth: stateRingWidth,
              height: innerSize,
              width: innerSize,
            },
          ]}>
          <View
            style={[
              styles.frame,
              {
                backgroundColor: palette.background,
                borderColor: palette.separator,
                borderRadius: frameSize / 2,
                borderWidth: frameWidth,
                height: frameSize,
                width: frameSize,
              },
            ]}>
            {resolvedImageSource ? (
              <Image
                source={resolvedImageSource}
                style={[
                  styles.image,
                  {
                    borderRadius: imageSize / 2,
                    height: imageSize,
                    width: imageSize,
                  },
                ]}
              />
            ) : (
              <HoystText style={[styles.initials, {color: palette.text}]}>
                {initials}
              </HoystText>
            )}
          </View>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  glow: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  outerRing: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  doneRing: {
    position: 'absolute',
    resizeMode: 'contain',
  },
  doneRingWrap: {
    overflow: 'visible',
  },
  innerRing: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  frame: {
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  image: {
    resizeMode: 'cover',
  },
  initials: {
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 0.2,
  },
});
