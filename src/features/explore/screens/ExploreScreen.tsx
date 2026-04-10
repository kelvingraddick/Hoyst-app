import React from 'react';
import {StyleSheet, View} from 'react-native';

import {GlassPanel} from '../../../design/components/GlassPanel';
import {HoystButton} from '../../../design/components/HoystButton';
import {HoystChip} from '../../../design/components/HoystChip';
import {HoystInput} from '../../../design/components/HoystInput';
import {HoystScreen} from '../../../design/components/HoystScreen';
import {HoystText} from '../../../design/components/HoystText';

const exploreCards = [
  {
    title: 'Founders Daily',
    members: '12 members',
    mode: 'Request to join',
  },
  {
    title: '5AM Crew',
    members: '8 members',
    mode: 'Invite only',
  },
  {
    title: 'Writers Room',
    members: '10 members',
    mode: 'Open seats',
  },
];

export function ExploreScreen(): React.JSX.Element {
  return (
    <HoystScreen contentContainerStyle={styles.content}>
      <View style={styles.header}>
        <HoystText variant="headline">Explore</HoystText>
        <HoystText tone="muted">
          Discover public circles with the same tighter, darker card treatment
          as the core accountability flows.
        </HoystText>
      </View>
      <HoystInput placeholder="Search circles, categories, or moods" />
      <View style={styles.chips}>
        <HoystChip label="Fitness" tone="green" />
        <HoystChip label="Sobriety" tone="purple" />
        <HoystChip label="Deep Work" tone="orange" />
      </View>
      {exploreCards.map(card => (
        <GlassPanel key={card.title}>
          <View style={styles.cardCopy}>
            <HoystText variant="title">{card.title}</HoystText>
            <HoystText tone="muted">{card.members}</HoystText>
          </View>
          <View style={styles.cardFooter}>
            <HoystChip
              label={card.mode}
              tone={card.mode === 'Open seats' ? 'green' : 'purple'}
            />
            <View style={styles.previewButton}>
              <HoystButton label="Preview" variant="outline" />
            </View>
          </View>
        </GlassPanel>
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
  chips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  cardCopy: {
    gap: 6,
  },
  cardFooter: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  previewButton: {
    minWidth: 128,
  },
});
