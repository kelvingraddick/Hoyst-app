import React, {useEffect, useState} from 'react';
import {Alert, Pressable, Share, StyleSheet, View} from 'react-native';
import {
  ArrowRight,
  BellRing,
  Check,
  Clock3,
  Flame,
  Globe2,
  Lock,
  Send,
  UsersRound,
  X,
} from 'lucide-react-native';
import type {NativeStackScreenProps} from '@react-navigation/native-stack';

import {GlassPanel} from '../../../design/components/GlassPanel';
import {HoystChip} from '../../../design/components/HoystChip';
import {HoystScreen} from '../../../design/components/HoystScreen';
import {HoystText} from '../../../design/components/HoystText';
import {LayeredAvatar} from '../../../design/components/LayeredAvatar';
import {CircleCategoryPill} from '../../../design/components/CircleCategoryIcon';
import {TapInRingMark} from '../../../design/components/TapInRingMark';
import {TapInPulseButton} from '../../../design/components/TapInPulseButton';
import {
  getPulseRingStateForCircle,
  getPulseRingStateForCircles,
} from '../../../design/components/pulse-ring-state';
import {radius} from '../../../design/tokens/radius';
import {useHoystTheme} from '../../../design/theme/useHoystTheme';
import type {RootStackParamList} from '../../../navigation/types';
import type {CircleManagementCard} from '../../../types/models';
import {useUserProfileStore} from '../../../store/profile-store';
import {useSessionStore} from '../../../store/session-store';
import {
  createEmptyHomeData,
  subscribeToHomeData,
  type HomeData,
} from '../../home/services/home-data-service';
import {nudgeCircleMembers} from '../../circles/services/circle-service';

type Props = NativeStackScreenProps<RootStackParamList, 'TapInPicker'>;

function sortDueCircles(
  left: CircleManagementCard,
  right: CircleManagementCard,
) {
  const stateDelta =
    Number(right.state === 'risk') - Number(left.state === 'risk');

  if (stateDelta !== 0) {
    return stateDelta;
  }

  const progressDelta = left.progressPercent - right.progressPercent;

  if (progressDelta !== 0) {
    return progressDelta;
  }

  return left.title.localeCompare(right.title);
}

function getRemainingTapInsLabel(circle: CircleManagementCard) {
  const count = circle.remainingCheckIns;
  const periodCopy =
    circle.commitmentCadence === 'daily'
      ? 'today'
      : circle.commitmentCadence === 'monthly'
      ? 'this month'
      : 'this week';

  return count === 1
    ? `1 Tap In left ${periodCopy}`
    : `${count} Tap Ins left ${periodCopy}`;
}

export function TapInPickerScreen({navigation}: Props): React.JSX.Element {
  const theme = useHoystTheme();
  const [homeData, setHomeData] = useState<HomeData>(() =>
    createEmptyHomeData(),
  );
  const [isLoadingHomeData, setIsLoadingHomeData] = useState(false);
  const [hasHomeDataError, setHasHomeDataError] = useState(false);
  const [nudgedCircleIds, setNudgedCircleIds] = useState<ReadonlySet<string>>(
    () => new Set(),
  );
  const [nudgingCircleIds, setNudgingCircleIds] = useState<ReadonlySet<string>>(
    () => new Set(),
  );
  const profile = useUserProfileStore(state => state.profile);
  const status = useSessionStore(state => state.status);
  const user = useSessionStore(state => state.user);
  const timezone = profile?.timezone ?? 'UTC';
  const canLoadCircles = status === 'authenticatedReady' && Boolean(user?.uid);

  useEffect(() => {
    if (!canLoadCircles || !user?.uid) {
      setHomeData(createEmptyHomeData(timezone));
      setIsLoadingHomeData(false);
      setHasHomeDataError(false);
      return undefined;
    }

    setIsLoadingHomeData(true);
    setHasHomeDataError(false);

    return subscribeToHomeData({
      onData: data => {
        setHomeData(data);
        setHasHomeDataError(false);
        setIsLoadingHomeData(false);
      },
      onError: () => {
        setHasHomeDataError(true);
        setIsLoadingHomeData(false);
      },
      timezone,
      uid: user.uid,
    });
  }, [canLoadCircles, timezone, user?.uid]);

  const activeCircles = homeData.circles.filter(
    circle => circle.viewerMembershipStatus !== 'pending',
  );
  const dueCircles = activeCircles
    .filter(circle => !circle.viewerHasCheckedIn)
    .sort(sortDueCircles);
  const secondaryCircles = activeCircles.filter(
    circle => circle.viewerHasCheckedIn,
  );
  const atRiskCount = activeCircles.filter(
    circle => circle.state === 'risk',
  ).length;
  const doneCount = activeCircles.filter(
    circle => circle.viewerHasCheckedIn,
  ).length;
  const heroPulseRingState = getPulseRingStateForCircles(activeCircles);
  const showLoadingState = isLoadingHomeData;
  const showDataErrorState =
    hasHomeDataError && !isLoadingHomeData && activeCircles.length === 0;
  const showNoActiveCirclesState =
    !hasHomeDataError && !isLoadingHomeData && activeCircles.length === 0;
  const showAllTappedInState =
    !hasHomeDataError &&
    !isLoadingHomeData &&
    activeCircles.length > 0 &&
    dueCircles.length === 0;

  const openTapIn = (circleId: string) => {
    navigation.replace('TapInComposer', {
      circleId,
      source: 'tap_in',
    });
  };

  const openCircle = (circleId: string) => {
    navigation.navigate('CircleDetail', {circleId});
  };

  const shareInvite = (circle: CircleManagementCard) => {
    if (!circle.inviteUrl) {
      return;
    }

    Share.share({
      title: `Join ${circle.title} on Hoyst`,
      message: `Join ${circle.title} on Hoyst: ${circle.inviteUrl}`,
      url: circle.inviteUrl,
    }).catch(() => undefined);
  };

  const nudgeCircle = (circle: CircleManagementCard) => {
    if ((circle.nudgeTargetCount ?? 0) <= 0) {
      openCircle(circle.id);
      return;
    }

    if (nudgedCircleIds.has(circle.id) || nudgingCircleIds.has(circle.id)) {
      return;
    }

    setNudgingCircleIds(currentNudgingCircleIds => {
      const nextNudgingCircleIds = new Set(currentNudgingCircleIds);
      nextNudgingCircleIds.add(circle.id);
      return nextNudgingCircleIds;
    });

    nudgeCircleMembers(circle.id)
      .then(result => {
        setNudgedCircleIds(currentNudgedCircleIds => {
          const nextNudgedCircleIds = new Set(currentNudgedCircleIds);
          nextNudgedCircleIds.add(circle.id);
          return nextNudgedCircleIds;
        });

        Alert.alert(
          'Nudge sent',
          result.nudged > 0
            ? `${result.nudged} member${result.nudged === 1 ? '' : 's'} nudged.`
            : 'Everyone is covered right now.',
        );
      })
      .catch(error => {
        Alert.alert(
          'Nudge failed',
          (error as {message?: string}).message ?? 'Could not send a nudge.',
        );
      })
      .finally(() => {
        setNudgingCircleIds(currentNudgingCircleIds => {
          if (!currentNudgingCircleIds.has(circle.id)) {
            return currentNudgingCircleIds;
          }

          const nextNudgingCircleIds = new Set(currentNudgingCircleIds);
          nextNudgingCircleIds.delete(circle.id);
          return nextNudgingCircleIds;
        });
      });
  };

  return (
    <HoystScreen contentContainerStyle={styles.content}>
      <View style={styles.closeRow}>
        <Pressable
          accessibilityLabel="Close Tap In picker"
          accessibilityRole="button"
          hitSlop={8}
          onPress={() => navigation.goBack()}
          style={({pressed}) => [
            styles.closeButton,
            {
              backgroundColor: theme.surfaceSoft,
              borderColor: theme.border,
              opacity: pressed ? 0.92 : 1,
            },
          ]}>
          <X color={theme.text} size={18} strokeWidth={2.4} />
        </Pressable>
      </View>

      <GlassPanel style={styles.heroPanel}>
        <View style={styles.heroIconWrap}>
          <TapInRingMark
            innerSize={56}
            outerSize={100}
            state={heroPulseRingState}
          />
        </View>
        <View style={styles.headerCopy}>
          <HoystText style={styles.centerText} variant="display">
            Tap In
          </HoystText>
          <HoystText style={styles.centerText} tone="muted">
            Handle the Circles that need your Tap In, then keep the rest moving.
          </HoystText>
        </View>
        <View style={styles.summaryChips}>
          <HoystChip label={`${dueCircles.length} Need You`} tone="orange" />
          <HoystChip label={`${atRiskCount} At Risk`} tone="purple" />
          <HoystChip label={`${doneCount} Already In`} tone="green" />
        </View>
      </GlassPanel>

      {dueCircles.length > 0 ? (
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <HoystText tone="muted" variant="label">
              Needs Your Tap In
            </HoystText>
            <HoystText tone="muted" variant="caption">
              {dueCircles.length} due
            </HoystText>
          </View>
          {dueCircles.map(circle => {
            const progressTone =
              circle.state === 'risk'
                ? theme.dangerForeground
                : circle.progressPercent >= 80
                ? theme.successForeground
                : circle.progressPercent >= 50
                ? theme.accentSecondaryForeground
                : theme.warningForeground;
            const privacyIcon =
              circle.privacy === 'public' ? (
                <Globe2 color={theme.textSubtle} size={14} strokeWidth={2.1} />
              ) : (
                <Lock color={theme.textSubtle} size={14} strokeWidth={2.1} />
              );
            const statusCopy =
              circle.state === 'risk'
                ? 'Group streak at risk'
                : getRemainingTapInsLabel(circle);
            const canTapInNow = !circle.viewerHasTappedInToday;
            const actionLabel = canTapInNow ? 'Tap In' : 'View Circle';

            return (
              <GlassPanel key={circle.id} style={styles.dueCard}>
                <View style={styles.cardHeader}>
                  <View style={styles.headerTags}>
                    <CircleCategoryPill category={circle.category} uppercase />
                    <View style={styles.streakRow}>
                      {circle.streakDays > 7 ? (
                        <Flame
                          color={theme.warningForeground}
                          size={15}
                          strokeWidth={2.4}
                        />
                      ) : null}
                      <HoystText
                        style={{
                          color:
                            circle.streakDays > 7
                              ? theme.warningForeground
                              : theme.successForeground,
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
                    {circle.state === 'risk' ? (
                      <Clock3
                        color={progressTone}
                        size={12}
                        strokeWidth={2.4}
                      />
                    ) : null}
                    <HoystText style={{color: progressTone}} variant="caption">
                      {circle.progressLabel ?? `${circle.progressPercent}%`}
                    </HoystText>
                  </View>
                </View>

                <View style={styles.cardCopy}>
                  <HoystText style={styles.cardTitle}>{circle.title}</HoystText>
                  <View style={styles.taskRow}>
                    {privacyIcon}
                    <HoystText tone="muted">{circle.commitment}</HoystText>
                  </View>
                </View>

                <View style={styles.cardMetaRow}>
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
                  <HoystText style={{color: progressTone}} variant="caption">
                    {statusCopy}
                  </HoystText>
                </View>

                <View style={styles.cardFooter}>
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
                          imageUrl={member.avatarUrl}
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

                  <TapInPulseButton
                    label={actionLabel}
                    onPress={() =>
                      canTapInNow ? openTapIn(circle.id) : openCircle(circle.id)
                    }
                    ringState={getPulseRingStateForCircle(circle)}
                    style={styles.primaryActionWrap}
                    variant="card"
                  />
                </View>
              </GlassPanel>
            );
          })}
        </View>
      ) : showLoadingState ? (
        <GlassPanel style={styles.emptyPanel}>
          <View style={styles.emptyState}>
            <TapInRingMark innerSize={34} outerSize={62} />
            <HoystText style={styles.centerText} variant="title">
              Loading your circles
            </HoystText>
            <HoystText style={styles.centerText} tone="muted">
              Pulling your live Tap In status from Hoyst.
            </HoystText>
          </View>
        </GlassPanel>
      ) : showDataErrorState ? (
        <GlassPanel style={styles.emptyPanel}>
          <View style={styles.emptyState}>
            <TapInRingMark innerSize={34} outerSize={62} />
            <HoystText style={styles.centerText} variant="title">
              Could not load Tap In
            </HoystText>
            <HoystText style={styles.centerText} tone="muted">
              Your account is connected, but Hoyst could not load your live
              circle status.
            </HoystText>
          </View>
        </GlassPanel>
      ) : showNoActiveCirclesState ? (
        <GlassPanel style={styles.emptyPanel}>
          <View style={styles.emptyState}>
            <TapInRingMark innerSize={34} outerSize={62} />
            <HoystText style={styles.centerText} variant="title">
              No active circles yet
            </HoystText>
            <HoystText style={styles.centerText} tone="muted">
              Join or create a circle before Tap In has anything to track.
            </HoystText>
          </View>
        </GlassPanel>
      ) : showAllTappedInState ? (
        <GlassPanel style={styles.emptyPanel}>
          <View style={styles.emptyState}>
            <TapInRingMark innerSize={34} outerSize={62} />
            <HoystText style={styles.centerText} variant="title">
              Your Commitments are complete
            </HoystText>
            <HoystText style={styles.centerText} tone="muted">
              Every active Circle has what it needs from you right now. You can
              still keep Members moving below.
            </HoystText>
          </View>
        </GlassPanel>
      ) : null}

      <View style={styles.section}>
        <View style={styles.sectionHeader}>
          <HoystText tone="muted" variant="label">
            Still Useful Today
          </HoystText>
          <HoystText tone="muted" variant="caption">
            {secondaryCircles.length} active
          </HoystText>
        </View>

        {secondaryCircles.length > 0 ? (
          secondaryCircles.map(circle => {
            const nudgeTargetCount = circle.nudgeTargetCount ?? 0;
            const canNudge = nudgeTargetCount > 0;
            const canShare = !canNudge && Boolean(circle.inviteUrl);
            const isNudged = nudgedCircleIds.has(circle.id);
            const isNudging = nudgingCircleIds.has(circle.id);
            const actionLabel = canNudge
              ? isNudging
                ? 'Nudging...'
                : isNudged
                ? 'Nudged'
                : `Nudge ${nudgeTargetCount}`
              : canShare
              ? 'Share'
              : 'View';
            const statusTone = canNudge
              ? theme.accentSecondaryForeground
              : circle.viewerTodayStatus === 'skip'
              ? theme.warningForeground
              : theme.successForeground;
            const statusLabel = canNudge
              ? getRemainingTapInsLabel(circle)
              : circle.viewerTodayStatus === 'skip'
              ? 'Grace skip used today'
              : 'Commitment complete';
            const ActionIcon = canNudge
              ? BellRing
              : canShare
              ? Send
              : ArrowRight;

            return (
              <GlassPanel key={circle.id} style={styles.secondaryCard}>
                <View style={styles.secondaryRow}>
                  <View style={styles.secondaryCopy}>
                    <View style={styles.secondaryTitleRow}>
                      {circle.state === 'done' ? (
                        <Check
                          color={theme.successForeground}
                          size={15}
                          strokeWidth={2.6}
                        />
                      ) : null}
                      <HoystText style={styles.secondaryTitle}>
                        {circle.title}
                      </HoystText>
                    </View>
                    <HoystText tone="muted" variant="caption">
                      {statusLabel}
                    </HoystText>
                  </View>
                  <Pressable
                    onPress={() => {
                      if (canNudge) {
                        nudgeCircle(circle);
                        return;
                      }

                      if (canShare) {
                        shareInvite(circle);
                        return;
                      }

                      openCircle(circle.id);
                    }}
                    style={({pressed}) => [
                      styles.secondaryAction,
                      {
                        backgroundColor: theme.actionSurface,
                        borderColor: theme.actionBorder,
                        opacity: pressed ? 0.9 : 1,
                      },
                    ]}>
                    <ActionIcon
                      color={theme.actionForeground}
                      size={15}
                      strokeWidth={2.2}
                    />
                    <HoystText
                      numberOfLines={1}
                      style={[
                        styles.secondaryActionLabel,
                        {color: theme.actionForeground},
                      ]}
                      variant="button">
                      {actionLabel}
                    </HoystText>
                  </Pressable>
                </View>
                <View style={styles.secondaryMeta}>
                  <CircleCategoryPill category={circle.category} uppercase />
                  <HoystText style={{color: statusTone}} variant="caption">
                    {circle.progressPercent}% tapped in
                  </HoystText>
                </View>
              </GlassPanel>
            );
          })
        ) : (
          <GlassPanel style={styles.secondaryCard}>
            <HoystText variant="title">Nothing else needs you</HoystText>
            <HoystText tone="muted">
              Your active circles are clear for now.
            </HoystText>
          </GlassPanel>
        )}
      </View>
    </HoystScreen>
  );
}

const styles = StyleSheet.create({
  content: {
    paddingBottom: 168,
  },
  closeRow: {
    alignItems: 'flex-end',
    paddingTop: 14,
    paddingBottom: 8,
  },
  closeButton: {
    alignItems: 'center',
    borderRadius: radius.pill,
    borderWidth: 1,
    height: 46,
    justifyContent: 'center',
    width: 46,
  },
  heroPanel: {
    minHeight: 238,
  },
  heroIconWrap: {
    alignItems: 'center',
  },
  headerCopy: {
    gap: 8,
  },
  centerText: {
    textAlign: 'center',
  },
  summaryChips: {
    alignSelf: 'center',
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    justifyContent: 'center',
  },
  section: {
    gap: 12,
  },
  sectionHeader: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  dueCard: {
    minHeight: 198,
  },
  cardHeader: {
    alignItems: 'flex-start',
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  headerTags: {
    alignItems: 'center',
    flexDirection: 'row',
    flex: 1,
    flexWrap: 'wrap',
    gap: 10,
    paddingRight: 10,
  },
  streakRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 5,
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
  cardCopy: {
    gap: 8,
  },
  cardTitle: {
    fontSize: 24,
    fontWeight: '800',
    lineHeight: 27,
  },
  taskRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 6,
  },
  cardMetaRow: {
    alignItems: 'center',
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
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
    lineHeight: 16,
    marginLeft: 2,
  },
  managementDot: {
    backgroundColor: 'rgba(255,255,255,0.2)',
    borderRadius: radius.pill,
    height: 3,
    width: 3,
  },
  managementItem: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 5,
  },
  primaryActionWrap: {
    flexShrink: 0,
    marginLeft: 'auto',
    minWidth: 130,
  },
  emptyPanel: {
    minHeight: 186,
  },
  emptyState: {
    alignItems: 'center',
    gap: 12,
  },
  secondaryCard: {
    minHeight: 92,
  },
  secondaryRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 12,
  },
  secondaryCopy: {
    flex: 1,
    gap: 5,
    minWidth: 0,
  },
  secondaryTitleRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 6,
  },
  secondaryTitle: {
    fontSize: 17,
    fontWeight: '800',
    lineHeight: 21,
  },
  secondaryAction: {
    alignItems: 'center',
    borderRadius: radius.md,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 6,
    justifyContent: 'center',
    minHeight: 42,
    minWidth: 96,
    paddingHorizontal: 12,
  },
  secondaryActionLabel: {
    fontSize: 14,
    lineHeight: 18,
  },
  secondaryMeta: {
    alignItems: 'center',
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
});
