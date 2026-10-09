import React from 'react';
import {type StyleProp, type ViewStyle} from 'react-native';
import type {MomentumStatus} from '../../types/models';
import {CircularEmoji, type CircularEmojiKind} from './CircularEmoji';

export function MomentumStageIcon({
  size = 64,
  status,
  style,
  testID,
}: {
  size?: number;
  status: MomentumStatus;
  style?: StyleProp<ViewStyle>;
  testID?: string;
}): React.JSX.Element {
  const kind: CircularEmojiKind =
    status === 'peak_momentum'
      ? 'peak'
      : status === 'strong_momentum'
      ? 'strong'
      : status === 'building_momentum'
      ? 'building'
      : 'gettingStarted';
  return (
    <CircularEmoji
      kind={kind}
      size={size}
      emojiSize={size * 0.72}
      backgroundColor="#FFF3DF"
      style={style}
      testID={testID}
    />
  );
}
