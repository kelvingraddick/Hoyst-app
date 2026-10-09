import React from 'react';
import {Modal, Pressable} from 'react-native';
import renderer, {act} from 'react-test-renderer';
import {CommitmentAppearanceControl} from '../src/design/components/CommitmentAppearanceControl';
jest.mock('../src/store/settings-store', () => ({
  useSettingsStore: (selector: (state: {appearance: string}) => unknown) =>
    selector({appearance: 'light'}),
}));

test('sheet stages independently, Cancel discards, Done applies and Reset clears overrides', () => {
  const change = jest.fn();
  let tree!: renderer.ReactTestRenderer;
  act(() => {
    tree = renderer.create(
      <CommitmentAppearanceControl
        category="Work"
        appearance={{emoji: '🌱', palette: 'pink'}}
        onChange={change}
      />,
    );
  });
  const press = (label: string) =>
    act(() => {
      tree.root
        .findAllByType(Pressable)
        .find(node => node.props.accessibilityLabel === label)!
        .props.onPress();
    });
  press('Customize');
  press('Red');
  expect(change).not.toHaveBeenCalled();
  press('Cancel');
  expect(tree.root.findByType(Modal).props.visible).toBe(false);
  press('Customize');
  press('Done');
  expect(change).toHaveBeenLastCalledWith({emoji: '🌱', palette: 'pink'});
  press('Customize');
  press('Reset to default');
  press('Done');
  expect(change).toHaveBeenLastCalledWith({});
});
