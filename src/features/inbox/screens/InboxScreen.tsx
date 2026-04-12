import React from 'react';
import {Pressable, StyleSheet, View} from 'react-native';
import {ArrowLeft} from 'lucide-react-native';
import type {NativeStackScreenProps} from '@react-navigation/native-stack';

import {ActivityFeedCard} from '../../../design/components/ActivityFeedCard';
import {HoystScreen} from '../../../design/components/HoystScreen';
import {HoystText} from '../../../design/components/HoystText';
import {useHoystTheme} from '../../../design/theme/useHoystTheme';
import type {RootStackParamList} from '../../../navigation/types';
import type {CircleActivityItem} from '../../../types/models';

type Props = NativeStackScreenProps<RootStackParamList, 'Inbox'>;

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

export function InboxScreen({navigation}: Props): React.JSX.Element {
  const theme = useHoystTheme();

  return (
    <HoystScreen contentContainerStyle={styles.content}>
      <View style={styles.header}>
        <Pressable
          onPress={() => navigation.goBack()}
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
    alignItems: 'center',
    flexDirection: 'row',
    gap: 12,
  },
  backButton: {
    alignItems: 'center',
    borderRadius: 16,
    borderWidth: 1,
    height: 40,
    justifyContent: 'center',
    width: 40,
  },
});
