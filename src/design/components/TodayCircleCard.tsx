import React from 'react';
import {Pressable, StyleSheet, View} from 'react-native';
import {
  BellRing,
  Check,
  Clock3,
  Flame,
  Lock,
  Send,
} from 'lucide-react-native';

import type {TodayCircleCard as TodayCircleCardModel} from '../../types/models';
import {useHoystTheme} from '../theme/useHoystTheme';
import {actionMotion, actionShadow} from '../tokens/actions';
import {radius} from '../tokens/radius';
import {GlassPanel} from './GlassPanel';
import {HoystChip} from './HoystChip';
import {LayeredAvatar} from './LayeredAvatar';
import {TapInRingMark} from './TapInRingMark';
import {HoystText} from './HoystText';

type TodayCircleCardProps = {
  card: TodayCircleCardModel;
  onPress: () => void;
};

export function TodayCircleCard({
  card,
  onPress,
}: TodayCircleCardProps): React.JSX.Element {
  const theme = useHoystTheme();
  const streakTone =
    card.streakDays > 7
      ? theme.warning
      : card.streakDays > 0
      ? theme.success
      : theme.accentSecondary;
  const showFlameIcon = card.streakDays > 7;
  const streakLabel = `${card.streakDays}d streak`;
  const progressTone =
    card.progressPercent >= 80
      ? theme.success
      : card.progressPercent >= 50
      ? theme.accentSecondary
      : theme.warning;
  const badgeTone =
    card.state === 'done'
      ? theme.success
      : card.state === 'risk'
      ? theme.danger
      : progressTone;
  const badgeLabel = card.state === 'done' ? 'Done' : `${card.progressPercent}%`;
  const showBadgeCheck = card.state === 'done';
  const showBadgeTimer = card.state === 'risk';
  const actionVariant = !card.viewerHasCheckedIn
    ? 'check_in'
    : card.remainingCheckIns > 0
    ? 'poke'
    : 'share';
  const actionLabel =
    actionVariant === 'check_in'
      ? 'Tap In'
      : actionVariant === 'poke'
      ? `Poke ${card.remainingCheckIns}`
      : 'Share';

  return (
    <GlassPanel style={styles.card}>
      <View style={styles.header}>
        <View style={styles.headerTags}>
          <View style={styles.headerMetaRow}>
            <HoystChip label={card.category.toUpperCase()} tone="purple" />
            <View style={styles.streakRow}>
              {showFlameIcon ? (
                <Flame color={streakTone} size={16} strokeWidth={2.4} />
              ) : null}
              <HoystText
                style={[
                  styles.streakText,
                  showFlameIcon ? styles.streakTextWithIcon : undefined,
                  {color: streakTone},
                ]}
                variant="bodyStrong">
                {streakLabel}
              </HoystText>
            </View>
          </View>
        </View>
        <View
          style={[
            styles.ringBadge,
            {
              borderColor: `${badgeTone}66`,
              backgroundColor: `${badgeTone}12`,
            },
          ]}>
          {showBadgeCheck ? (
            <Check color={badgeTone} size={12} strokeWidth={2.6} />
          ) : null}
          {showBadgeTimer ? (
            <Clock3 color={badgeTone} size={12} strokeWidth={2.4} />
          ) : null}
          <HoystText
            style={[
              styles.badgeText,
              showBadgeCheck ? styles.badgeTextDone : undefined,
              {color: badgeTone},
            ]}
            variant="caption">
            {badgeLabel}
          </HoystText>
        </View>
      </View>

      <View style={styles.copy}>
        <HoystText style={styles.titleText}>{card.title}</HoystText>
        <View style={styles.taskRow}>
          <Lock color={theme.textSubtle} size={14} strokeWidth={2.1} />
          <HoystText tone="muted">{card.dailyTask}</HoystText>
        </View>
      </View>

      <View style={styles.footer}>
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
                size={42}
                state={member.state}
              />
            </View>
          ))}
          {card.members.length > 3 ? (
            <HoystText style={styles.moreCount} tone="muted" variant="caption">
              +{card.members.length - 3}
            </HoystText>
          ) : null}
        </View>

        {actionVariant === 'check_in' ? (
          <Pressable
            onPress={onPress}
            style={({pressed}) => [
              styles.actionWrap,
              styles.primaryActionGlow,
              {
                opacity: pressed ? actionMotion.pressedOpacity : 1,
                shadowColor: theme.actionShadowColor,
                shadowOpacity: theme.actionShadowOpacity,
              },
            ]}>
            <View
              style={[
                styles.primaryAction,
                {
                  backgroundColor: theme.actionSurface,
                  borderColor: theme.actionBorder,
                },
              ]}>
              <TapInRingMark innerSize={17} outerSize={30} />
              <HoystText
                numberOfLines={1}
                style={[
                  styles.primaryActionLabel,
                  {color: theme.actionForeground},
                ]}
                variant="button">
                {actionLabel}
              </HoystText>
            </View>
          </Pressable>
        ) : (
          <View
            style={[
              styles.actionWrap,
              styles.secondaryAction,
              {
                backgroundColor: theme.actionSurface,
                borderColor: theme.actionBorder,
              },
            ]}>
            {actionVariant === 'poke' ? (
              <BellRing
                color={theme.actionForeground}
                size={16}
                strokeWidth={2.2}
              />
            ) : (
              <Send
                color={theme.actionForeground}
                size={16}
                strokeWidth={2.2}
              />
            )}
            <HoystText
              style={[
                styles.secondaryActionLabel,
                {color: theme.actionForeground},
              ]}
              variant="button">
              {actionLabel}
            </HoystText>
          </View>
        )}
      </View>
    </GlassPanel>
  );
}

const styles = StyleSheet.create({
  card: {
    minHeight: 164,
  },
  header: {
    alignItems: 'flex-start',
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  headerTags: {
    gap: 6,
  },
  headerMetaRow: {
    alignItems: 'center',
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  streakRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 6,
  },
  streakText: {
    fontSize: 14,
    fontWeight: '700',
    letterSpacing: -0.2,
    lineHeight: 16,
  },
  streakTextWithIcon: {
    marginLeft: -4,
  },
  ringBadge: {
    alignItems: 'center',
    borderRadius: radius.pill,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 4,
    height: 32,
    justifyContent: 'center',
    minWidth: 64,
    paddingHorizontal: 10,
  },
  badgeText: {
    fontSize: 13,
    fontWeight: '700',
    letterSpacing: -0.2,
    lineHeight: 14,
  },
  badgeTextDone: {
    fontSize: 12,
    lineHeight: 13,
  },
  copy: {
    gap: 8,
  },
  titleText: {
    fontSize: 26,
    fontWeight: '800',
    letterSpacing: -0.6,
    lineHeight: 28,
  },
  taskRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 6,
  },
  footer: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 12,
  },
  avatarRow: {
    alignItems: 'center',
    flexDirection: 'row',
    flex: 1,
    minWidth: 0,
    overflow: 'visible',
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
  actionWrap: {
    alignItems: 'flex-end',
    marginLeft: 'auto',
    flexShrink: 0,
    minWidth: 116,
  },
  primaryAction: {
    alignItems: 'center',
    borderRadius: radius.md,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 8,
    justifyContent: 'center',
    minHeight: 48,
    minWidth: 116,
    paddingHorizontal: 14,
  },
  primaryActionGlow: {
    borderRadius: radius.md,
    elevation: actionShadow.elevation,
    shadowOffset: actionShadow.offset,
    shadowRadius: actionShadow.compactRadius,
  },
  primaryActionLabel: {
    fontSize: 14,
    flexShrink: 0,
    fontWeight: '800',
    lineHeight: 18,
    textAlign: 'center',
  },
  secondaryAction: {
    alignItems: 'center',
    borderRadius: radius.md,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 8,
    justifyContent: 'center',
    minHeight: 48,
    paddingHorizontal: 14,
  },
  secondaryActionLabel: {
    fontSize: 14,
    lineHeight: 18,
  },
});
