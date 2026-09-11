import React, {useCallback, useEffect, useRef, useState} from 'react';
import {Image, Pressable, StyleSheet, View} from 'react-native';
import type {NativeStackScreenProps} from '@react-navigation/native-stack';
import {useFocusEffect} from '@react-navigation/native';
import {ArrowLeft, ChevronRight} from 'lucide-react-native';

import {
  DesignSystemProvider,
  DSIconButton,
  DSScreen,
  DSSurface,
  DSText,
  space,
  useSystemTheme,
  type SemanticTone,
} from '../../../design/system';
import {clearDeliveredNotifications} from '../../../lib/notifications';
import type {RootStackParamList} from '../../../navigation/types';
import {useSettingsStore} from '../../../store/settings-store';
import {useSessionStore} from '../../../store/session-store';
import {
  legacyCircleActivityEventTypes,
  type InboxEvent,
} from '../../../types/models';
import {
  markAllInboxEventsRead,
  markInboxEventRead,
  subscribeToInboxEvents,
} from '../../settings/services/notification-settings-service';

type Props = NativeStackScreenProps<RootStackParamList, 'Inbox'>;
type InboxVisual = {
  messageTone: SemanticTone;
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
    event.type === 'circle_restored' ||
    event.type === legacyCircleActivityEventTypes.achievementUnlocked ||
    event.type === legacyCircleActivityEventTypes.circleCreated ||
    event.type === legacyCircleActivityEventTypes.circleJoined ||
    event.type === legacyCircleActivityEventTypes.momentumLevelUp ||
    event.type === legacyCircleActivityEventTypes.streakMilestone ||
    event.type === legacyCircleActivityEventTypes.tappedIn ||
    event.type === 'join_approved' ||
    event.type === 'member_joined'
  );
}

function isAlertEvent(event: InboxEvent) {
  if (
    event.type === 'circle_at_risk' ||
    event.type === legacyCircleActivityEventTypes.skipped ||
    event.type === 'member_due_prompt' ||
    event.type === 'tap_in_final_warning' ||
    event.type === 'join_declined'
  ) {
    return true;
  }

  return false;
}

function getInboxVisual(event: InboxEvent): InboxVisual {
  if (isSuccessEvent(event)) {
    return {
      messageTone: 'success',
    };
  }

  if (isAlertEvent(event)) {
    return {
      messageTone: 'warning',
    };
  }

  if (event.type === 'tap_in_midday_reminder') {
    return {
      messageTone: 'warning',
    };
  }

  if (
    event.type === 'circle_discovery_suggestion' ||
    event.type === 'evening_summary'
  ) {
    return {
      messageTone: 'action',
    };
  }

  if (
    event.type === 'circle_archived' ||
    event.type === 'join_request' ||
    event.type === 'nudge' ||
    event.type === 'circle_nudge_prompt'
  ) {
    return {
      messageTone: 'progress',
    };
  }

  return {
    messageTone: 'muted',
  };
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

function getUnreadEventIds(events: readonly InboxEvent[]) {
  return events.filter(event => !event.isRead).map(event => event.id);
}

function InboxAvatar({name, uri}: {name: string; uri?: string}) {
  const theme = useSystemTheme();
  const [failedUri, setFailedUri] = useState<string>();
  const backgroundColor = theme.isDark ? '#151827' : '#FFFFFF';

  return (
    <View style={[styles.avatarFace, {backgroundColor}]}>
      {uri && failedUri !== uri ? (
        <Image
          source={{uri}}
          resizeMode="cover"
          accessibilityIgnoresInvertColors
          accessible={false}
          onError={() => setFailedUri(uri)}
          style={styles.avatarImage}
          testID="inbox-avatar-image"
        />
      ) : (
        <DSText allowFontScaling={false} style={styles.avatarInitials}>
          {getInitials(name) || 'HO'}
        </DSText>
      )}
    </View>
  );
}

function InboxEventRow({
  event,
  isUnread,
  onPress,
}: {
  event: InboxEvent;
  isUnread: boolean;
  onPress: () => void;
}): React.JSX.Element {
  const theme = useSystemTheme();
  const visual = getInboxVisual(event);
  const lead = getEventLead(event);
  const message = getEventMessage(event);
  const [pressed, setPressed] = useState(false);
  const borderBottomColor = theme.isDark
    ? 'rgba(255,255,255,0.10)'
    : 'rgba(16,24,40,0.08)';

  return (
    <Pressable
      accessibilityLabel={
        isUnread ? `Unread, open ${lead} update` : `Open ${lead} update`
      }
      accessibilityRole="button"
      onPress={onPress}
      onPressIn={() => setPressed(true)}
      onPressOut={() => setPressed(false)}
      // NativeWind interop drops functional styles. Keep layout and feedback explicit.
      style={[
        styles.notificationRow,
        {borderBottomColor},
        pressed ? styles.notificationPressed : undefined,
      ]}
      testID={`inbox-event-row-${event.id}`}>
      <View style={styles.notificationAvatarSlot} testID="inbox-avatar">
        <InboxAvatar
          key={event.actor?.avatarUrl}
          name={lead}
          uri={event.actor?.avatarUrl}
        />
        <View style={styles.notificationUnreadSlot}>
          {isUnread ? (
            <View
              style={[
                styles.notificationUnreadDot,
                {backgroundColor: theme[visual.messageTone]},
              ]}
              testID="inbox-unread-dot"
            />
          ) : null}
        </View>
      </View>
      <View style={styles.notificationCopy} testID="inbox-event-copy">
        <DSText variant="body" style={styles.notificationCopyText}>
          <DSText
            variant="body"
            style={isUnread ? styles.notificationMessageUnread : undefined}>
            {lead}{' '}
          </DSText>
          <DSText
            variant="body"
            tone={visual.messageTone}
            style={isUnread ? styles.notificationMessageUnread : undefined}>
            {message}
          </DSText>
        </DSText>
        <DSText
          variant="secondary"
          tone={isUnread ? 'text' : 'muted'}
          style={isUnread ? styles.notificationTimestampUnread : undefined}>
          {event.createdAtLabel}
        </DSText>
      </View>
      {event.mediaImageUrl ? (
        <Image
          resizeMode="cover"
          source={{uri: event.mediaImageUrl}}
          accessibilityLabel="Activity photo"
          style={styles.notificationMediaImage}
          testID="inbox-media-image"
        />
      ) : null}
      <ChevronRight
        color={theme.muted}
        size={18}
        testID="inbox-event-chevron"
      />
    </Pressable>
  );
}

function InboxScreenContent({navigation}: Props): React.JSX.Element {
  const theme = useSystemTheme();
  const user = useSessionStore(state => state.user);
  const status = useSessionStore(state => state.status);
  const [events, setEvents] = useState<InboxEvent[]>([]);
  const [hasInboxError, setHasInboxError] = useState(false);
  const [currentVisitUnreadIds, setCurrentVisitUnreadIds] = useState<
    ReadonlySet<string>
  >(() => new Set());
  const hasReceivedInboxSnapshotRef = useRef(false);
  const hasMarkedInboxVisitReadRef = useRef(false);
  const isInboxFocusedRef = useRef(false);
  const latestEventsRef = useRef<InboxEvent[]>([]);
  const markedUnreadIdsRef = useRef<Set<string>>(new Set());

  const addCurrentVisitUnreadIds = useCallback(
    (unreadIds: readonly string[]) => {
      if (unreadIds.length === 0) {
        return;
      }

      setCurrentVisitUnreadIds(currentIds => {
        let nextIds: Set<string> | undefined;

        unreadIds.forEach(id => {
          if (!currentIds.has(id)) {
            nextIds ??= new Set(currentIds);
            nextIds.add(id);
          }
        });

        return nextIds ?? currentIds;
      });
    },
    [],
  );

  const markInboxReadForCurrentVisit = useCallback(
    (unreadIds: readonly string[] = []) => {
      const unmarkedUnreadIds = unreadIds.filter(
        id => !markedUnreadIdsRef.current.has(id),
      );

      if (
        hasMarkedInboxVisitReadRef.current &&
        unmarkedUnreadIds.length === 0
      ) {
        return;
      }

      hasMarkedInboxVisitReadRef.current = true;
      unmarkedUnreadIds.forEach(id => {
        markedUnreadIdsRef.current.add(id);
      });
      markAllInboxEventsRead().catch(() => undefined);
    },
    [],
  );

  useEffect(() => {
    if (status !== 'authenticatedReady' || !user?.uid) {
      setEvents([]);
      setHasInboxError(false);
      setCurrentVisitUnreadIds(new Set());
      hasReceivedInboxSnapshotRef.current = false;
      hasMarkedInboxVisitReadRef.current = false;
      isInboxFocusedRef.current = false;
      latestEventsRef.current = [];
      markedUnreadIdsRef.current.clear();
      return undefined;
    }

    setHasInboxError(false);
    setCurrentVisitUnreadIds(new Set());
    hasReceivedInboxSnapshotRef.current = false;
    hasMarkedInboxVisitReadRef.current = false;
    latestEventsRef.current = [];
    markedUnreadIdsRef.current.clear();

    return subscribeToInboxEvents({
      onError: () => {
        setHasInboxError(true);
      },
      onEvents: nextEvents => {
        const unreadIds = getUnreadEventIds(nextEvents);

        hasReceivedInboxSnapshotRef.current = true;
        latestEventsRef.current = nextEvents;
        if (isInboxFocusedRef.current) {
          addCurrentVisitUnreadIds(unreadIds);
          markInboxReadForCurrentVisit(unreadIds);
        }
        setEvents(nextEvents);
        setHasInboxError(false);
      },
      uid: user.uid,
    });
  }, [
    addCurrentVisitUnreadIds,
    markInboxReadForCurrentVisit,
    status,
    user?.uid,
  ]);

  useFocusEffect(
    useCallback(() => {
      if (status !== 'authenticatedReady' || !user?.uid) {
        return undefined;
      }

      isInboxFocusedRef.current = true;
      hasMarkedInboxVisitReadRef.current = false;
      markedUnreadIdsRef.current.clear();

      const unreadIds = getUnreadEventIds(latestEventsRef.current);

      addCurrentVisitUnreadIds(unreadIds);
      clearDeliveredNotifications().catch(() => undefined);
      if (hasReceivedInboxSnapshotRef.current) {
        markInboxReadForCurrentVisit(unreadIds);
      }

      return () => {
        isInboxFocusedRef.current = false;
        hasMarkedInboxVisitReadRef.current = false;
        markedUnreadIdsRef.current.clear();
        setCurrentVisitUnreadIds(new Set());
      };
    }, [
      addCurrentVisitUnreadIds,
      markInboxReadForCurrentVisit,
      status,
      user?.uid,
    ]),
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

    if (event.deeplink.screen === 'TapInPicker') {
      navigation.navigate('TapInPicker');
      return;
    }

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
    <DSScreen contentContainerStyle={styles.content}>
      <View style={styles.header} testID="inbox-header">
        <View style={styles.headerSide}>
          <DSIconButton
            label="Back"
            onPress={navigateBack}
            icon={<ArrowLeft color={theme.text} size={22} strokeWidth={2.3} />}
          />
        </View>
        <DSText accessibilityRole="header" style={styles.headerTitle}>
          Inbox
        </DSText>
        <View style={styles.headerSide} />
      </View>
      {hasInboxError && events.length === 0 ? (
        <DSSurface kind="quiet">
          <View style={styles.emptyState}>
            <DSText variant="title">Could not load Inbox</DSText>
            <DSText tone="muted">
              Your account is connected, but Hoyst could not load your latest
              updates.
            </DSText>
          </View>
        </DSSurface>
      ) : events.length > 0 ? (
        <View style={styles.notificationList}>
          {events.map(event => (
            <InboxEventRow
              event={event}
              isUnread={currentVisitUnreadIds.has(event.id)}
              key={event.id}
              onPress={() => openEvent(event)}
            />
          ))}
        </View>
      ) : (
        <DSSurface kind="quiet">
          <View style={styles.emptyState}>
            <DSText variant="title">No updates yet</DSText>
            <DSText tone="muted">
              Circle requests, reminders, nudges, discovery, and streak alerts
              will show up here.
            </DSText>
          </View>
        </DSSurface>
      )}
    </DSScreen>
  );
}

export function InboxScreen(props: Props): React.JSX.Element {
  const appearance = useSettingsStore(state => state.appearance);

  return (
    <DesignSystemProvider scheme={appearance}>
      <InboxScreenContent {...props} />
    </DesignSystemProvider>
  );
}

const styles = StyleSheet.create({
  avatarFace: {
    alignItems: 'center',
    justifyContent: 'center',
    width: 28,
    height: 28,
    borderRadius: 14,
    overflow: 'hidden',
  },
  avatarImage: {width: 28, height: 28},
  avatarInitials: {fontSize: 11, lineHeight: 15, fontWeight: '600'},
  content: {
    paddingBottom: 168,
  },
  emptyState: {
    gap: space.sm,
  },
  header: {
    alignItems: 'center',
    flexDirection: 'row',
    minHeight: 44,
  },
  headerSide: {
    alignItems: 'flex-start',
    flexShrink: 0,
    width: 84,
  },
  headerTitle: {
    flex: 1,
    fontSize: 17,
    fontWeight: '600',
    lineHeight: 21,
    textAlign: 'center',
  },
  notificationCopy: {
    flex: 1,
    flexShrink: 1,
    gap: space.xs,
    minWidth: 0,
  },
  notificationCopyText: {
    flexShrink: 1,
  },
  notificationList: {
    gap: 0,
  },
  notificationMediaImage: {
    borderRadius: 8,
    flexShrink: 0,
    height: 32,
    width: 32,
  },
  notificationMessageUnread: {
    fontWeight: '700',
  },
  notificationPressed: {opacity: 0.72},
  notificationRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: space.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
    minHeight: 56,
    opacity: 1,
    paddingVertical: space.sm,
  },
  notificationTimestampUnread: {
    fontWeight: '700',
  },
  notificationUnreadDot: {
    borderRadius: 3,
    height: 6,
    width: 6,
  },
  notificationUnreadSlot: {
    alignItems: 'center',
    position: 'absolute',
    right: -2,
    top: -2,
  },
  notificationAvatarSlot: {
    alignSelf: 'flex-start',
    flexShrink: 0,
    height: 28,
    position: 'relative',
    width: 28,
  },
});
