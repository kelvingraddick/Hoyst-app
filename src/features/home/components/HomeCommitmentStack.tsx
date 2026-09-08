import React from 'react';
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  TouchableWithoutFeedback,
  useWindowDimensions,
  View,
} from 'react-native';
import {
  ArrowUpRight,
  Check,
  ChevronRight,
  Clock3,
  Minus,
} from 'lucide-react-native';
import type {CircleManagementCard} from '../../../types/models';
import {useHoystTheme} from '../../../design/theme/useHoystTheme';
import {
  CircleCategoryIcon,
  getCircleCategoryForegroundColor,
  getCircleCategoryVisual,
} from '../../../design/components/CircleCategoryIcon';
import {HoystText} from '../../../design/components/HoystText';
import {LayeredAvatar} from '../../../design/components/LayeredAvatar';
import {homeTypography} from '../../../design/tokens/home';
import {getHomeDailyAction} from '../services/home-daily-actions';

export const HOME_ROW_ICON_SIZE = 32;
export const HOME_ROW_GAP = 12;

type Props = {
  cards: readonly CircleManagementCard[];
  focusedCardId?: string;
  isNudged: (circleId: string) => boolean;
  isNudging: (circleId: string) => boolean;
  onActionPress: (card: CircleManagementCard) => void;
  onFocusCard: (circleId: string) => void;
  onViewDetails: (circleId: string) => void;
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
  const color = getCircleCategoryForegroundColor(card.category, theme);
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
  const done = card.members.filter(member => member.state === 'done').length;
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
        {card.circleMode === 'personal'
          ? 'Personal commitment'
          : `${done}/${Math.max(
              card.memberCount,
              card.members.length,
            )} members tapped in`}
      </HoystText>
    </View>
  );
}

export function HomeCommitmentStack({
  cards,
  focusedCardId,
  isNudging,
  onActionPress,
  onFocusCard,
  onViewDetails,
}: Props) {
  const theme = useHoystTheme();
  const {fontScale} = useWindowDimensions();
  const focusedShadowColor = theme.isDark ? '#000000' : '#92723E';
  const largeType = fontScale >= 1.5;
  const focused =
    cards.find(card => card.id === focusedCardId) ??
    (focusedCardId === undefined
      ? cards.find(card =>
          ['tap_in', 'nudge'].includes(getHomeDailyAction(card)),
        )
      : undefined);
  return (
    <View style={styles.list} testID="home-commitments-stack">
      {cards.map(card => {
        const isFocused = card.id === focused?.id;
        const color = getCircleCategoryForegroundColor(card.category, theme);
        const visual = getCircleCategoryVisual(card.category);
        const action = getHomeDailyAction(card);
        const actionable = action === 'tap_in' || action === 'nudge';
        if (isFocused) {
          return (
            <TouchableWithoutFeedback
              key={card.id}
              accessible={false}
              onPress={() => onViewDetails(card.id)}>
              <View
                style={[
                  styles.focused,
                  {
                    shadowColor: focusedShadowColor,
                    backgroundColor: theme.isDark
                      ? `${visual.accentColor}20`
                      : visual.backplateColor,
                  },
                ]}
                testID={`home-commitment-focused-${card.id}`}>
                <View
                  pointerEvents="none"
                  style={styles.detailArrow}
                  testID={`home-commitment-detail-arrow-${card.id}`}>
                  <ArrowUpRight color={theme.textMuted} size={18} />
                </View>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={`View details for ${card.title}`}
                  onPress={event => {
                    event?.stopPropagation();
                    onViewDetails(card.id);
                  }}
                  style={styles.titleRow}
                  testID={`home-commitment-details-${card.id}`}>
                  <CircleCategoryIcon
                    category={card.category}
                    showBackplate={false}
                    size={HOME_ROW_ICON_SIZE}
                  />
                  <View style={styles.copy}>
                    <HoystText style={styles.title}>{card.title}</HoystText>
                    <HoystText style={[styles.category, {color}]}>
                      {card.circleMode === 'personal'
                        ? 'PERSONAL COMMITMENT'
                        : visual.label.toUpperCase()}
                    </HoystText>
                  </View>
                </Pressable>
                <HoystText style={styles.description} tone="muted">
                  {card.commitment}
                </HoystText>
                {!actionable && (
                  <HoystText style={styles.meta} tone="muted">
                    {statusCopy(card)}
                  </HoystText>
                )}
                <View style={styles.footer}>
                  <Members card={card} />
                  <Action
                    card={card}
                    prominent
                    busy={isNudging(card.id)}
                    onPress={() => onActionPress(card)}
                  />
                </View>
              </View>
            </TouchableWithoutFeedback>
          );
        }
        return (
          <View
            key={card.id}
            style={[
              styles.row,
              largeType && styles.largeRow,
              {borderBottomColor: theme.border},
            ]}
            testID={`home-commitment-collapsed-surface-${card.id}`}>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={`Expand ${card.title}. ${statusCopy(card)}`}
              accessibilityState={{expanded: false}}
              onPress={() => onFocusCard(card.id)}
              style={[styles.rowContent, largeType && styles.largeContent]}
              testID={`home-commitment-collapsed-${card.id}`}>
              <CircleCategoryIcon
                category={card.category}
                size={HOME_ROW_ICON_SIZE}
              />
              <View style={styles.copy}>
                <HoystText style={styles.title}>{card.title}</HoystText>
                <HoystText
                  style={[
                    styles.meta,
                    {color: actionable ? color : theme.textMuted},
                  ]}>
                  {statusCopy(card)}
                </HoystText>
              </View>
            </Pressable>
            {actionable && (
              <View style={largeType && styles.largeAction}>
                <Action
                  card={card}
                  busy={isNudging(card.id)}
                  onPress={() => onActionPress(card)}
                />
              </View>
            )}
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={`Expand ${card.title}`}
              accessibilityState={{expanded: false}}
              onPress={() => onFocusCard(card.id)}
              style={[styles.chevron, largeType && styles.largeChevron]}
              testID={`home-commitment-expand-${card.id}`}>
              <ChevronRight size={18} color={theme.textMuted} />
            </Pressable>
          </View>
        );
      })}
    </View>
  );
}
const styles = StyleSheet.create({
  list: {gap: 0},
  focused: {
    borderRadius: 18,
    gap: 12,
    marginBottom: 0,
    paddingHorizontal: 18,
    paddingVertical: 12,
    shadowOffset: {width: 0, height: 6},
    shadowOpacity: 0.1,
    shadowRadius: 12,
    elevation: 3,
  },
  detailArrow: {
    position: 'absolute',
    right: 18,
    top: 18,
  },
  titleRow: {
    flexDirection: 'row',
    gap: 12,
    alignItems: 'center',
    minHeight: 44,
    paddingRight: 28,
  },
  copy: {flex: 1, gap: 4, minWidth: 0, minHeight: 44, justifyContent: 'center'},
  title: homeTypography.title,
  category: {...homeTypography.category, letterSpacing: 0.5},
  description: homeTypography.body,
  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    flexWrap: 'wrap',
  },
  members: {
    flex: 1,
    minWidth: 140,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  avatars: {flexDirection: 'row'},
  avatarOverlap: {marginLeft: -6},
  meta: {...homeTypography.secondary, flexShrink: 1},
  largeRow: {flexWrap: 'wrap'},
  largeAction: {marginLeft: 44},
  largeChevron: {marginLeft: 'auto'},
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    columnGap: 4,
    rowGap: 8,
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  rowContent: {
    flex: 1,
    minHeight: 44,
    flexDirection: 'row',
    alignItems: 'center',
    gap: HOME_ROW_GAP,
  },
  largeContent: {flexBasis: '100%'},
  chevron: {
    width: 44,
    minHeight: 44,
    alignItems: 'flex-end',
    justifyContent: 'center',
  },
  actionTarget: {minHeight: 44, minWidth: 66, justifyContent: 'center'},
  action: {
    minWidth: 66,
    minHeight: 32,
    borderRadius: 16,
    borderWidth: 1.5,
    paddingHorizontal: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  actionLabel: homeTypography.action,
  done: {
    width: 44,
    minHeight: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
