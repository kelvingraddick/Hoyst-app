import React from 'react';
import {StyleSheet, View} from 'react-native';
import {
  AlarmClock,
  Archive,
  Award,
  Bell,
  Check,
  Clock3,
  Compass,
  Flame,
  Moon,
  RotateCcw,
  SkipForward,
  TrendingUp,
  TriangleAlert,
  UserCheck,
  UserPlus,
  UsersRound,
  UserX,
  type LucideIcon,
} from 'lucide-react-native';

import {getSystemTheme, type SemanticTone} from '../../../design/system/tokens';
import {
  legacyCircleActivityEventTypes,
  type InboxEventType,
} from '../../../types/models';

export type InboxIconTone = Extract<
  SemanticTone,
  'action' | 'muted' | 'progress' | 'success' | 'warning'
>;

const inboxEventIcons: Record<InboxEventType, LucideIcon> = {
  circle_archived: Archive,
  circle_at_risk: TriangleAlert,
  circle_complete: Check,
  circle_discovery_suggestion: Compass,
  circle_nudge_prompt: Bell,
  circle_restored: RotateCcw,
  streak_restored: RotateCcw,
  [legacyCircleActivityEventTypes.achievementUnlocked]: Award,
  [legacyCircleActivityEventTypes.circleCreated]: UsersRound,
  [legacyCircleActivityEventTypes.circleJoined]: UsersRound,
  [legacyCircleActivityEventTypes.momentumLevelUp]: TrendingUp,
  [legacyCircleActivityEventTypes.skipped]: SkipForward,
  [legacyCircleActivityEventTypes.streakMilestone]: Flame,
  [legacyCircleActivityEventTypes.tappedIn]: Check,
  evening_summary: Moon,
  join_approved: UserCheck,
  join_declined: UserX,
  join_request: UserPlus,
  member_due_prompt: Clock3,
  member_joined: UsersRound,
  nudge: Bell,
  tap_in_final_warning: AlarmClock,
  tap_in_midday_reminder: Clock3,
};

export function getInboxEventTone(type: InboxEventType): InboxIconTone {
  if (
    type === 'circle_complete' ||
    type === 'circle_restored' ||
    type === 'streak_restored' ||
    type === legacyCircleActivityEventTypes.achievementUnlocked ||
    type === legacyCircleActivityEventTypes.circleCreated ||
    type === legacyCircleActivityEventTypes.circleJoined ||
    type === legacyCircleActivityEventTypes.momentumLevelUp ||
    type === legacyCircleActivityEventTypes.streakMilestone ||
    type === legacyCircleActivityEventTypes.tappedIn ||
    type === 'join_approved' ||
    type === 'member_joined'
  ) {
    return 'success';
  }

  if (
    type === 'circle_at_risk' ||
    type === legacyCircleActivityEventTypes.skipped ||
    type === 'member_due_prompt' ||
    type === 'tap_in_final_warning' ||
    type === 'join_declined' ||
    type === 'tap_in_midday_reminder'
  ) {
    return 'warning';
  }

  if (type === 'circle_discovery_suggestion' || type === 'evening_summary') {
    return 'action';
  }

  if (
    type === 'circle_archived' ||
    type === 'join_request' ||
    type === 'nudge' ||
    type === 'circle_nudge_prompt'
  ) {
    return 'progress';
  }

  return 'muted';
}

export function InboxEventBadge({
  isDark,
  type,
  tone = getInboxEventTone(type),
}: {
  isDark: boolean;
  type: InboxEventType;
  tone?: InboxIconTone;
}) {
  const theme = getSystemTheme(isDark ? 'dark' : 'light');
  const Icon = inboxEventIcons[type] ?? Bell;
  const backgroundColor = {
    action: theme.category.blue.surface,
    muted: theme.category.neutral.surface,
    progress: theme.category.purple.surface,
    success: theme.category.green.surface,
    warning: theme.category.orange.surface,
  }[tone];

  return (
    <View
      accessible={false}
      style={[styles.badge, {backgroundColor}]}
      testID={
        type === 'circle_complete'
          ? 'inbox-circle-complete-icon'
          : 'inbox-event-icon'
      }>
      <Icon color={theme[tone]} size={16} strokeWidth={2.2} />
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    alignItems: 'center',
    justifyContent: 'center',
    width: 28,
    height: 28,
    borderRadius: 14,
    overflow: 'hidden',
  },
});
