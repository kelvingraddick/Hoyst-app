import React, {useEffect, useMemo, useState} from 'react';
import {
  Alert,
  Pressable,
  Share,
  StyleSheet,
  useWindowDimensions,
  View,
} from 'react-native';
import {
  ArrowLeft,
  CalendarClock,
  Plus,
  Star,
  TrendingUp,
  Zap,
} from 'lucide-react-native';
import type {NativeStackScreenProps} from '@react-navigation/native-stack';

import {FrostedBackdrop} from '../../../design/components/FrostedBackdrop';
import {GlassPanel} from '../../../design/components/GlassPanel';
import {HoystScreen} from '../../../design/components/HoystScreen';
import {HoystText} from '../../../design/components/HoystText';
import {OverviewStatCard} from '../../../design/components/OverviewStatCard';
import {HeroIconButton} from '../../../design/components/ScreenHeroHeader';
import {TodayCircleCard} from '../../../design/components/TodayCircleCard';
import {actionMotion} from '../../../design/tokens/actions';
import {brandColors} from '../../../design/tokens/colors';
import {radius} from '../../../design/tokens/radius';
import {useHoystTheme} from '../../../design/theme/useHoystTheme';
import type {RootStackParamList} from '../../../navigation/types';
import {useSessionStore} from '../../../store/session-store';
import type {CircleManagementCard} from '../../../types/models';
import {
  canTapInToday,
  createEmptyHomeData,
  getHomeCircleActionVariant,
  sortHomeCircles,
  subscribeToHomeData,
  type HomeData,
} from '../../home/services/home-data-service';
import {useUserProfileStore} from '../../../store/profile-store';
import {CircleActionCard} from '../components/CircleActionCard';
import {nudgeCircleMembers} from '../services/circle-service';

type Props = NativeStackScreenProps<RootStackParamList, 'Circles'>;

type CirclesFilter = 'all' | 'needsYou' | 'pending' | 'onTrack' | 'done';
const STAT_ROW_GAP = 9;
const SCREEN_HORIZONTAL_PADDING = 40;
const lightCommitmentStatColors = {
  done: '#159957',
  needsYou: brandColors.orangeStrong,
  onTrack: brandColors.blueVivid,
  pending: '#D68B00',
};

function matchesCirclesFilter(
  circle: CircleManagementCard,
  filter: CirclesFilter,
) {
  if (filter === 'all') {
    return true;
  }

  if (filter === 'pending') {
    return circle.viewerMembershipStatus === 'pending';
  }

  if (circle.viewerMembershipStatus === 'pending') {
    return false;
  }

  if (filter === 'needsYou') {
    return canTapInToday(circle);
  }

  if (filter === 'onTrack') {
    return Boolean(circle.viewerHasCheckedIn) && circle.state !== 'done';
  }

  return circle.state === 'done';
}

function canInvite(circle: CircleManagementCard) {
  return Boolean(
    circle.inviteUrl &&
      (circle.viewerRole === 'owner' || circle.viewerRole === 'admin'),
  );
}

export function CirclesScreen({navigation}: Props): React.JSX.Element {
  const theme = useHoystTheme();
  const {width: viewportWidth} = useWindowDimensions();
  const status = useSessionStore(state => state.status);
  const user = useSessionStore(state => state.user);
  const profile = useUserProfileStore(state => state.profile);
  const [homeData, setHomeData] = useState<HomeData>(() =>
    createEmptyHomeData(),
  );
  const [selectedFilter, setSelectedFilter] = useState<CirclesFilter>('all');
  const [nudgedCircleIds, setNudgedCircleIds] = useState<Set<string>>(
    () => new Set(),
  );
  const [nudgingCircleIds, setNudgingCircleIds] = useState<Set<string>>(
    () => new Set(),
  );
  const timezone = profile?.timezone ?? 'UTC';
  const canLoad = status === 'authenticatedReady' && Boolean(user?.uid);
  const statSlotStyle = useMemo(
    () => ({
      width: Math.max(
        0,
        (viewportWidth - SCREEN_HORIZONTAL_PADDING - STAT_ROW_GAP * 3) / 4,
      ),
    }),
    [viewportWidth],
  );

  useEffect(() => {
    if (!canLoad || !user?.uid) {
      setHomeData(createEmptyHomeData(timezone));
      return undefined;
    }

    return subscribeToHomeData({
      onData: setHomeData,
      onError: () => undefined,
      timezone,
      uid: user.uid,
    });
  }, [canLoad, timezone, user?.uid]);

  const allCircles = useMemo(
    () => sortHomeCircles(homeData.circles),
    [homeData.circles],
  );
  const personalCommitments = useMemo(
    () => allCircles.filter(circle => circle.circleMode === 'personal'),
    [allCircles],
  );
  const groupCircles = useMemo(
    () => allCircles.filter(circle => circle.circleMode !== 'personal'),
    [allCircles],
  );
  const counts = useMemo(
    () => ({
      done: groupCircles.filter(circle => matchesCirclesFilter(circle, 'done'))
        .length,
      needsYou: groupCircles.filter(circle =>
        matchesCirclesFilter(circle, 'needsYou'),
      ).length,
      onTrack: groupCircles.filter(circle =>
        matchesCirclesFilter(circle, 'onTrack'),
      ).length,
      pending: groupCircles.filter(circle =>
        matchesCirclesFilter(circle, 'pending'),
      ).length,
    }),
    [groupCircles],
  );
  const visibleCircles = useMemo(
    () =>
      groupCircles.filter(circle =>
        matchesCirclesFilter(circle, selectedFilter),
      ),
    [groupCircles, selectedFilter],
  );

  const toneColor = {
    done: theme.isDark
      ? theme.successForeground
      : lightCommitmentStatColors.done,
    needsYou: theme.isDark
      ? theme.warningForeground
      : lightCommitmentStatColors.needsYou,
    onTrack: theme.isDark
      ? theme.accentTertiaryForeground
      : lightCommitmentStatColors.onTrack,
    pending: theme.isDark
      ? brandColors.spectrumYellow
      : lightCommitmentStatColors.pending,
  };

  const toggleFilter = (filter: CirclesFilter) => {
    setSelectedFilter(current => (current === filter ? 'all' : filter));
  };

  const openCircle = (circleId: string) => {
    navigation.navigate('CircleDetail', {circleId});
  };

  const shareCircle = (circle: CircleManagementCard) => {
    if (!canInvite(circle) || !circle.inviteUrl) {
      openCircle(circle.id);
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

    setNudgingCircleIds(current => {
      const next = new Set(current);
      next.add(circle.id);
      return next;
    });

    nudgeCircleMembers(circle.id)
      .then(result => {
        setNudgedCircleIds(current => {
          const next = new Set(current);
          next.add(circle.id);
          return next;
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
        setNudgingCircleIds(current => {
          if (!current.has(circle.id)) {
            return current;
          }

          const next = new Set(current);
          next.delete(circle.id);
          return next;
        });
      });
  };

  const handleCircleAction = (circle: CircleManagementCard) => {
    const actionVariant = getHomeCircleActionVariant(circle);

    if (circle.viewerMembershipStatus === 'pending') {
      openCircle(circle.id);
      return;
    }

    if (actionVariant === 'check_in') {
      navigation.navigate('TapInComposer', {
        circleId: circle.id,
        source: 'tap_in',
      });
      return;
    }

    if (actionVariant === 'nudge') {
      nudgeCircle(circle);
      return;
    }

    if (actionVariant === 'share') {
      shareCircle(circle);
      return;
    }

    openCircle(circle.id);
  };

  const newButton = (
    <Pressable
      accessibilityLabel="Create commitment"
      accessibilityRole="button"
      onPress={() => navigation.navigate('CreateCircle')}
      style={({pressed}) => ({
        opacity: pressed ? actionMotion.pressedOpacity : 1,
        transform: [{scale: pressed ? actionMotion.pressedScale : 1}],
      })}>
      <View
        style={[
          styles.newPill,
          {backgroundColor: theme.accent, shadowColor: theme.accent},
        ]}>
        <Plus color={theme.onPurpleAccent} size={15} strokeWidth={2.8} />
        <HoystText
          numberOfLines={1}
          style={[styles.newPillLabel, {color: theme.onPurpleAccent}]}>
          Create commitment
        </HoystText>
      </View>
    </Pressable>
  );

  const header = (
    <View style={styles.navRow}>
      <View style={styles.navSide}>
        <HeroIconButton
          accessibilityLabel="Go back"
          onPress={() => navigation.goBack()}>
          <ArrowLeft color={theme.text} size={22} strokeWidth={2.3} />
        </HeroIconButton>
      </View>
      <HoystText numberOfLines={1} style={styles.navTitle}>
        Circles
      </HoystText>
      <View style={[styles.navSide, styles.navSideEnd]}>{newButton}</View>
    </View>
  );

  const overviewRow = (
    <View style={styles.statRow}>
      <View style={[styles.statSlot, statSlotStyle]}>
        <OverviewStatCard
          accessibilityLabel={`Needs You, ${counts.needsYou}`}
          color={toneColor.needsYou}
          label="Needs You"
          onPress={() => toggleFilter('needsYou')}
          renderIcon={color => (
            <Zap color={color} size={17} strokeWidth={2.4} />
          )}
          selected={selectedFilter === 'needsYou'}
          value={counts.needsYou}
        />
      </View>
      <View style={[styles.statSlot, statSlotStyle]}>
        <OverviewStatCard
          accessibilityLabel={`Pending, ${counts.pending}`}
          color={toneColor.pending}
          label="Pending"
          onPress={() => toggleFilter('pending')}
          renderIcon={color => (
            <CalendarClock color={color} size={17} strokeWidth={2.2} />
          )}
          selected={selectedFilter === 'pending'}
          value={counts.pending}
        />
      </View>
      <View style={[styles.statSlot, statSlotStyle]}>
        <OverviewStatCard
          accessibilityLabel={`On Track, ${counts.onTrack}`}
          color={toneColor.onTrack}
          label="On Track"
          onPress={() => toggleFilter('onTrack')}
          renderIcon={color => (
            <TrendingUp color={color} size={17} strokeWidth={2.4} />
          )}
          selected={selectedFilter === 'onTrack'}
          value={counts.onTrack}
        />
      </View>
      <View style={[styles.statSlot, statSlotStyle]}>
        <OverviewStatCard
          accessibilityLabel={`Done, ${counts.done}`}
          color={toneColor.done}
          label="Done"
          onPress={() => toggleFilter('done')}
          renderIcon={color => (
            <Star color={color} fill={color} size={16} strokeWidth={2} />
          )}
          selected={selectedFilter === 'done'}
          value={counts.done}
        />
      </View>
    </View>
  );

  const listHeader = (
    <View style={styles.listHeaderRow}>
      <HoystText style={[styles.listHeaderLabel, {color: theme.textMuted}]}>
        Sorted by urgency
      </HoystText>
      {counts.needsYou > 0 ? (
        <View style={styles.needCue}>
          <Zap color={theme.warningForeground} size={13} strokeWidth={2.6} />
          <HoystText
            style={[styles.needCueLabel, {color: theme.warningForeground}]}>
            {counts.needsYou} need you
          </HoystText>
        </View>
      ) : null}
    </View>
  );

  const emptyState =
    groupCircles.length === 0 ? (
      <GlassPanel style={styles.emptyPanel}>
        <HoystText style={styles.emptyTitle}>No circles yet</HoystText>
        <HoystText tone="muted" variant="caption">
          Circles you create or join will collect here.
        </HoystText>
      </GlassPanel>
    ) : (
      <GlassPanel style={styles.emptyPanel}>
        <HoystText style={styles.emptyTitle}>Nothing here right now</HoystText>
        <HoystText tone="muted" variant="caption">
          No circles match this filter yet.
        </HoystText>
        <Pressable
          accessibilityRole="button"
          onPress={() => setSelectedFilter('all')}
          style={({pressed}) => [
            styles.showAll,
            {
              borderColor: theme.borderStrong,
              opacity: pressed ? actionMotion.pressedOpacity : 1,
            },
          ]}>
          <HoystText style={[styles.showAllLabel, {color: theme.text}]}>
            Show all circles
          </HoystText>
        </Pressable>
      </GlassPanel>
    );

  const findMore = (
    <CircleActionCard
      accessibilityLabel="Find more circles"
      onPress={() => navigation.navigate('MainTabs', {screen: 'Explore'})}
      subtitle="Browse public circles in Explore"
      testID="find-more-circles-card"
      title="Find more circles"
    />
  );

  return (
    <HoystScreen
      background={<FrostedBackdrop />}
      contentContainerStyle={styles.content}
      padded={false}>
      <View style={styles.page}>
        {header}

        <View style={styles.headingBlock}>
          <HoystText style={styles.heading}>Your commitments</HoystText>
          <HoystText style={styles.headingSubtitle} tone="muted">
            Personal commitments, active circles, and join requests.
          </HoystText>
        </View>

        <View style={styles.body}>
          {personalCommitments.length > 0 ? (
            <View
              style={styles.listBlock}
              testID="personal-commitments-section">
              <View style={styles.listHeaderRow}>
                <HoystText
                  style={[styles.listHeaderLabel, {color: theme.textMuted}]}>
                  Personal Commitments
                </HoystText>
              </View>
              {personalCommitments.map(commitment => (
                <TodayCircleCard
                  card={commitment}
                  key={commitment.id}
                  onActionPress={() => handleCircleAction(commitment)}
                  onCardPress={() => openCircle(commitment.id)}
                  variant="list"
                />
              ))}
            </View>
          ) : null}

          {overviewRow}

          <View style={styles.listBlock}>
            {listHeader}
            {visibleCircles.length > 0
              ? visibleCircles.map(circle => (
                  <TodayCircleCard
                    card={circle}
                    isNudged={nudgedCircleIds.has(circle.id)}
                    isNudging={nudgingCircleIds.has(circle.id)}
                    key={circle.id}
                    onActionPress={() => handleCircleAction(circle)}
                    onCardPress={() => openCircle(circle.id)}
                    variant="list"
                  />
                ))
              : emptyState}
          </View>

          {findMore}
        </View>
      </View>
    </HoystScreen>
  );
}

const styles = StyleSheet.create({
  body: {
    gap: 18,
    paddingHorizontal: 20,
    paddingTop: 18,
  },
  content: {
    paddingBottom: 56,
  },
  heading: {
    fontSize: 24,
    fontWeight: '800',
    letterSpacing: 0,
    lineHeight: 28,
  },
  headingBlock: {
    gap: 2,
    paddingHorizontal: 20,
    paddingTop: 16,
  },
  headingSubtitle: {
    fontSize: 14,
    fontWeight: '700',
    letterSpacing: 0,
    lineHeight: 18,
  },
  navRow: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
    minHeight: 44,
    paddingHorizontal: 20,
  },
  navSide: {
    flexShrink: 0,
    width: 96,
  },
  navSideEnd: {
    alignItems: 'flex-end',
  },
  navTitle: {
    flex: 1,
    fontSize: 17,
    fontWeight: '800',
    letterSpacing: 0,
    lineHeight: 21,
    textAlign: 'center',
  },
  page: {
    paddingTop: 4,
  },
  emptyPanel: {
    gap: 8,
  },
  emptyTitle: {
    fontSize: 17,
    fontWeight: '800',
    letterSpacing: 0,
    lineHeight: 21,
  },
  listBlock: {
    gap: 12,
  },
  listHeaderLabel: {
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 1.3,
    lineHeight: 15,
    textTransform: 'uppercase',
  },
  listHeaderRow: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 2,
    paddingTop: 4,
  },
  needCue: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 4,
  },
  needCueLabel: {
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 0,
    lineHeight: 15,
  },
  newPill: {
    alignItems: 'center',
    alignSelf: 'flex-end',
    borderRadius: 13,
    elevation: 6,
    flexDirection: 'row',
    flexShrink: 0,
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 10,
    shadowOffset: {height: 6, width: 0},
    shadowOpacity: 0.4,
    shadowRadius: 14,
  },
  newPillLabel: {
    fontSize: 13,
    fontWeight: '800',
    letterSpacing: 0,
    lineHeight: 16,
  },
  showAll: {
    alignItems: 'center',
    alignSelf: 'flex-start',
    borderRadius: radius.pill,
    borderWidth: 1,
    marginTop: 4,
    paddingHorizontal: 16,
    paddingVertical: 9,
  },
  showAllLabel: {
    fontSize: 13,
    fontWeight: '800',
    letterSpacing: 0,
    lineHeight: 16,
  },
  statRow: {
    alignItems: 'stretch',
    alignSelf: 'stretch',
    flexDirection: 'row',
    gap: STAT_ROW_GAP,
    width: '100%',
  },
  statSlot: {
    flexShrink: 0,
  },
});
