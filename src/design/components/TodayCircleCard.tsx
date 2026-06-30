import React from 'react';
import {
  Pressable,
  StyleSheet,
  useWindowDimensions,
  View,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
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
  getCircleCategoryVisual,
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

const ATTENTION_CARD_MAX_WIDTH = 300;
const ATTENTION_CARD_MIN_WIDTH = 284;
const ATTENTION_CARD_SIDE_INSET = 76;

type TodayCircleCardProps = {
  card: CircleManagementCard;
  isNudged?: boolean;
  isNudging?: boolean;
  onActionPress: () => void;
  onCardPress: () => void;
  surfaceStyle?: StyleProp<ViewStyle>;
  useCategoryTintGradient?: boolean;
  variant?: 'today' | 'active' | 'upcoming' | 'attention' | 'list';
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
  surfaceStyle,
  useCategoryTintGradient = false,
  variant = 'today',
}: TodayCircleCardProps): React.JSX.Element {
  const theme = useHoystTheme();
  const {width: windowWidth} = useWindowDimensions();
  const completionRate = card.completionRate ?? card.progressPercent;
  const clampedCompletionRate = Math.max(
    0,
    Math.min(100, Number.isFinite(completionRate) ? completionRate : 0),
  );
  const progressTone = getProgressTone(theme, completionRate);
  const categoryVisual = getCircleCategoryVisual(card.category);
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
  const attentionCardWidth = Math.min(
    ATTENTION_CARD_MAX_WIDTH,
    Math.max(ATTENTION_CARD_MIN_WIDTH, windowWidth - ATTENTION_CARD_SIDE_INSET),
  );
  const handleActionPress = () => {
    onActionPress();
  };
  const actionSlot =
    actionVariant === 'check_in' ? (
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
            style={[styles.previewButtonLabel, {color: theme.actionForeground}]}
            variant="button">
            {actionLabel}
          </HoystText>
        </View>
      </Pressable>
    );

  const attentionActionSlot =
    actionVariant === 'check_in' ? (
      <Pressable
        accessibilityLabel={actionLabel}
        accessibilityRole="button"
        onPress={event => {
          event.stopPropagation();
          handleActionPress();
        }}
        style={({pressed}) => [
          styles.attentionTapInPressable,
          {
            opacity: pressed ? actionMotion.pressedOpacity : 1,
            transform: [{scale: pressed ? actionMotion.pressedScale : 1}],
          },
        ]}
        testID="attention-tap-in-button">
        <View
          style={[
            styles.attentionTapInButton,
            {
              backgroundColor: categoryVisual.foregroundColor,
              shadowColor: categoryVisual.foregroundColor,
            },
          ]}>
          <HoystText style={styles.attentionTapInLabel} variant="button">
            {actionLabel}
          </HoystText>
          <ChevronRight
            color={theme.onPurpleAccent}
            size={18}
            strokeWidth={2.6}
          />
        </View>
      </Pressable>
    ) : (
      actionSlot
    );

  if (variant === 'attention') {
    const attentionCardBorder = theme.isDark
      ? `${categoryVisual.accentLight}2E`
      : theme.glassBorder;
    const attentionCardShadow = theme.glassShadow;
    const attentionPeriodCopy = getPeriodCopy(card);

    return (
      <Pressable
        onPress={onCardPress}
        style={({pressed}) => [
          styles.cardPressable,
          styles.attentionPressable,
          {width: attentionCardWidth},
          {opacity: pressed ? 0.94 : 1},
        ]}>
        <GlassPanel
          padding="none"
          style={[
            styles.attentionCard,
            {
              borderColor: attentionCardBorder,
              shadowColor: attentionCardShadow,
            },
            surfaceStyle,
            {width: attentionCardWidth},
          ]}>
          <View style={styles.attentionContent}>
            <View style={styles.attentionHeader}>
              <View style={styles.attentionTitleCluster}>
                <CircleCategoryIcon
                  category={card.category}
                  shape="roundedSquare"
                  size={36}
                  style={styles.categoryTitleIcon}
                />
                <View style={styles.attentionTitleCopy}>
                  <HoystText numberOfLines={1} style={styles.attentionTitle}>
                    {card.title}
                  </HoystText>
                  <HoystText
                    numberOfLines={1}
                    style={[styles.attentionCategory, {color: categoryColor}]}>
                    {categoryVisual.label.toUpperCase()}
                  </HoystText>
                </View>
              </View>
            </View>

            <View style={styles.attentionCopyStack}>
              <HoystText
                numberOfLines={1}
                style={styles.attentionDescription}
                tone="muted"
                variant="caption">
                {description}
              </HoystText>

              <HoystText
                numberOfLines={1}
                style={styles.attentionMetricText}
                tone="muted"
                variant="caption">
                {`${clampedCompletionRate}% complete ${attentionPeriodCopy}`}
              </HoystText>
            </View>

            <View
              style={[
                styles.attentionRailTrack,
                {backgroundColor: `${categoryVisual.accentColor}22`},
              ]}>
              <View
                style={[
                  styles.attentionRailFill,
                  {
                    backgroundColor: categoryColor,
                    width: `${clampedCompletionRate}%`,
                  },
                ]}
              />
            </View>

            <View style={styles.attentionFooter}>
              <AvatarPreview card={card} />
              <View style={styles.attentionActionSlot}>
                {attentionActionSlot}
              </View>
            </View>
          </View>
        </GlassPanel>
      </Pressable>
    );
  }

  if (variant === 'upcoming') {
    const upcomingSupportingCopy = getUpcomingSupportingCopy(card);
    const upcomingCardBorder = theme.isDark
      ? `${categoryVisual.accentLight}24`
      : theme.glassBorder;

    return (
      <Pressable
        onPress={onCardPress}
        style={({pressed}) => [
          styles.cardPressable,
          styles.upcomingPressable,
          {opacity: pressed ? 0.94 : 1},
        ]}>
        <GlassPanel
          padding={useCategoryTintGradient ? 'none' : 'compact'}
          style={[
            styles.upcomingCard,
            useCategoryTintGradient
              ? {
                  borderColor: upcomingCardBorder,
                  shadowColor: theme.glassShadow,
                }
              : undefined,
            surfaceStyle,
          ]}>
          <View
            style={
              useCategoryTintGradient
                ? styles.upcomingGradientContent
                : styles.upcomingContent
            }>
            <View style={styles.upcomingBody}>
              <CircleCategoryIcon
                category={card.category}
                shape="roundedSquare"
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
          </View>
        </GlassPanel>
      </Pressable>
    );
  }

  if (variant === 'list') {
    const listCardBorder = theme.isDark
      ? `${categoryVisual.accentLight}24`
      : theme.glassBorder;
    const listPrimaryMeta =
      card.viewerMembershipStatus === 'pending'
        ? 'Pending approval'
        : canTapInToday(card)
        ? (card.viewerRemainingTapIns ?? 0) > 0 &&
          card.commitmentCadence !== 'daily'
          ? getRemainingTapInsLabel(card.viewerRemainingTapIns ?? 0, card)
          : `Next tap ${getPeriodCopy(card)}`
        : card.state === 'done'
        ? 'Complete'
        : 'On track';
    const listMeta = (
      card.viewerMembershipStatus === 'pending'
        ? [listPrimaryMeta]
        : [
            listPrimaryMeta,
            shownUpCount > 0
              ? `${shownUpCount} companion${
                  shownUpCount === 1 ? '' : 's'
                } showed up`
              : undefined,
            `${clampedCompletionRate}%`,
          ]
    )
      .filter((part): part is string => Boolean(part))
      .join(' · ');

    return (
      <Pressable
        onPress={onCardPress}
        style={({pressed}) => [
          styles.cardPressable,
          {opacity: pressed ? 0.94 : 1},
        ]}>
        <GlassPanel
          padding="none"
          style={[
            styles.listCard,
            {borderColor: listCardBorder, shadowColor: theme.glassShadow},
            surfaceStyle,
          ]}>
          <View style={styles.listContent}>
            <View style={styles.listHeader}>
              <View style={styles.listTitleCluster}>
                <CircleCategoryIcon
                  category={card.category}
                  shape="roundedSquare"
                  size={38}
                  style={styles.categoryTitleIcon}
                />
                <View style={styles.listTitleCopy}>
                  <HoystText numberOfLines={1} style={styles.listTitle}>
                    {card.title}
                  </HoystText>
                  <HoystText
                    numberOfLines={1}
                    style={[styles.listCategory, {color: categoryColor}]}>
                    {categoryVisual.label.toUpperCase()}
                  </HoystText>
                </View>
              </View>
              <HoystChip density="compact" label={statusLabel} tone={statusTone} />
            </View>

            <HoystText
              numberOfLines={1}
              style={styles.listMeta}
              tone="muted"
              variant="caption">
              {listMeta}
            </HoystText>

            <View
              style={[
                styles.attentionRailTrack,
                {backgroundColor: `${categoryVisual.accentColor}22`},
              ]}>
              <View
                style={[
                  styles.attentionRailFill,
                  {
                    backgroundColor: categoryColor,
                    width: `${clampedCompletionRate}%`,
                  },
                ]}
              />
            </View>

            <View style={styles.attentionFooter}>
              <AvatarPreview card={card} />
              <View style={styles.attentionActionSlot}>
                {attentionActionSlot}
              </View>
            </View>
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
        <GlassPanel padding="compact" style={[styles.activeCard, surfaceStyle]}>
          <View style={styles.activeTitleRow}>
            <View style={styles.titleCluster}>
              <CircleCategoryIcon
                category={card.category}
                shape="roundedSquare"
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
      <GlassPanel style={[styles.todayCard, surfaceStyle]}>
        <View style={styles.todayBody}>
          <View style={styles.todayTitleRow}>
            <View style={styles.todayTitleCopy}>
              <View style={styles.titleCluster}>
                <CircleCategoryIcon
                  category={card.category}
                  shape="roundedSquare"
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

            <View style={styles.todayActionSlot}>{actionSlot}</View>
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
  upcomingContent: {
    gap: 12,
  },
  upcomingCopy: {
    gap: 4,
    minWidth: 0,
  },
  upcomingGradientContent: {
    gap: 12,
    overflow: 'hidden',
    padding: 16,
    position: 'relative',
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
  attentionPressable: {
    flexShrink: 0,
  },
  listCard: {
    borderRadius: 22,
  },
  listContent: {
    gap: 11,
    padding: 18,
  },
  listHeader: {
    alignItems: 'flex-start',
    flexDirection: 'row',
    gap: 10,
    justifyContent: 'space-between',
  },
  listTitleCluster: {
    alignItems: 'center',
    flex: 1,
    flexDirection: 'row',
    gap: 11,
    minWidth: 0,
  },
  listTitleCopy: {
    flex: 1,
    gap: 2,
    minWidth: 0,
  },
  listTitle: {
    fontSize: 17,
    fontWeight: '800',
    letterSpacing: 0,
    lineHeight: 21,
  },
  listCategory: {
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.6,
    lineHeight: 13,
  },
  listMeta: {
    fontSize: 13,
    fontWeight: '600',
    letterSpacing: 0,
    lineHeight: 17,
  },
  attentionCard: {
    elevation: 9,
    shadowOffset: {height: 10, width: 0},
    shadowOpacity: 0.13,
    shadowRadius: 22,
  },
  attentionContent: {
    gap: 10,
    overflow: 'hidden',
    padding: 16,
    position: 'relative',
  },
  attentionHeader: {
    alignItems: 'flex-start',
    flexDirection: 'row',
    gap: 8,
    justifyContent: 'space-between',
  },
  attentionTitleCluster: {
    alignItems: 'center',
    flex: 1,
    flexDirection: 'row',
    gap: 8,
    minWidth: 0,
  },
  attentionTitleCopy: {
    flex: 1,
    gap: 2,
    minWidth: 0,
  },
  attentionTitle: {
    flexShrink: 1,
    fontSize: 17,
    fontWeight: '800',
    letterSpacing: 0,
    lineHeight: 21,
    minWidth: 0,
  },
  attentionCategory: {
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 0.9,
    lineHeight: 15,
  },
  attentionCopyStack: {
    gap: 6,
    marginTop: 1,
  },
  attentionDescription: {
    fontSize: 14,
    fontWeight: '600',
    letterSpacing: 0,
    lineHeight: 18,
    minWidth: 0,
  },
  attentionMetricText: {
    fontSize: 14,
    fontWeight: '500',
    letterSpacing: 0,
    lineHeight: 18,
    minWidth: 0,
  },
  attentionRailTrack: {
    borderRadius: 4,
    height: 5,
    overflow: 'hidden',
    width: '100%',
  },
  attentionRailFill: {
    borderRadius: 4,
    height: 5,
  },
  attentionFooter: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 10,
    justifyContent: 'space-between',
    minHeight: 46,
  },
  attentionActionSlot: {
    alignItems: 'flex-end',
    flexShrink: 0,
    justifyContent: 'center',
    minHeight: 46,
  },
  attentionTapInButton: {
    alignItems: 'center',
    borderRadius: radius.pill,
    elevation: 6,
    flexDirection: 'row',
    gap: 4,
    justifyContent: 'center',
    minHeight: 42,
    minWidth: 112,
    paddingHorizontal: 18,
    shadowOffset: {height: 6, width: 0},
    shadowOpacity: 0.28,
    shadowRadius: 12,
  },
  attentionTapInLabel: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '800',
    lineHeight: 20,
  },
  attentionTapInPressable: {
    flexShrink: 0,
  },
});
