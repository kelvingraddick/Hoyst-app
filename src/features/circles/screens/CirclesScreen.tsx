import React, {useEffect, useMemo, useState} from 'react';
import {
  Alert,
  Pressable,
  ScrollView,
  Share,
  StyleSheet,
  View,
} from 'react-native';
import {Plus, Search, UsersRound} from 'lucide-react-native';
import type {BottomTabScreenProps} from '@react-navigation/bottom-tabs';
import type {NativeStackNavigationProp} from '@react-navigation/native-stack';

import {GlassPanel} from '../../../design/components/GlassPanel';
import {HoystButton} from '../../../design/components/HoystButton';
import {HoystChip} from '../../../design/components/HoystChip';
import {HoystInput} from '../../../design/components/HoystInput';
import {HoystScreen} from '../../../design/components/HoystScreen';
import {HoystText} from '../../../design/components/HoystText';
import {LayeredAvatar} from '../../../design/components/LayeredAvatar';
import {SectionHeader} from '../../../design/components/SectionHeader';
import {
  OverviewStatusIcon,
  type OverviewStatusIconKind,
} from '../../../design/components/OverviewStatusIcon';
import {
  CircleCategoryIcon,
  CircleCategoryPill,
  getCircleCategoryForegroundColor,
  getCircleCategoryVisual,
} from '../../../design/components/CircleCategoryIcon';
import {GradientRing} from '../../../design/components/GradientRing';
import {TodayCircleCard} from '../../../design/components/TodayCircleCard';
import {actionMotion} from '../../../design/tokens/actions';
import {brandColors} from '../../../design/tokens/colors';
import {radius} from '../../../design/tokens/radius';
import {useHoystTheme} from '../../../design/theme/useHoystTheme';
import type {
  AppTabsParamList,
  RootStackParamList,
} from '../../../navigation/types';
import {useSessionStore} from '../../../store/session-store';
import type {CircleManagementCard, ExploreCircle} from '../../../types/models';
import {
  createEmptyHomeData,
  getHomeCircleActionVariant,
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

type Props = BottomTabScreenProps<AppTabsParamList, 'Circles'>;
type OverviewTone = 'blue' | 'green' | 'orange' | 'purple' | 'yellow';

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

  if (tone === 'yellow') {
    return theme.isDark ? brandColors.spectrumYellow : '#7A5C00';
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

function OverviewStat({
  iconKind,
  label,
  tone,
  value,
}: {
  iconKind: OverviewStatusIconKind;
  label: string;
  tone: OverviewTone;
  value: number;
}) {
  const theme = useHoystTheme();
  const color = getToneForeground(theme, tone);

  return (
    <View style={styles.overviewStat}>
      <OverviewStatusIcon color={color} kind={iconKind} size={42} />
      <HoystText style={styles.overviewValue}>{value}</HoystText>
      <HoystChip label={label} style={styles.overviewChip} tone={tone} />
    </View>
  );
}

function DiscoverAvatarPreview({circle}: {circle: ExploreCircle}) {
  const theme = useHoystTheme();

  return (
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
  const categoryColor = getCircleCategoryForegroundColor(
    circle.category,
    theme,
  );
  const description = circle.matchCopy ?? circle.commitment;
  const supportingLabel = circle.matchCopy ? circle.commitment : undefined;
  const seatsLabel =
    seatsOpen === 1 ? '1 seat open' : `${seatsOpen} seats open`;

  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      style={({pressed}) => [
        styles.cardPressable,
        {opacity: pressed ? actionMotion.pressedOpacity : 1},
      ]}>
      <GlassPanel style={styles.discoverCard}>
        <View style={styles.discoverBody}>
          <View style={styles.discoverTitleRow}>
            <View style={styles.titleCluster}>
              <CircleCategoryIcon
                category={circle.category}
                size={34}
                style={styles.categoryTitleIcon}
              />
              <HoystText style={styles.discoverTitle}>{circle.title}</HoystText>
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

          <View style={styles.discoverMeta}>
            <CircleCategoryPill category={circle.category} uppercase />
            <HoystChip
              label={circle.joinLabel}
              tone={circle.joinLabel === 'Open seats' ? 'green' : 'purple'}
            />
          </View>

          <View style={styles.discoverCopy}>
            <HoystText numberOfLines={2} tone="muted">
              {description}
            </HoystText>
            {supportingLabel ? (
              <HoystText tone="muted" variant="caption">
                {supportingLabel}
              </HoystText>
            ) : null}
          </View>

          <View style={styles.discoverStats}>
            <View style={styles.statRow}>
              <UsersRound color={categoryColor} size={17} strokeWidth={2.4} />
              <HoystText tone="muted" variant="caption">
                {circle.memberCount}/{circle.maxSize} members
              </HoystText>
            </View>
            <View style={styles.statRow}>
              <GradientRing
                flatColor={categoryColor}
                progress={circle.completionRate / 100}
                size={18}
                strokeWidth={3}
                trackColor={theme.ring}
              />
              <HoystText tone="muted" variant="caption">
                {circle.completionRate}% tapped-in pace
              </HoystText>
            </View>
            <HoystText tone="muted" variant="caption">
              {circle.streakLabel} · {seatsLabel}
            </HoystText>
          </View>

          <View style={styles.discoverFooter}>
            <DiscoverAvatarPreview circle={circle} />

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
                  style={[
                    styles.previewButtonLabel,
                    {color: theme.actionForeground},
                  ]}
                  variant="button">
                  View Circle
                </HoystText>
              </View>
            </Pressable>
          </View>
        </View>
      </GlassPanel>
    </Pressable>
  );
}

function DiscoverySectionCard({
  actionLabel,
  description,
  icon,
  metaLabels,
  onActionPress,
  stats,
  supportingLabel,
  title,
}: {
  actionLabel: string;
  description: string;
  icon: React.ReactNode;
  metaLabels: [string, string];
  onActionPress: () => void;
  stats: [string, string];
  supportingLabel: string;
  title: string;
}) {
  const theme = useHoystTheme();

  return (
    <GlassPanel style={styles.discoverCard}>
      <View style={styles.discoverBody}>
        <View style={styles.discoverTitleRow}>
          <View style={styles.titleCluster}>
            <View
              style={[
                styles.discoveryIcon,
                {
                  backgroundColor: `${theme.accent}12`,
                  borderColor: `${theme.accentForeground}24`,
                },
              ]}>
              {icon}
            </View>
            <HoystText style={styles.discoverTitle}>{title}</HoystText>
          </View>
        </View>

        <View style={styles.discoverMeta}>
          <HoystChip label={metaLabels[0]} tone="purple" />
          <HoystChip label={metaLabels[1]} tone="green" />
        </View>

        <View style={styles.discoverCopy}>
          <HoystText numberOfLines={2} tone="muted">
            {description}
          </HoystText>
          <HoystText tone="muted" variant="caption">
            {supportingLabel}
          </HoystText>
        </View>

        <View style={styles.discoverStats}>
          <View style={styles.statRow}>
            <Search
              color={theme.accentForeground}
              size={17}
              strokeWidth={2.4}
            />
            <HoystText tone="muted" variant="caption">
              {stats[0]}
            </HoystText>
          </View>
          <View style={styles.statRow}>
            <Plus color={theme.successForeground} size={17} strokeWidth={2.4} />
            <HoystText tone="muted" variant="caption">
              {stats[1]}
            </HoystText>
          </View>
        </View>

        <View style={styles.discoveryAction}>
          <HoystButton
            label={actionLabel}
            onPress={onActionPress}
            variant="outline"
          />
        </View>
      </View>
    </GlassPanel>
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

  useEffect(
    () => subscribeToPublicCircles(setPublicCircles, () => undefined),
    [],
  );

  const activeCircles = useMemo(
    () =>
      homeData.circles.filter(
        circle => circle.viewerMembershipStatus !== 'pending',
      ),
    [homeData.circles],
  );
  const needsAttention = useMemo(
    () =>
      sortHomeCircles(
        activeCircles.filter(circle => !circle.viewerHasCheckedIn),
      ),
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
  const hasActiveCircles = activeCircles.length > 0;
  const sourcePublicCircles =
    publicCircles.length > 0 ? publicCircles : exploreCircles;
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
    const actionVariant = getHomeCircleActionVariant(circle);

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

  const overviewSection = (
    <GlassPanel padding="compact" style={styles.overview}>
      <HoystText tone="muted" variant="bodyStrong">
        Overview
      </HoystText>
      <View style={styles.overviewRow}>
        <OverviewStat
          iconKind="needsTap"
          label="Needs You"
          tone="orange"
          value={needsAttention.length}
        />
        <View
          style={[
            styles.overviewDivider,
            {backgroundColor: theme.borderStrong},
          ]}
        />
        <OverviewStat
          iconKind="pending"
          label="Pending"
          tone="yellow"
          value={pendingCount}
        />
        <View
          style={[
            styles.overviewDivider,
            {backgroundColor: theme.borderStrong},
          ]}
        />
        <OverviewStat
          iconKind="onTrack"
          label="On Track"
          tone="blue"
          value={onTrackCount}
        />
        <View
          style={[
            styles.overviewDivider,
            {backgroundColor: theme.borderStrong},
          ]}
        />
        <OverviewStat
          iconKind="completedToday"
          label="Done"
          tone="green"
          value={completedTodayCount}
        />
      </View>
    </GlassPanel>
  );

  const needAttentionSection = (
    <>
      <SectionHeader
        description="Circles that need your Tap In to keep moving."
        title="Need Attention"
      />
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
          <SectionHeader
            description="When a Tap In, nudge, or circle update needs attention, it will show up here."
            title="No circles need you right now"
          />
        </GlassPanel>
      )}
    </>
  );

  const allCirclesSection = (
    <>
      <SectionHeader
        description="Everything you have joined or requested to join."
        title="All Circles"
      />
      {allCircles.length > 0 ? (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={styles.allCirclesScroll}
          contentContainerStyle={styles.allCirclesScrollContent}>
          {allCircles.map(circle => (
            <TodayCircleCard
              card={circle}
              isNudged={nudgedCircleIds.has(circle.id)}
              isNudging={nudgingCircleIds.has(circle.id)}
              key={circle.id}
              onActionPress={() => handleCircleAction(circle)}
              onCardPress={() => openCircle(circle.id)}
              variant="upcoming"
            />
          ))}
        </ScrollView>
      ) : (
        <GlassPanel style={styles.emptyPanel}>
          <SectionHeader
            description="Public Circles and your own created Circles will collect here."
            title="No circles yet"
          />
        </GlassPanel>
      )}
    </>
  );

  const startPanel = (
    <DiscoverySectionCard
      actionLabel="Create Circle"
      description="Browse public Circles below, or create a Circle around the habit you want to keep moving."
      icon={<Plus color={theme.accentForeground} size={28} strokeWidth={2.6} />}
      metaLabels={['Find Circles', 'Start your own']}
      onActionPress={() => rootNavigation?.navigate('CreateCircle')}
      stats={[
        'Public Circles are ready to browse',
        'Private rhythms start here',
      ]}
      supportingLabel="Find people already moving, or build the space you need."
      title="Find Circles or start your own"
    />
  );

  const discoverSection = (
    <>
      <SectionHeader
        description="Browse public Circles with open seats, steady Tap Ins, and members moving at your pace."
        title="Find Circles"
      />

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
        <DiscoverySectionCard
          actionLabel="Clear filters"
          description="Try a different search or switch categories to keep browsing."
          icon={
            <Search
              color={theme.accentForeground}
              size={27}
              strokeWidth={2.5}
            />
          }
          metaLabels={['No matches', 'Filters active']}
          onActionPress={() => {
            setActiveCategory('All');
            setSearchTerm('');
          }}
          stats={[
            'Search terms narrow the list',
            'Categories can hide matches',
          ]}
          supportingLabel="Clearing filters brings every public Circle back into view."
          title="No Circles found"
        />
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
          {discoverSection}
        </>
      ) : (
        <>
          {startPanel}
          {discoverSection}
          {allCirclesSection}
        </>
      )}
    </HoystScreen>
  );
}

const styles = StyleSheet.create({
  allCirclesScroll: {
    marginHorizontal: -20,
  },
  allCirclesScrollContent: {
    gap: 12,
    paddingHorizontal: 20,
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
  content: {
    paddingBottom: 176,
  },
  discoverCard: {
    minHeight: 250,
  },
  discoverBody: {
    gap: 13,
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
  discoverMeta: {
    alignItems: 'center',
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
    flexShrink: 1,
    fontSize: 21,
    fontWeight: '800',
    letterSpacing: 0,
    lineHeight: 25,
    minWidth: 0,
  },
  emptyPanel: {
    gap: 16,
  },
  discoverTitleRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 10,
    justifyContent: 'space-between',
  },
  discoveryAction: {
    alignItems: 'stretch',
    marginTop: 2,
  },
  discoveryIcon: {
    alignItems: 'center',
    borderRadius: radius.lg,
    borderWidth: 1,
    height: 42,
    justifyContent: 'center',
    width: 42,
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
  overviewChip: {
    alignSelf: 'center',
  },
  overviewDivider: {
    alignSelf: 'stretch',
    marginVertical: 10,
    opacity: 0.68,
    width: StyleSheet.hairlineWidth,
  },
  overviewRow: {
    alignItems: 'stretch',
    flexDirection: 'row',
  },
  overviewStat: {
    alignItems: 'center',
    flex: 1,
    gap: 4,
    minHeight: 100,
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
  statRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 8,
  },
  titleCluster: {
    alignItems: 'center',
    flex: 1,
    flexDirection: 'row',
    gap: 10,
    minWidth: 0,
  },
});
