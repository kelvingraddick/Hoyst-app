import React from 'react';
import {Image, StyleSheet} from 'react-native';
import renderer, {act} from 'react-test-renderer';

import {
  CommitmentTypeIcon,
  CommitmentTypePill,
} from '../src/design/components/CommitmentTypeVisual';
import type {CommitmentType} from '../src/types/models';

jest.mock('../src/store/settings-store', () => ({
  useSettingsStore: (selector: (state: {appearance: 'light'}) => unknown) =>
    selector({appearance: 'light'}),
}));

const expectations: Array<{
  backgroundColor: string;
  commitmentType: CommitmentType;
  label: string;
}> = [
  {
    backgroundColor: 'rgba(16,185,103,0.16)',
    commitmentType: 'build',
    label: 'BUILD',
  },
  {
    backgroundColor: 'rgba(255,109,0,0.16)',
    commitmentType: 'limit',
    label: 'LIMIT',
  },
  {
    backgroundColor: 'rgba(255,59,48,0.16)',
    commitmentType: 'avoid',
    label: 'AVOID',
  },
];

describe('commitment type visuals', () => {
  it.each(expectations)(
    'renders the $commitmentType artwork in its matching circle',
    ({backgroundColor, commitmentType, label}) => {
      let tree: renderer.ReactTestRenderer | undefined;

      act(() => {
        tree = renderer.create(
          <CommitmentTypePill
            commitmentType={commitmentType}
            density="compact"
            uppercase
          />,
        );
      });

      const pill = tree!.root.findByProps({
        testID: `commitment-type-pill-${commitmentType}`,
      });
      const icon = tree!.root.findByProps({
        testID: `commitment-type-icon-${commitmentType}`,
      });

      expect(pill.props.accessibilityLabel).toBe(
        `${label[0]}${label.slice(1).toLowerCase()} commitment type`,
      );
      expect(StyleSheet.flatten(pill.props.style).backgroundColor).toBe(
        backgroundColor,
      );
      expect(StyleSheet.flatten(icon.props.style)).toEqual(
        expect.objectContaining({
          backgroundColor,
          borderRadius: 9,
          height: 18,
          width: 18,
        }),
      );
      expect(tree!.root.findAllByType(Image)).toHaveLength(1);
      expect(JSON.stringify(tree!.toJSON())).toContain(label);
    },
  );

  it('renders a larger accessible selection-card icon', () => {
    let tree: renderer.ReactTestRenderer | undefined;

    act(() => {
      tree = renderer.create(
        <CommitmentTypeIcon commitmentType="build" size={42} />,
      );
    });

    const icon = tree!.root.findByProps({testID: 'commitment-type-icon-build'});

    expect(icon.props.accessibilityLabel).toBe('Build commitment type');
    expect(icon.props.accessibilityRole).toBe('image');
    expect(StyleSheet.flatten(icon.props.style)).toEqual(
      expect.objectContaining({borderRadius: 21, height: 42, width: 42}),
    );
  });
});
