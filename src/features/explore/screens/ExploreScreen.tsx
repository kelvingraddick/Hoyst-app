import React, {useEffect, useMemo, useState} from 'react';
import {
  Pressable,
  ScrollView,
  StyleSheet,
  useWindowDimensions,
  View,
  type StyleProp,
  type TextStyle,
  type ViewStyle,
} from 'react-native';
import type {BottomTabScreenProps} from '@react-navigation/bottom-tabs';
import type {NativeStackNavigationProp} from '@react-navigation/native-stack';
import LinearGradient from 'react-native-linear-gradient';
import {
  Check,
  Flame,
  Plus,
  Search,
  Star,
  UsersRound,
} from 'lucide-react-native';

import {
  CircleCategoryIcon,
  CircleCategoryPill,
  getCircleCategoryForegroundColor,
  getCircleCategoryVisual,
} from '../../../design/components/CircleCategoryIcon';
import {FrostedBackdrop} from '../../../design/components/FrostedBackdrop';
import {GlassPanel} from '../../../design/components/GlassPanel';
import {HoystButton} from '../../../design/components/HoystButton';
import {HoystChip} from '../../../design/components/HoystChip';
import {HoystInput} from '../../../design/components/HoystInput';
import {HoystScreen} from '../../../design/components/HoystScreen';
import {HoystText} from '../../../design/components/HoystText';
import {LayeredAvatar} from '../../../design/components/LayeredAvatar';
import {
  SectionEyebrow,
  SectionEyebrowTrailing,
} from '../../../design/components/SectionEyebrow';
import {actionMotion} from '../../../design/tokens/actions';
import {brandColors} from '../../../design/tokens/colors';
import {radius} from '../../../design/tokens/radius';
import {useHoystTheme} from '../../../design/theme/useHoystTheme';
import type {
  AppTabsParamList,
  RootStackParamList,
} from '../../../navigation/types';
import type {ExploreCircle} from '../../../types/models';
import {exploreCircles} from '../../circles/mockData';
import {
  filterPublicCircles,
  getPublicCircleCategories,
} from '../../circles/services/circles-screen-selectors';
import {subscribeToPublicCircles} from '../../circles/services/public-circle-service';

type Props = BottomTabScreenProps<AppTabsParamList, 'Explore'>;

function getSeatsOpen(circle: ExploreCircle) {
  return Math.max(circle.maxSize - circle.memberCount, 0);
}

function getSeatsOpenLabel(circle: ExploreCircle) {
  const seatsOpen = getSeatsOpen(circle);

  if (seatsOpen === 1) {
    return '1 seat open';
  }

  return `${seatsOpen} seats open`;
}

function getExploreCircleStatus(circle: ExploreCircle) {
  const seatsOpen = getSeatsOpen(circle);

  if (circle.completionRate >= 85) {
    return {
      isActive: true,
      label: 'Active today',
    };
  }

  if (circle.joinLabel === 'Open seats' && seatsOpen > 0) {
    return {
      isActive: false,
      label: getSeatsOpenLabel(circle),
    };
  }

  if (seatsOpen <= 0) {
    return {
      isActive: false,
      label: 'Circle full',
    };
  }

  return {
    isActive: false,
    label: 'Request open',
  };
}

function getFeaturedCircle(circles: ExploreCircle[]) {
  return [...circles].sort((left, right) => {
    if (right.completionRate !== left.completionRate) {
      return right.completionRate - left.completionRate;
    }

    return right.memberCount - left.memberCount;
  })[0];
}

function ExploreAvatarStack({
  circle,
  size = 38,
}: {
  circle: ExploreCircle;
  size?: number;
}) {
  const hiddenCount = Math.max(circle.members.length - 3, 0);

  return (
    <View style={styles.avatarRow} testID={`explore-avatar-row-${circle.id}`}>
      {circle.members.slice(0, 3).map((member, index) => (
        <View
          key={member.id}
          style={[
            styles.avatarOffset,
            index === 0 ? undefined : styles.avatarOverlap,
          ]}
          testID={`explore-avatar-${circle.id}-${member.id}`}>
          <LayeredAvatar
            chrome="minimal"
            imageSource={member.avatarImage}
            imageUrl={member.avatarUrl}
            initials={member.initials}
            size={size}
            state={member.state}
          />
        </View>
      ))}
      {hiddenCount > 0 ? (
        <View
          style={[
            styles.moreBubble,
            {
              height: size,
              marginLeft: -Math.round(size * 0.32),
              width: size,
            },
          ]}>
          <HoystText style={styles.moreBubbleText} variant="caption">
            +{hiddenCount}
          </HoystText>
        </View>
      ) : null}
    </View>
  );
}

function ExploreSectionTitle({
  count,
  showFeaturedStar = false,
  title,
}: {
  count?: number;
  showFeaturedStar?: boolean;
  title: string;
}) {
  return (
    <View style={styles.sectionTitleRow}>
      <View style={styles.sectionTitleLabel}>
        {showFeaturedStar ? (
          <Star
            color={brandColors.spectrumYellow}
            fill={brandColors.spectrumYellow}
            size={13}
            strokeWidth={2.4}
            testID="explore-featured-section-star"
          />
        ) : null}
        <SectionEyebrow>{title}</SectionEyebrow>
      </View>
      {typeof count === 'number' ? (
        <SectionEyebrowTrailing>
          {count} match{count === 1 ? '' : 'es'}
        </SectionEyebrowTrailing>
      ) : null}
    </View>
  );
}

function ExplorePillButton({
  accessibilityLabel,
  backgroundColor,
  borderColor,
  fillStyle,
  label,
  labelStyle,
  onPress,
  style,
  testID,
  textColor,
}: {
  accessibilityLabel?: string;
  backgroundColor: string;
  borderColor?: string;
  fillStyle?: StyleProp<ViewStyle>;
  label: string;
  labelStyle?: StyleProp<TextStyle>;
  onPress: () => void;
  style?: StyleProp<ViewStyle>;
  testID?: string;
  textColor: string;
}) {
  return (
    <Pressable
      accessibilityLabel={accessibilityLabel ?? label}
      accessibilityRole="button"
      onPress={onPress}
      style={({pressed}) => [
        styles.pillButtonPressable,
        style,
        {opacity: pressed ? actionMotion.pressedOpacity : 1},
      ]}
      testID={testID}>
      <View
        style={[
          styles.pillButtonFill,
          {
            backgroundColor,
            borderColor: borderColor ?? backgroundColor,
          },
          fillStyle,
        ]}
        testID={testID ? `${testID}-fill` : undefined}>
        <HoystText
          style={[styles.pillButtonLabel, {color: textColor}, labelStyle]}>
          {label}
        </HoystText>
      </View>
    </Pressable>
  );
}

function CategoryFilterChip({
  category,
  isActive,
  onPress,
}: {
  category: string;
  isActive: boolean;
  onPress: () => void;
}) {
  const theme = useHoystTheme();
  const isAllCategory = category === 'All';
  const categoryVisual = isAllCategory
    ? undefined
    : getCircleCategoryVisual(category);
  const tone = categoryVisual?.tone ?? 'neutral';
  const borderColor = categoryVisual?.accentColor ?? theme.textMuted;
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
      onPress={onPress}
      testID={`explore-filter-${category}`}
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
}

function FeaturedCircleCard({
  circle,
  onJoinPress,
  onViewPress,
}: {
  circle: ExploreCircle;
  onJoinPress: () => void;
  onViewPress: () => void;
}) {
  const theme = useHoystTheme();
  const {width} = useWindowDimensions();
  const visual = getCircleCategoryVisual(circle.category);
  const categoryColor = getCircleCategoryForegroundColor(
    circle.category,
    theme,
  );
  const featuredActionWidth = Math.max((width - 94) / 2, 0);

  return (
    <LinearGradient
      colors={[visual.accentColor, visual.accentDark]}
      end={{x: 1, y: 1}}
      start={{x: 0, y: 0}}
      style={styles.featuredCard}
      testID="explore-featured-card">
      <View
        style={styles.featuredCardContent}
        testID="explore-featured-card-content">
        <View style={styles.featuredTopRow}>
          <View
            style={styles.featuredPill}
            testID="explore-featured-category-pill">
            <CircleCategoryIcon
              category={circle.category}
              shape="roundedSquare"
              size={18}
            />
            <HoystText style={styles.featuredPillText} variant="caption">
              {circle.category.toUpperCase()}
            </HoystText>
          </View>
          <View
            style={[styles.featuredPill, styles.featuredActivePill]}
            testID="explore-featured-active-pill">
            <View style={styles.activeDot} />
            <HoystText style={styles.featuredPillText} variant="caption">
              Active now
            </HoystText>
          </View>
        </View>

        <View style={styles.featuredCopy}>
          <HoystText
            numberOfLines={2}
            style={styles.featuredTitle}
            testID="explore-featured-title">
            {circle.title}
          </HoystText>
          <HoystText
            numberOfLines={2}
            style={styles.featuredDescription}
            testID="explore-featured-description">
            {circle.commitment}. {circle.memberCount}{' '}
            {circle.memberCount === 1 ? 'Member' : 'Members'} tapped in today.
          </HoystText>
        </View>

        <View style={styles.featuredStatsRow}>
          <ExploreAvatarStack circle={circle} size={32} />
          <HoystText
            style={styles.featuredStat}
            testID="explore-featured-stat"
            variant="button">
            {circle.memberCount}/{circle.maxSize} Members
          </HoystText>
        </View>

        <View style={styles.featuredActions} testID="explore-featured-actions">
          <ExplorePillButton
            accessibilityLabel={`View ${circle.title}`}
            backgroundColor="rgba(255,255,255,0.18)"
            borderColor="rgba(255,255,255,0.34)"
            fillStyle={[
              styles.featuredActionFill,
              {width: featuredActionWidth},
            ]}
            label="View Circle"
            labelStyle={styles.featuredActionLabel}
            onPress={onViewPress}
            style={[styles.featuredAction, {width: featuredActionWidth}]}
            testID={`explore-featured-view-${circle.id}`}
            textColor={brandColors.white}
          />
          <ExplorePillButton
            accessibilityLabel={`Join ${circle.title}`}
            backgroundColor={brandColors.white}
            borderColor={brandColors.white}
            fillStyle={[
              styles.featuredActionFill,
              {width: featuredActionWidth},
            ]}
            label="Join"
            labelStyle={styles.featuredActionLabel}
            onPress={onJoinPress}
            style={[styles.featuredAction, {width: featuredActionWidth}]}
            testID={`explore-featured-join-${circle.id}`}
            textColor={categoryColor}
          />
        </View>
      </View>
    </LinearGradient>
  );
}

function ExploreActivityCallout({
  circle,
  tone,
}: {
  circle: ExploreCircle;
  tone: 'cool' | 'warm';
}) {
  const theme = useHoystTheme();
  const member = circle.members[0];
  const visual = getCircleCategoryVisual(circle.category);
  const isWarm = tone === 'warm';
  const categoryColor = getCircleCategoryForegroundColor(
    circle.category,
    theme,
  );
  const backgroundColor = theme.isDark
    ? isWarm
      ? 'rgba(255,138,61,0.22)'
      : `${visual.accentColor}24`
    : isWarm
    ? '#FFF0E6'
    : visual.backplateColor;
  const borderColor = theme.isDark
    ? isWarm
      ? 'rgba(255,184,138,0.72)'
      : `${visual.accentLight}88`
    : isWarm
    ? '#FFC8AD'
    : `${visual.accentColor}55`;
  const color = isWarm
    ? theme.isDark
      ? '#FFB88A'
      : theme.warningForeground
    : theme.isDark
    ? visual.accentLight
    : categoryColor;
  const memberName = member?.name ?? 'Someone';

  return (
    <GlassPanel padding="none" style={[styles.callout, {borderColor}]}>
      <View
        style={[
          StyleSheet.absoluteFill,
          styles.calloutTint,
          theme.isDark ? styles.calloutTintDark : undefined,
          {backgroundColor},
        ]}
        testID={`explore-activity-callout-tint-${tone}-${circle.id}`}
      />
      <View style={styles.calloutContent}>
        <View style={styles.calloutAvatarWrap}>
          <LayeredAvatar
            chrome="minimal"
            imageSource={member?.avatarImage}
            imageUrl={member?.avatarUrl}
            initials={member?.initials ?? 'HO'}
            size={46}
            state={member?.state ?? 'done'}
          />
          <View
            style={[styles.calloutBadge, {backgroundColor: color}]}
            testID={`explore-activity-callout-badge-${tone}-${circle.id}`}>
            {isWarm ? (
              <Flame color={brandColors.white} size={11} strokeWidth={3} />
            ) : (
              <Check color={brandColors.white} size={12} strokeWidth={3} />
            )}
          </View>
        </View>
        <View
          style={styles.calloutCopy}
          testID={`explore-activity-callout-copy-${tone}-${circle.id}`}>
          <HoystText
            numberOfLines={2}
            style={styles.calloutTitle}
            testID={`explore-activity-callout-title-${tone}-${circle.id}`}>
            {isWarm
              ? `${circle.title} hit a group streak`
              : `${memberName} just tapped in to ${circle.title}`}
          </HoystText>
          <HoystText
            numberOfLines={1}
            style={[styles.calloutDetail, {color}]}
            testID={`explore-activity-callout-detail-${tone}-${circle.id}`}>
            {isWarm
              ? `${circle.memberCount} ${
                  circle.memberCount === 1 ? 'Member' : 'Members'
                } tapped in today`
              : `2 min ago · keeping a ${circle.streakLabel}`}
          </HoystText>
        </View>
      </View>
    </GlassPanel>
  );
}

function ExploreCircleCard({
  circle,
  index,
  onJoinPress,
  onViewPress,
}: {
  circle: ExploreCircle;
  index: number;
  onJoinPress: () => void;
  onViewPress: () => void;
}) {
  const theme = useHoystTheme();
  const categoryColor = getCircleCategoryForegroundColor(
    circle.category,
    theme,
  );
  const categoryVisual = getCircleCategoryVisual(circle.category);
  const status = getExploreCircleStatus(circle);
  const statusColor = status.isActive
    ? theme.warningForeground
    : brandColors.graySoft;

  return (
    <Pressable
      accessibilityRole="button"
      onPress={onViewPress}
      style={({pressed}) => [
        styles.cardPressable,
        {opacity: pressed ? actionMotion.pressedOpacity : 1},
      ]}>
      <GlassPanel style={styles.circleCard}>
        <View style={styles.cardHeader}>
          <CircleCategoryIcon
            category={circle.category}
            shape="roundedSquare"
            size={44}
            style={styles.cardCategoryIcon}
          />
          <View style={styles.cardTitleGroup}>
            <HoystText
              numberOfLines={2}
              style={styles.cardTitle}
              testID={`explore-card-title-${circle.id}`}>
              {circle.title}
            </HoystText>
            <HoystText
              numberOfLines={1}
              style={[styles.cardCategoryLabel, {color: categoryColor}]}
              testID={`explore-card-category-${circle.id}`}>
              {categoryVisual.label.toUpperCase()}
            </HoystText>
          </View>
        </View>

        <HoystText
          numberOfLines={2}
          style={styles.cardDescription}
          testID={`explore-card-description-${circle.id}`}>
          {circle.commitment}
        </HoystText>

        <View style={styles.matchPill}>
          <CircleCategoryIcon category={circle.category} size={14} />
          <HoystText
            numberOfLines={1}
            style={[styles.matchPillText, {color: categoryColor}]}
            testID={`explore-card-match-${circle.id}`}>
            {index === 0
              ? `${
                  circle.members[0]?.name ?? 'Someone'
                } + 1 Member you know is inside`
              : `Matches your ${circle.category} focus`}
          </HoystText>
        </View>

        <View style={styles.cardStats}>
          <View style={styles.statRow}>
            <UsersRound color={categoryColor} size={14} strokeWidth={2.3} />
            <HoystText
              style={styles.cardStatText}
              tone="muted"
              testID={`explore-card-members-${circle.id}`}>
              {circle.memberCount}/{circle.maxSize}
            </HoystText>
          </View>
          <HoystText style={styles.cardStatText} tone="muted">
            ·
          </HoystText>
          <View style={styles.statRow}>
            {status.isActive ? (
              <Flame
                color={theme.warningForeground}
                size={12}
                strokeWidth={2.6}
              />
            ) : null}
            <HoystText
              numberOfLines={1}
              style={[styles.cardStatusText, {color: statusColor}]}
              testID={`explore-card-status-${circle.id}`}>
              {status.label}
            </HoystText>
          </View>
        </View>

        <View style={styles.cardFooter}>
          <ExploreAvatarStack circle={circle} size={30} />
          <View style={styles.cardActions}>
            <ExplorePillButton
              accessibilityLabel={`View ${circle.title}`}
              backgroundColor={theme.surfaceSoft}
              borderColor={theme.border}
              fillStyle={styles.cardActionFill}
              label="View"
              labelStyle={styles.cardActionLabel}
              onPress={onViewPress}
              style={styles.smallAction}
              testID={`explore-card-view-${circle.id}`}
              textColor={theme.text}
            />
            <ExplorePillButton
              accessibilityLabel={`Join ${circle.title}`}
              backgroundColor={categoryColor}
              borderColor={categoryColor}
              fillStyle={styles.cardActionFill}
              label="Join"
              labelStyle={styles.cardActionLabel}
              onPress={onJoinPress}
              style={styles.smallAction}
              testID={`explore-card-join-${circle.id}`}
              textColor={brandColors.white}
            />
          </View>
        </View>
      </GlassPanel>
    </Pressable>
  );
}

export function ExploreScreen({navigation}: Props): React.JSX.Element {
  const theme = useHoystTheme();
  const {width} = useWindowDimensions();
  const [liveCircles, setLiveCircles] = useState<ExploreCircle[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [activeCategory, setActiveCategory] = useState('All');
  const rootNavigation =
    navigation.getParent<NativeStackNavigationProp<RootStackParamList>>();
  const sourceCircles = liveCircles.length > 0 ? liveCircles : exploreCircles;
  const contentWidth = Math.max(width - 40, 0);

  useEffect(() => {
    return subscribeToPublicCircles(setLiveCircles, () => {
      setLiveCircles([]);
    });
  }, []);

  const categories = useMemo(
    () => getPublicCircleCategories(sourceCircles),
    [sourceCircles],
  );
  const filteredCircles = useMemo(
    () => filterPublicCircles(sourceCircles, activeCategory, searchTerm),
    [activeCategory, searchTerm, sourceCircles],
  );
  const featuredCircle = useMemo(
    () => getFeaturedCircle(filteredCircles),
    [filteredCircles],
  );
  const forYouCircles = useMemo(
    () =>
      featuredCircle
        ? filteredCircles.filter(circle => circle.id !== featuredCircle.id)
        : filteredCircles,
    [featuredCircle, filteredCircles],
  );

  useEffect(() => {
    if (!categories.includes(activeCategory)) {
      setActiveCategory('All');
    }
  }, [activeCategory, categories]);

  const openCircle = (circleId: string) => {
    rootNavigation?.navigate('CircleDetail', {circleId});
  };

  const joinCircle = (circleId: string) => {
    rootNavigation?.navigate('CircleDetail', {
      circleId,
      resumeAction: 'join',
    });
  };

  return (
    <HoystScreen
      background={<FrostedBackdrop />}
      contentContainerStyle={styles.content}
      keyboardDismissMode="on-drag"
      keyboardShouldPersistTaps="handled">
      <View style={[styles.screenStack, {width: contentWidth}]}>
        <View style={styles.header}>
          <View style={styles.headerTopRow}>
            <HoystText style={styles.headline} testID="explore-title">
              Explore
            </HoystText>
            <Pressable
              accessibilityLabel="Create commitment"
              accessibilityRole="button"
              onPress={() => rootNavigation?.navigate('CreateCircle')}
              style={({pressed}) => [
                styles.createButton,
                {opacity: pressed ? actionMotion.pressedOpacity : 1},
              ]}>
              <View
                style={[
                  styles.createButtonSurface,
                  {
                    backgroundColor: theme.surfaceStrong,
                    borderColor: theme.border,
                  },
                ]}>
                <Plus color={theme.text} size={26} strokeWidth={2.5} />
              </View>
            </Pressable>
          </View>
          <HoystText
            numberOfLines={1}
            style={styles.subhead}
            testID="explore-subtitle">
            Find circles moving at your pace.
          </HoystText>
        </View>

        <View style={styles.searchWrap}>
          <Search
            color={theme.textMuted}
            size={23}
            strokeWidth={2.3}
            style={styles.searchIcon}
          />
          <HoystInput
            containerStyle={styles.searchInput}
            onChangeText={setSearchTerm}
            placeholder="Search circles, categories, goals..."
            style={styles.searchInputText}
            testID="explore-search-input"
            value={searchTerm}
          />
        </View>

        <ScrollView
          contentContainerStyle={styles.filterRow}
          horizontal
          showsHorizontalScrollIndicator={false}
          style={styles.filterScroller}
          testID="explore-filter-scroll">
          {categories.map(category => (
            <CategoryFilterChip
              category={category}
              isActive={activeCategory === category}
              key={category}
              onPress={() => setActiveCategory(category)}
            />
          ))}
        </ScrollView>

        {featuredCircle ? (
          <View
            style={[styles.sectionStack, styles.featuredSection]}
            testID="explore-featured-section">
            <ExploreSectionTitle showFeaturedStar title="FEATURED THIS WEEK" />
            <View
              style={styles.featuredCardFrame}
              testID="explore-featured-card-frame">
              <FeaturedCircleCard
                circle={featuredCircle}
                onJoinPress={() => joinCircle(featuredCircle.id)}
                onViewPress={() => openCircle(featuredCircle.id)}
              />
            </View>
          </View>
        ) : null}

        <View style={styles.sectionStack}>
          <ExploreSectionTitle count={filteredCircles.length} title="FOR YOU" />
          {filteredCircles.length === 0 ? (
            <GlassPanel style={styles.emptyState}>
              <HoystText variant="title">No circles found</HoystText>
              <HoystText tone="muted">
                Try a different search or switch categories to keep browsing.
              </HoystText>
              <HoystButton
                label="Clear filters"
                onPress={() => {
                  setActiveCategory('All');
                  setSearchTerm('');
                }}
                style={styles.clearButton}
                variant="outline"
              />
            </GlassPanel>
          ) : (
            forYouCircles.map((circle, index) => (
              <React.Fragment key={circle.id}>
                <ExploreCircleCard
                  circle={circle}
                  index={index}
                  onJoinPress={() => joinCircle(circle.id)}
                  onViewPress={() => openCircle(circle.id)}
                />
                {index === 0 ? (
                  <ExploreActivityCallout circle={circle} tone="cool" />
                ) : null}
                {index === 1 ? (
                  <ExploreActivityCallout circle={circle} tone="warm" />
                ) : null}
              </React.Fragment>
            ))
          )}
        </View>
      </View>
    </HoystScreen>
  );
}

const styles = StyleSheet.create({
  activeDot: {
    backgroundColor: '#70E2A3',
    borderRadius: 4,
    height: 8,
    width: 8,
  },
  avatarOffset: {
    borderRadius: radius.pill,
  },
  avatarOverlap: {
    marginLeft: -6,
  },
  avatarRow: {
    alignItems: 'center',
    flexDirection: 'row',
    flexShrink: 0,
    overflow: 'visible',
  },
  callout: {
    borderWidth: 1,
  },
  calloutAvatarWrap: {
    flexShrink: 0,
    position: 'relative',
  },
  calloutBadge: {
    alignItems: 'center',
    borderColor: brandColors.white,
    borderRadius: 10,
    borderWidth: 2,
    bottom: -2,
    height: 20,
    justifyContent: 'center',
    position: 'absolute',
    right: -2,
    width: 20,
  },
  calloutContent: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 12,
    minHeight: 86,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  calloutCopy: {
    flex: 1,
    gap: 3,
    minWidth: 0,
  },
  calloutDetail: {
    fontSize: 13,
    fontWeight: '500',
    letterSpacing: 0,
    lineHeight: 17,
    opacity: 0.78,
  },
  calloutTint: {
    opacity: 0.62,
  },
  calloutTintDark: {
    opacity: 0.9,
  },
  calloutTitle: {
    fontSize: 14,
    fontWeight: '800',
    letterSpacing: 0,
    lineHeight: 18,
  },
  cardActionFill: {
    minHeight: 40,
    paddingHorizontal: 14,
  },
  cardActionLabel: {
    fontSize: 14,
    lineHeight: 18,
  },
  cardActions: {
    flexDirection: 'row',
    gap: 8,
  },
  cardCategoryIcon: {
    flexShrink: 0,
  },
  cardDescription: {
    color: brandColors.graySoft,
    fontSize: 14,
    fontWeight: '600',
    letterSpacing: 0,
    lineHeight: 18,
  },
  cardCategoryLabel: {
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.6,
    lineHeight: 14,
  },
  cardFooter: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 12,
    justifyContent: 'space-between',
  },
  cardHeader: {
    alignItems: 'flex-start',
    flexDirection: 'row',
    gap: 12,
  },
  cardPressable: {
    borderRadius: radius.lg,
  },
  cardStats: {
    alignItems: 'center',
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 7,
  },
  cardStatText: {
    fontSize: 12,
    fontWeight: '500',
    letterSpacing: 0,
    lineHeight: 16,
  },
  cardStatusText: {
    flexShrink: 1,
    fontSize: 12,
    fontWeight: '500',
    letterSpacing: 0,
    lineHeight: 16,
  },
  cardTitle: {
    fontSize: 17,
    fontWeight: '800',
    letterSpacing: 0,
    lineHeight: 21,
  },
  cardTitleGroup: {
    flex: 1,
    gap: 2,
    minWidth: 0,
  },
  circleCard: {
    minHeight: 218,
  },
  clearButton: {
    alignSelf: 'flex-start',
    minWidth: 160,
  },
  content: {
    paddingBottom: 176,
    paddingTop: 0,
  },
  createButton: {
    borderRadius: 20,
    flexShrink: 0,
    padding: 2,
  },
  createButtonSurface: {
    alignItems: 'center',
    borderRadius: 18,
    borderWidth: 1,
    elevation: 5,
    height: 44,
    justifyContent: 'center',
    shadowColor: 'rgba(15,23,42,0.16)',
    shadowOffset: {height: 12, width: 0},
    shadowOpacity: 0.14,
    shadowRadius: 20,
    width: 44,
  },
  emptyState: {
    gap: 16,
    minHeight: 180,
  },
  featuredAction: {
    borderRadius: 14,
    flexShrink: 1,
    minWidth: 0,
  },
  featuredActionFill: {
    alignSelf: 'stretch',
    borderRadius: 14,
    minHeight: 44,
    paddingHorizontal: 16,
    width: '100%',
  },
  featuredActionLabel: {
    fontSize: 15,
    lineHeight: 19,
  },
  featuredActions: {
    flexDirection: 'row',
    gap: 14,
    marginTop: 10,
    width: '100%',
  },
  featuredActivePill: {
    flexShrink: 1,
    justifyContent: 'center',
    marginLeft: 'auto',
    minWidth: 104,
    paddingHorizontal: 12,
  },
  featuredCard: {
    alignSelf: 'stretch',
    borderRadius: radius.lg,
    overflow: 'hidden',
    shadowColor: 'rgba(47,111,237,0.34)',
    shadowOffset: {height: 16, width: 0},
    shadowOpacity: 0.22,
    shadowRadius: 28,
    width: '100%',
  },
  featuredCardContent: {
    gap: 0,
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 18,
  },
  featuredCardFrame: {
    marginHorizontal: 0,
  },
  featuredCopy: {
    gap: 3,
    marginTop: 10,
  },
  featuredDescription: {
    color: 'rgba(255,255,255,0.82)',
    fontSize: 14,
    fontWeight: '700',
    letterSpacing: 0,
    lineHeight: 19,
  },
  featuredPill: {
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.18)',
    borderRadius: radius.pill,
    flexDirection: 'row',
    flexShrink: 0,
    gap: 8,
    minHeight: 30,
    paddingHorizontal: 14,
  },
  featuredPillText: {
    color: brandColors.white,
    flexShrink: 0,
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 0.2,
    lineHeight: 15,
  },
  featuredStat: {
    color: brandColors.white,
    flexShrink: 1,
    fontSize: 12,
    fontWeight: '700',
    lineHeight: 16,
  },
  featuredStatsRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 10,
    marginTop: 8,
  },
  featuredTitle: {
    color: brandColors.white,
    fontSize: 26,
    fontWeight: '800',
    letterSpacing: 0,
    lineHeight: 30,
  },
  featuredTopRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 8,
    justifyContent: 'space-between',
    minWidth: 0,
    width: '100%',
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
    gap: 10,
    paddingRight: 20,
  },
  filterScroller: {
    alignSelf: 'stretch',
    marginBottom: 4,
    width: '100%',
  },
  header: {
    alignSelf: 'stretch',
    gap: 0,
    width: '100%',
  },
  headerTopRow: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
    width: '100%',
  },
  headline: {
    fontSize: 26,
    fontWeight: '800',
    letterSpacing: 0,
    lineHeight: 30,
  },
  featuredSection: {
    gap: 10,
    marginBottom: 8,
    marginTop: 2,
  },
  matchPill: {
    alignItems: 'center',
    alignSelf: 'flex-start',
    backgroundColor: 'rgba(47,111,237,0.10)',
    borderRadius: radius.pill,
    flexDirection: 'row',
    gap: 8,
    maxWidth: '100%',
    paddingHorizontal: 11,
    paddingVertical: 7,
  },
  matchPillText: {
    flexShrink: 1,
    fontSize: 13,
    fontWeight: '800',
    letterSpacing: 0,
    lineHeight: 17,
  },
  moreBubble: {
    alignItems: 'center',
    backgroundColor: brandColors.charcoal,
    borderColor: brandColors.white,
    borderRadius: radius.pill,
    borderWidth: 1.5,
    justifyContent: 'center',
  },
  moreBubbleText: {
    color: brandColors.white,
    fontWeight: '800',
  },
  pillButtonFill: {
    alignItems: 'center',
    borderRadius: radius.pill,
    borderWidth: 1,
    justifyContent: 'center',
    minHeight: 46,
    paddingHorizontal: 18,
  },
  pillButtonLabel: {
    fontSize: 15,
    fontWeight: '800',
    letterSpacing: 0,
    lineHeight: 19,
  },
  pillButtonPressable: {
    borderRadius: radius.pill,
    flexShrink: 0,
  },
  screenStack: {
    alignSelf: 'stretch',
    gap: 12,
    marginTop: 0,
    width: '100%',
  },
  searchIcon: {
    left: 18,
    position: 'absolute',
    top: 14,
    zIndex: 1,
  },
  searchInput: {
    borderRadius: 24,
    height: 50,
    minHeight: 50,
    paddingLeft: 48,
    paddingRight: 18,
    paddingVertical: 0,
  },
  searchInputText: {
    fontSize: 15,
    lineHeight: 20,
  },
  searchWrap: {
    alignSelf: 'stretch',
    position: 'relative',
    width: '100%',
  },
  sectionStack: {
    alignSelf: 'stretch',
    gap: 12,
    width: '100%',
  },
  sectionTitleRow: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  sectionTitleLabel: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 8,
  },
  smallAction: {
    minWidth: 78,
  },
  statRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 6,
  },
  subhead: {
    color: brandColors.graySoft,
    fontSize: 15,
    fontWeight: '500',
    letterSpacing: 0,
    lineHeight: 20,
    marginTop: -6,
  },
});
