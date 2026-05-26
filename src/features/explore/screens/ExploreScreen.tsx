import React, {useEffect, useMemo, useState} from 'react';
import {Pressable, StyleSheet, View} from 'react-native';
import type {NativeStackNavigationProp} from '@react-navigation/native-stack';
import {Search} from 'lucide-react-native';

import {GlassPanel} from '../../../design/components/GlassPanel';
import {HoystButton} from '../../../design/components/HoystButton';
import {HoystChip} from '../../../design/components/HoystChip';
import {HoystInput} from '../../../design/components/HoystInput';
import {HoystScreen} from '../../../design/components/HoystScreen';
import {HoystText} from '../../../design/components/HoystText';
import {LayeredAvatar} from '../../../design/components/LayeredAvatar';
import {
  CircleCategoryPill,
  getCircleCategoryVisual,
} from '../../../design/components/CircleCategoryIcon';
import {radius} from '../../../design/tokens/radius';
import {useHoystTheme} from '../../../design/theme/useHoystTheme';
import type {RootStackParamList} from '../../../navigation/types';
import type {ExploreCircle} from '../../../types/models';
import {exploreCircles} from '../../circles/mockData';
import {subscribeToPublicCircles} from '../../circles/services/public-circle-service';

type Props = {
  navigation: {
    getParent: <T>() => T | undefined;
  };
};

function getFilterBorderColor(
  theme: ReturnType<typeof useHoystTheme>,
  category: string,
) {
  if (category === 'All') {
    return theme.borderStrong;
  }

  return getCircleCategoryVisual(category).accentColor;
}

function getFilterChipStateStyle(
  theme: ReturnType<typeof useHoystTheme>,
  category: string,
  isActive: boolean,
) {
  return {
    borderColor: isActive
      ? getFilterBorderColor(theme, category)
      : 'transparent',
  };
}

function getSearchableText(circle: ExploreCircle) {
  return [
    circle.title,
    circle.category,
    circle.commitment,
    circle.matchCopy,
  ].join(' ');
}

function ExploreCircleCard({
  circle,
  onPress,
}: {
  circle: ExploreCircle;
  onPress: () => void;
}) {
  const theme = useHoystTheme();
  const seatsOpen = circle.maxSize - circle.memberCount;
  const completionTone =
    circle.completionRate >= 85
      ? theme.successForeground
      : circle.completionRate >= 75
      ? theme.accentSecondaryForeground
      : theme.warningForeground;

  return (
    <Pressable
      onPress={onPress}
      style={({pressed}) => [{opacity: pressed ? 0.94 : 1}]}>
      <GlassPanel style={styles.card}>
        <View style={styles.cardHeader}>
          <View style={styles.cardMeta}>
            <CircleCategoryPill category={circle.category} uppercase />
            <HoystText
              style={{color: theme.warningForeground}}
              variant="caption">
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

        <View style={styles.cardCopy}>
          <HoystText style={styles.cardTitle}>{circle.title}</HoystText>
          <HoystText tone="muted">{circle.commitment}</HoystText>
          <HoystText tone="muted" variant="caption">
            {circle.matchCopy}
          </HoystText>
        </View>

        <View style={styles.cardStats}>
          <HoystChip
            label={circle.joinLabel}
            tone={circle.joinLabel === 'Open seats' ? 'green' : 'purple'}
          />
          <HoystText tone="muted" variant="caption">
            {circle.memberCount}/{circle.maxSize} members
          </HoystText>
          <HoystText tone="muted" variant="caption">
            {seatsOpen} seats open
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
                  size={42}
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

          <Pressable
            onPress={onPress}
            style={({pressed}) => [
              styles.previewButtonPressable,
              {
                opacity: pressed ? 0.92 : 1,
              },
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
                Preview
              </HoystText>
            </View>
          </Pressable>
        </View>
      </GlassPanel>
    </Pressable>
  );
}

export function ExploreScreen({navigation}: Props): React.JSX.Element {
  const theme = useHoystTheme();
  const [liveCircles, setLiveCircles] = useState<ExploreCircle[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [activeCategory, setActiveCategory] = useState('All');
  const rootNavigation =
    navigation.getParent<NativeStackNavigationProp<RootStackParamList>>();
  const sourceCircles = liveCircles.length > 0 ? liveCircles : exploreCircles;

  useEffect(() => {
    return subscribeToPublicCircles(setLiveCircles, () => {
      setLiveCircles([]);
    });
  }, []);

  const categories = useMemo(
    () => [
      'All',
      ...Array.from(new Set(sourceCircles.map(circle => circle.category))),
    ],
    [sourceCircles],
  );
  const normalizedSearch = searchTerm.trim().toLowerCase();
  const filteredCircles = useMemo(
    () =>
      sourceCircles.filter(circle => {
        const matchesCategory =
          activeCategory === 'All' || circle.category === activeCategory;
        const matchesSearch =
          normalizedSearch.length === 0 ||
          getSearchableText(circle).toLowerCase().includes(normalizedSearch);

        return matchesCategory && matchesSearch;
      }),
    [activeCategory, normalizedSearch, sourceCircles],
  );

  const openCircle = (circleId: string) => {
    rootNavigation?.navigate('CircleDetail', {circleId});
  };

  return (
    <HoystScreen contentContainerStyle={styles.content}>
      <View style={styles.header}>
        <HoystText variant="headline">Find Circles</HoystText>
        <HoystText tone="muted">
          Find public Circles with steady Tap Ins, open seats, and Members who
          match your pace.
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

      <View style={styles.chips}>
        {categories.map(category => {
          const isActive = activeCategory === category;
          const chipStyle = [
            styles.filterChip,
            getFilterChipStateStyle(theme, category, isActive),
          ];

          return (
            <Pressable
              key={category}
              onPress={() => setActiveCategory(category)}
              style={({pressed}) => [
                styles.filterPressable,
                {
                  opacity: pressed ? 0.86 : 1,
                  transform: [{scale: pressed ? 0.98 : 1}],
                },
              ]}>
              {category === 'All' ? (
                <HoystChip label={category} style={chipStyle} tone="neutral" />
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
          {filteredCircles.length} match
          {filteredCircles.length === 1 ? '' : 'es'}
        </HoystText>
      </View>

      {filteredCircles.length > 0 ? (
        filteredCircles.map(circle => (
          <ExploreCircleCard
            circle={circle}
            key={circle.id}
            onPress={() => openCircle(circle.id)}
          />
        ))
      ) : (
        <GlassPanel style={styles.emptyState}>
          <HoystText variant="title">No Circles found</HoystText>
          <HoystText tone="muted">
            Try a different search or switch categories to keep browsing.
          </HoystText>
          <View style={styles.emptyAction}>
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
    </HoystScreen>
  );
}

const styles = StyleSheet.create({
  content: {
    paddingBottom: 168,
  },
  header: {
    gap: 8,
  },
  searchWrap: {
    position: 'relative',
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
  chips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  filterPressable: {
    borderRadius: radius.pill,
  },
  filterChip: {
    borderColor: 'transparent',
    borderWidth: 1,
  },
  resultsHeader: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  card: {
    minHeight: 210,
  },
  cardHeader: {
    alignItems: 'flex-start',
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  cardMeta: {
    alignItems: 'center',
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    maxWidth: '72%',
  },
  completionBadge: {
    alignItems: 'center',
    borderRadius: radius.pill,
    borderWidth: 1,
    minWidth: 54,
    paddingHorizontal: 10,
    paddingVertical: 7,
  },
  cardCopy: {
    gap: 7,
  },
  cardTitle: {
    fontSize: 26,
    fontWeight: '800',
    letterSpacing: -0.4,
    lineHeight: 29,
  },
  cardStats: {
    alignItems: 'center',
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
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
  previewButtonPressable: {
    flexShrink: 0,
  },
  previewButton: {
    alignItems: 'center',
    borderRadius: radius.pill,
    borderWidth: 1,
    justifyContent: 'center',
    minHeight: 48,
    minWidth: 116,
    paddingHorizontal: 18,
  },
  previewButtonLabel: {
    fontSize: 14,
    lineHeight: 18,
  },
  emptyState: {
    minHeight: 180,
  },
  emptyAction: {
    maxWidth: 180,
  },
});
