import React from 'react';
import {
  CircularEmoji,
  type CircularEmojiKind,
} from '../../../design/components/CircularEmoji';
import {useSystemTheme} from '../../../design/system';

export function ProgressStatBadge({
  tone,
  kind,
}: {
  tone: 'orange' | 'blue';
  kind?: CircularEmojiKind;
}) {
  const theme = useSystemTheme();
  return (
    <CircularEmoji
      kind={kind ?? (tone === 'orange' ? 'streak' : 'momentum')}
      size={36}
      emojiSize={22}
      backgroundColor={theme.category[tone].surface}
    />
  );
}
