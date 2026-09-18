import React, {useCallback, useEffect, useMemo, useState} from 'react';
import {
  Alert,
  FlatList,
  Modal,
  Pressable,
  Share,
  StatusBar,
  StyleSheet,
  View,
} from 'react-native';
import {
  ArrowLeft,
  CalendarClock,
  Check,
  ChevronDown,
  History,
  Plus,
  Search,
  Star,
  TrendingUp,
  Zap,
} from 'lucide-react-native';
import {SafeAreaView} from 'react-native-safe-area-context';
import type {NativeStackScreenProps} from '@react-navigation/native-stack';

import {
  DesignSystemProvider,
  DSButton,
  DSCommitmentPreview,
  DSFeedback,
  DSIconButton,
  DSListRow,
  DSSectionHeading,
  DSSurface,
  DSText,
  layout,
  minimumTarget,
  radii,
  space,
  useSystemTheme,
} from '../../../design/system';
import type {RootStackParamList} from '../../../navigation/types';
import {useSessionStore} from '../../../store/session-store';
import {useSettingsStore} from '../../../store/settings-store';
import {useUserProfileStore} from '../../../store/profile-store';
import type {CircleManagementCard} from '../../../types/models';
import {
  canTapInToday,
  createEmptyHomeData,
  getHomeCircleActionVariant,
  sortHomeCircles,
  subscribeToHomeData,
  type HomeData,
} from '../../home/services/home-data-service';
import {nudgeCircleMembers} from '../services/circle-service';
import {getCircleCycleProgressPresentation} from '../../commitments/cycle-progress-presentation';
import {getCommitmentGoalPresentation} from '../../commitments/commitment-goal-label';
import {
  subscribeToPastCircles,
  type PastCircleSummary,
} from '../services/past-circle-service';

type Props = NativeStackScreenProps<RootStackParamList, 'Circles'>;
type CirclesFilter = 'all' | 'needsYou' | 'pending' | 'onTrack' | 'done';
type CirclesSort = 'urgency' | 'name' | 'progress';
type StatusFilter = Exclude<CirclesFilter, 'all'>;

const FILTERS: readonly StatusFilter[] = [
  'needsYou',
  'pending',
  'onTrack',
  'done',
];

function hasViewerMetCycleGoal(circle: CircleManagementCard) {
  return (
    circle.commitmentCadence !== 'daily' &&
    (circle.viewerCycleRequiredCount ?? 0) > 0 &&
    (circle.viewerCycleCoveredCount ?? 0) >=
      (circle.viewerCycleRequiredCount ?? 0)
  );
}

function getCircleStatus(circle: CircleManagementCard): StatusFilter {
  if (circle.viewerMembershipStatus === 'pending') {
    return 'pending';
  }
  if (hasViewerMetCycleGoal(circle)) {
    return 'done';
  }
  if (canTapInToday(circle)) {
    return 'needsYou';
  }
  if (circle.state === 'done') {
    return 'done';
  }
  return 'onTrack';
}

function matchesCirclesFilter(
  circle: CircleManagementCard,
  filter: CirclesFilter,
) {
  return filter === 'all' || getCircleStatus(circle) === filter;
}

function sortCircles(
  circles: readonly CircleManagementCard[],
  sort: CirclesSort,
) {
  if (sort === 'name') {
    return [...circles].sort((left, right) =>
      left.title.localeCompare(right.title),
    );
  }
  if (sort === 'progress') {
    return [...circles].sort((left, right) => {
      const progress = left.progressPercent - right.progressPercent;
      return progress || left.title.localeCompare(right.title);
    });
  }
  return sortHomeCircles([...circles]);
}

function canInvite(circle: CircleManagementCard) {
  return Boolean(
    circle.inviteUrl &&
      (circle.viewerRole === 'owner' || circle.viewerRole === 'admin'),
  );
}

function actionLabel(circle: CircleManagementCard) {
  if (hasViewerMetCycleGoal(circle)) {
    return undefined;
  }
  const variant = getHomeCircleActionVariant(circle);
  if (variant === 'check_in') {
    return circle.viewerCanUpdateTapIn && circle.viewerHasTappedInToday
      ? 'Update Tap In'
      : 'Tap In';
  }
  if (variant === 'nudge') {
    return 'Nudge';
  }
  if (variant === 'share') {
    return 'Share';
  }
  return undefined;
}

function statusCopy(circle: CircleManagementCard, isNudged: boolean) {
  if (circle.viewerMembershipStatus === 'pending') {
    return 'Pending approval';
  }
  if (hasViewerMetCycleGoal(circle)) {
    return circle.commitmentCadence === 'monthly'
      ? 'Monthly goal met'
      : 'Weekly goal met';
  }
  if (canTapInToday(circle)) {
    return 'Needs your Tap In';
  }
  if (isNudged || circle.viewerHasNudgedToday) {
    return 'Nudged today';
  }
  if (getHomeCircleActionVariant(circle) === 'nudge') {
    const count = circle.nudgeTargetCount ?? 0;
    return `${count} member${count === 1 ? '' : 's'} need${
      count === 1 ? 's' : ''
    } a nudge`;
  }
  if (circle.state === 'done') {
    return 'Complete';
  }
  if (circle.viewerHasTappedInToday) {
    return 'Tapped in today';
  }
  return 'On track';
}

function memberContext(circle: CircleManagementCard) {
  return getCircleCycleProgressPresentation(circle).listLabel;
}

function memberSources(circle: CircleManagementCard) {
  if (circle.circleMode === 'personal') {
    return [];
  }
  return circle.members.slice(0, 3).map(member => ({
    id: member.id,
    name: member.name,
    source:
      member.avatarImage ??
      (member.avatarUrl ? {uri: member.avatarUrl} : undefined),
  }));
}

function FilterIcon({filter}: {filter: StatusFilter}) {
  const theme = useSystemTheme();
  if (filter === 'needsYou') {
    return (
      <Zap color={theme.warning} size={layout.statIcon} strokeWidth={2.4} />
    );
  }
  if (filter === 'pending') {
    return (
      <CalendarClock
        color={theme.warning}
        size={layout.statIcon}
        strokeWidth={2.2}
      />
    );
  }
  if (filter === 'onTrack') {
    return (
      <TrendingUp
        color={theme.action}
        size={layout.statIcon}
        strokeWidth={2.4}
      />
    );
  }
  return (
    <Star
      color={theme.success}
      fill={theme.success}
      size={layout.statIcon}
      strokeWidth={2}
    />
  );
}

function filterLabel(filter: StatusFilter) {
  if (filter === 'needsYou') {
    return 'Needs you';
  }
  if (filter === 'onTrack') {
    return 'On track';
  }
  return filter === 'pending' ? 'Pending' : 'Done';
}

function CommitmentSeparator() {
  return <View style={styles.itemSeparator} />;
}

function CirclesStatusSummary({
  counts,
  selected,
  onSelect,
}: {
  counts: Record<StatusFilter, number>;
  selected: CirclesFilter;
  onSelect: (filter: StatusFilter) => void;
}) {
  const theme = useSystemTheme();
  return (
    <DSSurface
      kind="statistics"
      raised
      style={[styles.filterSurface, {backgroundColor: theme.surface}]}
      testID="circles-status-summary">
      <View style={styles.filterItems}>
        {FILTERS.map((filter, index) => {
          const label = filterLabel(filter);
          const isSelected = selected === filter;
          const tone =
            filter === 'needsYou' || filter === 'pending'
              ? theme.warning
              : filter === 'done'
              ? theme.success
              : theme.action;
          return (
            <Pressable
              key={filter}
              accessibilityLabel={`${label}, ${counts[filter]}`}
              accessibilityRole="button"
              accessibilityState={{selected: isSelected}}
              onPress={() => onSelect(filter)}
              style={[styles.filterItem, {minHeight: minimumTarget()}]}>
              {index > 0 ? (
                <View
                  style={[
                    styles.filterDivider,
                    {backgroundColor: theme.border},
                  ]}
                />
              ) : null}
              <FilterIcon filter={filter} />
              <DSText variant="statistic">{counts[filter]}</DSText>
              <DSText
                numberOfLines={1}
                variant="category"
                style={[styles.filterCaption, {color: tone}]}>
                {label}
              </DSText>
              {isSelected ? (
                <View
                  testID={`circles-filter-selected-${filter}`}
                  style={[styles.filterSelection, {backgroundColor: tone}]}
                />
              ) : null}
            </Pressable>
          );
        })}
      </View>
    </DSSurface>
  );
}

function SortModal({
  selected,
  visible,
  onClose,
  onSelect,
}: {
  selected: CirclesSort;
  visible: boolean;
  onClose: () => void;
  onSelect: (sort: CirclesSort) => void;
}) {
  const theme = useSystemTheme();
  const options: readonly {label: string; value: CirclesSort}[] = [
    {label: 'Urgency', value: 'urgency'},
    {label: 'Name', value: 'name'},
    {label: 'Progress', value: 'progress'},
  ];
  return (
    <Modal
      animationType="fade"
      onRequestClose={onClose}
      presentationStyle="overFullScreen"
      transparent
      visible={visible}>
      <View style={styles.modalRoot}>
        <Pressable
          accessibilityLabel="Close sort menu"
          accessibilityRole="button"
          onPress={onClose}
          style={styles.modalScrim}
        />
        <SafeAreaView edges={['bottom']} style={styles.modalSafeArea}>
          <DSSurface
            accessibilityViewIsModal
            raised
            style={[styles.sortPanel, {backgroundColor: theme.surface}]}>
            <DSSectionHeading
              title="Sort commitments"
              subtitle="Choose how commitments are ordered."
            />
            {options.map(option => (
              <DSListRow
                key={option.value}
                title={option.label}
                titleVariant="body"
                accessibilityLabel={`Sort by ${option.label}`}
                onPress={() => onSelect(option.value)}
                leading={
                  option.value === selected ? (
                    <Check color={theme.action} size={layout.controlIcon} />
                  ) : (
                    <View style={styles.sortPlaceholder} />
                  )
                }
              />
            ))}
            <DSButton label="Cancel" onPress={onClose} variant="quiet" />
          </DSSurface>
        </SafeAreaView>
      </View>
    </Modal>
  );
}

function CirclesScreenContent({navigation}: Props) {
  const theme = useSystemTheme();
  const status = useSessionStore(state => state.status);
  const user = useSessionStore(state => state.user);
  const profile = useUserProfileStore(state => state.profile);
  const [homeData, setHomeData] = useState<HomeData>(() =>
    createEmptyHomeData(),
  );
  const [pastCircles, setPastCircles] = useState<PastCircleSummary[]>([]);
  const [selectedFilter, setSelectedFilter] = useState<CirclesFilter>('all');
  const [selectedSort, setSelectedSort] = useState<CirclesSort>('urgency');
  const [sortVisible, setSortVisible] = useState(false);
  const [homeError, setHomeError] = useState<string>();
  const [pastError, setPastError] = useState<string>();
  const [subscriptionRevision, setSubscriptionRevision] = useState(0);
  const [nudgedCircleIds, setNudgedCircleIds] = useState<Set<string>>(
    () => new Set(),
  );
  const [nudgingCircleIds, setNudgingCircleIds] = useState<Set<string>>(
    () => new Set(),
  );
  const timezone = profile?.timezone ?? 'UTC';
  const canLoad = status === 'authenticatedReady' && Boolean(user?.uid);

  useEffect(() => {
    if (!canLoad || !user?.uid) {
      setHomeData(createEmptyHomeData(timezone));
      return undefined;
    }
    return subscribeToHomeData({
      onData: data => {
        setHomeData(data);
        setHomeError(undefined);
      },
      onError: error =>
        setHomeError(error.message || 'Could not load commitments.'),
      timezone,
      uid: user.uid,
    });
  }, [canLoad, subscriptionRevision, timezone, user?.uid]);

  useEffect(() => {
    if (!canLoad || !user?.uid) {
      setPastCircles([]);
      return undefined;
    }
    return subscribeToPastCircles({
      onCircles: circles => {
        setPastCircles(circles);
        setPastError(undefined);
      },
      onError: error =>
        setPastError(error.message || 'Could not load past circles.'),
      uid: user.uid,
    });
  }, [canLoad, subscriptionRevision, user?.uid]);

  const allCommitments = useMemo(
    () =>
      homeData.circles.filter(circle => circle.lifecycleStatus !== 'archived'),
    [homeData.circles],
  );
  const counts = useMemo(
    () =>
      allCommitments.reduce(
        (result, circle) => {
          const circleStatus = getCircleStatus(circle);
          return {...result, [circleStatus]: result[circleStatus] + 1};
        },
        {needsYou: 0, pending: 0, onTrack: 0, done: 0} as Record<
          StatusFilter,
          number
        >,
      ),
    [allCommitments],
  );
  const visibleCommitments = useMemo(
    () =>
      sortCircles(
        allCommitments.filter(circle =>
          matchesCirclesFilter(circle, selectedFilter),
        ),
        selectedSort,
      ),
    [allCommitments, selectedFilter, selectedSort],
  );
  const hasResolvedContent = Boolean(homeData.hasResolvedGreetingContext);

  const openCircle = useCallback(
    (circleId: string) => navigation.navigate('CircleDetail', {circleId}),
    [navigation],
  );

  const shareCircle = useCallback(
    (circle: CircleManagementCard) => {
      if (!canInvite(circle) || !circle.inviteUrl) {
        openCircle(circle.id);
        return;
      }
      Share.share({
        title: `Join ${circle.title} on Hoyst`,
        message: `Join ${circle.title} on Hoyst: ${circle.inviteUrl}`,
        url: circle.inviteUrl,
      }).catch(() => undefined);
    },
    [openCircle],
  );

  const nudgeCircle = useCallback(
    (circle: CircleManagementCard) => {
      if ((circle.nudgeTargetCount ?? 0) <= 0) {
        openCircle(circle.id);
        return;
      }
      if (nudgedCircleIds.has(circle.id) || nudgingCircleIds.has(circle.id)) {
        return;
      }
      setNudgingCircleIds(current => new Set(current).add(circle.id));
      nudgeCircleMembers(circle.id)
        .then(result => {
          setNudgedCircleIds(current => new Set(current).add(circle.id));
          Alert.alert(
            'Nudge sent',
            result.nudged > 0
              ? `${result.nudged} ${
                  result.nudged === 1 ? 'Member' : 'Members'
                } nudged.`
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
            const next = new Set(current);
            next.delete(circle.id);
            return next;
          });
        });
    },
    [nudgedCircleIds, nudgingCircleIds, openCircle],
  );

  const handleCircleAction = useCallback(
    (circle: CircleManagementCard) => {
      const variant = getHomeCircleActionVariant(circle);
      if (variant === 'check_in') {
        navigation.navigate('TapInComposer', {
          circleId: circle.id,
          source: 'tap_in',
        });
      } else if (variant === 'nudge') {
        nudgeCircle(circle);
      } else if (variant === 'share') {
        shareCircle(circle);
      } else {
        openCircle(circle.id);
      }
    },
    [navigation, nudgeCircle, openCircle, shareCircle],
  );

  const retry = useCallback(() => {
    setHomeError(undefined);
    setPastError(undefined);
    setSubscriptionRevision(current => current + 1);
  }, []);

  const renderCommitment = useCallback(
    ({item}: {item: CircleManagementCard}) => {
      const locallyNudged = nudgedCircleIds.has(item.id);
      const isNudging = nudgingCircleIds.has(item.id);
      const label = actionLabel(item);
      const action =
        label && !(locallyNudged && label === 'Nudge')
          ? {
              label: isNudging ? 'Nudging' : label,
              busy: isNudging,
              disabled: isNudging,
              variant:
                label === 'Share' ? ('outline' as const) : ('primary' as const),
              onPress: () => handleCircleAction(item),
            }
          : undefined;
      return (
        <DSCommitmentPreview
          action={action}
          category={item.category}
          context={memberContext(item)}
          description={item.commitment}
          expanded
          goal={getCommitmentGoalPresentation(item)}
          members={memberSources(item)}
          onDetails={() => openCircle(item.id)}
          onExpand={() => undefined}
          status={statusCopy(item, locallyNudged)}
          title={item.title}
        />
      );
    },
    [handleCircleAction, nudgedCircleIds, nudgingCircleIds, openCircle],
  );

  const selectedSortLabel =
    selectedSort === 'name'
      ? 'Sorted by name'
      : selectedSort === 'progress'
      ? 'Sorted by progress'
      : 'Sorted by urgency';

  const listHeader = (
    <View style={styles.headerStack}>
      <View style={styles.navRow}>
        <View style={styles.navSide}>
          <DSIconButton
            label="Go back"
            onPress={() => navigation.goBack()}
            style={styles.backButton}
            icon={<ArrowLeft color={theme.text} size={20} strokeWidth={2.2} />}
          />
        </View>
        <DSText numberOfLines={1} style={styles.navTitle}>
          Circles
        </DSText>
        <View style={[styles.navSide, styles.navSideEnd]}>
          <Pressable
            accessibilityLabel="Create commitment"
            accessibilityRole="button"
            onPress={() => navigation.navigate('CreateCircle')}
            style={({pressed}) => [
              styles.createTarget,
              pressed && styles.pressed,
            ]}>
            <DSSurface
              kind="statistics"
              raised
              style={[styles.createAction, {backgroundColor: theme.surface}]}>
              <Plus color={theme.action} size={18} strokeWidth={2.4} />
              <DSText variant="action" tone="action">
                Create
              </DSText>
            </DSSurface>
          </Pressable>
        </View>
      </View>

      <DSSectionHeading
        title="Your commitments"
        subtitle="Personal commitments, active circles, and join requests."
      />

      {hasResolvedContent ? (
        <CirclesStatusSummary
          counts={counts}
          selected={selectedFilter}
          onSelect={filter =>
            setSelectedFilter(current => (current === filter ? 'all' : filter))
          }
        />
      ) : null}

      {hasResolvedContent && allCommitments.length > 0 ? (
        <Pressable
          accessibilityLabel={`${selectedSortLabel}. Change sorting.`}
          accessibilityRole="button"
          onPress={() => setSortVisible(true)}
          testID="circles-sort-control"
          style={({pressed}) => [
            styles.sortControl,
            pressed && styles.pressed,
          ]}>
          <View style={styles.sortFace}>
            <DSText variant="secondary" tone="muted">
              {selectedSortLabel}
            </DSText>
            <ChevronDown color={theme.muted} size={16} strokeWidth={2.2} />
          </View>
        </Pressable>
      ) : null}

      {homeError && hasResolvedContent ? (
        <DSSurface kind="quiet" style={styles.inlineFeedback}>
          <DSText variant="secondary" tone="danger">
            Could not refresh commitments.
          </DSText>
          <DSButton label="Retry" compact onPress={retry} variant="quiet" />
        </DSSurface>
      ) : null}
    </View>
  );

  const listEmpty =
    !canLoad || (!hasResolvedContent && !homeError) ? (
      <DSFeedback
        kind="loading"
        title="Loading commitments"
        message="Your commitments will appear here when they are ready."
      />
    ) : homeError && !hasResolvedContent ? (
      <DSFeedback
        kind="error"
        title="Could not load commitments"
        message="Check your connection and try again."
        action={<DSButton label="Retry" onPress={retry} variant="outline" />}
      />
    ) : allCommitments.length === 0 ? (
      <DSFeedback
        title="No commitments yet"
        message="Create a commitment or find a circle to get started."
        action={
          <View style={styles.emptyActions}>
            <DSButton
              label="Create commitment"
              onPress={() => navigation.navigate('CreateCircle')}
            />
            <DSButton
              label="Find circles"
              onPress={() =>
                navigation.navigate('MainTabs', {screen: 'Explore'})
              }
              variant="outline"
            />
          </View>
        }
      />
    ) : (
      <DSFeedback
        title="Nothing here right now"
        message={`No commitments match ${filterLabel(
          selectedFilter as StatusFilter,
        ).toLowerCase()}.`}
        action={
          <DSButton
            label="Clear filter"
            onPress={() => setSelectedFilter('all')}
            variant="outline"
          />
        }
      />
    );

  const listFooter = hasResolvedContent ? (
    <View style={styles.footerStack}>
      {pastCircles.length > 0 ? (
        <View style={styles.footerSection} testID="past-circles-section">
          <DSSectionHeading title="Past circles" />
          {pastCircles.map(circle => (
            <DSListRow
              key={circle.id}
              accessibilityLabel={`View past circle ${circle.title}`}
              leading={
                <History color={theme.muted} size={layout.controlIcon} />
              }
              onPress={() =>
                navigation.navigate('PastCircle', {summary: circle})
              }
              subtitle={circle.commitment}
              title={circle.title}
            />
          ))}
        </View>
      ) : null}
      {pastError ? (
        <DSSurface kind="quiet" style={styles.inlineFeedback}>
          <DSText variant="secondary" tone="muted">
            Past circles are unavailable.
          </DSText>
          <DSButton label="Retry" compact onPress={retry} variant="quiet" />
        </DSSurface>
      ) : null}
      <DSListRow
        accessibilityLabel="Find more circles"
        leading={
          <View
            style={[
              styles.linkBackplate,
              {backgroundColor: theme.mutedSurface},
            ]}>
            <Search color={theme.muted} size={layout.controlIcon} />
          </View>
        }
        onPress={() => navigation.navigate('MainTabs', {screen: 'Explore'})}
        subtitle="Browse public circles in Explore"
        testID="find-more-circles-card"
        title="Find more circles"
      />
    </View>
  ) : null;

  return (
    <SafeAreaView style={[styles.screen, {backgroundColor: theme.canvas}]}>
      <StatusBar
        backgroundColor={theme.canvas}
        barStyle={theme.isDark ? 'light-content' : 'dark-content'}
      />
      <FlatList
        contentContainerStyle={styles.listContent}
        data={hasResolvedContent ? visibleCommitments : []}
        ItemSeparatorComponent={CommitmentSeparator}
        keyExtractor={item => item.id}
        keyboardShouldPersistTaps="handled"
        ListEmptyComponent={listEmpty}
        ListFooterComponent={listFooter}
        ListHeaderComponent={listHeader}
        ListHeaderComponentStyle={styles.listHeader}
        renderItem={renderCommitment}
      />
      <SortModal
        selected={selectedSort}
        visible={sortVisible}
        onClose={() => setSortVisible(false)}
        onSelect={sort => {
          setSelectedSort(sort);
          setSortVisible(false);
        }}
      />
    </SafeAreaView>
  );
}

export function CirclesScreen(props: Props): React.JSX.Element {
  const appearance = useSettingsStore(state => state.appearance);
  return (
    <DesignSystemProvider scheme={appearance}>
      <CirclesScreenContent {...props} />
    </DesignSystemProvider>
  );
}

const styles = StyleSheet.create({
  screen: {flex: 1},
  listContent: {
    flexGrow: 1,
    paddingBottom: space.xxl,
    paddingHorizontal: layout.gutter,
    paddingTop: space.xs,
  },
  listHeader: {marginBottom: space.md},
  headerStack: {gap: layout.sectionGap},
  navRow: {
    alignItems: 'center',
    flexDirection: 'row',
    minHeight: 44,
  },
  navSide: {width: 82},
  navSideEnd: {alignItems: 'flex-end'},
  backButton: {alignItems: 'flex-start'},
  navTitle: {
    flex: 1,
    fontSize: 17,
    fontWeight: '600',
    lineHeight: 21,
    textAlign: 'center',
  },
  createTarget: {
    justifyContent: 'center',
    minHeight: 44,
  },
  createAction: {
    alignItems: 'center',
    borderRadius: radii.statistics,
    flexDirection: 'row',
    gap: space.xs,
    justifyContent: 'flex-end',
    minHeight: 32,
    paddingHorizontal: space.sm,
    paddingVertical: 0,
  },
  filterSurface: {
    gap: 0,
    minHeight: 76,
    paddingHorizontal: space.md,
    paddingVertical: space.md,
    width: '100%',
  },
  filterItems: {
    alignItems: 'center',
    alignSelf: 'stretch',
    flexDirection: 'row',
    width: '100%',
  },
  filterItem: {
    alignItems: 'center',
    flex: 1,
    gap: 1,
    justifyContent: 'center',
    minWidth: 0,
    paddingHorizontal: 2,
    position: 'relative',
  },
  filterDivider: {
    height: 52,
    left: 0,
    position: 'absolute',
    top: 2,
    width: StyleSheet.hairlineWidth,
  },
  filterCaption: {textAlign: 'center'},
  filterSelection: {
    borderRadius: 1,
    bottom: 0,
    height: 2,
    position: 'absolute',
    width: 20,
  },
  sortControl: {
    alignSelf: 'flex-start',
    justifyContent: 'center',
    minHeight: 44,
  },
  sortFace: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: space.xs,
  },
  itemSeparator: {height: space.md},
  footerStack: {gap: layout.sectionGap, marginTop: layout.sectionGap},
  footerSection: {gap: space.xs},
  inlineFeedback: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: space.sm,
  },
  emptyActions: {gap: space.sm},
  linkBackplate: {
    alignItems: 'center',
    borderRadius: 10,
    height: layout.iconBackplate,
    justifyContent: 'center',
    width: layout.iconBackplate,
  },
  pressed: {opacity: 0.7},
  modalRoot: {flex: 1, justifyContent: 'flex-end'},
  modalScrim: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.32)',
  },
  modalSafeArea: {justifyContent: 'flex-end'},
  sortPanel: {
    borderBottomLeftRadius: 0,
    borderBottomRightRadius: 0,
    borderTopLeftRadius: radii.card,
    borderTopRightRadius: radii.card,
    gap: space.sm,
    paddingBottom: space.md,
    paddingHorizontal: layout.gutter,
    paddingTop: space.lg,
  },
  sortPlaceholder: {height: layout.controlIcon, width: layout.controlIcon},
});
