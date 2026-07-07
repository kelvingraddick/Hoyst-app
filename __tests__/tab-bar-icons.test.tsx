import React from 'react';
import Svg, {Circle, Path} from 'react-native-svg';
import renderer, {act} from 'react-test-renderer';

import {
  ExploreTabIcon,
  HomeTabIcon,
  MomentumTabIcon,
  ProfileTabIcon,
  type TabBarIconProps,
} from '../src/design/components/TabBarIcons';
import {brandColors} from '../src/design/tokens/colors';

const icons: Array<{
  Component: (props: TabBarIconProps) => React.JSX.Element;
  name: string;
}> = [
  {Component: HomeTabIcon, name: 'Home'},
  {Component: ExploreTabIcon, name: 'Explore'},
  {Component: MomentumTabIcon, name: 'Momentum'},
  {Component: ProfileTabIcon, name: 'Profile'},
];

function renderIcon(
  Component: (props: TabBarIconProps) => React.JSX.Element,
  props: TabBarIconProps = {},
) {
  let tree: renderer.ReactTestRenderer | undefined;

  act(() => {
    tree = renderer.create(
      <Component
        color="#111827"
        secondaryColor="#6C748C"
        size={28}
        strokeWidth={1.9}
        {...props}
      />,
    );
  });

  return tree!;
}

function getStrokeColors(tree: renderer.ReactTestRenderer) {
  return tree.root
    .findAll(node => typeof node.props.stroke === 'string')
    .map(node => node.props.stroke);
}

function getVisibleGlyphColors(tree: renderer.ReactTestRenderer) {
  return tree.root
    .findAllByType(Path)
    .concat(tree.root.findAllByType(Circle))
    .flatMap(node => [node.props.fill, node.props.stroke])
    .filter(
      color =>
        typeof color === 'string' &&
        color !== 'none' &&
        color !== 'transparent',
    );
}

describe('TabBarIcons', () => {
  it('renders every tab icon at the same visible size', () => {
    icons.forEach(({Component}) => {
      const tree = renderIcon(Component);
      const svg = tree.root.findByType(Svg);

      expect(svg.props.height).toBe(28);
      expect(svg.props.width).toBe(28);
      expect(svg.props.viewBox).toBe('0 0 28 28');
    });
  });

  it('uses the primary stroke color for inactive icons', () => {
    icons.forEach(({Component}) => {
      const tree = renderIcon(Component);
      const strokes = getStrokeColors(tree);

      expect(strokes).toContain('#111827');
    });
  });

  it('renders the Explore icon as a telescope mark', () => {
    const tree = renderIcon(ExploreTabIcon);
    const rings = tree.root.findAllByType(Circle);
    const paths = tree.root.findAllByType(Path);

    expect(rings).toHaveLength(1);
    expect(paths).toHaveLength(6);
    expect(rings[0].props).toEqual(
      expect.objectContaining({
        cx: 14,
        cy: 15.167,
        fill: 'none',
        r: 2.333,
        stroke: '#111827',
        strokeWidth: 1.9,
      }),
    );
    expect(paths.map(path => path.props.d)).toEqual([
      'm11.743 14.575-7.21 1.538a1.09 1.09 0 0 1-1.293-.819l-.627-2.508a1.248 1.248 0 0 1 .806-1.476l15.755-5.18',
      'm15.82 13.705 5.054-1.078',
      'm18.667 24.5-3.623-7.245',
      'M19.233 6.93a2.333 2.333 0 0 1 1.697-2.829l1.272-.317a1.167 1.167 0 0 1 1.414.848l1.768 7.07a1.167 1.167 0 0 1-.848 1.415l-1.272.317a2.333 2.333 0 0 1-2.829-1.697z',
      'm7.184 10.072 1.3 5.199',
      'm9.333 24.5 3.623-7.245',
    ]);
    paths.forEach(path => {
      expect(path.props.fill).toBe('none');
      expect(path.props.stroke).toBe('#111827');
      expect(path.props.strokeLinecap).toBe('round');
      expect(path.props.strokeLinejoin).toBe('round');
      expect(path.props.strokeWidth).toBe(1.9);
    });
  });

  it('can render inactive icons in one gray color', () => {
    icons.forEach(({Component}) => {
      const tree = renderIcon(Component, {
        color: brandColors.graySoft,
        secondaryColor: brandColors.graySoft,
      });

      expect(new Set(getVisibleGlyphColors(tree))).toEqual(
        new Set([brandColors.graySoft]),
      );
    });
  });

  it('uses Hoyst blue for every selected icon stroke', () => {
    icons.forEach(({Component}) => {
      const tree = renderIcon(Component, {
        color: brandColors.blue,
        focused: true,
        secondaryColor: '#6C748C',
        strokeWidth: 2.1,
      });
      const strokes = getStrokeColors(tree);

      expect(strokes.length).toBeGreaterThan(0);
      expect(new Set(strokes)).toEqual(new Set([brandColors.blue]));
    });
  });

  it('tints every selected glyph element (fill or stroke) with the active color', () => {
    icons.forEach(({Component}) => {
      const tree = renderIcon(Component, {
        color: brandColors.blue,
        focused: true,
      });
      const colors = getVisibleGlyphColors(tree);

      expect(colors.length).toBeGreaterThan(0);
      expect(new Set(colors)).toEqual(new Set([brandColors.blue]));
    });
  });

  it('keeps the selected Home icon line-based without fills', () => {
    const tree = renderIcon(HomeTabIcon, {
      color: brandColors.blue,
      focused: true,
    });
    const filledShapes = tree.root
      .findAllByType(Path)
      .concat(tree.root.findAllByType(Circle))
      .filter(node => node.props.fill && node.props.fill !== 'none');

    expect(filledShapes).toHaveLength(0);
  });
});
