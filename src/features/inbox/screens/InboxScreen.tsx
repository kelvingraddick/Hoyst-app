import React from 'react';
import {StyleSheet} from 'react-native';

import {GlassPanel} from '../../../design/components/GlassPanel';
import {HoystChip} from '../../../design/components/HoystChip';
import {HoystScreen} from '../../../design/components/HoystScreen';
import {HoystText} from '../../../design/components/HoystText';

const inboxItems = [
  {
    title: 'Poke received',
    body: 'Rina nudged you in Morning Makers because the day is still open.',
    tone: 'orange' as const,
  },
  {
    title: 'Join request approved',
    body: 'You are in Founders Daily. First check-in opens tomorrow.',
    tone: 'green' as const,
  },
  {
    title: 'Circle is at risk',
    body: 'Lift Club needs 2 more check-ins to save the group streak today.',
    tone: 'purple' as const,
  },
];

export function InboxScreen(): React.JSX.Element {
  return (
    <HoystScreen contentContainerStyle={styles.content}>
      <HoystText variant="headline">Inbox</HoystText>
      {inboxItems.map(item => (
        <GlassPanel key={item.title}>
          <HoystChip label={item.title} tone={item.tone} />
          <HoystText tone="muted">{item.body}</HoystText>
        </GlassPanel>
      ))}
    </HoystScreen>
  );
}

const styles = StyleSheet.create({
  content: {
    paddingBottom: 168,
  },
});
