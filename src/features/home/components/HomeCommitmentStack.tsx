import {CircleCardStreaks} from '../../circles/components/CircleCardStreaks';
import React from 'react';
import {ActivityIndicator, Pressable, StyleSheet, View} from 'react-native';
import {Check, Clock3, Minus, Target} from 'lucide-react-native';
import type {CircleManagementCard} from '../../../types/models';
import {useHoystTheme} from '../../../design/theme/useHoystTheme';
import {getCircleCategoryForegroundColor} from '../../../design/components/CircleCategoryIcon';
import {HoystText} from '../../../design/components/HoystText';
import {LayeredAvatar} from '../../../design/components/LayeredAvatar';
import {homeTypography} from '../../../design/tokens/home';
import {
  CommitmentCardHeader,
  CommitmentCardSurface,
  getCommitmentCardColors,
} from '../../../design/components/CommitmentCardSurface';
import {getHomeDailyAction} from '../services/home-daily-actions';
import {getCommitmentGoalPresentation} from '../../commitments/commitment-goal-label';
import {getCircleCycleProgressPresentation} from '../../commitments/cycle-progress-presentation';

export const HOME_ROW_ICON_SIZE = 32;
export const HOME_ROW_GAP = 12;

type Props = {
  cards: readonly CircleManagementCard[];
  isNudged: (circleId: string) => boolean;
  isNudging: (circleId: string) => boolean;
  onActionPress: (card: CircleManagementCard) => void;
  onViewDetails: (circleId: string) => void;
  renderBelowCard?: (card: CircleManagementCard) => React.ReactNode;
};

function statusCopy(card: CircleManagementCard) {
  switch (getHomeDailyAction(card)) {
    case 'tap_in':
      return 'Needs your Tap In';
    case 'nudge':
      return `${card.nudgeTargetCount} member${
        card.nudgeTargetCount === 1 ? '' : 's'
      } need${card.nudgeTargetCount === 1 ? 's' : ''} a nudge`;
    case 'pending':
      return 'Pending approval';
    case 'complete':
      return card.circleMode !== 'personal' && card.viewerHasNudgedToday
        ? card.viewerHasTappedInToday
          ? 'Tap In and Nudge handled'
          : 'Nudged today'
        : 'Tapped in today';
    default:
      return 'No action needed today';
  }
}

function Action({
  card,
  prominent,
  busy,
  onPress,
}: {
  card: CircleManagementCard;
  prominent?: boolean;
  busy: boolean;
  onPress: () => void;
}) {
  const theme = useHoystTheme();
  const action = getHomeDailyAction(card);
  const color = getCircleCategoryForegroundColor(
    card.category,
    theme,
    card.appearance,
  );
  if (action !== 'tap_in' && action !== 'nudge') {
    return (
      <View
        accessible
        accessibilityLabel={statusCopy(card)}
        style={styles.done}
        testID={`home-commitment-done-${card.id}`}>
        {action === 'view' ? (
          <Minus color={theme.textMuted} size={20} />
        ) : action === 'pending' ? (
          <Clock3 color={theme.textMuted} size={20} />
        ) : (
          <Check color={theme.textMuted} size={20} />
        )}
        <HoystText style={styles.meta} tone="muted">
          {statusCopy(card)}
        </HoystText>
      </View>
    );
  }
  const label = action === 'tap_in' ? 'Tap In' : 'Nudge';
  const actionBackground = prominent ? color : 'transparent';
  const actionOpacity = busy ? 0.65 : 1;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${label} for ${card.title}`}
      accessibilityState={{disabled: busy, busy}}
      disabled={busy}
      onPress={event => {
        event?.stopPropagation();
        onPress();
      }}
      style={styles.actionTarget}
      testID={`home-commitment-action-${card.id}`}>
      <View
        style={[
          styles.action,
          {
            backgroundColor: actionBackground,
            borderColor: color,
            opacity: actionOpacity,
          },
        ]}>
        {busy ? (
          <ActivityIndicator
            size="small"
            color={prominent ? (theme.isDark ? '#121212' : '#FFFFFF') : color}
          />
        ) : (
          <HoystText
            style={[
              styles.actionLabel,
              {
                color: prominent
                  ? theme.isDark
                    ? '#121212'
                    : '#FFFFFF'
                  : color,
              },
            ]}>
            {label}
          </HoystText>
        )}
      </View>
    </Pressable>
  );
}

function Members({card}: {card: CircleManagementCard}) {
  const progress = getCircleCycleProgressPresentation(card);
  return (
    <View style={styles.members}>
      {card.circleMode !== 'personal' && (
        <View style={styles.avatars}>
          {card.members.slice(0, 2).map((member, i) => (
            <View key={member.id} style={i ? styles.avatarOverlap : undefined}>
              <LayeredAvatar
                chrome="minimal"
                initials={member.initials}
                imageSource={member.avatarImage}
                imageUrl={member.avatarUrl}
                size={24}
                state={member.state}
              />
            </View>
          ))}
        </View>
      )}
      <HoystText style={styles.meta} tone="muted">
        {progress.listLabel}
      </HoystText>
    </View>
  );
}

export function HomeCommitmentStack({
  cards,
  isNudging,
  onActionPress,
  onViewDetails,
  renderBelowCard,
}: Props) {
  const theme = useHoystTheme();
  return (
    <View style={styles.list} testID="home-commitments-stack">
      {cards.map(card => {
        const colors = getCommitmentCardColors(
          card.category,
          card.appearance,
          theme.isDark,
        );
        const goal = getCommitmentGoalPresentation(card);
        const action = getHomeDailyAction(card);
        return (
          <View key={card.id} style={styles.cardGroup}>
            <CommitmentCardSurface
              colors={colors}
              testID={`home-commitment-card-${card.id}`}
              footer={
                <View style={styles.footer}>
                  <View
                    style={[
                      styles.memberCopy,
                      action !== 'tap_in' &&
                        action !== 'nudge' &&
                        styles.statusMemberCopy,
                    ]}>
                    <Members card={card} />
                    {action === 'nudge' ? (
                      <HoystText style={styles.meta} tone="muted">
                        {statusCopy(card)}
                      </HoystText>
                    ) : null}
                  </View>
                  <Action
                    card={card}
                    prominent
                    busy={isNudging(card.id)}
                    onPress={() => onActionPress(card)}
                  />
                </View>
              }>
              <CommitmentCardHeader
                title={card.title}
                category={card.category}
                appearance={card.appearance}
                colors={colors}
                onPress={() => onViewDetails(card.id)}
                testID={`home-commitment-details-${card.id}`}
              />
              <Pressable
                accessible={false}
                onPress={() => onViewDetails(card.id)}
                style={styles.descriptionGroup}>
                <HoystText style={styles.description} tone="muted">
                  {card.commitment}
                </HoystText>
                {goal ? (
                  <View
                    style={styles.goalLine}
                    testID={`home-commitment-goal-${card.id}`}>
                    <Target
                      accessible={false}
                      color={colors.muted}
                      size={14}
                      strokeWidth={2.2}
                      style={styles.goalIcon}
                    />
                    <HoystText
                      style={[styles.meta, styles.goalText]}
                      tone="muted">
                      {goal.label}
                    </HoystText>
                    <HoystText
                      style={[styles.meta, styles.goalText]}
                      tone="muted">
                      {goal.label === 'Goal' ? ': ' : ' · '}
                    </HoystText>
                    <HoystText
                      style={[styles.meta, styles.goalText]}
                      tone="muted">
                      {goal.value}
                    </HoystText>
                  </View>
                ) : null}
              </Pressable>
              <CircleCardStreaks circle={card} />
            </CommitmentCardSurface>
            {renderBelowCard?.(card)}
          </View>
        );
      })}
    </View>
  );
}
const styles = StyleSheet.create({
  list: {gap: 16},
  cardGroup: {gap: 0},
  description: homeTypography.body,
  descriptionGroup: {gap: 4, minHeight: 20},
  goalLine: {alignItems: 'center', flexDirection: 'row', flexWrap: 'wrap'},
  goalIcon: {marginRight: 3},
  goalText: {fontWeight: '600'},
  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    flexWrap: 'wrap',
  },
  memberCopy: {flexGrow: 1, flexShrink: 1, flexBasis: 140, gap: 4},
  statusMemberCopy: {flexBasis: 100},
  members: {minWidth: 0, flexDirection: 'row', alignItems: 'center', gap: 8},
  avatars: {flexDirection: 'row'},
  avatarOverlap: {marginLeft: -6},
  meta: {...homeTypography.secondary, flexShrink: 1},
  actionTarget: {minHeight: 48, minWidth: 80, justifyContent: 'center'},
  action: {
    minWidth: 80,
    minHeight: 36,
    borderRadius: 18,
    borderWidth: 1.5,
    paddingHorizontal: 16,
    justifyContent: 'center',
    alignItems: 'center',
  },
  actionLabel: {...homeTypography.action, fontSize: 14, lineHeight: 20},
  done: {
    minHeight: 48,
    flexDirection: 'row',
    alignItems: 'center',
    flexShrink: 1,
    gap: 8,
  },
});
