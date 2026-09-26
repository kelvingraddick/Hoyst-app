import React, {useCallback, useEffect, useRef, useState} from 'react';
import {
  ActivityIndicator,
  FlatList,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  StatusBar,
  Text,
  TextInput,
  useWindowDimensions,
  View,
} from 'react-native';
import {SafeAreaView, useSafeAreaInsets} from 'react-native-safe-area-context';
import {useIsFocused} from '@react-navigation/native';
import type {BottomTabScreenProps} from '@react-navigation/bottom-tabs';
import type {NativeStackNavigationProp} from '@react-navigation/native-stack';
import {Flame, Plus, Search, UsersRound, X} from 'lucide-react-native';
import {
  CircleCategoryIcon,
  getCircleCategoryVisual,
} from '../../../design/components/CircleCategoryIcon';
import {
  DesignSystemProvider,
  DSAvatar,
  DSButton,
  DSSurface,
  DSText,
  layout,
  minimumTarget,
  nativeFont,
  radii,
  space,
  typography,
  useSystemTheme,
} from '../../../design/system';
import {useSettingsStore} from '../../../store/settings-store';
import {ExploreSearchingHoy} from '../components/ExploreSearchingHoy';
import type {
  AppTabsParamList,
  RootStackParamList,
} from '../../../navigation/types';
import {
  searchPublicCircles,
  getExploreSearchError,
  formatPublicTapInTime,
  type DiscoverableCircle,
  type ExplorePage,
} from '../services/explore-service';

type Props = BottomTabScreenProps<AppTabsParamList, 'Explore'>;
const categoryOrder = [
  'Fitness',
  'Wellness',
  'Deep Work',
  'Writing',
  'Sobriety',
  'Custom',
  'General',
];

function CircleResult({
  circle,
  onDetails,
}: {
  circle: DiscoverableCircle;
  onDetails: () => void;
}) {
  const theme = useSystemTheme();
  const tone = getCircleCategoryVisual(circle.category).tone;
  const activity = circle.latestPublicTapIn;
  const timestamp = activity ? formatPublicTapInTime(activity.occurredAt) : '';
  const avatarSource = React.useMemo(
    () => (activity?.avatarUrl ? {uri: activity.avatarUrl} : undefined),
    [activity?.avatarUrl],
  );
  const availability =
    circle.memberCount >= circle.maxSize
      ? 'Circle full'
      : circle.joinMode === 'open'
      ? 'Open seats'
      : circle.joinMode === 'invite_only'
      ? 'Invite only'
      : 'Request to join';
  return (
    <DSSurface
      category={tone}
      style={styles.card}
      testID={`explore-circle-${circle.id}`}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`View details for ${circle.title}`}
        onPress={onDetails}
        style={styles.cardDetails}>
        <View style={styles.row}>
          <CircleCategoryIcon category={circle.category} size={40} />
          <View style={styles.grow}>
            <DSText variant="title">{circle.title}</DSText>
            <DSText
              variant="category"
              style={{color: theme.category[tone].foreground}}>
              {circle.category.toUpperCase()}
            </DSText>
          </View>
        </View>
        <DSText tone="muted">{circle.commitment}</DSText>
        <View style={styles.facts}>
          <View style={styles.fact}>
            <UsersRound size={layout.statIcon} color={theme.muted} />
            <DSText variant="secondary" tone="muted">
              {circle.memberCount}/{circle.maxSize} members
            </DSText>
          </View>
          <View style={styles.fact}>
            {circle.groupStreakDays > 0 ? (
              <Flame
                size={layout.statIcon}
                color={theme.category[tone].foreground}
              />
            ) : null}
            <DSText variant="secondary" tone="muted">
              {circle.groupStreakDays > 0
                ? `${circle.groupStreakDays}-day group streak`
                : availability}
            </DSText>
          </View>
        </View>
      </Pressable>
      <View style={[styles.cardFooter, {borderTopColor: theme.border}]}>
        {activity && timestamp ? (
          <View
            style={styles.activity}
            accessible
            accessibilityLabel={`${activity.displayName} tapped in, ${timestamp}`}>
            <DSAvatar
              name={activity.displayName}
              source={avatarSource}
              size={28}
            />
            <View style={styles.grow}>
              <DSText variant="secondary">
                {activity.displayName} tapped in
              </DSText>
              <DSText variant="statCaption" tone="muted">
                {timestamp}
              </DSText>
            </View>
          </View>
        ) : null}
        <DSButton
          compact
          category={tone}
          label="View details"
          accessibilityLabel={`View details for ${circle.title}`}
          onPress={onDetails}
          style={styles.detailsButton}
        />
      </View>
    </DSSurface>
  );
}

function ExploreContent({navigation}: Props) {
  const theme = useSystemTheme();
  const insets = useSafeAreaInsets();
  const focused = useIsFocused();
  const {fontScale, width} = useWindowDimensions();
  const [query, setQuery] = useState('');
  const [category, setCategory] = useState('All');
  const [page, setPage] = useState<ExplorePage>();
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [requestPending, setRequestPending] = useState(false);
  const [error, setError] = useState<string>();
  const [moreError, setMoreError] = useState(false);
  const [refreshToken, setRefreshToken] = useState(0);
  const generation = useRef(0);
  const moreLock = useRef(false);
  const list = useRef<FlatList<DiscoverableCircle>>(null);
  const root =
    navigation.getParent<NativeStackNavigationProp<RootStackParamList>>();

  useEffect(() => {
    const requestId = ++generation.current;
    moreLock.current = false;
    setLoadingMore(false);
    setRequestPending(false);
    setLoading(true);
    setError(undefined);
    setMoreError(false);
    setPage(previous =>
      previous
        ? {...previous, circles: [], total: 0, nextCursor: undefined}
        : undefined,
    );
    list.current?.scrollToOffset({offset: 0, animated: false});
    if (!focused) {
      return;
    }
    const timer = setTimeout(
      () => {
        setRequestPending(true);
        searchPublicCircles({query: query.trim(), category})
          .then(result => {
            if (generation.current === requestId) {
              setPage(result);
              setLoading(false);
              setRequestPending(false);
            }
          })
          .catch(problem => {
            if (generation.current === requestId) {
              setError(getExploreSearchError(problem));
              setLoading(false);
              setRequestPending(false);
            }
          });
      },
      query ? 300 : 0,
    );
    return () => {
      clearTimeout(timer);
      generation.current = requestId + 1;
    };
  }, [query, category, refreshToken, focused]);

  const loadMore = useCallback(() => {
    if (!page?.nextCursor || loading || moreLock.current) {
      return;
    }
    const requestId = generation.current;
    moreLock.current = true;
    setLoadingMore(true);
    setMoreError(false);
    searchPublicCircles({
      query: query.trim(),
      category,
      cursor: page.nextCursor,
    })
      .then(result => {
        if (requestId !== generation.current) {
          return;
        }
        setPage(previous => ({
          ...result,
          circles: [...(previous?.circles ?? []), ...result.circles].filter(
            (circle, index, circles) =>
              circles.findIndex(item => item.id === circle.id) === index,
          ),
        }));
      })
      .catch(() => {
        if (requestId === generation.current) {
          setMoreError(true);
        }
      })
      .finally(() => {
        if (requestId === generation.current) {
          moreLock.current = false;
          setLoadingMore(false);
        }
      });
  }, [page, loading, query, category]);
  const categories = [
    'All',
    ...[...(page?.categories ?? [])].sort((a, b) => {
      const indexA = categoryOrder.indexOf(a);
      const indexB = categoryOrder.indexOf(b);
      return (
        (indexA < 0 ? 99 : indexA) - (indexB < 0 ? 99 : indexB) ||
        a.localeCompare(b)
      );
    }),
  ];
  if (!categories.includes(category)) {
    categories.push(category);
  }
  const retry = () => setRefreshToken(value => value + 1);
  const header = (
    <View style={styles.header}>
      <View
        style={[
          styles.headingRow,
          (fontScale > 1.3 || width < 360) && styles.headingStack,
        ]}>
        <View style={[styles.headingGroup, styles.grow]}>
          <ExploreSearchingHoy
            searching={focused && (requestPending || loadingMore)}
            dark={theme.isDark}
          />
          <View style={[styles.headingCopy, styles.grow]}>
            <DSText variant="screenTitle" accessibilityRole="header">
              Explore
            </DSText>
            <DSText
              testID="explore-subtitle"
              accessibilityLabel="Find circles moving at your pace.">
              Find <Text style={styles.subtitleEmphasis}>circles</Text> moving at
              your pace.
            </DSText>
          </View>
        </View>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Create a circle"
          onPress={() => root?.navigate('CreateCircle')}
          style={[
            styles.create,
            {backgroundColor: theme.surface, borderColor: theme.border},
          ]}>
          <Plus size={18} color={theme.text} />
          <DSText variant="action">Create</DSText>
        </Pressable>
      </View>
      <View
        style={[
          styles.search,
          theme.isDark ? styles.searchDark : styles.searchLight,
        ]}>
        <Search size={layout.controlIcon} color={theme.muted} />
        <TextInput
          accessibilityLabel="Search circles"
          placeholder="Search circles"
          placeholderTextColor={theme.muted}
          value={query}
          onChangeText={setQuery}
          maxLength={120}
          returnKeyType="search"
          autoCorrect={false}
          allowFontScaling={false}
          autoCapitalize="none"
          style={[
            styles.searchInput,
            typography.body,
            {
              color: theme.text,
              fontSize: typography.body.fontSize * fontScale,
              lineHeight: typography.body.lineHeight * fontScale,
            },
          ]}
        />
        {query ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Clear search"
            onPress={() => setQuery('')}
            style={styles.clear}>
            <X size={18} color={theme.muted} />
          </Pressable>
        ) : null}
      </View>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.filters}
        keyboardShouldPersistTaps="handled">
        {categories.map(value => {
          const selected = category === value;
          return (
            <Pressable
              key={value}
              accessibilityRole="button"
              accessibilityLabel={`${value} circles`}
              accessibilityState={{selected}}
              onPress={() => setCategory(value)}
              style={[
                styles.filter,
                {
                  backgroundColor: selected
                    ? theme.category.blue.surface
                    : theme.surface,
                  borderColor: selected
                    ? theme.category.blue.foreground
                    : theme.border,
                },
              ]}>
              {value !== 'All' ? (
                <CircleCategoryIcon
                  category={value}
                  size={20}
                  showBackplate={false}
                />
              ) : null}
              <DSText
                variant="action"
                style={{
                  color: selected ? theme.category.blue.foreground : theme.text,
                }}>
                {value}
              </DSText>
            </Pressable>
          );
        })}
      </ScrollView>
      <View style={styles.section}>
        <DSText variant="heading" accessibilityRole="header">
          Circles
        </DSText>
        <DSText
          variant="secondary"
          tone="muted"
          accessibilityLiveRegion="polite">
          {loading
            ? 'Finding circles…'
            : error
            ? 'Search unavailable'
            : `${page?.total ?? 0} ${
                (page?.total ?? 0) === 1 ? 'match' : 'matches'
              }`}
        </DSText>
      </View>
    </View>
  );
  return (
    <SafeAreaView
      edges={['top', 'left', 'right']}
      style={[styles.screen, {backgroundColor: theme.canvas}]}>
      {focused ? (
        <StatusBar barStyle={theme.isDark ? 'light-content' : 'dark-content'} />
      ) : null}
      <KeyboardAvoidingView
        style={styles.screen}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <FlatList
          key={fontScale}
          ref={list}
          data={page?.circles ?? []}
          keyExtractor={item => item.id}
          renderItem={({item}) => (
            <CircleResult
              circle={item}
              onDetails={() =>
                root?.navigate('CircleDetail', {circleId: item.id})
              }
            />
          )}
          ListHeaderComponent={header}
          contentContainerStyle={styles.content}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="on-drag"
          onEndReached={() => {
            if (!moreError) {
              loadMore();
            }
          }}
          onEndReachedThreshold={0.3}
          refreshing={loading && refreshToken > 0}
          onRefresh={retry}
          ListEmptyComponent={
            loading ? (
              <View style={styles.state}>
                <ActivityIndicator
                  color={theme.action}
                  accessibilityLabel="Loading circles"
                />
              </View>
            ) : error ? (
              <View style={styles.state}>
                <DSText variant="title">Couldn't load circles</DSText>
                <DSText tone="muted">{error}</DSText>
                <DSButton label="Try again" onPress={retry} />
              </View>
            ) : (
              <View style={styles.state}>
                <DSText variant="title">
                  {query || category !== 'All'
                    ? 'No matching circles'
                    : 'No public circles yet'}
                </DSText>
                <DSText tone="muted">
                  {query || category !== 'All'
                    ? 'Try another word or category.'
                    : 'Create a circle and start showing up together.'}
                </DSText>
                {query || category !== 'All' ? (
                  <DSButton
                    label="Clear filters"
                    variant="outline"
                    onPress={() => {
                      setQuery('');
                      setCategory('All');
                    }}
                  />
                ) : null}
              </View>
            )
          }
          ListFooterComponent={
            <View
              style={{
                paddingBottom:
                  72 +
                  (Platform.OS === 'ios' ? 18 : 12) +
                  insets.bottom +
                  space.xxl,
              }}>
              {loadingMore ? (
                <ActivityIndicator
                  color={theme.action}
                  accessibilityLabel="Loading more circles"
                />
              ) : moreError ? (
                <View style={styles.state}>
                  <DSText tone="muted">Couldn't load more circles.</DSText>
                  <DSButton
                    label="Retry loading more"
                    variant="outline"
                    onPress={loadMore}
                  />
                </View>
              ) : null}
            </View>
          }
        />
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

export function ExploreScreen(props: Props) {
  const appearance = useSettingsStore(state => state.appearance);
  return (
    <DesignSystemProvider scheme={appearance}>
      <ExploreContent {...props} />
    </DesignSystemProvider>
  );
}
const styles = StyleSheet.create({
  screen: {flex: 1},
  grow: {flex: 1, minWidth: 0},
  content: {paddingHorizontal: layout.gutter, paddingTop: space.lg},
  header: {gap: space.lg, paddingBottom: space.lg},
  headingRow: {flexDirection: 'row', alignItems: 'flex-start', gap: space.md},
  headingCopy: {gap: 6},
  headingGroup: {flexDirection: 'row', alignItems: 'center', gap: 8},
  subtitleEmphasis: {fontWeight: '700'},
  headingStack: {flexDirection: 'column', alignItems: 'flex-start'},
  create: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.xs,
    borderWidth: 1,
    borderRadius: radii.pill,
    paddingHorizontal: space.md,
    minHeight: minimumTarget(),
  },
  search: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.sm,
    shadowOffset: {width: 0, height: 6},
    shadowOpacity: 0.1,
    shadowRadius: 12,
    elevation: 3,
    borderRadius: radii.input,
    paddingLeft: space.md,
    minHeight: layout.controlHeight,
  },
  searchInput: {
    flex: 1,
    minWidth: 0,
    fontFamily: nativeFont,
    paddingVertical: space.md,
    paddingRight: space.sm,
  },
  searchLight: {backgroundColor: '#FFFFFF', shadowColor: '#92723E'},
  searchDark: {backgroundColor: '#252527', shadowColor: '#000000'},
  clear: {
    minHeight: minimumTarget(),
    minWidth: minimumTarget(),
    alignItems: 'center',
    justifyContent: 'center',
  },
  filters: {gap: space.sm, paddingVertical: 1},
  filter: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.xs,
    borderWidth: 1,
    borderRadius: radii.pill,
    paddingHorizontal: space.md,
    minHeight: minimumTarget(),
  },
  section: {gap: space.xs},
  card: {marginBottom: space.lg, gap: space.md},
  cardDetails: {gap: space.md, minHeight: minimumTarget()},
  row: {flexDirection: 'row', alignItems: 'center', gap: space.sm},
  facts: {flexDirection: 'row', flexWrap: 'wrap', gap: space.md},
  fact: {flexDirection: 'row', alignItems: 'center', gap: space.xs},
  cardFooter: {
    borderTopWidth: StyleSheet.hairlineWidth,
    paddingTop: space.sm,
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: space.sm,
  },
  activity: {
    flexDirection: 'row',
    gap: space.sm,
    alignItems: 'center',
    flexGrow: 1,
    flexShrink: 1,
    flexBasis: 150,
  },
  detailsButton: {marginLeft: 'auto'},
  state: {paddingVertical: space.xxl, gap: space.md, alignItems: 'center'},
});
