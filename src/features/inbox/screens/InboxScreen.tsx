import React from 'react';
import {StyleSheet, View} from 'react-native';

import {ActivityFeedCard} from '../../../design/components/ActivityFeedCard';
import {HoystScreen} from '../../../design/components/HoystScreen';
import {HoystText} from '../../../design/components/HoystText';
import type {CircleActivityItem} from '../../../types/models';

const inboxItems: CircleActivityItem[] = [
  {
    id: 'poke-received',
    actorName: 'Rina',
    actorInitials: 'RI',
    tone: 'pending',
    message: 'nudged you in Morning Makers because the day is still open.',
    timestamp: 'Just now',
    actionLabel: 'Poke received',
  },
  {
    id: 'join-request-approved',
    actorName: 'Founders Daily',
    actorInitials: 'FD',
    tone: 'success',
    message: 'approved your join request. First Tap In opens tomorrow.',
    timestamp: 'Today',
    actionLabel: 'Joined',
  },
  {
    id: 'circle-at-risk',
    actorName: 'Lift Club',
    actorInitials: 'LC',
    tone: 'alert',
    message: 'needs 2 more Tap Ins to save the group streak today.',
    timestamp: 'Today',
    actionLabel: 'At risk',
  },
];

export function InboxScreen(): React.JSX.Element {
  return (
    <HoystScreen contentContainerStyle={styles.content}>
      <View style={styles.header}>
        <HoystText variant="headline">Inbox</HoystText>
      </View>
      {inboxItems.map(item => (
        <ActivityFeedCard item={item} key={item.id} />
      ))}
    </HoystScreen>
  );
}

const styles = StyleSheet.create({
  content: {
    paddingBottom: 168,
  },
  header: {
    gap: 8,
  },
});
