import React, {useCallback, useEffect, useMemo, useState} from 'react';
import {Pressable, StyleSheet, View} from 'react-native';
import type {NativeStackScreenProps} from '@react-navigation/native-stack';
import {useFocusEffect} from '@react-navigation/native';
import {ArrowLeft} from 'lucide-react-native';

import {ActivityFeedCard} from '../../../design/components/ActivityFeedCard';
import {GlassPanel} from '../../../design/components/GlassPanel';
import {HoystScreen} from '../../../design/components/HoystScreen';
import {HoystText} from '../../../design/components/HoystText';
import {useHoystTheme} from '../../../design/theme/useHoystTheme';
import {clearDeliveredNotifications} from '../../../lib/notifications';
import type {RootStackParamList} from '../../../navigation/types';
import {useSessionStore} from '../../../store/session-store';
import type {
  CircleActivityItem,
  CircleActivityTone,
  InboxEvent,
} from '../../../types/models';
import {
  markAllInboxEventsRead,
  markInboxEventRead,
  subscribeToInboxEvents,
} from '../../settings/services/notification-settings-service';

type Props = NativeStackScreenProps<RootStackParamList, 'Inbox'>;

function getInitials(name: string) {
  return name
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map(part => part[0]?.toUpperCase() ?? '')
    .join('');
}

function getInboxTone(event: InboxEvent): CircleActivityTone {
  if (
    event.type === 'circle_complete' ||
    event.type === 'companion_tapped_in' ||
    event.type === 'join_approved' ||
    event.type === 'member_joined'
  ) {
    return 'success';
  }

  if (
    event.type === 'circle_at_risk' ||
    event.type === 'member_due_prompt' ||
    event.type === 'tap_in_final_warning' ||
    event.type === 'join_declined'
  ) {
    return 'alert';
  }

  return 'pending';
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

function mapInboxEventToActivity(event: InboxEvent): CircleActivityItem {
  const actorName = event.actor?.displayName ?? event.title;

  return {
    actorAvatarUrl: event.actor?.avatarUrl,
    actorInitials: getInitials(actorName) || 'HO',
    actorName,
    actionLabel: getActionLabel(event),
    id: event.id,
    message: event.actor?.displayName ? event.body : event.body,
    timestamp: event.createdAtLabel,
    tone: getInboxTone(event),
  };
}

export function InboxScreen({navigation}: Props): React.JSX.Element {
  const theme = useHoystTheme();
  const user = useSessionStore(state => state.user);
  const status = useSessionStore(state => state.status);
  const [events, setEvents] = useState<InboxEvent[]>([]);
  const [hasInboxError, setHasInboxError] = useState(false);
  const activityItems = useMemo(
    () => events.map(mapInboxEventToActivity),
    [events],
  );

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
      {hasInboxError && activityItems.length === 0 ? (
        <GlassPanel>
          <View style={styles.emptyState}>
            <HoystText variant="title">Could not load Inbox</HoystText>
            <HoystText tone="muted">
              Your account is connected, but Hoyst could not load your latest
              updates.
            </HoystText>
          </View>
        </GlassPanel>
      ) : activityItems.length > 0 ? (
        activityItems.map((item, index) => (
          <Pressable
            accessibilityRole="button"
            key={item.id}
            onPress={() => openEvent(events[index])}>
            <ActivityFeedCard item={item} />
          </Pressable>
        ))
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
});
