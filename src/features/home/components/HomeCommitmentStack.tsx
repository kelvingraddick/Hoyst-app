import React from 'react';
import {Pressable, StyleSheet, View} from 'react-native';
import {Check, ChevronRight, Clock3} from 'lucide-react-native';

import type {CircleManagementCard} from '../../../types/models';
import {
  canTapInToday,
  getHomeCircleActionVariant,
} from '../services/home-circle-actions';
import {useHoystTheme} from '../../../design/theme/useHoystTheme';
import {actionMotion, touchTarget} from '../../../design/tokens/actions';
import {brandColors} from '../../../design/tokens/colors';
import {radius} from '../../../design/tokens/radius';
import {
  CircleCategoryIcon,
  getCircleCategoryForegroundColor,
  getCircleCategoryVisual,
} from '../../../design/components/CircleCategoryIcon';
import {HoystText} from '../../../design/components/HoystText';
import {LayeredAvatar} from '../../../design/components/LayeredAvatar';
import {NudgeActionButton} from '../../../design/components/NudgeActionButton';

type HomeCommitmentStackProps = {
  cards: readonly CircleManagementCard[];
  focusedCardId?: string;
  isNudged: (circleId: string) => boolean;
  isNudging: (circleId: string) => boolean;
  onActionPress: (card: CircleManagementCard) => void;
  onFocusCard: (circleId: string) => void;
  onViewDetails: (circleId: string) => void;
};

const DARK_HOME_CANVAS_COLOR = '#121212';
const FOCUSED_STACK_SURFACE_OPACITY = 0x31 / 255;
const COLLAPSED_STACK_SURFACE_OPACITY = 0x26 / 255;

function getOpaqueDarkStackSurface(accentColor: string, opacity: number) {
  const foregroundChannels = [0, 2, 4].map(index =>
    Number.parseInt(accentColor.slice(index + 1, index + 3), 16),
  );
  const backgroundChannels = [0, 2, 4].map(index =>
    Number.parseInt(DARK_HOME_CANVAS_COLOR.slice(index + 1, index + 3), 16),
  );
  const channels = foregroundChannels.map((channel, index) =>
    Math.round(channel * opacity + backgroundChannels[index] * (1 - opacity)),
  );

  return `#${channels
    .map(channel => channel.toString(16).padStart(2, '0'))
    .join('')}`;
}

function getPeriodCopy(card: CircleManagementCard) {
  if (card.commitmentCadence === 'monthly') {
    return 'this month';
  }

  return card.commitmentCadence === 'daily' ? 'today' : 'this week';
}

function getStatusCopy(card: CircleManagementCard) {
  const actionVariant = getHomeCircleActionVariant(card);

  if (card.viewerMembershipStatus === 'pending') {
    return 'Pending approval';
  }

  if (actionVariant === 'nudge') {
    const count = card.nudgeTargetCount ?? 0;
    return count === 1
      ? '1 member needs a nudge'
      : `${count} members need a nudge`;
  }

  if (card.viewerHasTappedInToday) {
    return card.state === 'done' ? 'Complete today' : 'Tapped in today';
  }

  if (canTapInToday(card)) {
    return 'Needs your Tap In';
  }

  if (card.commitmentCadence === 'daily') {
    return 'Next tap tomorrow';
  }

  return `Next tap ${getPeriodCopy(card)}`;
}

function getCheckAccessibilityLabel(card: CircleManagementCard) {
  if (card.viewerMembershipStatus === 'pending') {
    return `Pending approval for ${card.title}`;
  }

  const canUpdate = getHomeCircleActionVariant(card) === 'check_in';

  if (card.viewerHasTappedInToday) {
    return canUpdate
      ? `Update Tap In for ${card.title}`
      : `${card.title} tapped in today`;
  }

  return canUpdate
    ? `Tap In for ${card.title}`
    : `${card.title} has not been tapped in today`;
}

function getContextCopy(card: CircleManagementCard) {
  if (card.circleMode === 'personal') {
    return 'Personal commitment';
  }

  const completedCount = card.members.filter(
    member => member.state === 'done',
  ).length;
  const memberCount = Math.max(card.memberCount, card.members.length);

  if (memberCount <= 0) {
    return 'Circle';
  }

  return `${completedCount}/${memberCount} members tapped in`;
}

function getNudgeLabel(card: CircleManagementCard) {
  const count = card.nudgeTargetCount ?? 0;
  return count === 1 ? 'Nudge 1' : `Nudge ${count}`;
}

function getStackCardSurfaceStyle(
  theme: ReturnType<typeof useHoystTheme>,
  visual: ReturnType<typeof getCircleCategoryVisual>,
  isFocused: boolean,
) {
  return {
    backgroundColor: theme.isDark
      ? getOpaqueDarkStackSurface(
          visual.accentColor,
          isFocused
            ? FOCUSED_STACK_SURFACE_OPACITY
            : COLLAPSED_STACK_SURFACE_OPACITY,
        )
      : visual.backplateColor,
    borderColor: theme.isDark ? '#121212' : '#FAFAF7',
  };
}

function CompletionControl({
  card,
  compact = false,
  onPress,
}: {
  card: CircleManagementCard;
  compact?: boolean;
  onPress?: () => void;
}): React.JSX.Element {
  const theme = useHoystTheme();
  const checked = Boolean(card.viewerHasTappedInToday);
  const isPending = card.viewerMembershipStatus === 'pending';
  const isActionable = getHomeCircleActionVariant(card) === 'check_in';
  const isDisabled = !isActionable;
  const indicatorSize = 30;
  const tapInPillWidth = 64;
  const iconSize = 16;
  const categoryColor = getCircleCategoryForegroundColor(card.category, theme);
  const showsTapInPill = !checked && isActionable;
  const indicatorWidth = showsTapInPill ? tapInPillWidth : indicatorSize;
  const check = (
    <View
      testID={`home-commitment-check-indicator-${card.id}`}
      style={[
        styles.check,
        checked ? styles.checkFilled : undefined,
        isPending ? styles.pendingClock : undefined,
        showsTapInPill ? styles.tapInPill : undefined,
        {
          borderColor: checked
            ? theme.success
            : showsTapInPill
            ? categoryColor
            : theme.textMuted,
          borderRadius: showsTapInPill ? radius.pill : indicatorSize / 2,
          height: indicatorSize,
          width: indicatorWidth,
        },
      ]}>
      {checked ? (
        <Check color="#FFFFFF" size={iconSize} strokeWidth={3} />
      ) : showsTapInPill ? (
        <HoystText
          style={[styles.tapInPillLabel, {color: categoryColor}]}
          variant="tiny">
          TAP IN
        </HoystText>
      ) : isPending ? (
        <Clock3 color={theme.textMuted} size={20} strokeWidth={2.2} />
      ) : null}
    </View>
  );

  if (compact) {
    return (
      <View
        accessible={false}
        pointerEvents="none"
        style={[
          styles.checkPressable,
          {height: indicatorSize, width: indicatorWidth},
        ]}
        testID={`home-commitment-check-${card.id}`}>
        {check}
      </View>
    );
  }

  return (
    <Pressable
      accessibilityLabel={getCheckAccessibilityLabel(card)}
      accessibilityRole={isPending ? 'image' : 'checkbox'}
      accessibilityState={
        isPending ? {disabled: true} : {checked, disabled: isDisabled}
      }
      disabled={isDisabled}
      hitSlop={7}
      onPress={isActionable ? onPress : undefined}
      style={({pressed}) => [
        styles.checkPressable,
        {
          borderRadius: touchTarget.minimum / 2,
          height: touchTarget.minimum,
          opacity: isDisabled ? (checked ? 1 : 0.56) : pressed ? 0.82 : 1,
          transform: [
            {scale: pressed && !isDisabled ? actionMotion.pressedScale : 1},
          ],
          width: Math.max(touchTarget.minimum, indicatorWidth),
        },
      ]}
      testID={`home-commitment-check-${card.id}`}>
      {check}
    </Pressable>
  );
}

function CircleContext({card}: {card: CircleManagementCard}) {
  const theme = useHoystTheme();
  const categoryColor = getCircleCategoryForegroundColor(card.category, theme);

  if (card.circleMode === 'personal') {
    return (
      <View
        style={[styles.personalPill, {backgroundColor: `${categoryColor}1A`}]}>
        <HoystText style={[styles.personalPillLabel, {color: categoryColor}]}>
          PERSONAL
        </HoystText>
      </View>
    );
  }

  return (
    <View style={styles.circleContext}>
      <View style={styles.avatarRow}>
        {card.members.slice(0, 3).map((member, index) => (
          <View
            key={member.id}
            style={index === 0 ? undefined : styles.avatarOverlap}>
            <LayeredAvatar
              chrome="minimal"
              initials={member.initials}
              imageSource={member.avatarImage}
              imageUrl={member.avatarUrl}
              size={32}
              state={member.state}
            />
          </View>
        ))}
      </View>
    </View>
  );
}

function CollapsedCommitmentCard({
  card,
  onFocus,
}: {
  card: CircleManagementCard;
  onFocus: () => void;
}): React.JSX.Element {
  const theme = useHoystTheme();
  const visual = getCircleCategoryVisual(card.category);
  const categoryColor = getCircleCategoryForegroundColor(card.category, theme);

  return (
    <Pressable
      accessibilityLabel={`Focus ${card.title}`}
      accessibilityRole="button"
      onPress={onFocus}
      style={({pressed}) => [
        styles.collapsedPressable,
        {opacity: pressed ? actionMotion.pressedOpacity : 1},
      ]}
      testID={`home-commitment-collapsed-${card.id}`}>
      <View
        style={[
          styles.collapsedCard,
          getStackCardSurfaceStyle(theme, visual, false),
        ]}
        testID={`home-commitment-collapsed-surface-${card.id}`}>
        <CircleCategoryIcon
          category={card.category}
          showBackplate={false}
          size={24}
        />
        <View style={styles.collapsedCopy}>
          <HoystText numberOfLines={1} style={styles.collapsedTitle}>
            {card.title}
          </HoystText>
          <HoystText
            numberOfLines={1}
            style={[styles.collapsedStatus, {color: categoryColor}]}
            variant="caption">
            {getStatusCopy(card)}
          </HoystText>
        </View>
        <CompletionControl card={card} compact />
      </View>
    </Pressable>
  );
}

function FocusedCommitmentCard({
  card,
  isNudged,
  isNudging,
  onActionPress,
  onViewDetails,
}: {
  card: CircleManagementCard;
  isNudged: boolean;
  isNudging: boolean;
  onActionPress: () => void;
  onViewDetails: () => void;
}): React.JSX.Element {
  const theme = useHoystTheme();
  const visual = getCircleCategoryVisual(card.category);
  const categoryColor = getCircleCategoryForegroundColor(card.category, theme);
  const actionVariant = getHomeCircleActionVariant(card);
  const progress = Math.max(
    0,
    Math.min(100, card.completionRate ?? card.progressPercent),
  );

  return (
    <View
      style={[
        styles.focusedCard,
        getStackCardSurfaceStyle(theme, visual, true),
      ]}
      testID={`home-commitment-focused-${card.id}`}>
      <View style={styles.focusedHeader}>
        <View style={styles.focusedTitleCluster}>
          <CircleCategoryIcon
            category={card.category}
            showBackplate={false}
            size={32}
          />
          <View style={styles.focusedTitleCopy}>
            <HoystText numberOfLines={2} style={styles.focusedTitle}>
              {card.title}
            </HoystText>
            <HoystText
              style={[styles.focusedCategory, {color: categoryColor}]}
              variant="caption">
              {card.circleMode === 'personal'
                ? 'PERSONAL COMMITMENT'
                : visual.label.toUpperCase()}
            </HoystText>
          </View>
        </View>
        <CompletionControl card={card} onPress={onActionPress} />
      </View>

      <HoystText numberOfLines={2} style={styles.commitmentCopy} tone="muted">
        {card.commitment}
      </HoystText>

      <View style={styles.statusRow}>
        <HoystText
          style={[styles.statusCopy, {color: categoryColor}]}
          variant="caption">
          {getStatusCopy(card)}
        </HoystText>
        <HoystText style={styles.progressCopy} tone="muted" variant="caption">
          {card.circleMode === 'personal'
            ? `${progress}% complete`
            : getContextCopy(card)}
        </HoystText>
      </View>

      <View
        style={[
          styles.progressTrack,
          {backgroundColor: `${visual.accentColor}26`},
        ]}>
        <View
          style={[
            styles.progressFill,
            {backgroundColor: categoryColor, width: `${progress}%`},
          ]}
        />
      </View>

      <View style={styles.focusedFooter}>
        <CircleContext card={card} />
        <View style={styles.footerActions}>
          {actionVariant === 'nudge' ? (
            <NudgeActionButton
              isLoading={isNudging}
              isSent={isNudged}
              label={getNudgeLabel(card)}
              onPress={onActionPress}
              size="compact"
              targetCount={card.nudgeTargetCount}
              style={styles.nudgeAction}
            />
          ) : null}
          <Pressable
            accessibilityLabel={`View details for ${card.title}`}
            accessibilityRole="button"
            onPress={onViewDetails}
            style={({pressed}) => [
              styles.detailsButton,
              {
                backgroundColor: theme.isDark
                  ? `${categoryColor}36`
                  : `${categoryColor}18`,
                opacity: pressed ? actionMotion.pressedOpacity : 1,
              },
            ]}
            testID={`home-commitment-details-${card.id}`}>
            <View style={styles.detailsContent}>
              <HoystText
                numberOfLines={1}
                style={[styles.detailsLabel, {color: categoryColor}]}
                variant="caption">
                View details
              </HoystText>
              <ChevronRight color={categoryColor} size={20} strokeWidth={2.8} />
            </View>
          </Pressable>
        </View>
      </View>
    </View>
  );
}

export function HomeCommitmentStack({
  cards,
  focusedCardId,
  isNudged,
  isNudging,
  onActionPress,
  onFocusCard,
  onViewDetails,
}: HomeCommitmentStackProps): React.JSX.Element | null {
  const focusedCard = cards.find(card => card.id === focusedCardId) ?? cards[0];

  if (!focusedCard) {
    return null;
  }

  const focusCard = (circleId: string) => {
    if (circleId === focusedCard.id) {
      return;
    }

    onFocusCard(circleId);
  };

  return (
    <View style={styles.stack} testID="home-commitments-stack">
      {cards.map((card, index) => {
        const isFocused = card.id === focusedCard.id;

        return (
          <View
            key={card.id}
            style={[
              styles.cardLayer,
              index > 0 ? styles.stackedLayer : undefined,
              isFocused
                ? [styles.focusedLayer, {zIndex: cards.length + 1}]
                : {zIndex: cards.length - index},
            ]}
            testID={
              isFocused
                ? `home-commitment-focused-layer-${card.id}`
                : `home-commitment-collapsed-layer-${card.id}`
            }>
            {isFocused ? (
              <FocusedCommitmentCard
                card={card}
                isNudged={isNudged(card.id)}
                isNudging={isNudging(card.id)}
                onActionPress={() => onActionPress(card)}
                onViewDetails={() => onViewDetails(card.id)}
              />
            ) : (
              <CollapsedCommitmentCard
                card={card}
                onFocus={() => focusCard(card.id)}
              />
            )}
          </View>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  avatarOverlap: {
    marginLeft: -9,
  },
  avatarRow: {
    alignItems: 'center',
    flexDirection: 'row',
  },
  check: {
    alignItems: 'center',
    borderWidth: 1.8,
    justifyContent: 'center',
  },
  checkFilled: {
    backgroundColor: brandColors.green,
  },
  checkPressable: {
    alignItems: 'center',
    flexShrink: 0,
    justifyContent: 'center',
  },
  circleContext: {
    alignItems: 'center',
    flex: 1,
    flexDirection: 'row',
    gap: 8,
    minWidth: 0,
  },
  collapsedCard: {
    alignItems: 'center',
    borderWidth: 4,
    borderRadius: radius.lg,
    flexDirection: 'row',
    gap: 9,
    minHeight: 79,
    paddingHorizontal: 14,
    paddingVertical: 18,
  },
  collapsedCopy: {
    flex: 1,
    gap: 3,
    minWidth: 0,
  },
  cardLayer: {
    position: 'relative',
  },
  collapsedPressable: {
    borderRadius: radius.lg,
  },
  collapsedStatus: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0,
    lineHeight: 14,
  },
  collapsedTitle: {
    fontSize: 15,
    fontWeight: '800',
    letterSpacing: 0,
    lineHeight: 18,
  },
  commitmentCopy: {
    fontSize: 15,
    fontWeight: '600',
    lineHeight: 20,
  },
  detailsButton: {
    alignItems: 'center',
    borderRadius: radius.pill,
    justifyContent: 'center',
    minHeight: touchTarget.minimum,
    paddingHorizontal: 14,
  },
  detailsContent: {
    alignItems: 'center',
    flexDirection: 'row',
    flexShrink: 0,
    gap: 3,
  },
  detailsLabel: {
    fontSize: 14,
    fontWeight: '800',
    lineHeight: 18,
  },
  focusedCard: {
    borderWidth: 4,
    borderRadius: 28,
    gap: 10,
    padding: 16,
    position: 'relative',
  },
  focusedCategory: {
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.6,
    lineHeight: 12,
  },
  focusedFooter: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 10,
    justifyContent: 'space-between',
    marginTop: -4,
    minHeight: touchTarget.minimum,
  },
  focusedHeader: {
    alignItems: 'flex-start',
    flexDirection: 'row',
    gap: 10,
    justifyContent: 'space-between',
  },
  focusedTitle: {
    fontSize: 18,
    fontWeight: '800',
    letterSpacing: 0,
    lineHeight: 22,
  },
  focusedTitleCluster: {
    alignItems: 'center',
    flex: 1,
    flexDirection: 'row',
    gap: 8,
    minWidth: 0,
  },
  focusedTitleCopy: {
    flex: 1,
    gap: 4,
    minWidth: 0,
  },
  footerActions: {
    alignItems: 'center',
    flexDirection: 'row',
    flexShrink: 0,
    gap: 8,
  },
  nudgeAction: {
    minWidth: 112,
  },
  personalPill: {
    alignItems: 'center',
    borderRadius: radius.pill,
    justifyContent: 'center',
    minHeight: 26,
    paddingHorizontal: 8,
  },
  personalPillLabel: {
    fontSize: 9,
    fontWeight: '800',
    letterSpacing: 0.55,
    lineHeight: 11,
  },
  pendingClock: {
    borderWidth: 0,
  },
  progressCopy: {
    fontSize: 11,
    fontWeight: '600',
    lineHeight: 14,
  },
  progressFill: {
    borderRadius: 999,
    height: 5,
  },
  progressTrack: {
    borderRadius: 999,
    height: 5,
    overflow: 'hidden',
    width: '100%',
  },
  focusedLayer: {
    position: 'relative',
  },
  stack: {
    marginHorizontal: -4,
  },
  stackedLayer: {
    marginTop: -14,
  },
  tapInPill: {
    paddingHorizontal: 8,
  },
  tapInPillLabel: {
    fontSize: 9,
    fontWeight: '800',
    letterSpacing: 0.55,
    lineHeight: 11,
  },
  statusCopy: {
    flex: 1,
    fontSize: 11,
    fontWeight: '800',
    lineHeight: 14,
  },
  statusRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 10,
  },
});
