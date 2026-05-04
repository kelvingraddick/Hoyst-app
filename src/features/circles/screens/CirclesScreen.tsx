import React, {useMemo, useState} from 'react';
import {Pressable, Share, StyleSheet, View} from 'react-native';
import {
  ArrowRight,
  Check,
  Clock3,
  Flame,
  Globe2,
  Lock,
  Plus,
  Send,
  UsersRound,
} from 'lucide-react-native';
import type {BottomTabScreenProps} from '@react-navigation/bottom-tabs';
import type {NativeStackNavigationProp} from '@react-navigation/native-stack';

import {GlassPanel} from '../../../design/components/GlassPanel';
import {HoystChip} from '../../../design/components/HoystChip';
import {HoystScreen} from '../../../design/components/HoystScreen';
import {HoystText} from '../../../design/components/HoystText';
import {LayeredAvatar} from '../../../design/components/LayeredAvatar';
import {TapInRingMark} from '../../../design/components/TapInRingMark';
import {actionMotion, actionShadow} from '../../../design/tokens/actions';
import {radius} from '../../../design/tokens/radius';
import {useHoystTheme} from '../../../design/theme/useHoystTheme';
import {useProtectedAction} from '../../auth/hooks/useProtectedAction';
import {circleManagementCards} from '../mockData';
import type {
  CircleManagementCard,
  CircleManagementFilter,
} from '../../../types/models';
import type {
  AppTabsParamList,
  RootStackParamList,
} from '../../../navigation/types';

type Props = BottomTabScreenProps<AppTabsParamList, 'Circles'>;

const filterLabels: Record<CircleManagementFilter, string> = {
  all: 'All',
  needsYou: 'Needs you',
  atRisk: 'At risk',
  done: 'Done',
};

const filters: CircleManagementFilter[] = ['all', 'needsYou', 'atRisk', 'done'];

function canInvite(circle: CircleManagementCard) {
  return Boolean(
    circle.inviteUrl &&
      (circle.viewerRole === 'owner' || circle.viewerRole === 'admin'),
  );
}

function getUrgencyRank(circle: CircleManagementCard) {
  const needsViewer = !circle.viewerHasCheckedIn;
  const isAtRisk = circle.state === 'risk';
  const hasPendingToday = circle.state !== 'done' && circle.remainingCheckIns > 0;

  if (needsViewer && isAtRisk) {
    return 0;
  }
  if (needsViewer) {
    return 1;
  }
  if (isAtRisk) {
    return 2;
  }
  if (hasPendingToday) {
    return 3;
  }
  if (circle.state === 'done') {
    return 5;
  }
  return 4;
}

function matchesFilter(
  circle: CircleManagementCard,
  filter: CircleManagementFilter,
) {
  if (filter === 'needsYou') {
    return !circle.viewerHasCheckedIn;
  }
  if (filter === 'atRisk') {
    return circle.state === 'risk';
  }
  if (filter === 'done') {
    return circle.state === 'done';
  }
  return true;
}

export function CirclesScreen({navigation}: Props): React.JSX.Element {
  const theme = useHoystTheme();
  const [activeFilter, setActiveFilter] =
    useState<CircleManagementFilter>('all');
  const rootNavigation =
    navigation.getParent<NativeStackNavigationProp<RootStackParamList>>();
  const requireAccount = useProtectedAction(rootNavigation);
  const filterCounts = useMemo(
    () =>
      filters.reduce(
        (counts, filter) => ({
          ...counts,
          [filter]: circleManagementCards.filter(circle =>
            matchesFilter(circle, filter),
          ).length,
        }),
        {} as Record<CircleManagementFilter, number>,
      ),
    [],
  );
  const displayedCircles = useMemo(
    () =>
      circleManagementCards
        .filter(circle => matchesFilter(circle, activeFilter))
        .sort((left, right) => {
          const rankDelta = getUrgencyRank(left) - getUrgencyRank(right);
          if (rankDelta !== 0) {
            return rankDelta;
          }

          const progressDelta = left.progressPercent - right.progressPercent;
          if (progressDelta !== 0) {
            return progressDelta;
          }

          return left.title.localeCompare(right.title);
        }),
    [activeFilter],
  );
  const needYouCount = filterCounts.needsYou;
  const atRiskCount = filterCounts.atRisk;

  const openDetail = (circleId: string) => {
    rootNavigation?.navigate('CircleDetail', {circleId});
  };

  const shareInvite = (circle: CircleManagementCard) => {
    if (!canInvite(circle) || !circle.inviteUrl) {
      return;
    }

    Share.share({
      title: `Join ${circle.title} on Hoyst`,
      message: `Join ${circle.title} on Hoyst: ${circle.inviteUrl}`,
      url: circle.inviteUrl,
    }).catch(() => undefined);
  };

  return (
    <HoystScreen contentContainerStyle={styles.content}>
      <View style={styles.header}>
        <View style={styles.headerCopy}>
          <HoystText variant="headline">Your circles</HoystText>
          <HoystText tone="muted">
            Manage your circles, invite your people, and handle what needs you
            today.
          </HoystText>
        </View>
        <Pressable
          accessibilityLabel="Create Circle"
          hitSlop={8}
          onPress={() =>
            requireAccount({type: 'createCircle'}, () =>
              rootNavigation?.navigate('CreateCircle'),
            )
          }
          style={({pressed}) => [
            styles.createButtonPressable,
            {
              opacity: pressed ? actionMotion.pressedOpacity : 1,
              shadowColor: theme.actionShadowColor,
              shadowOpacity: theme.actionShadowOpacity,
              transform: [{scale: pressed ? actionMotion.pressedScale : 1}],
            },
          ]}>
          <View
            style={[
              styles.createButton,
              {
                backgroundColor: theme.actionSurface,
                borderColor: theme.actionBorder,
              },
            ]}>
            <View style={styles.createIcon}>
              <TapInRingMark innerSize={22} outerSize={40} />
              <Plus
                color={theme.accentSecondary}
                size={17}
                strokeWidth={3}
                style={styles.createIconPlus}
              />
            </View>
            <HoystText
              numberOfLines={1}
              style={[styles.createButtonLabel, {color: theme.actionForeground}]}
              variant="button">
              Create Circle
            </HoystText>
          </View>
        </Pressable>
      </View>

      <View style={styles.metaRow}>
        <HoystChip
          label={`${circleManagementCards.length} Active Circles`}
          tone="green"
        />
        <HoystChip label={`${needYouCount} Need You Today`} tone="orange" />
        <HoystChip label={`${atRiskCount} At Risk`} tone="purple" />
      </View>

      <View style={styles.filterRow}>
        {filters.map(filter => {
          const isSelected = activeFilter === filter;
          return (
            <Pressable
              key={filter}
              onPress={() => setActiveFilter(filter)}
              style={({pressed}) => [
                styles.filterPill,
                {
                  backgroundColor: isSelected
                    ? theme.surfaceStrong
                    : theme.surfaceSoft,
                  borderColor: isSelected
                    ? theme.accentSecondary
                    : theme.border,
                  opacity: pressed ? 0.88 : 1,
                },
              ]}>
              <HoystText
                style={{
                  color: isSelected ? theme.text : theme.textMuted,
                }}
                variant="caption">
                {filterLabels[filter]} {filterCounts[filter]}
              </HoystText>
            </Pressable>
          );
        })}
      </View>

      {displayedCircles.map(circle => {
        const progressTone =
          circle.state === 'done'
            ? theme.success
            : circle.state === 'risk'
              ? theme.danger
              : circle.progressPercent >= 80
                ? theme.success
                : circle.progressPercent >= 50
                  ? theme.accentSecondary
                  : theme.warning;
        const statusLabel =
          circle.state === 'done'
            ? 'Done'
            : circle.state === 'risk'
              ? `${circle.progressPercent}%`
              : `${circle.progressPercent}%`;
        const statusCopy =
          circle.state === 'risk'
            ? 'Group streak at risk'
            : !circle.viewerHasCheckedIn
              ? 'Needs your tap in'
              : circle.remainingCheckIns > 0
                ? `${circle.remainingCheckIns} pending today`
                : 'Daily Tap In complete';
        const joinModeLabel =
          circle.joinMode === 'invite_only' ? 'Invite only' : 'Requests open';
        const roleLabel =
          circle.viewerRole === 'owner'
            ? 'Owner'
            : circle.viewerRole === 'admin'
              ? 'Admin'
              : 'Member';
        const privacyIcon =
          circle.privacy === 'public' ? (
            <Globe2 color={theme.textSubtle} size={14} strokeWidth={2.1} />
          ) : (
            <Lock color={theme.textSubtle} size={14} strokeWidth={2.1} />
          );
        const showInvite = canInvite(circle);

        return (
          <Pressable
            key={circle.id}
            onPress={() => openDetail(circle.id)}
            style={({pressed}) => [
              styles.cardPressable,
              {opacity: pressed ? 0.94 : 1},
            ]}>
            <GlassPanel style={styles.circleCard}>
              <View style={styles.cardHeader}>
                <View style={styles.headerTags}>
                  <HoystChip label={circle.category.toUpperCase()} tone="purple" />
                  <View style={styles.streakRow}>
                    {circle.streakDays > 7 ? (
                      <Flame color={theme.warning} size={15} strokeWidth={2.4} />
                    ) : null}
                    <HoystText
                      style={{
                        color:
                          circle.streakDays > 7 ? theme.warning : theme.success,
                      }}
                      variant="bodyStrong">
                      {circle.streakDays}d streak
                    </HoystText>
                  </View>
                </View>
                <View
                  style={[
                    styles.progressBadge,
                    {
                      backgroundColor: `${progressTone}12`,
                      borderColor: `${progressTone}66`,
                    },
                  ]}>
                  {circle.state === 'done' ? (
                    <Check color={progressTone} size={12} strokeWidth={2.6} />
                  ) : circle.state === 'risk' ? (
                    <Clock3 color={progressTone} size={12} strokeWidth={2.4} />
                  ) : null}
                  <HoystText style={{color: progressTone}} variant="caption">
                    {statusLabel}
                  </HoystText>
                </View>
              </View>

              <View style={styles.cardCopy}>
                <HoystText style={styles.cardTitle}>{circle.title}</HoystText>
                <View style={styles.taskRow}>
                  {privacyIcon}
                  <HoystText tone="muted">{circle.dailyTask}</HoystText>
                </View>
              </View>

              <View style={styles.managementRow}>
                <View style={styles.managementItem}>
                  <UsersRound
                    color={theme.textSubtle}
                    size={15}
                    strokeWidth={2.1}
                  />
                  <HoystText tone="muted" variant="caption">
                    {circle.memberCount}/{circle.maxSize} members
                  </HoystText>
                </View>
                <View
                  style={[
                    styles.managementDot,
                    {backgroundColor: theme.borderStrong},
                  ]}
                />
                <HoystText tone="muted" variant="caption">
                  {joinModeLabel}
                </HoystText>
                <View
                  style={[
                    styles.managementDot,
                    {backgroundColor: theme.borderStrong},
                  ]}
                />
                <HoystText tone="muted" variant="caption">
                  {roleLabel}
                </HoystText>
              </View>

              <View style={styles.footer}>
                <View style={styles.avatarColumn}>
                  <View style={styles.avatarRow}>
                    {circle.members.slice(0, 3).map((member, index) => (
                      <View
                        key={member.id}
                        style={[
                          styles.avatarOffset,
                          index === 0 ? undefined : styles.avatarOverlap,
                        ]}>
                        <LayeredAvatar
                          imageSource={member.avatarImage}
                          initials={member.initials}
                          size={40}
                          state={member.state}
                        />
                      </View>
                    ))}
                    {circle.members.length > 3 ? (
                      <HoystText
                        style={styles.moreCount}
                        tone="muted"
                        variant="caption">
                        +{circle.members.length - 3}
                      </HoystText>
                    ) : null}
                  </View>
                  <HoystText style={{color: progressTone}} variant="caption">
                    {statusCopy}
                  </HoystText>
                </View>

                <View style={styles.actions}>
                  {showInvite ? (
                    <Pressable
                      onPress={() => shareInvite(circle)}
                      style={({pressed}) => [
                        styles.secondaryAction,
                        {
                          backgroundColor: theme.actionSurface,
                          borderColor: theme.actionBorder,
                          opacity: pressed ? 0.9 : 1,
                        },
                      ]}>
                      <Send
                        color={theme.actionForeground}
                        size={15}
                        strokeWidth={2.2}
                      />
                      <HoystText
                        style={[
                          styles.cardActionLabel,
                          {color: theme.actionForeground},
                        ]}
                        variant="button">
                        Invite
                      </HoystText>
                    </Pressable>
                  ) : null}
                  <View
                    style={[
                      styles.manageAction,
                      {
                        backgroundColor: theme.actionSurface,
                        borderColor: theme.actionBorder,
                      },
                    ]}>
                    <HoystText
                      style={[
                        styles.cardActionLabel,
                        {color: theme.actionForeground},
                      ]}
                      variant="button">
                      Manage
                    </HoystText>
                    <ArrowRight
                      color={theme.actionForeground}
                      size={16}
                      strokeWidth={2.2}
                    />
                  </View>
                </View>
              </View>
            </GlassPanel>
          </Pressable>
        );
      })}
    </HoystScreen>
  );
}

const styles = StyleSheet.create({
  content: {
    paddingBottom: 168,
  },
  actions: {
    alignItems: 'flex-end',
    gap: 8,
  },
  avatarColumn: {
    flex: 1,
    gap: 6,
    minWidth: 0,
  },
  avatarOffset: {
    borderRadius: radius.pill,
  },
  avatarOverlap: {
    marginLeft: -14,
  },
  avatarRow: {
    alignItems: 'center',
    flexDirection: 'row',
    minWidth: 0,
    overflow: 'visible',
  },
  cardCopy: {
    gap: 8,
  },
  cardHeader: {
    alignItems: 'flex-start',
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  cardPressable: {
    borderRadius: radius.lg,
  },
  cardTitle: {
    fontSize: 24,
    fontWeight: '800',
    letterSpacing: -0.5,
    lineHeight: 27,
  },
  circleCard: {
    minHeight: 198,
  },
  cardActionLabel: {
    fontSize: 14,
    lineHeight: 18,
  },
  createButton: {
    alignItems: 'center',
    borderRadius: radius.md,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 7,
    justifyContent: 'center',
    minHeight: 68,
    overflow: 'hidden',
    paddingHorizontal: 24,
    width: '100%',
  },
  createButtonLabel: {
    fontSize: 17,
    fontWeight: '800',
    lineHeight: 21,
  },
  createButtonPressable: {
    alignSelf: 'stretch',
    borderRadius: radius.md,
    elevation: actionShadow.elevation,
    shadowOffset: actionShadow.offset,
    shadowRadius: actionShadow.compactRadius,
    width: '100%',
  },
  createIcon: {
    alignItems: 'center',
    height: 44,
    justifyContent: 'center',
    width: 44,
  },
  createIconPlus: {
    position: 'absolute',
  },
  filterPill: {
    borderRadius: radius.pill,
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 9,
  },
  filterRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  footer: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 12,
  },
  header: {
    gap: 14,
  },
  headerCopy: {
    gap: 8,
  },
  headerTags: {
    alignItems: 'center',
    flexDirection: 'row',
    flex: 1,
    flexWrap: 'wrap',
    gap: 10,
    paddingRight: 10,
  },
  manageAction: {
    alignItems: 'center',
    borderRadius: radius.md,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 8,
    justifyContent: 'center',
    minHeight: 42,
    minWidth: 104,
    paddingHorizontal: 14,
  },
  managementDot: {
    borderRadius: radius.pill,
    height: 3,
    width: 3,
  },
  managementItem: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 5,
  },
  managementRow: {
    alignItems: 'center',
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  metaRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  moreCount: {
    fontSize: 14,
    fontWeight: '700',
    letterSpacing: -0.2,
    lineHeight: 16,
    marginLeft: 2,
  },
  progressBadge: {
    alignItems: 'center',
    borderRadius: radius.pill,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 4,
    justifyContent: 'center',
    minHeight: 32,
    minWidth: 64,
    paddingHorizontal: 10,
  },
  secondaryAction: {
    alignItems: 'center',
    borderRadius: radius.md,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 6,
    justifyContent: 'center',
    minHeight: 42,
    minWidth: 104,
    paddingHorizontal: 14,
  },
  streakRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 5,
  },
  taskRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 6,
  },
});
