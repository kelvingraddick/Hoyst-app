import React from 'react';
import renderer, {act} from 'react-test-renderer';
import {Circle} from 'react-native-svg';

import {GradientRing} from '../src/design/components/GradientRing';

describe('GradientRing', () => {
  it('renders an empty track at 0% progress', () => {
    let tree: renderer.ReactTestRenderer | undefined;

    act(() => {
      tree = renderer.create(<GradientRing progress={0} />);
    });

    expect(tree!.root.findAllByType(Circle)).toHaveLength(1);
  });

  it('clamps progress above 100%', () => {
    let tree: renderer.ReactTestRenderer | undefined;

    act(() => {
      tree = renderer.create(<GradientRing progress={1.5} />);
    });

    const circles = tree!.root.findAllByType(Circle);

    expect(circles).toHaveLength(2);
    expect(circles[1].props.strokeDashoffset).toBe(0);
  });
});
