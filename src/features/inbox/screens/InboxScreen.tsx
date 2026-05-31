import React, {useCallback, useEffect, useState} from 'react';
import {Pressable, StyleSheet, View} from 'react-native';
import type {NativeStackScreenProps} from '@react-navigation/native-stack';
import {useFocusEffect} from '@react-navigation/native';
import {ArrowLeft} from 'lucide-react-native';

import {GlassPanel} from '../../../design/components/GlassPanel';
import {HoystAvatar} from '../../../design/components/HoystAvatar';
import {HoystChip} from '../../../design/components/HoystChip';
import {HoystScreen} from '../../../design/components/HoystScreen';
import {HoystText} from '../../../design/components/HoystText';
import {brandColors} from '../../../design/tokens/colors';
import {useHoystTheme} from '../../../design/theme/useHoystTheme';
import {clearDeliveredNotifications} from '../../../lib/notifications';
import type {RootStackParamList} from '../../../navigation/types';
import {useSessionStore} from '../../../store/session-store';
import type {InboxEvent} from '../../../types/models';
import {
  markAllInboxEventsRead,
  markInboxEventRead,
  subscribeToInboxEvents,
} from '../../settings/services/notification-settings-service';

type Props = NativeStackScreenProps<RootStackParamList, 'Inbox'>;
type HoystChipTone = React.ComponentProps<typeof HoystChip>['tone'];
type HoystAvatarTone = React.ComponentProps<typeof HoystAvatar>['tone'];
type InboxVisual = {
  avatarTone: HoystAvatarTone;
  chipTone: HoystChipTone;
  foregroundColor: string;
  useBrandRing?: boolean;
};

function getInitials(name: string) {
  return name
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map(part => part[0]?.toUpperCase() ?? '')
    .join('');
}

function isSuccessEvent(event: InboxEvent) {
  return (
    event.type === 'circle_complete' ||
    event.type === 'companion_tapped_in' ||
    event.type === 'join_approved' ||
    event.type === 'member_joined'
  );
}

function isAlertEvent(event: InboxEvent) {
  if (
    event.type === 'circle_at_risk' ||
    event.type === 'member_due_prompt' ||
    event.type === 'tap_in_final_warning' ||
    event.type === 'join_declined'
  ) {
    return true;
  }

  return false;
}

function getInboxVisual(
  event: InboxEvent,
  theme: ReturnType<typeof useHoystTheme>,
): InboxVisual {
  if (isSuccessEvent(event)) {
    return {
      avatarTone: 'green',
      chipTone: 'green',
      foregroundColor: theme.successForeground,
      useBrandRing: true,
    };
  }

  if (isAlertEvent(event)) {
    return {
      avatarTone: 'muted',
      chipTone: 'orange',
      foregroundColor: theme.warningForeground,
    };
  }

  if (event.type === 'tap_in_midday_reminder') {
    return {
      avatarTone: 'muted',
      chipTone: 'yellow',
      foregroundColor: theme.isDark ? brandColors.spectrumYellow : '#7A5C00',
    };
  }

  if (event.type === 'circle_discovery_suggestion') {
    return {
      avatarTone: 'muted',
      chipTone: 'blue',
      foregroundColor: theme.accentTertiaryForeground,
    };
  }

  if (
    event.type === 'join_request' ||
    event.type === 'nudge' ||
    event.type === 'circle_nudge_prompt'
  ) {
    return {
      avatarTone: 'purple',
      chipTone: 'purple',
      foregroundColor: theme.accentSecondaryForeground,
    };
  }

  return {
    avatarTone: 'muted',
    chipTone: 'neutral',
    foregroundColor: theme.textMuted,
  };
}

function getActionLabel(event: InboxEvent) {
  if (event.type === 'tap_in_midday_reminder') {
    return 'Reminder';
  }
  if (event.type === 'tap_in_final_warning') {
    return 'Last call';
  }
  if (event.type === 'member_due_prompt') {
    return 'Tap In';
  }
  if (event.type === 'join_request') {
    return 'Review';
  }
  if (event.type === 'nudge') {
    return 'Nudge';
  }
  if (event.type === 'circle_nudge_prompt') {
    return 'Nudge';
  }
  if (event.type === 'circle_at_risk') {
    return 'At risk';
  }
  if (event.type === 'circle_complete') {
    return 'Complete';
  }
  if (event.type === 'companion_tapped_in') {
    return 'Tapped in';
  }
  if (event.type === 'circle_discovery_suggestion') {
    return 'Explore';
  }
  return event.type === 'join_approved' || event.type === 'member_joined'
    ? 'Joined'
    : 'Update';
}

function getEventLead(event: InboxEvent) {
  return event.actor?.displayName ?? event.title;
}

function getEventMessage(event: InboxEvent) {
  const actorName = event.actor?.displayName?.trim();

  if (!actorName) {
    return event.body;
  }

  const duplicatedPrefix = `${actorName} `;
  return event.body.startsWith(duplicatedPrefix)
    ? event.body.slice(duplicatedPrefix.length)
    : event.body;
}

function InboxEventRow({
  event,
  onPress,
}: {
  event: InboxEvent;
  onPress: () => void;
}): React.JSX.Element {
  const theme = useHoystTheme();
  const visual = getInboxVisual(event, theme);
  const lead = getEventLead(event);
  const message = getEventMessage(event);

  return (
    <Pressable
      accessibilityLabel={`Open ${lead} update`}
      accessibilityRole="button"
      onPress={onPress}
      style={({pressed}) => ({opacity: pressed ? 0.9 : 1})}>
      <GlassPanel padding="compact">
        <View style={styles.notificationRow}>
          <HoystAvatar
            initials={getInitials(lead) || 'HO'}
            imageUrl={event.actor?.avatarUrl}
            size={34}
            tone={visual.avatarTone}
            useBrandRing={visual.useBrandRing}
          />
          <View style={styles.notificationCopy}>
            <HoystText>
              <HoystText style={styles.notificationLead}>{lead} </HoystText>
              <HoystText style={{color: visual.foregroundColor}}>
                {message}
              </HoystText>
            </HoystText>
            <HoystText tone="muted" variant="caption">
              {event.createdAtLabel}
            </HoystText>
          </View>
          <HoystChip
            label={getActionLabel(event)}
            style={styles.notificationChip}
            tone={visual.chipTone}
          />
        </View>
      </GlassPanel>
    </Pressable>
  );
}

export function InboxScreen({navigation}: Props): React.JSX.Element {
  const theme = useHoystTheme();
  const user = useSessionStore(state => state.user);
  const status = useSessionStore(state => state.status);
  const [events, setEvents] = useState<InboxEvent[]>([]);
  const [hasInboxError, setHasInboxError] = useState(false);

  useEffect(() => {
    if (status !== 'authenticatedReady' || !user?.uid) {
      setEvents([]);
      setHasInboxError(false);
      return undefined;
    }

    setHasInboxError(false);

    return subscribeToInboxEvents({
      onError: () => {
        setHasInboxError(true);
      },
      onEvents: nextEvents => {
        setEvents(nextEvents);
        setHasInboxError(false);
      },
      uid: user.uid,
    });
  }, [status, user?.uid]);

  useFocusEffect(
    useCallback(() => {
      if (status !== 'authenticatedReady' || !user?.uid) {
        return undefined;
      }

      clearDeliveredNotifications().catch(() => undefined);
      markAllInboxEventsRead().catch(() => undefined);

      return undefined;
    }, [status, user?.uid]),
  );

  const navigateBack = useCallback(() => {
    if (navigation.canGoBack()) {
      navigation.goBack();
      return;
    }

    navigation.navigate('MainTabs', {screen: 'Home'});
  }, [navigation]);

  const openEvent = (event: InboxEvent) => {
    markInboxEventRead(event.id).catch(() => undefined);

    if (event.deeplink.screen === 'TapInComposer') {
      navigation.navigate('TapInComposer', {
        circleId: event.deeplink.circleId,
        source: event.deeplink.source,
      });
      return;
    }

    if (event.deeplink.screen === 'CircleDetail') {
      navigation.navigate('CircleDetail', {
        circleId: event.deeplink.circleId,
      });
    }
  };

  return (
    <HoystScreen contentContainerStyle={styles.content}>
      <View style={styles.header}>
        <Pressable
          accessibilityLabel="Back"
          accessibilityRole="button"
          hitSlop={8}
          onPress={navigateBack}
          style={({pressed}) => [
            styles.backButton,
            {
              backgroundColor: theme.surfaceSoft,
              borderColor: theme.border,
              opacity: pressed ? 0.92 : 1,
            },
          ]}>
          <ArrowLeft color={theme.text} size={22} strokeWidth={2.3} />
        </Pressable>
        <HoystText variant="headline">Inbox</HoystText>
      </View>
      {hasInboxError && events.length === 0 ? (
        <GlassPanel>
          <View style={styles.emptyState}>
            <HoystText variant="title">Could not load Inbox</HoystText>
            <HoystText tone="muted">
              Your account is connected, but Hoyst could not load your latest
              updates.
            </HoystText>
          </View>
        </GlassPanel>
      ) : events.length > 0 ? (
        <View style={styles.notificationList}>
          {events.map(event => (
            <InboxEventRow
              event={event}
              key={event.id}
              onPress={() => openEvent(event)}
            />
          ))}
        </View>
      ) : (
        <GlassPanel>
          <View style={styles.emptyState}>
            <HoystText variant="title">No updates yet</HoystText>
            <HoystText tone="muted">
              Circle requests, reminders, nudges, discovery, and streak alerts
              will show up here.
            </HoystText>
          </View>
        </GlassPanel>
      )}
    </HoystScreen>
  );
}

const styles = StyleSheet.create({
  content: {
    paddingBottom: 168,
  },
  backButton: {
    alignItems: 'center',
    borderRadius: 16,
    borderWidth: 1,
    height: 44,
    justifyContent: 'center',
    width: 44,
  },
  emptyState: {
    gap: 8,
  },
  header: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 12,
  },
  notificationChip: {
    marginLeft: 10,
  },
  notificationCopy: {
    flex: 1,
    gap: 4,
    minWidth: 0,
  },
  notificationLead: {
    fontWeight: '800',
  },
  notificationList: {
    gap: 10,
  },
  notificationRow: {
    alignItems: 'flex-start',
    flexDirection: 'row',
    gap: 10,
  },
});
