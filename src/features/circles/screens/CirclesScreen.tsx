import React, {useEffect, useMemo, useState} from 'react';
import {Alert, Pressable, Share, StyleSheet, View} from 'react-native';
import {Plus, Search, UsersRound} from 'lucide-react-native';
import type {BottomTabScreenProps} from '@react-navigation/bottom-tabs';
import type {NativeStackNavigationProp} from '@react-navigation/native-stack';

import {ActivityFeedCard} from '../../../design/components/ActivityFeedCard';
import {GlassPanel} from '../../../design/components/GlassPanel';
import {HoystButton} from '../../../design/components/HoystButton';
import {HoystChip} from '../../../design/components/HoystChip';
import {HoystInput} from '../../../design/components/HoystInput';
import {HoystScreen} from '../../../design/components/HoystScreen';
import {HoystText} from '../../../design/components/HoystText';
import {LayeredAvatar} from '../../../design/components/LayeredAvatar';
import {
  OverviewStatusIcon,
  type OverviewStatusIconKind,
} from '../../../design/components/OverviewStatusIcon';
import {
  CircleCategoryPill,
  getCircleCategoryVisual,
} from '../../../design/components/CircleCategoryIcon';
import {
  TodayCircleCard,
  getTodayCircleCardActionVariant,
} from '../../../design/components/TodayCircleCard';
import {actionMotion} from '../../../design/tokens/actions';
import {radius} from '../../../design/tokens/radius';
import {useHoystTheme} from '../../../design/theme/useHoystTheme';
import type {AppTabsParamList, RootStackParamList} from '../../../navigation/types';
import {useSessionStore} from '../../../store/session-store';
import type {
  CircleActivityItem,
  CircleManagementCard,
  ExploreCircle,
  InboxEvent,
} from '../../../types/models';
import {
  createEmptyHomeData,
  sortHomeCircles,
  subscribeToHomeData,
  type HomeData,
} from '../../home/services/home-data-service';
import {useUserProfileStore} from '../../../store/profile-store';
import {exploreCircles} from '../mockData';
import {nudgeCircleMembers} from '../services/circle-service';
import {
  filterPublicCircles,
  getPublicCircleCategories,
} from '../services/circles-screen-selectors';
import {subscribeToPublicCircles} from '../services/public-circle-service';
import {
  markInboxEventRead,
  subscribeToInboxEvents,
} from '../../settings/services/notification-settings-service';

type Props = BottomTabScreenProps<AppTabsParamList, 'Circles'>;
type OverviewTone = 'blue' | 'green' | 'orange' | 'purple';

function getInitials(name: string) {
  return name
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map(part => part[0]?.toUpperCase() ?? '')
    .join('');
}

function getToneForeground(
  theme: ReturnType<typeof useHoystTheme>,
  tone: React.ComponentProps<typeof HoystChip>['tone'] | OverviewTone,
) {
  if (tone === 'green') {
    return theme.successForeground;
  }

  if (tone === 'orange') {
    return theme.warningForeground;
  }

  if (tone === 'blue') {
    return theme.accentTertiaryForeground;
  }

  if (tone === 'purple') {
    return theme.accentSecondaryForeground;
  }

  return theme.textMuted;
}

function getCompletionTone(
  theme: ReturnType<typeof useHoystTheme>,
  completionRate: number,
) {
  if (completionRate >= 85) {
    return theme.successForeground;
  }

  if (completionRate >= 75) {
    return theme.accentSecondaryForeground;
  }

  return theme.warningForeground;
}

function canInvite(circle: CircleManagementCard) {
  return Boolean(
    circle.inviteUrl &&
      (circle.viewerRole === 'owner' || circle.viewerRole === 'admin'),
  );
}

function mapInboxEventToActivity(event: InboxEvent): CircleActivityItem {
  const actorName = event.actor?.displayName ?? event.title;

  return {
    actorAvatarUrl: event.actor?.avatarUrl,
    actorInitials: getInitials(actorName) || 'HO',
    actorName,
    actionLabel: event.type === 'join_request' ? 'Review' : 'Update',
    id: event.id,
    message: event.body,
    timestamp: event.createdAtLabel,
    tone:
      event.type === 'circle_at_risk' ||
      event.type === 'tap_in_final_warning'
        ? 'alert'
        : event.type === 'join_approved' || event.type === 'member_joined'
        ? 'success'
        : 'pending',
  };
}

function OverviewStat({
  detail,
  iconKind,
  label,
  tone,
  value,
}: {
  detail: string;
  iconKind: OverviewStatusIconKind;
  label: string;
  tone: OverviewTone;
  value: number;
}) {
  const theme = useHoystTheme();
  const color = getToneForeground(theme, tone);

  return (
    <View style={styles.overviewStat}>
      <OverviewStatusIcon kind={iconKind} size={42} />
      <HoystText style={styles.overviewValue}>{value}</HoystText>
      <HoystText
        adjustsFontSizeToFit
        minimumFontScale={0.78}
        numberOfLines={1}
        style={[styles.overviewLabel, {color}]}>
        {label}
      </HoystText>
      <HoystText
        adjustsFontSizeToFit
        minimumFontScale={0.82}
        numberOfLines={1}
        style={styles.overviewDetail}
        tone="muted">
        {detail}
      </HoystText>
    </View>
  );
}

function DiscoverCircleCard({
  circle,
  onPress,
}: {
  circle: ExploreCircle;
  onPress: () => void;
}) {
  const theme = useHoystTheme();
  const seatsOpen = Math.max(circle.maxSize - circle.memberCount, 0);
  const completionTone = getCompletionTone(theme, circle.completionRate);

  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      style={({pressed}) => [
        styles.cardPressable,
        {opacity: pressed ? actionMotion.pressedOpacity : 1},
      ]}>
      <GlassPanel style={styles.discoverCard}>
        <View style={styles.discoverHeader}>
          <View style={styles.discoverMeta}>
            <CircleCategoryPill category={circle.category} uppercase />
            <HoystText style={{color: theme.warningForeground}} variant="caption">
              {circle.streakLabel}
            </HoystText>
          </View>
          <View
            style={[
              styles.completionBadge,
              {
                backgroundColor: `${completionTone}14`,
                borderColor: `${completionTone}55`,
              },
            ]}>
            <HoystText style={{color: completionTone}} variant="caption">
              {circle.completionRate}%
            </HoystText>
          </View>
        </View>

        <View style={styles.discoverCopy}>
          <HoystText style={styles.discoverTitle}>{circle.title}</HoystText>
          <HoystText tone="muted">{circle.commitment}</HoystText>
          <HoystText tone="muted" variant="caption">
            {circle.matchCopy}
          </HoystText>
        </View>

        <View style={styles.discoverStats}>
          <HoystChip
            label={circle.joinLabel}
            tone={circle.joinLabel === 'Open seats' ? 'green' : 'purple'}
          />
          <View style={styles.statRow}>
            <UsersRound
              color={theme.accentForeground}
              size={17}
              strokeWidth={2.4}
            />
            <HoystText tone="muted" variant="caption">
              {circle.memberCount}/{circle.maxSize} members
            </HoystText>
          </View>
          <HoystText tone="muted" variant="caption">
            {seatsOpen} seats open
          </HoystText>
        </View>

        <View style={styles.discoverFooter}>
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
                  size={36}
                  state={member.state}
                />
              </View>
            ))}
            {circle.members.length > 3 ? (
              <View
                style={[
                  styles.moreCountBubble,
                  {backgroundColor: theme.surfaceHigh},
                ]}>
                <HoystText style={styles.moreCount} tone="muted" variant="caption">
                  +{circle.members.length - 3}
                </HoystText>
              </View>
            ) : null}
          </View>

          <Pressable
            accessibilityRole="button"
            onPress={event => {
              event.stopPropagation();
              onPress();
            }}
            style={({pressed}) => [
              styles.previewButtonPressable,
              {opacity: pressed ? actionMotion.pressedOpacity : 1},
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
                Preview
              </HoystText>
            </View>
          </Pressable>
        </View>
      </GlassPanel>
    </Pressable>
  );
}

export function CirclesScreen({navigation}: Props): React.JSX.Element {
  const theme = useHoystTheme();
  const status = useSessionStore(state => state.status);
  const user = useSessionStore(state => state.user);
  const profile = useUserProfileStore(state => state.profile);
  const [homeData, setHomeData] = useState<HomeData>(() =>
    createEmptyHomeData(),
  );
  const [publicCircles, setPublicCircles] = useState<ExploreCircle[]>([]);
  const [events, setEvents] = useState<InboxEvent[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [activeCategory, setActiveCategory] = useState('All');
  const [nudgedCircleIds, setNudgedCircleIds] = useState<Set<string>>(
    () => new Set(),
  );
  const [nudgingCircleIds, setNudgingCircleIds] = useState<Set<string>>(
    () => new Set(),
  );
  const rootNavigation =
    navigation.getParent<NativeStackNavigationProp<RootStackParamList>>();
  const timezone = profile?.timezone ?? 'UTC';
  const canLoad = status === 'authenticatedReady' && Boolean(user?.uid);

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

  useEffect(() => subscribeToPublicCircles(setPublicCircles, () => undefined), []);

  useEffect(() => {
    if (!canLoad || !user?.uid) {
      setEvents([]);
      return undefined;
    }

    return subscribeToInboxEvents({
      onEvents: setEvents,
      uid: user.uid,
    });
  }, [canLoad, user?.uid]);

  const activeCircles = useMemo(
    () =>
      homeData.circles.filter(
        circle => circle.viewerMembershipStatus !== 'pending',
      ),
    [homeData.circles],
  );
  const needsAttention = useMemo(
    () => sortHomeCircles(activeCircles.filter(circle => !circle.viewerHasCheckedIn)),
    [activeCircles],
  );
  const allCircles = useMemo(
    () => sortHomeCircles(homeData.circles),
    [homeData.circles],
  );
  const onTrackCount = activeCircles.filter(
    circle => circle.viewerHasCheckedIn && circle.state !== 'done',
  ).length;
  const completedTodayCount = activeCircles.filter(
    circle => circle.state === 'done',
  ).length;
  const pendingCount = homeData.circles.filter(
    circle => circle.viewerMembershipStatus === 'pending',
  ).length;
  const companionUpdates = events.slice(0, 2).map(mapInboxEventToActivity);
  const hasActiveCircles = activeCircles.length > 0;
  const sourcePublicCircles = publicCircles.length > 0 ? publicCircles : exploreCircles;
  const categories = useMemo(
    () => getPublicCircleCategories(sourcePublicCircles),
    [sourcePublicCircles],
  );
  const filteredPublicCircles = useMemo(
    () => filterPublicCircles(sourcePublicCircles, activeCategory, searchTerm),
    [activeCategory, searchTerm, sourcePublicCircles],
  );

  useEffect(() => {
    if (!categories.includes(activeCategory)) {
      setActiveCategory('All');
    }
  }, [activeCategory, categories]);

  const openCircle = (circleId: string) => {
    rootNavigation?.navigate('CircleDetail', {circleId});
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
    const actionVariant = getTodayCircleCardActionVariant(circle);

    if (circle.viewerMembershipStatus === 'pending') {
      openCircle(circle.id);
      return;
    }

    if (actionVariant === 'check_in') {
      rootNavigation?.navigate('TapInComposer', {
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

  const openEvent = (event: InboxEvent) => {
    markInboxEventRead(event.id).catch(() => undefined);

    if (event.deeplink.screen === 'TapInComposer') {
      rootNavigation?.navigate('TapInComposer', {
        circleId: event.deeplink.circleId,
        source: event.deeplink.source,
      });
      return;
    }

    if (event.deeplink.screen === 'CircleDetail') {
      rootNavigation?.navigate('CircleDetail', {
        circleId: event.deeplink.circleId,
      });
    }
  };

  const overviewSection = (
    <GlassPanel padding="compact" style={styles.overview}>
      <View style={styles.overviewHeader}>
        <HoystText variant="subtitle">Overview</HoystText>
      </View>
      <View style={styles.overviewRow}>
        <OverviewStat
          detail="Your attention"
          iconKind="needsTap"
          label="Needs Tap"
          tone="purple"
          value={needsAttention.length}
        />
        <View
          style={[
            styles.overviewDivider,
            {backgroundColor: theme.borderStrong},
          ]}
        />
        <OverviewStat
          detail="Awaiting approval"
          iconKind="pending"
          label="Pending"
          tone="orange"
          value={pendingCount}
        />
        <View
          style={[
            styles.overviewDivider,
            {backgroundColor: theme.borderStrong},
          ]}
        />
        <OverviewStat
          detail="Keep it going"
          iconKind="onTrack"
          label="On Track"
          tone="green"
          value={onTrackCount}
        />
        <View
          style={[
            styles.overviewDivider,
            {backgroundColor: theme.borderStrong},
          ]}
        />
        <OverviewStat
          detail="Nice work!"
          iconKind="completedToday"
          label="Completed Today"
          tone="purple"
          value={completedTodayCount}
        />
      </View>
    </GlassPanel>
  );

  const needAttentionSection = (
    <>
      <View style={styles.sectionHeader}>
        <View>
          <HoystText variant="subtitle">Need Attention</HoystText>
          <HoystText tone="muted" variant="caption">
            Circles that need your Tap In to keep moving.
          </HoystText>
        </View>
      </View>
      {needsAttention.length > 0 ? (
        needsAttention.map(circle => (
          <TodayCircleCard
            card={circle}
            isNudged={nudgedCircleIds.has(circle.id)}
            isNudging={nudgingCircleIds.has(circle.id)}
            key={circle.id}
            onActionPress={() => handleCircleAction(circle)}
            onCardPress={() => openCircle(circle.id)}
            variant="today"
          />
        ))
      ) : (
        <GlassPanel>
          <HoystText variant="subtitle">No circles need you right now</HoystText>
          <HoystText tone="muted">
            When a Tap In, nudge, or circle update needs attention, it will show
            up here.
          </HoystText>
        </GlassPanel>
      )}
    </>
  );

  const allCirclesSection = (
    <>
      <View style={styles.sectionHeader}>
        <View>
          <HoystText variant="subtitle">All Circles</HoystText>
          <HoystText tone="muted" variant="caption">
            Everything you have joined or requested to join.
          </HoystText>
        </View>
      </View>
      {allCircles.length > 0 ? (
        <View style={styles.allCirclesGrid}>
          {allCircles.map(circle => (
            <View key={circle.id} style={styles.allCircleTile}>
              <TodayCircleCard
                card={circle}
                isNudged={nudgedCircleIds.has(circle.id)}
                isNudging={nudgingCircleIds.has(circle.id)}
                onActionPress={() => handleCircleAction(circle)}
                onCardPress={() => openCircle(circle.id)}
                variant="active"
              />
            </View>
          ))}
        </View>
      ) : (
        <GlassPanel style={styles.emptyPanel}>
          <View style={styles.emptyCopy}>
            <HoystText variant="subtitle">No circles yet</HoystText>
            <HoystText tone="muted">
              Public Circles and your own created Circles will collect here.
            </HoystText>
          </View>
        </GlassPanel>
      )}
    </>
  );

  const companionUpdatesSection = (
    <>
      <View style={styles.sectionHeader}>
        <View>
          <HoystText variant="subtitle">Companion Updates</HoystText>
          <HoystText tone="muted" variant="caption">
            What is happening in your circles.
          </HoystText>
        </View>
      </View>
      {companionUpdates.length > 0 ? (
        companionUpdates.map((item, index) => (
          <Pressable key={item.id} onPress={() => openEvent(events[index])}>
            <ActivityFeedCard item={item} />
          </Pressable>
        ))
      ) : (
        <GlassPanel>
          <HoystText variant="subtitle">No companion updates yet</HoystText>
          <HoystText tone="muted">
            Nudges, joins, and circle milestones will appear here.
          </HoystText>
        </GlassPanel>
      )}
    </>
  );

  const startPanel = (
    <GlassPanel style={styles.emptyPanel}>
      <View style={styles.emptyCopy}>
        <HoystText variant="title">Find Circles or start your own</HoystText>
        <HoystText tone="muted">
          Browse public Circles below, or create a Circle around the habit you
          want to keep moving.
        </HoystText>
      </View>
      <View style={styles.emptyActions}>
        <HoystButton
          label="Create Circle"
          onPress={() => rootNavigation?.navigate('CreateCircle')}
          variant="outline"
        />
      </View>
    </GlassPanel>
  );

  const discoverSection = (
    <>
      <View style={styles.findHeader}>
        <HoystText variant="subtitle">Find Circles</HoystText>
        <HoystText tone="muted">
          Browse public Circles with open seats, steady Tap Ins, and members
          moving at your pace.
        </HoystText>
      </View>

      <View style={styles.searchWrap}>
        <Search
          color={theme.textMuted}
          size={18}
          strokeWidth={2.2}
          style={styles.searchIcon}
        />
        <HoystInput
          containerStyle={styles.searchInput}
          onChangeText={setSearchTerm}
          placeholder="Search Circles, categories, or Commitments"
          value={searchTerm}
        />
      </View>

      <View style={styles.filterRow}>
        {categories.map(category => {
          const isActive = activeCategory === category;
          const isAllCategory = category === 'All';
          const categoryVisual = isAllCategory
            ? undefined
            : getCircleCategoryVisual(category);
          const tone = categoryVisual?.tone ?? 'neutral';
          const borderColor =
            categoryVisual?.accentColor ?? getToneForeground(theme, tone);
          const chipStyle = [
            styles.filterChip,
            isActive
              ? {
                  backgroundColor: theme.surfaceStrong,
                  borderColor,
                }
              : styles.filterChipInactive,
          ];

          return (
            <Pressable
              accessibilityRole="button"
              accessibilityState={{selected: isActive}}
              key={category}
              onPress={() => setActiveCategory(category)}
              style={({pressed}) => [
                styles.filterChipButton,
                {opacity: pressed ? actionMotion.pressedOpacity : 1},
              ]}>
              {isAllCategory ? (
                <HoystChip label={category} style={chipStyle} tone={tone} />
              ) : (
                <CircleCategoryPill category={category} style={chipStyle} />
              )}
            </Pressable>
          );
        })}
      </View>

      <View style={styles.resultsHeader}>
        <HoystText tone="muted" variant="label">
          Discover Circles
        </HoystText>
        <HoystText tone="muted" variant="caption">
          {filteredPublicCircles.length} match
          {filteredPublicCircles.length === 1 ? '' : 'es'}
        </HoystText>
      </View>

      {filteredPublicCircles.length > 0 ? (
        filteredPublicCircles.map(circle => (
          <DiscoverCircleCard
            circle={circle}
            key={circle.id}
            onPress={() => openCircle(circle.id)}
          />
        ))
      ) : (
        <GlassPanel style={styles.emptyPanel}>
          <View style={styles.emptyCopy}>
            <HoystText variant="subtitle">No Circles found</HoystText>
            <HoystText tone="muted">
              Try a different search or switch categories to keep browsing.
            </HoystText>
          </View>
          <View style={styles.emptyActions}>
            <HoystButton
              label="Clear filters"
              onPress={() => {
                setActiveCategory('All');
                setSearchTerm('');
              }}
              variant="outline"
            />
          </View>
        </GlassPanel>
      )}
    </>
  );

  return (
    <HoystScreen contentContainerStyle={styles.content}>
      <View style={styles.header}>
        <View style={styles.headerCopy}>
          <HoystText variant="headline">Circles</HoystText>
          <HoystText tone="muted">
            Your active commitments and new circles to join.
          </HoystText>
        </View>
        <Pressable
          accessibilityRole="button"
          onPress={() => rootNavigation?.navigate('CreateCircle')}
          style={({pressed}) => [
            styles.newCircle,
            {opacity: pressed ? actionMotion.pressedOpacity : 1},
          ]}>
          <View
            style={[
              styles.newCircleIcon,
              {backgroundColor: `${theme.accent}12`},
            ]}>
            <Plus color={theme.accentForeground} size={32} strokeWidth={2.6} />
          </View>
          <HoystText
            style={[styles.newCircleLabel, {color: theme.accentForeground}]}
            variant="caption">
            New Circle
          </HoystText>
        </Pressable>
      </View>

      {hasActiveCircles ? (
        <>
          {overviewSection}
          {needAttentionSection}
          {allCirclesSection}
          {companionUpdatesSection}
          {discoverSection}
        </>
      ) : (
        <>
          {startPanel}
          {discoverSection}
          {allCirclesSection}
          {companionUpdatesSection}
        </>
      )}
    </HoystScreen>
  );
}

const styles = StyleSheet.create({
  allCirclesGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  allCircleTile: {
    width: '100%',
  },
  avatarOffset: {
    borderRadius: radius.pill,
  },
  avatarOverlap: {
    marginLeft: -13,
  },
  avatarRow: {
    alignItems: 'center',
    flexDirection: 'row',
    flex: 1,
    minWidth: 0,
  },
  cardPressable: {
    borderRadius: radius.lg,
  },
  completionBadge: {
    alignItems: 'center',
    borderRadius: radius.pill,
    borderWidth: 1,
    minWidth: 54,
    paddingHorizontal: 10,
    paddingVertical: 7,
  },
  content: {
    paddingBottom: 176,
  },
  discoverCard: {
    minHeight: 238,
  },
  discoverCopy: {
    gap: 7,
  },
  discoverFooter: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 12,
    justifyContent: 'space-between',
  },
  discoverHeader: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 10,
    justifyContent: 'space-between',
  },
  discoverMeta: {
    alignItems: 'center',
    flex: 1,
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    minWidth: 0,
  },
  discoverStats: {
    alignItems: 'center',
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  discoverTitle: {
    fontSize: 22,
    fontWeight: '800',
    letterSpacing: 0,
    lineHeight: 26,
  },
  emptyActions: {
    gap: 12,
  },
  emptyCopy: {
    gap: 8,
  },
  emptyPanel: {
    gap: 16,
  },
  filterChip: {
    borderRadius: radius.pill,
    borderWidth: 1,
  },
  filterChipButton: {
    borderRadius: radius.pill,
  },
  filterChipInactive: {
    borderColor: 'transparent',
  },
  filterRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  findHeader: {
    gap: 8,
  },
  header: {
    alignItems: 'flex-start',
    flexDirection: 'row',
    gap: 16,
    justifyContent: 'space-between',
  },
  headerCopy: {
    flex: 1,
    gap: 8,
    minWidth: 0,
  },
  moreCount: {
    fontSize: 14,
    fontWeight: '700',
    letterSpacing: 0,
    lineHeight: 16,
  },
  moreCountBubble: {
    alignItems: 'center',
    borderRadius: radius.pill,
    height: 36,
    justifyContent: 'center',
    marginLeft: -13,
    width: 36,
  },
  newCircle: {
    alignItems: 'center',
    borderRadius: radius.lg,
    gap: 14,
    justifyContent: 'center',
    minHeight: 80,
    width: 98,
  },
  newCircleIcon: {
    alignItems: 'center',
    alignSelf: 'center',
    borderRadius: 29,
    height: 58,
    justifyContent: 'center',
    width: 58,
  },
  newCircleLabel: {
    flexShrink: 0,
    fontSize: 14,
    fontWeight: '800',
    letterSpacing: 0,
    lineHeight: 17,
    marginTop: 2,
    textAlign: 'center',
    width: 98,
  },
  overview: {
    gap: 14,
  },
  overviewDetail: {
    fontSize: 10,
    letterSpacing: 0,
    lineHeight: 13,
    maxWidth: '100%',
    textAlign: 'center',
  },
  overviewDivider: {
    alignSelf: 'stretch',
    marginVertical: 10,
    opacity: 0.68,
    width: StyleSheet.hairlineWidth,
  },
  overviewHeader: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  overviewLabel: {
    fontSize: 10.5,
    fontWeight: '800',
    letterSpacing: 0,
    lineHeight: 13,
    maxWidth: '100%',
    textAlign: 'center',
  },
  overviewRow: {
    alignItems: 'stretch',
    flexDirection: 'row',
  },
  overviewStat: {
    alignItems: 'center',
    flex: 1,
    gap: 4,
    minHeight: 118,
    minWidth: 0,
    paddingHorizontal: 2,
    paddingVertical: 2,
  },
  overviewValue: {
    fontSize: 28,
    fontWeight: '800',
    letterSpacing: 0,
    lineHeight: 32,
    textAlign: 'center',
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
    borderRadius: radius.pill,
    flexShrink: 0,
  },
  resultsHeader: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  searchIcon: {
    left: 16,
    position: 'absolute',
    top: 19,
    zIndex: 1,
  },
  searchInput: {
    paddingLeft: 44,
  },
  searchWrap: {
    position: 'relative',
  },
  sectionHeader: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  statRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 8,
  },
});
