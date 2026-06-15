import React from 'react';
import {Pressable, StyleSheet, View} from 'react-native';
import {ChevronRight, UsersRound} from 'lucide-react-native';

import type {CircleManagementCard} from '../../types/models';
import {
  canTapInToday,
  getHomeCircleActionVariant,
  type HomeCircleActionVariant,
} from '../../features/home/services/home-circle-actions';
import {useHoystTheme} from '../theme/useHoystTheme';
import {actionMotion} from '../tokens/actions';
import {radius} from '../tokens/radius';
import {
  CircleCategoryIcon,
  CircleCategoryPill,
  getCircleCategoryForegroundColor,
} from './CircleCategoryIcon';
import {CircleCardTapInButton} from './CircleCardTapInButton';
import {GradientRing} from './GradientRing';
import {GlassPanel} from './GlassPanel';
import {HoystChip} from './HoystChip';
import {LayeredAvatar} from './LayeredAvatar';
import {HoystText} from './HoystText';
import {NudgeActionButton} from './NudgeActionButton';
import {getPulseRingStateForCircle} from './pulse-ring-state';

export type TodayCircleCardActionVariant = HomeCircleActionVariant;

type TodayCircleCardProps = {
  card: CircleManagementCard;
  isNudged?: boolean;
  isNudging?: boolean;
  onActionPress: () => void;
  onCardPress: () => void;
  variant?: 'today' | 'active' | 'upcoming';
};

function getPeriodCopy(card: CircleManagementCard) {
  if (card.commitmentCadence === 'monthly') {
    return 'this month';
  }

  return card.commitmentCadence === 'daily' ? 'today' : 'this week';
}

function getUpcomingPeriodCopy(card: CircleManagementCard) {
  if (card.commitmentCadence === 'monthly') {
    return 'this month';
  }

  return card.commitmentCadence === 'daily' ? 'tomorrow' : 'this week';
}

function getUpcomingPrimaryCopy(card: CircleManagementCard) {
  if (card.viewerMembershipStatus === 'pending') {
    return 'Pending approval';
  }

  return `Next tap ${getUpcomingPeriodCopy(card)}`;
}

function getUpcomingSupportingCopy(card: CircleManagementCard) {
  if (card.viewerMembershipStatus === 'pending') {
    return 'Approval needed before Tap In unlocks.';
  }

  const viewerRemainingTapIns = card.viewerRemainingTapIns ?? 0;

  if (viewerRemainingTapIns > 0) {
    return getRemainingTapInsLabel(viewerRemainingTapIns, card);
  }

  if (card.remainingCheckIns > 0 && card.commitmentCadence !== 'daily') {
    return `Circle still moving ${getUpcomingPeriodCopy(card)}`;
  }

  return undefined;
}

function getRemainingTapInsLabel(count: number, card: CircleManagementCard) {
  const periodCopy = getPeriodCopy(card);

  return count === 1
    ? `1 Tap In left ${periodCopy}`
    : `${count} Tap Ins left ${periodCopy}`;
}

function getProgressStatLabel(
  card: CircleManagementCard,
  completionRate: number,
) {
  const periodCopy = getPeriodCopy(card);

  return `${completionRate}% tapped-in ${periodCopy}`;
}

export const getTodayCircleCardActionVariant = getHomeCircleActionVariant;

function getActionLabel({
  actionVariant,
  card,
  isNudged,
  isNudging,
}: {
  actionVariant: TodayCircleCardActionVariant;
  card: CircleManagementCard;
  isNudged: boolean;
  isNudging: boolean;
}) {
  if (actionVariant === 'check_in') {
    return 'Tap In';
  }

  if (actionVariant === 'nudge') {
    if (isNudging) {
      return 'Nudging...';
    }

    if (isNudged) {
      return 'Nudged';
    }

    return `Nudge ${card.nudgeTargetCount ?? 0}`;
  }

  if (actionVariant === 'share') {
    return 'Share';
  }

  return 'View';
}

function getStatusLabel(card: CircleManagementCard) {
  if (card.viewerMembershipStatus === 'pending') {
    return 'Pending';
  }

  if (card.viewerTodayStatus === 'skip') {
    return 'Skipped';
  }

  if (canTapInToday(card)) {
    return card.viewerHasCheckedIn ? 'Tap Today' : 'Needs You';
  }

  if (!card.viewerHasCheckedIn) {
    return 'Tapped Today';
  }

  return card.remainingCheckIns > 0 ? 'Others Needed' : 'Complete';
}

function getStatusTone(
  statusLabel: string,
): React.ComponentProps<typeof HoystChip>['tone'] {
  if (
    statusLabel === 'Complete' ||
    statusLabel === 'Tapped Today' ||
    statusLabel === 'Tap Today'
  ) {
    return 'green';
  }

  if (statusLabel === 'Others Needed') {
    return 'yellow';
  }

  if (statusLabel === 'Needs You' || statusLabel === 'Skipped') {
    return 'orange';
  }

  return 'purple';
}

function getProgressTone(
  theme: ReturnType<typeof useHoystTheme>,
  completionRate: number,
) {
  return completionRate >= 85
    ? theme.successForeground
    : completionRate >= 75
    ? theme.accentSecondaryForeground
    : theme.warningForeground;
}

function AvatarPreview({card}: {card: CircleManagementCard}) {
  return (
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
            size={36}
            state={member.state}
          />
        </View>
      ))}
      {card.members.length > 3 ? (
        <View style={styles.moreCountBubble}>
          <HoystText style={styles.moreCount} tone="muted" variant="caption">
            +{card.members.length - 3}
          </HoystText>
        </View>
      ) : null}
    </View>
  );
}

export function TodayCircleCard({
  card,
  isNudged = false,
  isNudging = false,
  onActionPress,
  onCardPress,
  variant = 'today',
}: TodayCircleCardProps): React.JSX.Element {
  const theme = useHoystTheme();
  const completionRate = card.completionRate ?? card.progressPercent;
  const progressTone = getProgressTone(theme, completionRate);
  const categoryColor = getCircleCategoryForegroundColor(card.category, theme);
  const statusLabel = getStatusLabel(card);
  const statusTone = getStatusTone(statusLabel);
  const othersNeededLabel = getRemainingTapInsLabel(
    card.remainingCheckIns,
    card,
  );
  const viewerNeededLabel = getRemainingTapInsLabel(
    card.viewerRemainingTapIns ?? 0,
    card,
  );
  const fallbackContextLabel =
    card.viewerMembershipStatus === 'pending'
      ? 'Pending approval before Tap In unlocks.'
      : canTapInToday(card)
      ? card.viewerHasCheckedIn
        ? 'Commitment complete, Tap In today'
        : undefined
      : !card.viewerHasCheckedIn
      ? card.viewerHasTappedInToday
        ? viewerNeededLabel
        : undefined
      : card.remainingCheckIns > 0
      ? othersNeededLabel
      : 'Commitment complete';
  const description = card.matchCopy ?? card.commitment;
  const supportingLabel = card.matchCopy
    ? card.commitment
    : fallbackContextLabel;
  const statsLabel =
    card.viewerMembershipStatus === 'pending'
      ? 'Awaiting approval'
      : card.viewerTodayStatus === 'skip'
      ? 'Grace skip used today'
      : card.remainingCheckIns > 0
      ? othersNeededLabel
      : card.progressLabel ?? `${completionRate}% tapped in`;
  const progressLabel = card.progressLabel ?? `${completionRate}%`;
  const progressStatLabel = getProgressStatLabel(card, completionRate);
  const shownUpCount = card.members.filter(
    member => member.state === 'done',
  ).length;
  const shownUpLabel =
    shownUpCount === 1
      ? '1 companion already showed up'
      : `${shownUpCount} companions already showed up`;
  const actionVariant = getTodayCircleCardActionVariant(card);
  const actionLabel = getActionLabel({
    actionVariant,
    card,
    isNudged,
    isNudging,
  });
  const pulseRingState = getPulseRingStateForCircle(card);
  const handleActionPress = () => {
    onActionPress();
  };

  if (variant === 'upcoming') {
    const upcomingSupportingCopy = getUpcomingSupportingCopy(card);

    return (
      <Pressable
        onPress={onCardPress}
        style={({pressed}) => [
          styles.cardPressable,
          styles.upcomingPressable,
          {opacity: pressed ? 0.94 : 1},
        ]}>
        <GlassPanel padding="compact" style={styles.upcomingCard}>
          <View style={styles.upcomingBody}>
            <CircleCategoryIcon
              category={card.category}
              size={52}
              style={styles.categoryTitleIcon}
            />
            <View style={styles.upcomingCopy}>
              <HoystText numberOfLines={2} style={styles.upcomingTitle}>
                {card.title}
              </HoystText>
              <HoystText tone="muted" variant="caption">
                {getUpcomingPrimaryCopy(card)}
              </HoystText>
              {upcomingSupportingCopy ? (
                <HoystText numberOfLines={2} tone="muted" variant="caption">
                  {upcomingSupportingCopy}
                </HoystText>
              ) : null}
            </View>
          </View>
          <View style={styles.upcomingArrowWrap}>
            <ChevronRight
              color={theme.accentForeground}
              size={22}
              strokeWidth={2.4}
            />
          </View>
        </GlassPanel>
      </Pressable>
    );
  }

  if (variant === 'active') {
    return (
      <Pressable
        onPress={onCardPress}
        style={({pressed}) => [
          styles.cardPressable,
          {opacity: pressed ? 0.94 : 1},
        ]}>
        <GlassPanel padding="compact" style={styles.activeCard}>
          <View style={styles.activeTitleRow}>
            <View style={styles.titleCluster}>
              <CircleCategoryIcon
                category={card.category}
                size={30}
                style={styles.categoryTitleIcon}
              />
              <HoystText numberOfLines={1} style={styles.activeTitle}>
                {card.title}
              </HoystText>
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
                {progressLabel}
              </HoystText>
            </View>
          </View>

          <View style={styles.activeCopy}>
            <CircleCategoryPill category={card.category} />
            <HoystText numberOfLines={2} tone="muted" variant="caption">
              {description}
            </HoystText>
          </View>

          <View style={styles.activeFooter}>
            <HoystText tone="muted" variant="caption">
              {statusLabel === 'Complete' ? 'All covered' : statsLabel}
            </HoystText>
            <ChevronRight
              color={theme.accentForeground}
              size={22}
              strokeWidth={2.4}
            />
          </View>
        </GlassPanel>
      </Pressable>
    );
  }

  return (
    <Pressable
      onPress={onCardPress}
      style={({pressed}) => [
        styles.cardPressable,
        {opacity: pressed ? 0.94 : 1},
      ]}>
      <GlassPanel style={styles.todayCard}>
        <View style={styles.todayBody}>
          <View style={styles.todayTitleRow}>
            <View style={styles.todayTitleCopy}>
              <View style={styles.titleCluster}>
                <CircleCategoryIcon
                  category={card.category}
                  size={34}
                  style={styles.categoryTitleIcon}
                />
                <HoystText style={styles.todayTitle}>{card.title}</HoystText>
              </View>
            </View>
          </View>

          <View style={styles.todayMetaRow}>
            <CircleCategoryPill category={card.category} />
            <HoystChip label={statusLabel} tone={statusTone} />
          </View>

          <HoystText numberOfLines={2} tone="muted">
            {description}
          </HoystText>
          {supportingLabel ? (
            <HoystText tone="muted" variant="caption">
              {supportingLabel}
            </HoystText>
          ) : null}

          <View style={styles.todayStats}>
            <View style={styles.statRow}>
              <UsersRound color={categoryColor} size={17} strokeWidth={2.4} />
              <HoystText tone="muted" variant="caption">
                {shownUpLabel}
              </HoystText>
            </View>
            <View style={styles.statRow}>
              <GradientRing
                flatColor={categoryColor}
                progress={completionRate / 100}
                size={18}
                strokeWidth={3}
                trackColor={theme.ring}
              />
              <HoystText tone="muted" variant="caption">
                {progressStatLabel}
              </HoystText>
            </View>
          </View>

          <View style={styles.todayFooter}>
            <AvatarPreview card={card} />

            <View style={styles.todayActionSlot}>
              {actionVariant === 'check_in' ? (
                <CircleCardTapInButton
                  label={actionLabel}
                  onPress={event => {
                    event.stopPropagation();
                    handleActionPress();
                  }}
                  ringState={pulseRingState}
                />
              ) : actionVariant === 'nudge' ? (
                <NudgeActionButton
                  isLoading={isNudging}
                  isSent={isNudged}
                  label={actionLabel}
                  onPress={event => {
                    event.stopPropagation();
                    handleActionPress();
                  }}
                  size="card"
                  targetCount={card.nudgeTargetCount ?? 0}
                />
              ) : (
                <Pressable
                  onPress={event => {
                    event.stopPropagation();
                    handleActionPress();
                  }}
                  style={({pressed}) => [
                    styles.previewButtonPressable,
                    {
                      opacity: pressed ? actionMotion.pressedOpacity : 1,
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
              )}
            </View>
          </View>
        </View>
      </GlassPanel>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  activeCard: {
    minHeight: 174,
  },
  activeCopy: {
    gap: 7,
  },
  activeFooter: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 8,
    justifyContent: 'space-between',
  },
  activeTitle: {
    flexShrink: 1,
    fontSize: 17,
    fontWeight: '800',
    lineHeight: 21,
    minWidth: 0,
  },
  activeTitleRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 10,
    justifyContent: 'space-between',
  },
  avatarOffset: {
    borderRadius: radius.pill,
  },
  avatarOverlap: {
    marginLeft: -13,
  },
  avatarRow: {
    alignItems: 'center',
    flex: 1,
    flexDirection: 'row',
    marginLeft: -7,
    minWidth: 0,
  },
  cardPressable: {
    borderRadius: radius.lg,
  },
  categoryTitleIcon: {
    flexShrink: 0,
  },
  completionBadge: {
    alignItems: 'center',
    borderRadius: radius.pill,
    borderWidth: 1,
    flexShrink: 0,
    minWidth: 54,
    paddingHorizontal: 10,
    paddingVertical: 7,
  },
  moreCount: {
    fontSize: 14,
    fontWeight: '700',
    letterSpacing: 0,
    lineHeight: 16,
  },
  moreCountBubble: {
    alignItems: 'center',
    backgroundColor: 'rgba(108,116,140,0.12)',
    borderRadius: radius.pill,
    height: 36,
    justifyContent: 'center',
    marginLeft: -13,
    width: 36,
  },
  previewButton: {
    alignItems: 'center',
    borderRadius: radius.pill,
    borderWidth: 1,
    justifyContent: 'center',
    minHeight: 48,
    minWidth: 104,
    paddingHorizontal: 18,
  },
  previewButtonLabel: {
    fontSize: 14,
    lineHeight: 18,
  },
  previewButtonPressable: {
    flexShrink: 0,
  },
  statRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 9,
  },
  todayBody: {
    alignSelf: 'stretch',
    flex: 1,
    gap: 10,
    minWidth: 0,
  },
  todayActionSlot: {
    alignItems: 'flex-end',
    flexShrink: 0,
    height: 48,
    justifyContent: 'center',
    width: 150,
  },
  todayCard: {
    minHeight: 244,
  },
  todayFooter: {
    alignItems: 'center',
    alignSelf: 'stretch',
    flexDirection: 'row',
    gap: 10,
    justifyContent: 'flex-start',
    minHeight: 48,
  },
  todayMetaRow: {
    alignItems: 'center',
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  todayStats: {
    gap: 8,
  },
  upcomingArrowWrap: {
    alignItems: 'flex-end',
  },
  upcomingBody: {
    flex: 1,
    gap: 10,
    minWidth: 0,
  },
  upcomingCard: {
    minHeight: 154,
    width: 180,
  },
  upcomingCopy: {
    gap: 4,
    minWidth: 0,
  },
  upcomingPressable: {
    width: 180,
  },
  upcomingTitle: {
    fontSize: 16,
    fontWeight: '800',
    letterSpacing: 0,
    lineHeight: 20,
  },
  todayTitle: {
    fontSize: 22,
    fontWeight: '800',
    letterSpacing: 0,
    lineHeight: 26,
  },
  todayTitleCopy: {
    flex: 1,
    minWidth: 0,
  },
  todayTitleRow: {
    alignItems: 'flex-start',
    flexDirection: 'row',
    gap: 10,
    justifyContent: 'space-between',
  },
  titleCluster: {
    alignItems: 'center',
    flex: 1,
    flexDirection: 'row',
    gap: 8,
    minWidth: 0,
  },
});
