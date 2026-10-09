import React from 'react';
import {Text, View, type StyleProp, type ViewStyle} from 'react-native';

/** Fixed UI meanings, independent of owner-customizable Commitment appearance. */
export const circularEmoji = {
  streak: '🔥',
  momentum: '📈',
  tapIns: '📅',
  milestone: '🏆',
  gettingStarted: '✨',
  building: '🧱',
  strong: '⚡',
  peak: '🏆',
  skip: '⏭️',
  restore: '🔄',
  build: '🧱',
  limit: '🎚️',
  avoid: '🚫',
  nudge: '🫵',
  notification: '🔔',
  reminder: '⏰',
  members: '👥',
  personal: '👤',
  archive: '📦',
  discovery: '🧭',
} as const;
export type CircularEmojiKind = keyof typeof circularEmoji;

export function CircularEmoji({
  kind,
  size = 36,
  emojiSize = size * 0.61,
  backgroundColor,
  style,
  testID,
  accessibilityLabel,
}: {
  kind: CircularEmojiKind;
  size?: number;
  emojiSize?: number;
  backgroundColor?: string;
  style?: StyleProp<ViewStyle>;
  testID?: string;
  accessibilityLabel?: string;
}) {
  return (
    <View
      accessible={!!accessibilityLabel}
      accessibilityRole={accessibilityLabel ? 'image' : undefined}
      accessibilityLabel={accessibilityLabel}
      style={[
        {
          width: size,
          height: size,
          borderRadius: size / 2,
          alignItems: 'center',
          justifyContent: 'center',
          flexShrink: 0,
          backgroundColor,
        },
        style,
      ]}
      testID={testID}>
      <Text
        accessible={false}
        accessibilityElementsHidden
        importantForAccessibility="no-hide-descendants"
        allowFontScaling={false}
        style={{
          fontSize: emojiSize,
          lineHeight: size,
          textAlign: 'center',
          includeFontPadding: false,
        }}>
        {circularEmoji[kind]}
      </Text>
    </View>
  );
}
