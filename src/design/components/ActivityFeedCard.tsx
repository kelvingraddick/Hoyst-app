import React from 'react';
import {StyleSheet, View} from 'react-native';
import LinearGradient from 'react-native-linear-gradient';
import {Heart} from 'lucide-react-native';

import type {CircleActivityItem} from '../../types/models';
import {useHoystTheme} from '../theme/useHoystTheme';
import {GlassPanel} from './GlassPanel';
import {HoystAvatar} from './HoystAvatar';
import {HoystChip} from './HoystChip';
import {HoystText} from './HoystText';

type ActivityFeedCardProps = {
  item: CircleActivityItem;
};

export function ActivityFeedCard({
  item,
}: ActivityFeedCardProps): React.JSX.Element {
  const theme = useHoystTheme();

  return (
    <GlassPanel>
      <View style={styles.header}>
        <View style={styles.actorRow}>
          <HoystAvatar
            initials={item.actorInitials}
            imageSource={item.actorAvatarImage}
            size={36}
            tone="green"
          />
          <View style={styles.actorCopy}>
            <HoystText>
              {item.actorName}{' '}
              <HoystText
                style={
                  item.tone === 'success'
                    ? {color: theme.success}
                    : item.tone === 'pending'
                    ? {color: theme.accentSecondary}
                    : {color: theme.warning}
                }>
                {item.message}
              </HoystText>
            </HoystText>
            <HoystText tone="muted" variant="caption">
              {item.timestamp}
            </HoystText>
          </View>
        </View>
        {item.actionLabel ? (
          <HoystChip label={item.actionLabel} tone="purple" />
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
