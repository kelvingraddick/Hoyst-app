import React from 'react';
import {Pressable, StyleSheet, View} from 'react-native';
import {Check} from 'lucide-react-native';

import type {CircleManagementCard} from '../../types/models';
import {useHoystTheme} from '../theme/useHoystTheme';
import {radius} from '../tokens/radius';
import {GlassPanel} from './GlassPanel';
import {HoystChip} from './HoystChip';
import {LayeredAvatar} from './LayeredAvatar';
import {HoystText} from './HoystText';

type TodayCircleCardProps = {
  card: CircleManagementCard;
  isNudged?: boolean;
  isNudging?: boolean;
  onActionPress: () => void;
  onCardPress: () => void;
};

function getCategoryTone(
  category: string,
): React.ComponentProps<typeof HoystChip>['tone'] {
  if (category === 'Fitness') {
    return 'green';
  }

  if (category === 'Deep Work') {
    return 'orange';
  }

  if (category === 'Sobriety') {
    return 'purple';
  }

  return 'neutral';
}

export function TodayCircleCard({
  card,
  isNudged = false,
  isNudging = false,
  onActionPress,
  onCardPress,
}: TodayCircleCardProps): React.JSX.Element {
  const theme = useHoystTheme();
  const canShareInvite = Boolean(
    card.inviteUrl &&
      (card.viewerRole === 'owner' || card.viewerRole === 'admin'),
  );
  const isPendingMembership = card.viewerMembershipStatus === 'pending';
  const isAlreadyTappedInLabel = card.streakLabel === 'Already tapped in';
  const completionRate = card.completionRate ?? card.progressPercent;
  const progressTone =
    completionRate >= 85
      ? theme.successForeground
      : completionRate >= 75
      ? theme.accentSecondaryForeground
      : theme.warningForeground;
  const statusLabel = isPendingMembership
    ? 'Pending'
    : card.viewerTodayStatus === 'skip'
    ? 'Skipped'
    : !card.viewerHasCheckedIn
    ? 'Needs You'
    : card.remainingCheckIns > 0
    ? 'Others Needed'
    : 'Complete';
  const othersNeededTodayLabel =
    card.remainingCheckIns === 1
      ? '1 other needed today'
      : `${card.remainingCheckIns} others needed today`;
  const statusTone: React.ComponentProps<typeof HoystChip>['tone'] =
    statusLabel === 'Complete'
      ? 'green'
      : statusLabel === 'Needs You'
      ? 'orange'
      : statusLabel === 'Skipped'
      ? 'orange'
      : 'purple';
  const fallbackContextLabel = isPendingMembership
    ? 'Pending approval before Tap In unlocks.'
    : !card.viewerHasCheckedIn
    ? 'Needs your Tap In'
    : card.remainingCheckIns > 0
    ? othersNeededTodayLabel
    : 'Daily Tap In complete';
  const contextLabel = card.matchCopy ?? fallbackContextLabel;
  const statsLabel = isPendingMembership
    ? 'Awaiting approval'
    : card.viewerTodayStatus === 'skip'
    ? 'Grace skip used today'
    : card.remainingCheckIns > 0
    ? othersNeededTodayLabel
    : `${completionRate}% tapped in`;
  const actionVariant = isPendingMembership
    ? 'view'
    : !card.viewerHasCheckedIn
    ? 'check_in'
    : card.remainingCheckIns > 0
    ? 'nudge'
    : canShareInvite
    ? 'share'
    : 'view';
  const actionLabel =
    actionVariant === 'check_in'
      ? 'Tap In'
      : actionVariant === 'nudge'
      ? isNudging
        ? 'Nudging...'
        : isNudged
        ? 'Nudged'
        : `Nudge ${card.remainingCheckIns}`
      : actionVariant === 'share'
      ? 'Share'
      : 'View';

  return (
    <Pressable
      onPress={onCardPress}
      style={({pressed}) => [
        styles.cardPressable,
        {opacity: pressed ? 0.94 : 1},
      ]}>
      <GlassPanel style={styles.card}>
        <View style={styles.cardHeader}>
          <View style={styles.cardMeta}>
            <HoystChip
              label={card.category.toUpperCase()}
              tone={getCategoryTone(card.category)}
            />
            {isAlreadyTappedInLabel ? (
              <View style={styles.streakStatus}>
                <Check
                  color={theme.successForeground}
                  size={14}
                  strokeWidth={2.8}
                />
                <HoystText
                  style={{color: theme.successForeground}}
                  variant="caption">
                  {card.streakLabel}
                </HoystText>
              </View>
            ) : (
              <HoystText
                style={{color: theme.warningForeground}}
                variant="caption">
                {card.streakLabel}
              </HoystText>
            )}
          </View>
          <View
            style={[
              styles.completionBadge,
              {
                backgroundColor: `${progressTone}14`,
                borderColor: `${progressTone}55`,
              },
            ]}>
            <HoystText style={{color: progressTone}} variant="caption">
              {completionRate}%
            </HoystText>
          </View>
        </View>

        <View style={styles.cardCopy}>
          <HoystText style={styles.cardTitle}>{card.title}</HoystText>
          <HoystText tone="muted">{card.dailyTask}</HoystText>
          <HoystText tone="muted" variant="caption">
            {contextLabel}
          </HoystText>
        </View>

        <View style={styles.cardStats}>
          <HoystChip label={statusLabel} tone={statusTone} />
          <HoystText tone="muted" variant="caption">
            {card.memberCount}/{card.maxSize} members
          </HoystText>
          <HoystText tone="muted" variant="caption">
            {statsLabel}
          </HoystText>
        </View>

        <View style={styles.cardFooter}>
          <View style={styles.avatarRow}>
            {card.members.slice(0, 3).map((member, index) => (
              <View
                key={member.id}
                style={[
                  styles.avatarOffset,
                  index === 0 ? undefined : styles.avatarOverlap,
                ]}>
                <LayeredAvatar
                  initials={member.initials}
                  imageSource={member.avatarImage}
                  imageUrl={member.avatarUrl}
                  size={42}
                  state={member.state}
                />
              </View>
            ))}
            {card.members.length > 3 ? (
              <HoystText
                style={styles.moreCount}
                tone="muted"
                variant="caption">
                +{card.members.length - 3}
              </HoystText>
            ) : null}
          </View>

          <Pressable
            onPress={event => {
              event.stopPropagation();
              onActionPress();
            }}
            style={({pressed}) => [
              styles.previewButtonPressable,
              {
                opacity: pressed ? 0.92 : 1,
              },
            ]}>
            <View
              style={[
                styles.previewButton,
                {
                  backgroundColor: theme.surfaceHigh,
                  borderColor: theme.borderStrong,
                },
              ]}>
              <HoystText
                style={[
                  styles.previewButtonLabel,
                  {color: theme.actionForeground},
                ]}
                variant="button">
                {actionLabel}
              </HoystText>
            </View>
          </Pressable>
        </View>
      </GlassPanel>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  cardPressable: {
    borderRadius: radius.lg,
  },
  card: {
    minHeight: 210,
  },
  cardHeader: {
    alignItems: 'flex-start',
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  cardMeta: {
    alignItems: 'center',
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    maxWidth: '72%',
  },
  streakStatus: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 4,
  },
  completionBadge: {
    alignItems: 'center',
    borderRadius: radius.pill,
    borderWidth: 1,
    minWidth: 54,
    paddingHorizontal: 10,
    paddingVertical: 7,
  },
  cardCopy: {
    gap: 7,
  },
  cardTitle: {
    fontSize: 26,
    fontWeight: '800',
    letterSpacing: -0.4,
    lineHeight: 29,
  },
  cardStats: {
    alignItems: 'center',
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  cardFooter: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 12,
  },
  avatarRow: {
    alignItems: 'center',
    flexDirection: 'row',
    flex: 1,
    minWidth: 0,
  },
  avatarOffset: {
    borderRadius: radius.pill,
  },
  avatarOverlap: {
    marginLeft: -14,
  },
  moreCount: {
    fontSize: 14,
    fontWeight: '700',
    letterSpacing: -0.2,
    lineHeight: 16,
    marginLeft: 2,
  },
  previewButtonPressable: {
    flexShrink: 0,
  },
  previewButton: {
    alignItems: 'center',
    borderRadius: radius.pill,
    borderWidth: 1,
    justifyContent: 'center',
    minHeight: 48,
    minWidth: 116,
    paddingHorizontal: 18,
  },
  previewButtonLabel: {
    fontSize: 14,
    lineHeight: 18,
  },
});
