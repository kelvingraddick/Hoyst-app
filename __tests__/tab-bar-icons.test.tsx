import React from 'react';
import Svg, {Circle, Path} from 'react-native-svg';
import renderer, {act} from 'react-test-renderer';

import {
  CirclesTabIcon,
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
  {Component: CirclesTabIcon, name: 'Circles'},
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

  it('uses primary and secondary strokes for inactive icons', () => {
    icons.forEach(({Component}) => {
      const tree = renderIcon(Component);
      const strokes = getStrokeColors(tree);

      expect(strokes).toContain('#111827');
      expect(strokes).toContain('#6C748C');
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

  it('keeps the new icons line-based without selected fills', () => {
    icons.forEach(({Component}) => {
      const tree = renderIcon(Component, {
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
});
