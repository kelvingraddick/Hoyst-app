import React from 'react';
import {Modal, Pressable} from 'react-native';
import renderer, {act} from 'react-test-renderer';
import {AcquisitionQuestion} from '../src/features/beta/components/AcquisitionQuestion';

const mockAnswer = jest.fn();
let mockPending = 'new-user';
jest.mock('../src/store/session-store', () => ({
  useSessionStore: (select: any) => select({user: {uid: 'new-user'}}),
}));
jest.mock('../src/store/settings-store', () => ({
  useSettingsStore: (select: any) => select({appearance: 'dark'}),
}));
jest.mock('../src/features/beta/services/acquisition-store', () => ({
  useAcquisitionStore: (select: any) =>
    select({hydrated: true, pendingUid: mockPending, answer: mockAnswer}),
}));
jest.mock('react-native-safe-area-context', () => ({
  SafeAreaView: require('react-native').View,
}));

test('mounts without an outer design provider and allows skipping only the current account prompt', () => {
  let tree!: renderer.ReactTestRenderer;
  act(() => {
    tree = renderer.create(<AcquisitionQuestion canShow={false} />);
  });
  expect(tree.root.findByType(Modal).props.visible).toBe(false);
  act(() => {
    tree.update(<AcquisitionQuestion canShow />);
  });
  expect(tree.root.findByType(Modal).props.visible).toBe(true);
  const skip = tree.root
    .findAllByType(Pressable)
    .find(node => node.props.testID === 'beta-source-skip');
  act(() => skip!.props.onPress());
  expect(mockAnswer).toHaveBeenCalledWith('new-user');
  mockPending = 'different-user';
  act(() => {
    tree.update(<AcquisitionQuestion canShow />);
  });
  expect(tree.root.findByType(Modal).props.visible).toBe(false);
  act(() => tree.unmount());
});
