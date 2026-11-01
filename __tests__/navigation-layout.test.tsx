import React from 'react';
import {Pressable, StyleSheet, Text, TextInput, View} from 'react-native';
import renderer, {act} from 'react-test-renderer';
import type {BottomTabBarProps} from '@react-navigation/bottom-tabs';
import {
  getHomeTopPadding,
  getNavigationLayout,
  type NavigationGeometry,
} from '../src/navigation/navigation-layout';
import {
  NavigationLayoutContext,
  useTabContentInsets,
} from '../src/navigation/NavigationLayoutContext';
import {
  HoystBottomTabBar,
  renderHoystTabBar,
} from '../src/navigation/components/HoystBottomTabBar';

jest.mock('@react-navigation/bottom-tabs', () => ({
  BottomTabBar: (props: object) =>
    require('react').createElement(require('react-native').View, {
      ...props,
      testID: 'bottom-bar',
    }),
}));
jest.mock('../src/design/theme/useHoystTheme', () => ({
  useHoystTheme: () => ({
    isDark: false,
    text: '#111',
    tabBarSurface: '#fff',
    border: '#ddd',
  }),
}));
jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({top: 0, bottom: 0, left: 0, right: 74}),
}));

const safe = {top: 0, bottom: 0, left: 0, right: 74};
const base: NavigationGeometry = {
  edge: 'trailing',
  rtl: false,
  bounds: {x: 0, y: 0, width: 440, height: 700},
  insets: safe,
  statusArea: {x: 366, y: 0, width: 74, height: 88},
};

describe('navigation geometry', () => {
  it('uses bottom navigation when the system has no vertical edge', () => {
    expect(getNavigationLayout(null, safe)).toEqual({
      mode: 'bottom',
      contentInsets: safe,
    });
    expect(getNavigationLayout({...base, edge: 'unspecified'}, safe).mode).toBe(
      'bottom',
    );
  });
  it('uses the side region below system UI without counting the side inset twice', () => {
    const layout = getNavigationLayout(base, safe);
    expect(layout.rail).toEqual({x: 348, y: 100, width: 88, height: 584});
    expect(layout.contentInsets.right).toBe(74);
    expect(layout.contentInsets.left).toBe(0);
  });
  it('accepts native NSNumber direction values without reversing the edge', () => {
    const geometry = {...base, rtl: 0} as unknown as NavigationGeometry;
    expect(getNavigationLayout(geometry, safe).rail?.x).toBe(348);
  });
  it('follows a changed inset and status frame without a window-size change', () => {
    const before = getNavigationLayout(base, safe);
    const after = getNavigationLayout(
      {
        ...base,
        insets: {...safe, right: 120, bottom: 24},
        statusArea: {...base.statusArea, height: 150},
      },
      safe,
    );
    expect(after.rail?.y).toBe(162);
    expect(after.rail?.height).toBe(498);
    expect(after.contentInsets.right).toBe(120);
    expect(before.rail?.y).toBe(100);
  });
  it.each([
    ['leading', false, true],
    ['trailing', false, false],
    ['leading', true, false],
    ['trailing', true, true],
  ] as const)(
    'resolves %s and rtl=%s to the correct physical edge',
    (edge, rtl, left) => {
      const layout = getNavigationLayout(
        {
          ...base,
          edge,
          rtl,
          insets: {...safe, left: 0, right: 0},
          statusArea: {x: 0, y: 0, width: 0, height: 0},
        },
        safe,
      );
      expect(layout.rail?.x).toBe(left ? 4 : 348);
      expect(layout.contentInsets).toEqual({...safe, left: 0, right: 0});
    },
  );
  it('keeps the rail in the side strip and leaves the upper third free without status geometry', () => {
    const hidden = getNavigationLayout(
      {...base, statusArea: {x: 0, y: 0, width: 0, height: 0}},
      safe,
    );
    expect(hidden.rail?.x).toBe(348);
    expect(hidden.contentInsets).toEqual(safe);
    expect(hidden.rail?.y).toBeCloseTo(700 / 3);
    const fullEdge = getNavigationLayout(
      {...base, statusArea: {...base.statusArea, height: 700}},
      safe,
    );
    expect(fullEdge.rail?.x).toBe(348);
    expect(fullEdge.rail?.y).toBeCloseTo(700 / 3);
  });
  it('reflows for container width changes', () => {
    const layout = getNavigationLayout(
      {
        ...base,
        bounds: {...base.bounds, width: 820},
        statusArea: {...base.statusArea, x: 746},
      },
      safe,
    );
    expect(layout.rail?.x).toBe(728);
    expect(layout.contentInsets.right).toBe(74);
  });
  it('gives Home at least 16 points while preserving regular top-safe-area spacing', () => {
    expect(getHomeTopPadding(0) + 4).toBe(16);
    expect(getHomeTopPadding(5) + 4).toBe(16);
    expect(getHomeTopPadding(59) + 4).toBe(63);
  });
});

describe('adaptive tab presentation', () => {
  const emit = jest.fn(() => ({defaultPrevented: false}));
  const dispatch = jest.fn();
  const routes = ['Home', 'Explore', 'TapIn', 'Progress', 'Profile'].map(
    name => ({key: name, name}),
  );
  const props = {
    state: {index: 1, key: 'tabs', routes},
    descriptors: Object.fromEntries(
      routes.map(route => [route.key, {options: {tabBarIcon: () => <View />}}]),
    ),
    navigation: {emit, dispatch},
    insets: safe,
  } as unknown as BottomTabBarProps;
  beforeEach(() => {
    emit.mockClear();
    dispatch.mockClear();
  });

  it('supports React Navigation invoking the render callback outside a component', () => {
    expect(renderHoystTabBar(props).type).toBe(HoystBottomTabBar);
  });

  it('keeps large-text navigation bounded and exposes scroll controls when destinations overflow', () => {
    const layout = getNavigationLayout(base, safe);
    let tree!: renderer.ReactTestRenderer;
    act(() => {
      tree = renderer.create(
        <NavigationLayoutContext.Provider value={layout}>
          <HoystBottomTabBar {...props} />
        </NavigationLayoutContext.Provider>,
      );
    });
    const scroll = tree.root.findByProps({testID: 'navigation-rail-scroll'});
    act(() => scroll.props.onContentSizeChange(88, 900));
    const railStyle = StyleSheet.flatten(
      tree.root.findByProps({testID: 'hoyst-navigation-rail'}).props.style,
    );
    expect(railStyle.height).toBe(layout.rail?.height);
    expect(railStyle.bottom).toBe(16);
    expect(
      tree.root.findByProps({testID: 'navigation-rail-scroll-more'}).props
        .accessibilityLabel,
    ).toBe('Show remaining navigation destinations');
    act(() =>
      scroll.props.onScroll({
        nativeEvent: {
          contentOffset: {y: 600},
          layoutMeasurement: {height: 300},
          contentSize: {height: 900},
        },
      }),
    );
    expect(
      tree.root.findByProps({testID: 'navigation-rail-scroll-more'}).props
        .accessibilityLabel,
    ).toBe('Show first navigation destinations');
    act(() => tree.unmount());
  });

  it('uses the actual local keyboard inset to hide and restore the rail', () => {
    const layout = getNavigationLayout(base, safe);
    const keyboardProps = {
      ...props,
      descriptors: {
        ...props.descriptors,
        Explore: {
          ...props.descriptors.Explore,
          options: {tabBarHideOnKeyboard: true},
        },
      },
    };
    const render = (keyboardInset: number) => (
      <NavigationLayoutContext.Provider value={{...layout, keyboardInset}}>
        <HoystBottomTabBar {...keyboardProps} />
      </NavigationLayoutContext.Provider>
    );
    let tree!: renderer.ReactTestRenderer;
    act(() => {
      tree = renderer.create(render(0));
    });
    expect(
      tree.root.findAllByProps({testID: 'hoyst-navigation-rail'}).length > 0,
    ).toBe(true);
    act(() => tree.update(render(300)));
    expect(
      tree.root.findAllByProps({testID: 'hoyst-navigation-rail'}),
    ).toHaveLength(0);
    act(() => tree.update(render(0)));
    expect(
      tree.root.findAllByProps({testID: 'hoyst-navigation-rail'}).length > 0,
    ).toBe(true);
    act(() => tree.unmount());
  });

  it('restores bottom navigation after folding even if JS keyboard visibility is stale', () => {
    let tree!: renderer.ReactTestRenderer;
    act(() => {
      tree = renderer.create(
        <NavigationLayoutContext.Provider
          value={{mode: 'bottom', contentInsets: safe, keyboardInset: 0}}>
          <HoystBottomTabBar {...props} />
        </NavigationLayoutContext.Provider>,
      );
    });
    expect(
      tree.root.findByProps({testID: 'bottom-bar'}).props.descriptors.Explore
        .options.tabBarHideOnKeyboard,
    ).toBe(false);
    act(() => tree.unmount());
  });

  it('preserves screen state and scroll content while navigation moves between edges and bottom', () => {
    let mounts = 0;
    function Screen() {
      const [draft, setDraft] = React.useState('');
      const insets = useTabContentInsets();
      React.useEffect(() => {
        mounts += 1;
      }, []);
      return (
        <TextInput
          value={draft}
          onChangeText={setDraft}
          style={{paddingRight: insets.right}}
        />
      );
    }
    function Host({geometry}: {geometry: NavigationGeometry | null}) {
      return (
        <NavigationLayoutContext.Provider
          value={getNavigationLayout(geometry, safe)}>
          <Screen />
          <HoystBottomTabBar {...props} />
        </NavigationLayoutContext.Provider>
      );
    }
    let tree!: renderer.ReactTestRenderer;
    act(() => {
      tree = renderer.create(<Host geometry={null} />);
    });
    act(() =>
      tree.root.findByType(TextInput).props.onChangeText('Keep my draft'),
    );
    for (const geometry of [
      base,
      {...base, edge: 'leading' as const},
      null,
      base,
    ]) {
      act(() => tree.update(<Host geometry={geometry} />));
      expect(tree.root.findByType(TextInput).props.value).toBe('Keep my draft');
      expect(
        tree.root.findAllByProps({testID: 'hoyst-navigation-rail'}).length > 0,
      ).toBe(Boolean(geometry));
    }
    expect(mounts).toBe(1);
    expect(
      StyleSheet.flatten(tree.root.findByType(TextInput).props.style)
        .paddingRight,
    ).toBe(74);
    act(() => tree.unmount());
  });

  it('keeps destination labels and the unlabeled Tap In mark, selection, reselect and long-press events', () => {
    let tree!: renderer.ReactTestRenderer;
    act(() => {
      tree = renderer.create(
        <NavigationLayoutContext.Provider
          value={getNavigationLayout(base, safe)}>
          <HoystBottomTabBar {...props} />
        </NavigationLayoutContext.Provider>,
      );
    });
    expect(
      tree.root.findAllByType(Text).map(node => node.props.children),
    ).toEqual(['Home', 'Explore', 'Progress', 'Profile']);
    const buttons = tree.root.findAllByType(Pressable);
    expect(buttons[1].props.accessibilityState.selected).toBe(true);
    act(() => buttons[1].props.onPress());
    expect(emit).toHaveBeenCalledWith({
      type: 'tabPress',
      target: 'Explore',
      canPreventDefault: true,
    });
    expect(dispatch).not.toHaveBeenCalled();
    act(() => buttons[0].props.onLongPress());
    expect(emit).toHaveBeenCalledWith({type: 'tabLongPress', target: 'Home'});
    act(() => buttons[0].props.onPress());
    expect(dispatch).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'NAVIGATE',
        target: 'tabs',
        payload: expect.objectContaining({name: 'Home'}),
      }),
    );
    act(() => tree.unmount());
  });

  it('honors prevented Tap In events so the existing authentication/modal listener owns the action', () => {
    emit.mockReturnValueOnce({defaultPrevented: true});
    let tree!: renderer.ReactTestRenderer;
    act(() => {
      tree = renderer.create(
        <NavigationLayoutContext.Provider
          value={getNavigationLayout(base, safe)}>
          <HoystBottomTabBar {...props} />
        </NavigationLayoutContext.Provider>,
      );
    });
    const button = tree.root.findAllByType(Pressable)[2];
    expect(button.props.accessibilityRole).toBe('button');
    expect(button.props.accessibilityState.selected).toBe(false);
    act(() => button.props.onPress());
    expect(dispatch).not.toHaveBeenCalled();
    act(() => tree.unmount());
  });
});
