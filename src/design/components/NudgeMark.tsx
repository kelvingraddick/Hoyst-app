import React from 'react';
import {Text, View} from 'react-native';
import {circularEmoji} from './CircularEmoji';

export function NudgeMark({size = 24}: {size?: number}): React.JSX.Element {
  return (
    <View
      style={{
        width: size,
        height: size,
        alignItems: 'center',
        justifyContent: 'center',
      }}>
      <Text
        accessible={false}
        accessibilityElementsHidden
        importantForAccessibility="no-hide-descendants"
        allowFontScaling={false}
        style={{
          fontSize: size,
          lineHeight: size,
          textAlign: 'center',
          includeFontPadding: false,
        }}>
        {circularEmoji.nudge}
      </Text>
    </View>
  );
}
