import React from 'react';
import {CircularEmoji} from '../../../design/components/CircularEmoji';
import {useSystemTheme} from '../../../design/system';

export function ProgressStatBadge({tone}: {tone: 'orange' | 'blue'}) {
  const theme = useSystemTheme();
  return (
    <CircularEmoji
      kind={tone === 'orange' ? 'streak' : 'momentum'}
      size={36}
      emojiSize={22}
      backgroundColor={theme.category[tone].surface}
    />
  );
}
