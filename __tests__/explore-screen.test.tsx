import React from 'react';
import {Dimensions, StyleSheet, TextInput} from 'react-native';
import renderer, {act} from 'react-test-renderer';

import {ExploreScreen} from '../src/features/explore/screens/ExploreScreen';
import type {ExploreCircle} from '../src/types/models';

let mockPublicCircles: ExploreCircle[];
let mockAppearance: 'dark' | 'light';

jest.mock('@react-native-community/blur', () => {
  const MockReact = require('react');
  const {View} = require('react-native');

  return {
    BlurView: ({children, ...props}: {children?: React.ReactNode}) =>
      MockReact.createElement(View, props, children),
  };
});

jest.mock('react-native-linear-gradient', () => {
  const MockReact = require('react');
  const {View} = require('react-native');

  return ({children, ...props}: {children?: React.ReactNode}) =>
    MockReact.createElement(View, props, children);
});

jest.mock('react-native-safe-area-context', () => {
  const MockReact = require('react');
  const {View} = require('react-native');

  return {
    SafeAreaView: ({children, ...props}: {children?: React.ReactNode}) =>
      MockReact.createElement(View, props, children),
    useSafeAreaInsets: () => ({bottom: 0, left: 0, right: 0, top: 0}),
  };
});

jest.mock('../src/store/settings-store', () => ({
  useSettingsStore: (
    selector: (state: {appearance: typeof mockAppearance}) => unknown,
  ) => selector({appearance: mockAppearance}),
}));

jest.mock('../src/features/circles/services/public-circle-service', () => ({
  subscribeToPublicCircles: jest.fn(onCircles => {
    onCircles(mockPublicCircles);
    return jest.fn();
  }),
}));

function publicCircle(overrides: Partial<ExploreCircle>): ExploreCircle {
  return {
    category: 'Fitness',
    commitment: 'Move for 30 minutes',
    commitmentCadence: 'daily',
    commitmentFrequency: {tapInsPerWeek: 7},
    completionRate: 82,
    id: 'fitness-circle',
    joinLabel: 'Open seats',
    matchCopy: 'A steady group for showing up.',
    maxSize: 10,
    memberCount: 6,
    members: [
      {id: 'member-1', initials: 'AV', name: 'Ava', state: 'done'},
      {id: 'member-2', initials: 'MA', name: 'Marcus', state: 'pending'},
      {id: 'member-3', initials: 'JU', name: 'June', state: 'done'},
      {id: 'member-4', initials: 'KA', name: 'Kai', state: 'done'},
    ],
    streakLabel: '6-day streak',
    title: 'Workout Circle',
    ...overrides,
  };
}

function renderScreenWithNavigation() {
  const rootNavigate = jest.fn();
  const navigation = {
    getParent: () => ({navigate: rootNavigate}),
  };
  let screen: renderer.ReactTestRenderer | undefined;

  act(() => {
    screen = renderer.create(
      <ExploreScreen navigation={navigation as never} route={{} as never} />,
    );
  });

  return {rootNavigate, screen: screen!};
}

function renderOutput(screen: renderer.ReactTestRenderer) {
  return JSON.stringify(screen.toJSON());
}

describe('ExploreScreen', () => {
  beforeEach(() => {
    mockAppearance = 'light';
    mockPublicCircles = [
      publicCircle({
        category: 'Fitness',
        completionRate: 82,
        id: 'fitness-circle',
        title: 'Workout Circle',
      }),
      publicCircle({
        category: 'Wellness',
        commitment: 'Wind down and sleep a full 8 hours each night',
        completionRate: 96,
        id: 'sleep-circle',
        matchCopy: 'Matches your Wellness focus',
        title: 'Sleep 8 Hours',
      }),
      publicCircle({
        category: 'Deep Work',
        commitment: 'One 90-minute deep work block before noon',
        completionRate: 88,
        id: 'deep-focus',
        matchCopy: 'Focused mornings with makers.',
        title: 'Deep Focus Mornings',
      }),
    ];
  });

  it('renders the mock sections and chooses the highest-completion circle as featured', () => {
    const {screen} = renderScreenWithNavigation();
    const output = renderOutput(screen);
    const featured = screen.root.findByProps({
      testID: 'explore-featured-card',
    });
    const featuredFrameStyle = StyleSheet.flatten(
      screen.root.findByProps({
        testID: 'explore-featured-card-frame',
      }).props.style,
    );
    const featuredSectionStyle = StyleSheet.flatten(
      screen.root.findByProps({
        testID: 'explore-featured-section',
      }).props.style,
    );
    const featuredStar = screen.root.findByProps({
      testID: 'explore-featured-section-star',
    });
    const allFilter = screen.root.findByProps({
      testID: 'explore-filter-All',
    });

    expect(output).toContain('Explore');
    expect(output).toContain('Find circles moving at your pace.');
    expect(output).toContain('FEATURED THIS WEEK');
    expect(output).toContain('FOR YOU');
    expect(output).toContain('All');
    expect(output).toContain('Fitness');
    expect(output).toContain('Wellness');
    expect(output).toContain('Deep Work');
    expect(output).toContain('Sleep 8 Hours');
    expect(allFilter.props.accessibilityState).toEqual({selected: true});
    expect(featured.props.colors).toEqual(['#7A55FF', '#5A1CFF']);
    expect(StyleSheet.flatten(featured.props.style).width).toBe('100%');
    expect(featuredStar.props.size).toBe(13);
    expect(featuredStar.props.color).toBe('#FFC400');
    expect(featuredStar.props.fill).toBe('#FFC400');
    expect(featuredSectionStyle.marginTop).toBe(2);
    expect(featuredSectionStyle.marginBottom).toBe(8);
    expect(featuredSectionStyle.gap).toBe(10);
    expect(featuredFrameStyle.marginHorizontal).toBe(0);
  });

  it('matches Home-aligned header and search sizing', () => {
    const {screen} = renderScreenWithNavigation();
    const titleStyle = StyleSheet.flatten(
      screen.root.findByProps({testID: 'explore-title'}).props.style,
    );
    const subtitleStyle = StyleSheet.flatten(
      screen.root.findByProps({testID: 'explore-subtitle'}).props.style,
    );
    const createButtonStyle = StyleSheet.flatten(
      screen.root
        .findByProps({accessibilityLabel: 'Create commitment'})
        .props.style({
          pressed: false,
        }),
    );
    const searchInput = screen.root.findByProps({
      testID: 'explore-search-input',
    });
    const searchInputContainerStyle = StyleSheet.flatten(
      searchInput.props.containerStyle,
    );
    const searchInputTextStyle = StyleSheet.flatten(searchInput.props.style);

    expect(titleStyle.fontSize).toBe(26);
    expect(titleStyle.lineHeight).toBe(30);
    expect(subtitleStyle.fontWeight).toBe('500');
    expect(subtitleStyle.marginTop).toBe(-6);
    expect(createButtonStyle.padding).toBe(2);
    expect(searchInputContainerStyle.height).toBe(50);
    expect(searchInputContainerStyle.minHeight).toBe(50);
    expect(searchInputContainerStyle.paddingLeft).toBe(48);
    expect(searchInputTextStyle.fontSize).toBe(15);
    expect(searchInputTextStyle.lineHeight).toBe(20);
  });

  it('uses singular Member grammar for the social match', () => {
    const {screen} = renderScreenWithNavigation();

    expect(renderOutput(screen)).toContain(
      'Ava + 1 Member you know is inside',
    );
  });

  it('matches Home-aligned featured card sizing for pills, stats, and CTAs', () => {
    const {screen} = renderScreenWithNavigation();
    const categoryPillStyle = StyleSheet.flatten(
      screen.root.findByProps({
        testID: 'explore-featured-category-pill',
      }).props.style,
    );
    const activePillStyle = StyleSheet.flatten(
      screen.root.findByProps({
        testID: 'explore-featured-active-pill',
      }).props.style,
    );
    const titleStyle = StyleSheet.flatten(
      screen.root.findByProps({
        testID: 'explore-featured-title',
      }).props.style,
    );
    const featuredCardStyle = StyleSheet.flatten(
      screen.root.findByProps({
        testID: 'explore-featured-card',
      }).props.style,
    );
    const featuredCardContentStyle = StyleSheet.flatten(
      screen.root.findByProps({
        testID: 'explore-featured-card-content',
      }).props.style,
    );
    const descriptionStyle = StyleSheet.flatten(
      screen.root.findByProps({
        testID: 'explore-featured-description',
      }).props.style,
    );
    const actionRowStyle = StyleSheet.flatten(
      screen.root.findByProps({
        testID: 'explore-featured-actions',
      }).props.style,
    );
    const statStyle = StyleSheet.flatten(
      screen.root.findByProps({
        testID: 'explore-featured-stat',
      }).props.style,
    );
    const avatarRowStyle = StyleSheet.flatten(
      screen.root.findByProps({
        testID: 'explore-avatar-row-sleep-circle',
      }).props.style,
    );
    const featuredAvatarChildren = React.Children.toArray(
      screen.root.findByProps({
        testID: 'explore-avatar-row-sleep-circle',
      }).props.children,
    );
    const avatarOverlapStyle = StyleSheet.flatten(
      screen.root.findByProps({
        testID: 'explore-avatar-sleep-circle-member-2',
      }).props.style,
    );
    const statText = React.Children.toArray(
      screen.root.findByProps({
        testID: 'explore-featured-stat',
      }).props.children,
    ).join('');
    const viewFillStyle = StyleSheet.flatten(
      screen.root.findByProps({
        testID: 'explore-featured-view-sleep-circle-fill',
      }).props.style,
    );
    const viewLabelStyle = StyleSheet.flatten(
      screen.root.findByProps({
        testID: 'explore-featured-view-sleep-circle-fill',
      }).props.children.props.style,
    );
    const viewButtonStyle = StyleSheet.flatten(
      screen.root.findByProps({
        testID: 'explore-featured-view-sleep-circle',
      }).props.style,
    );
    const joinFillStyle = StyleSheet.flatten(
      screen.root.findByProps({
        testID: 'explore-featured-join-sleep-circle-fill',
      }).props.style,
    );
    const joinButtonStyle = StyleSheet.flatten(
      screen.root.findByProps({
        testID: 'explore-featured-join-sleep-circle',
      }).props.style,
    );
    const expectedFeaturedActionWidth = Math.max(
      (Dimensions.get('window').width - 94) / 2,
      0,
    );

    expect(categoryPillStyle.minHeight).toBe(30);
    expect(activePillStyle.minWidth).toBe(104);
    expect(activePillStyle.marginLeft).toBe('auto');
    expect(statText).toBe('6/10 Members');
    expect(statText).not.toContain('seats');
    expect(featuredCardStyle.overflow).toBe('hidden');
    expect(featuredCardContentStyle.paddingTop).toBe(16);
    expect(featuredCardContentStyle.paddingBottom).toBe(18);
    expect(titleStyle.fontSize).toBe(26);
    expect(titleStyle.lineHeight).toBe(30);
    expect(descriptionStyle.fontSize).toBe(14);
    expect(descriptionStyle.lineHeight).toBe(19);
    expect(statStyle.fontSize).toBe(12);
    expect(statStyle.lineHeight).toBe(16);
    expect(avatarRowStyle.flexShrink).toBe(0);
    expect(avatarRowStyle.overflow).toBe('visible');
    expect(avatarOverlapStyle.marginLeft).toBe(-6);
    expect(featuredAvatarChildren).toHaveLength(4);
    expect(viewFillStyle.borderRadius).toBe(14);
    expect(joinFillStyle.borderRadius).toBe(14);
    expect(viewButtonStyle.borderRadius).toBe(14);
    expect(joinButtonStyle.borderRadius).toBe(14);
    expect(viewButtonStyle.minWidth).toBe(0);
    expect(joinButtonStyle.minWidth).toBe(0);
    expect(viewButtonStyle.width).toBe(expectedFeaturedActionWidth);
    expect(joinButtonStyle.width).toBe(expectedFeaturedActionWidth);
    expect(viewFillStyle.alignSelf).toBe('stretch');
    expect(joinFillStyle.alignSelf).toBe('stretch');
    expect(viewFillStyle.minHeight).toBe(44);
    expect(joinFillStyle.minHeight).toBe(44);
    expect(viewLabelStyle.fontSize).toBe(15);
    expect(viewLabelStyle.lineHeight).toBe(19);
    expect(actionRowStyle.width).toBe('100%');
    expect(actionRowStyle.gap).toBe(14);
    expect(viewFillStyle.width).toBe(expectedFeaturedActionWidth);
    expect(joinFillStyle.width).toBe(expectedFeaturedActionWidth);
  });

  it('filters by category using the Explore chips', () => {
    const {screen} = renderScreenWithNavigation();
    const filterScroll = screen.root.findByProps({
      testID: 'explore-filter-scroll',
    });
    const filterRowStyle = StyleSheet.flatten(
      filterScroll.props.contentContainerStyle,
    );
    const filterScrollerStyle = StyleSheet.flatten(filterScroll.props.style);
    const fitnessFilter = screen.root.findByProps({
      testID: 'explore-filter-Fitness',
    });

    expect(filterScroll.props.horizontal).toBe(true);
    expect(filterScroll.props.showsHorizontalScrollIndicator).toBe(false);
    expect(filterRowStyle.flexDirection).toBe('row');
    expect(filterRowStyle.flexWrap).toBeUndefined();
    expect(filterScrollerStyle.marginBottom).toBe(4);

    act(() => {
      fitnessFilter.props.onPress();
    });

    const output = renderOutput(screen);
    const selectedFitnessFilter = screen.root.findByProps({
      testID: 'explore-filter-Fitness',
    });

    expect(output).toContain('Workout Circle');
    expect(output).not.toContain('Sleep 8 Hours');
    expect(output).not.toContain('Deep Focus Mornings');
    expect(selectedFitnessFilter.props.accessibilityState).toEqual({
      selected: true,
    });
  });

  it('renders compact FOR YOU circle cards with inline status copy', () => {
    const {screen} = renderScreenWithNavigation();
    const output = renderOutput(screen);
    const titleStyle = StyleSheet.flatten(
      screen.root.findByProps({
        testID: 'explore-card-title-fitness-circle',
      }).props.style,
    );
    const descriptionStyle = StyleSheet.flatten(
      screen.root.findByProps({
        testID: 'explore-card-description-fitness-circle',
      }).props.style,
    );
    const categoryStyle = StyleSheet.flatten(
      screen.root.findByProps({
        testID: 'explore-card-category-fitness-circle',
      }).props.style,
    );
    const matchStyle = StyleSheet.flatten(
      screen.root.findByProps({
        testID: 'explore-card-match-fitness-circle',
      }).props.style,
    );
    const memberStyle = StyleSheet.flatten(
      screen.root.findByProps({
        testID: 'explore-card-members-fitness-circle',
      }).props.style,
    );
    const statusStyle = StyleSheet.flatten(
      screen.root.findByProps({
        testID: 'explore-card-status-fitness-circle',
      }).props.style,
    );
    const viewFillStyle = StyleSheet.flatten(
      screen.root.findByProps({
        testID: 'explore-card-view-fitness-circle-fill',
      }).props.style,
    );
    const viewLabelStyle = StyleSheet.flatten(
      screen.root.findByProps({
        testID: 'explore-card-view-fitness-circle-fill',
      }).props.children.props.style,
    );
    const joinFillStyle = StyleSheet.flatten(
      screen.root.findByProps({
        testID: 'explore-card-join-fitness-circle-fill',
      }).props.style,
    );

    expect(output).toContain('4 seats open');
    expect(output).toContain('FITNESS');
    expect(output).not.toContain('82% weekly pace');
    expect(titleStyle.fontSize).toBe(17);
    expect(titleStyle.lineHeight).toBe(21);
    expect(categoryStyle.fontSize).toBe(11);
    expect(categoryStyle.lineHeight).toBe(14);
    expect(descriptionStyle.fontSize).toBe(14);
    expect(descriptionStyle.lineHeight).toBe(18);
    expect(matchStyle.fontSize).toBe(13);
    expect(matchStyle.lineHeight).toBe(17);
    expect(memberStyle.fontSize).toBe(12);
    expect(memberStyle.fontWeight).toBe('500');
    expect(memberStyle.lineHeight).toBe(16);
    expect(statusStyle.fontSize).toBe(12);
    expect(statusStyle.fontWeight).toBe('500');
    expect(statusStyle.lineHeight).toBe(16);
    expect(viewFillStyle.minHeight).toBe(40);
    expect(joinFillStyle.minHeight).toBe(40);
    expect(viewLabelStyle.fontSize).toBe(14);
    expect(viewLabelStyle.lineHeight).toBe(18);
  });

  it('removes the FOR YOU availability pill even when seats are open', () => {
    mockPublicCircles = [
      publicCircle({
        completionRate: 96,
        id: 'featured-circle',
        maxSize: 4,
        memberCount: 4,
        title: 'Featured Circle',
      }),
      publicCircle({
        completionRate: 88,
        id: 'active-card',
        maxSize: 10,
        memberCount: 1,
        title: '3 Day Healthy Activity',
      }),
    ];

    const {screen} = renderScreenWithNavigation();
    const output = renderOutput(screen);

    expect(output).toContain('Active today');
    expect(output).not.toContain('9 seats');
    expect(
      screen.root.findAllByProps({testID: 'explore-card-seat-badge'}),
    ).toHaveLength(0);
  });

  it('renders Explore activity callouts as compact avatar cards', () => {
    const {screen} = renderScreenWithNavigation();
    const output = renderOutput(screen);
    const titleStyle = StyleSheet.flatten(
      screen.root.findByProps({
        testID: 'explore-activity-callout-title-cool-fitness-circle',
      }).props.style,
    );
    const copyStyle = StyleSheet.flatten(
      screen.root.findByProps({
        testID: 'explore-activity-callout-copy-cool-fitness-circle',
      }).props.style,
    );
    const detailStyle = StyleSheet.flatten(
      screen.root.findByProps({
        testID: 'explore-activity-callout-detail-cool-fitness-circle',
      }).props.style,
    );
    const badgeStyle = StyleSheet.flatten(
      screen.root.findByProps({
        testID: 'explore-activity-callout-badge-cool-fitness-circle',
      }).props.style,
    );

    expect(output).toContain('Ava just tapped in to Workout Circle');
    expect(output).toContain('2 min ago · keeping a 6-day streak');
    expect(titleStyle.fontSize).toBe(14);
    expect(titleStyle.lineHeight).toBe(18);
    expect(copyStyle.gap).toBe(3);
    expect(detailStyle.fontSize).toBe(13);
    expect(detailStyle.fontWeight).toBe('500');
    expect(detailStyle.lineHeight).toBe(17);
    expect(detailStyle.opacity).toBe(0.78);
    expect(badgeStyle.height).toBe(20);
    expect(badgeStyle.width).toBe(20);
  });

  it('uses high-contrast activity callout colors in dark mode', () => {
    mockAppearance = 'dark';

    const {screen} = renderScreenWithNavigation();
    const coolDetailStyle = StyleSheet.flatten(
      screen.root.findByProps({
        testID: 'explore-activity-callout-detail-cool-fitness-circle',
      }).props.style,
    );
    const coolTintStyle = StyleSheet.flatten(
      screen.root.findByProps({
        testID: 'explore-activity-callout-tint-cool-fitness-circle',
      }).props.style,
    );
    const warmDetailStyle = StyleSheet.flatten(
      screen.root.findByProps({
        testID: 'explore-activity-callout-detail-warm-deep-focus',
      }).props.style,
    );
    const warmTintStyle = StyleSheet.flatten(
      screen.root.findByProps({
        testID: 'explore-activity-callout-tint-warm-deep-focus',
      }).props.style,
    );

    expect(coolDetailStyle.color).toBe('#70E2A3');
    expect(coolTintStyle.backgroundColor).toBe('#10B96724');
    expect(coolTintStyle.opacity).toBe(0.9);
    expect(warmDetailStyle.color).toBe('#FFB88A');
    expect(warmTintStyle.backgroundColor).toBe('rgba(255,138,61,0.22)');
    expect(warmTintStyle.opacity).toBe(0.9);
  });

  it('filters by search text', () => {
    const {screen} = renderScreenWithNavigation();

    act(() => {
      screen.root.findByType(TextInput).props.onChangeText('deep');
    });

    const output = renderOutput(screen);

    expect(output).toContain('Deep Focus Mornings');
    expect(output).not.toContain('Sleep 8 Hours');
    expect(output).not.toContain('Workout Circle');
  });

  it('routes plus, View, and Join actions through the root stack', () => {
    const {rootNavigate, screen} = renderScreenWithNavigation();
    const createButton = screen.root.findByProps({
      accessibilityLabel: 'Create commitment',
    });
    const viewButton = screen.root.findByProps({
      testID: 'explore-featured-view-sleep-circle',
    });
    const joinButton = screen.root.findByProps({
      testID: 'explore-featured-join-sleep-circle',
    });

    act(() => {
      createButton.props.onPress();
      viewButton?.props.onPress();
      joinButton?.props.onPress();
    });

    expect(rootNavigate).toHaveBeenCalledWith('CreateCircle');
    expect(rootNavigate).toHaveBeenCalledWith('CircleDetail', {
      circleId: 'sleep-circle',
    });
    expect(rootNavigate).toHaveBeenCalledWith('CircleDetail', {
      circleId: 'sleep-circle',
      resumeAction: 'join',
    });
  });

  it('uses category color on non-featured Join buttons', () => {
    const {screen} = renderScreenWithNavigation();
    const fitnessJoinStyle = StyleSheet.flatten(
      screen.root.findByProps({
        testID: 'explore-card-join-fitness-circle-fill',
      }).props.style,
    );
    const deepWorkJoinStyle = StyleSheet.flatten(
      screen.root.findByProps({
        testID: 'explore-card-join-deep-focus-fill',
      }).props.style,
    );

    expect(fitnessJoinStyle.backgroundColor).toBe('#07763E');
    expect(deepWorkJoinStyle.backgroundColor).toBe('#086CA8');
  });
});
