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

function getSvgPathPoints(path: string): Array<{x: number; y: number}> {
  const coordinates = path.match(/-?\d+(?:\.\d+)?/g)?.map(Number) ?? [];

  expect(coordinates.length % 2).toBe(0);

  return coordinates.reduce<Array<{x: number; y: number}>>(
    (points, coordinate, index) =>
      index % 2 === 0
        ? points.concat({x: coordinate, y: coordinates[index + 1]})
        : points,
    [],
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

  it('renders the Explore icon as a search and compass mark', () => {
    const tree = renderIcon(ExploreTabIcon);
    const rings = tree.root.findAllByType(Circle);
    const paths = tree.root.findAllByType(Path);

    expect(rings).toHaveLength(1);
    expect(paths).toHaveLength(2);
    expect(rings[0].props.fill).toBe('none');
    expect(rings[0].props.stroke).toBe('#111827');
    expect(paths.map(path => path.props.stroke)).toEqual([
      '#6C748C',
      '#6C748C',
    ]);

    const compassPoints = getSvgPathPoints(paths[1].props.d);
    const compassCenter = compassPoints.reduce(
      (center, point) => ({
        x: center.x + point.x / compassPoints.length,
        y: center.y + point.y / compassPoints.length,
      }),
      {x: 0, y: 0},
    );

    expect(compassCenter.x).toBeCloseTo(rings[0].props.cx);
    expect(compassCenter.y).toBeCloseTo(rings[0].props.cy);
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
