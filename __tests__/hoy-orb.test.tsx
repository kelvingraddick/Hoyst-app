import React from 'react';
import {StyleSheet} from 'react-native';
import renderer, {act} from 'react-test-renderer';

import {
  getHoyAssetSource,
  HoyOrb,
} from '../src/design/components/HoyOrb';
import type {HoyState} from '../src/features/home/services/hoy-state';

const allStates: readonly HoyState[] = [
  'locked',
  'thinking',
  'celebrating',
  'risk_attention',
  'tap_in_needed',
  'goal_completed',
  'streak_active',
  'default',
];

function renderOrb(state: HoyState, animated = true) {
  let tree: renderer.ReactTestRenderer | undefined;

  act(() => {
    tree = renderer.create(
      <HoyOrb
        animated={animated}
        celebrationKey={1}
        size={52}
        state={state}
        testID="test-hoy"
      />,
    );
  });

  return tree!;
}

describe('HoyOrb', () => {
  it.each(allStates)('selects the %s asset', state => {
    const tree = renderOrb(state);
    const image = tree.root.findByProps({
      testID: `test-hoy-${state}-image`,
    });

    expect(image.props.source).toBe(getHoyAssetSource(state));
  });

  it.each([
    'locked',
    'risk_attention',
    'tap_in_needed',
    'goal_completed',
  ] as const)('renders the documented glyph for %s', state => {
    const tree = renderOrb(state);

    expect(
      tree.root.findAllByProps({testID: 'test-hoy-glyph'}).length,
    ).toBeGreaterThan(0);
  });

  it.each([
    'thinking',
    'celebrating',
    'streak_active',
    'default',
  ] as const)('does not badge the %s expression', state => {
    const tree = renderOrb(state);

    expect(tree.root.findAllByProps({testID: 'test-hoy-glyph'})).toHaveLength(
      0,
    );
  });

  it('uses temporary confetti only while celebrating', () => {
    const celebrating = renderOrb('celebrating');
    const defaultOrb = renderOrb('default');

    expect(
      celebrating.root.findAllByProps({testID: 'test-hoy-confetti'}),
    ).not.toHaveLength(0);
    expect(
      defaultOrb.root.findAllByProps({testID: 'test-hoy-confetti'}),
    ).toHaveLength(0);
  });

  it('renders a static composition in the test and reduced-motion path', () => {
    const tree = renderOrb('default');
    const animatedSurfaceStyle = StyleSheet.flatten(
      tree.root.findByProps({testID: 'test-hoy-animated-surface'}).props.style,
    );
    const celebrating = renderOrb('celebrating');
    const confettiStyle = StyleSheet.flatten(
      celebrating.root.findByProps({testID: 'test-hoy-confetti'}).props.style,
    );

    expect(animatedSurfaceStyle.transform).toBeUndefined();
    expect(confettiStyle.opacity).toBe(1);
    expect(confettiStyle.transform).toBeUndefined();
  });
});
