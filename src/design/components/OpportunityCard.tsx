import React from 'react';
import {Pressable, StyleSheet, View} from 'react-native';
import {ChevronRight, UsersRound} from 'lucide-react-native';

import type {CircleManagementCard} from '../../types/models';
import {useHoystTheme} from '../theme/useHoystTheme';
import {actionMotion} from '../tokens/actions';
import {radius} from '../tokens/radius';
import {GlassPanel} from './GlassPanel';
import {HoystChip} from './HoystChip';
import {HoystText} from './HoystText';
import {LayeredAvatar} from './LayeredAvatar';
import {CircleCardTapInButton} from './CircleCardTapInButton';

type OpportunityCardProps = {
  card: CircleManagementCard;
  onCardPress?: () => void;
  onTapInPress?: () => void;
};

function getStatus(card: CircleManagementCard) {
  if (card.viewerMembershipStatus === 'pending') {
    return {label: 'Pending approval', tone: 'purple' as const};
  }

  if (card.viewerHasCheckedIn) {
    return card.remainingCheckIns > 0
      ? {label: 'Needs others', tone: 'purple' as const}
      : {label: 'Momentum strong', tone: 'green' as const};
  }

  if (card.state === 'risk') {
    return {label: 'Momentum at risk', tone: 'orange' as const};
  }

  return {label: 'Waiting on you', tone: 'orange' as const};
}

export function OpportunityCard({
  card,
  onCardPress,
  onTapInPress,
}: OpportunityCardProps): React.JSX.Element {
  const theme = useHoystTheme();
  const status = getStatus(card);
  const canTapIn =
    !card.viewerHasCheckedIn && card.viewerMembershipStatus !== 'pending';

  return (
    <Pressable
      accessibilityRole="button"
      onPress={onCardPress}
      style={({pressed}) => [styles.pressable, {opacity: pressed ? 0.94 : 1}]}>
      <GlassPanel style={styles.card}>
        <View style={styles.row}>
          <View
            style={[styles.iconBubble, {backgroundColor: theme.surfaceHigh}]}>
            <HoystText
              style={{color: theme.accentForeground}}
              variant="headline">
              {card.title.slice(0, 1)}
            </HoystText>
          </View>
          <View style={styles.copy}>
            <View style={styles.titleRow}>
              <HoystText numberOfLines={1} style={styles.title}>
                {card.title}
              </HoystText>
              <ChevronRight
                color={theme.textSubtle}
                size={22}
                strokeWidth={2.4}
              />
            </View>
            <HoystChip label={status.label} tone={status.tone} />
            <View style={styles.metaRow}>
              <UsersRound
                color={theme.accentForeground}
                size={16}
                strokeWidth={2.2}
              />
              <HoystText tone="muted" variant="caption">
                {card.memberCount} companions
              </HoystText>
              <View
                style={[styles.dot, {backgroundColor: theme.borderStrong}]}
              />
              <HoystText tone="muted" variant="caption">
                Progress: {card.progressPercent}%
              </HoystText>
            </View>
            <View style={styles.footer}>
              <View style={styles.avatarRow}>
                {card.members.slice(0, 4).map((member, index) => (
                  <View
                    key={member.id}
                    style={index === 0 ? undefined : styles.avatarOverlap}>
                    <LayeredAvatar
                      imageSource={member.avatarImage}
                      imageUrl={member.avatarUrl}
                      initials={member.initials}
                      size={36}
                      state={member.state}
                    />
                  </View>
                ))}
                {card.members.length > 4 ? (
                  <View
                    style={[
                      styles.moreBubble,
                      {backgroundColor: theme.surfaceHigh},
                    ]}>
                    <HoystText tone="muted" variant="caption">
                      +{card.members.length - 4}
                    </HoystText>
                  </View>
                ) : null}
              </View>
              {canTapIn ? (
                <CircleCardTapInButton
                  label="Tap In"
                  onPress={event => {
                    event.stopPropagation();
                    onTapInPress?.();
                  }}
                  style={styles.action}
                />
              ) : (
                <Pressable
                  onPress={event => {
                    event.stopPropagation();
                    onCardPress?.();
                  }}
                  style={({pressed}) => [
                    styles.viewActionPressable,
                    {opacity: pressed ? actionMotion.pressedOpacity : 1},
                  ]}>
                  <View
                    style={[
                      styles.viewAction,
                      {
                        backgroundColor: theme.surfaceHigh,
                        borderColor: theme.borderStrong,
                      },
                    ]}>
                    <HoystText
                      style={{color: theme.actionForeground}}
                      variant="button">
                      View
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
  action: {
    minWidth: 190,
  },
  avatarOverlap: {
    marginLeft: -12,
  },
  avatarRow: {
    alignItems: 'center',
    flexDirection: 'row',
    flex: 1,
    minWidth: 0,
  },
  card: {
    minHeight: 156,
  },
  copy: {
    flex: 1,
    gap: 10,
    minWidth: 0,
  },
  dot: {
    borderRadius: radius.pill,
    height: 4,
    width: 4,
  },
  footer: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 12,
  },
  iconBubble: {
    alignItems: 'center',
    borderRadius: radius.pill,
    height: 72,
    justifyContent: 'center',
    width: 72,
  },
  metaRow: {
    alignItems: 'center',
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  moreBubble: {
    alignItems: 'center',
    borderRadius: radius.pill,
    height: 36,
    justifyContent: 'center',
    marginLeft: -12,
    width: 36,
  },
  pressable: {
    borderRadius: radius.lg,
  },
  row: {
    flexDirection: 'row',
    gap: 16,
  },
  title: {
    flex: 1,
    fontSize: 22,
    fontWeight: '800',
    lineHeight: 26,
  },
  titleRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 8,
  },
  viewAction: {
    alignItems: 'center',
    borderRadius: radius.pill,
    borderWidth: 1,
    justifyContent: 'center',
    minHeight: 48,
    minWidth: 104,
    paddingHorizontal: 18,
  },
  viewActionPressable: {
    borderRadius: radius.pill,
    flexShrink: 0,
  },
});
