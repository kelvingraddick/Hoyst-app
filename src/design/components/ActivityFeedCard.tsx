import React from 'react';
import {StyleSheet, View, type StyleProp, type ViewStyle} from 'react-native';
import LinearGradient from 'react-native-linear-gradient';
import {Heart} from 'lucide-react-native';

import type {CircleActivityItem} from '../../types/models';
import {useHoystTheme} from '../theme/useHoystTheme';
import {GlassPanel} from './GlassPanel';
import {HoystAvatar} from './HoystAvatar';
import {HoystChip} from './HoystChip';
import {HoystText} from './HoystText';

type ActivityFeedCardProps = {
  density?: 'compact' | 'regular';
  item: CircleActivityItem;
  style?: StyleProp<ViewStyle>;
};

export function ActivityFeedCard({
  density = 'regular',
  item,
  style,
}: ActivityFeedCardProps): React.JSX.Element {
  const theme = useHoystTheme();
  const isCompact = density === 'compact';
  const avatarTone =
    item.tone === 'success'
      ? 'green'
      : item.tone === 'pending'
      ? 'purple'
      : 'muted';
  const messageStyle =
    item.tone === 'success'
      ? {color: theme.successForeground}
      : item.tone === 'pending'
      ? {color: theme.accentSecondaryForeground}
      : {color: theme.warningForeground};

  return (
    <GlassPanel style={style}>
      <View style={styles.header}>
        <View style={styles.actorRow}>
          <HoystAvatar
            initials={item.actorInitials}
            imageSource={item.actorAvatarImage}
            imageUrl={item.actorAvatarUrl}
            size={36}
            tone={avatarTone}
            useBrandRing={item.tone === 'success'}
          />
          <View style={styles.actorCopy}>
            <HoystText style={isCompact ? styles.compactCopy : undefined}>
              {item.actorName}{' '}
              <HoystText
                style={[
                  isCompact ? styles.compactCopy : undefined,
                  messageStyle,
                ]}>
                {item.message}
              </HoystText>
            </HoystText>
            <HoystText
              style={isCompact ? styles.compactTimestamp : undefined}
              tone="muted"
              variant="caption">
              {item.timestamp}
            </HoystText>
          </View>
        </View>
        {item.actionLabel ? (
          <HoystChip density={density} label={item.actionLabel} tone="purple" />
        ) : (
          <Heart color={theme.textMuted} fill="transparent" size={16} />
        )}
      </View>
      {item.imageVariant === 'workout' ? (
        <LinearGradient
          colors={['#1a3431', '#102226', '#1e1f1c']}
          style={styles.media}>
          <HoystText style={styles.mediaLabel} variant="caption">
            Workout photo
          </HoystText>
        </LinearGradient>
      ) : null}
    </GlassPanel>
  );
}

const styles = StyleSheet.create({
  header: {
    alignItems: 'flex-start',
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  actorRow: {
    flex: 1,
    flexDirection: 'row',
    gap: 12,
  },
  actorCopy: {
    flex: 1,
    gap: 4,
  },
  compactCopy: {
    fontSize: 14,
    lineHeight: 19,
  },
  compactTimestamp: {
    fontSize: 12,
    lineHeight: 15,
  },
  media: {
    borderRadius: 18,
    height: 148,
    justifyContent: 'flex-end',
    overflow: 'hidden',
    padding: 16,
  },
  mediaLabel: {
    color: '#f5f5f5',
  },
});
