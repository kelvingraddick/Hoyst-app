import React, {useEffect, useMemo, useState} from 'react';
import {Pressable, StyleSheet, View} from 'react-native';
import type {BottomTabScreenProps} from '@react-navigation/bottom-tabs';
import type {NativeStackNavigationProp} from '@react-navigation/native-stack';

import {ActivityFeedCard} from '../../../design/components/ActivityFeedCard';
import {GlassPanel} from '../../../design/components/GlassPanel';
import {HoystScreen} from '../../../design/components/HoystScreen';
import {HoystText} from '../../../design/components/HoystText';
import type {
  AppTabsParamList,
  RootStackParamList,
} from '../../../navigation/types';
import {useSessionStore} from '../../../store/session-store';
import type {
  CircleActivityItem,
  CircleActivityTone,
  InboxEvent,
} from '../../../types/models';
import {
  markInboxEventRead,
  subscribeToInboxEvents,
} from '../../settings/services/notification-settings-service';

type Props = BottomTabScreenProps<AppTabsParamList, 'Inbox'>;

function getInitials(name: string) {
  return name
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map(part => part[0]?.toUpperCase() ?? '')
    .join('');
}

function getInboxTone(event: InboxEvent): CircleActivityTone {
  if (event.type === 'join_approved' || event.type === 'member_joined') {
    return 'success';
  }

  if (
    event.type === 'circle_at_risk' ||
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
  if (event.type === 'join_request') {
    return 'Review';
  }
  if (event.type === 'poke') {
    return 'Poke';
  }
  if (event.type === 'circle_at_risk') {
    return 'At risk';
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
  const user = useSessionStore(state => state.user);
  const status = useSessionStore(state => state.status);
  const [events, setEvents] = useState<InboxEvent[]>([]);
  const [hasInboxError, setHasInboxError] = useState(false);
  const rootNavigation =
    navigation.getParent<NativeStackNavigationProp<RootStackParamList>>();
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

  const openEvent = (event: InboxEvent) => {
    markInboxEventRead(event.id).catch(() => undefined);

    if (event.deeplink.screen === 'TapInComposer') {
      rootNavigation?.navigate('TapInComposer', {
        circleId: event.deeplink.circleId,
        source: event.deeplink.source,
      });
      return;
    }

    if (event.deeplink.screen === 'CircleDetail') {
      rootNavigation?.navigate('CircleDetail', {
        circleId: event.deeplink.circleId,
      });
    }
  };

  return (
    <HoystScreen contentContainerStyle={styles.content}>
      <View style={styles.header}>
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
              Circle requests, reminders, pokes, and streak alerts will show up
              here.
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
  emptyState: {
    gap: 8,
  },
  header: {
    gap: 8,
  },
});
