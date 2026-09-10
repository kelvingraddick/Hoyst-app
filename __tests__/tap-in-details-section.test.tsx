import React from 'react';
import {Alert} from 'react-native';
import renderer, {act} from 'react-test-renderer';
import {
  DSButton,
  DSIconButton,
  DSInput,
  DesignSystemProvider,
} from '../src/design/system';
import {ComposerDisclosure} from '../src/features/check-in/components/TapInComposerPresentation';
import {TapInDetailsSection} from '../src/features/check-in/components/TapInDetailsSection';
const mockSubscribeToMemberCircleDetail = jest.fn();
const mockUpdateTapInDetails = jest.fn();
const mockUploadTapInPhoto = jest.fn();
const mockLaunchCamera = jest.fn();
const mockLaunchImageLibrary = jest.fn();
jest.mock('react-native-image-picker', () => ({
  launchCamera: (...args: unknown[]) => mockLaunchCamera(...args),
  launchImageLibrary: (...args: unknown[]) => mockLaunchImageLibrary(...args),
}));

jest.mock('../src/features/check-in/services/check-in-service', () => ({
  updateTapInDetails: (...args: unknown[]) => mockUpdateTapInDetails(...args),
  uploadTapInPhoto: (...args: unknown[]) => mockUploadTapInPhoto(...args),
}));

jest.mock('@react-native-community/blur', () => {
  const MockReact = require('react');
  const {View: MockView} = require('react-native');

  return {
    BlurView: ({children, ...props}: {children?: React.ReactNode}) =>
      MockReact.createElement(MockView, props, children),
  };
});

jest.mock('react-native-linear-gradient', () => {
  const MockReact = require('react');
  const {View: MockView} = require('react-native');

  return ({children, ...props}: {children?: React.ReactNode}) =>
    MockReact.createElement(MockView, props, children);
});

jest.mock('react-native-safe-area-context', () => {
  const MockReact = require('react');
  const {View: MockView} = require('react-native');

  return {
    SafeAreaView: ({children, ...props}: {children?: React.ReactNode}) =>
      MockReact.createElement(MockView, props, children),
  };
});

jest.mock('../src/store/settings-store', () => ({
  useSettingsStore: (selector: (state: {appearance: 'light'}) => unknown) =>
    selector({appearance: 'light'}),
}));

jest.mock('../src/store/session-store', () => ({
  useSessionStore: (
    selector: (state: {
      status: 'authenticatedReady';
      user: {providerIds: string[]; uid: string};
    }) => unknown,
  ) =>
    selector({
      status: 'authenticatedReady',
      user: {providerIds: [], uid: 'user-1'},
    }),
}));

jest.mock('../src/store/profile-store', () => ({
  useUserProfileStore: (
    selector: (state: {profile: {name: string; timezone: string}}) => unknown,
  ) => selector({profile: {name: 'Kelvin', timezone: 'UTC'}}),
}));

jest.mock('../src/features/home/services/home-data-service', () => ({
  subscribeToMemberCircleDetail: (options: unknown) =>
    mockSubscribeToMemberCircleDetail(options),
}));

function mount(
  props: Partial<React.ComponentProps<typeof TapInDetailsSection>> = {},
) {
  return renderer.create(
    <DesignSystemProvider scheme="dark">
      <TapInDetailsSection
        circleId="fixture"
        dateKey="2026-09-09"
        presentation="composer"
        {...props}
      />
    </DesignSystemProvider>,
  );
}
function button(tree: renderer.ReactTestRenderer, label: string) {
  return tree.root
    .findAllByType(DSButton)
    .find(item => item.props.label === label)!;
}
beforeEach(() => {
  jest.clearAllMocks();
  mockUploadTapInPhoto.mockResolvedValue('https://example.test/proof.jpg');
  mockUpdateTapInDetails.mockResolvedValue({note: 'A note'});
  jest.spyOn(Alert, 'alert').mockImplementation(() => {});
});
it('preserves disclosure, dirty tracking, note save and callbacks in composer mode', async () => {
  const dirty = jest.fn();
  const saved = jest.fn();
  let tree!: renderer.ReactTestRenderer;
  await act(async () => {
    tree = mount({onDirtyChange: dirty, onSaved: saved});
  });
  await act(async () => {
    tree.root.findByType(ComposerDisclosure).props.onPress();
  });
  await act(async () => {
    tree.root.findByType(DSInput).props.onChangeText('A note');
  });
  expect(dirty).toHaveBeenLastCalledWith(true);
  await act(async () => {
    button(tree, 'Save Details').props.onPress();
  });
  expect(mockUpdateTapInDetails).toHaveBeenCalledWith({
    circleId: 'fixture',
    note: 'A note',
    photoUrl: null,
  });
  expect(saved).toHaveBeenCalledWith({note: 'A note'});
  expect(dirty).toHaveBeenLastCalledWith(false);
  expect(tree.root.findAllByType(DSInput)).toHaveLength(0);
});
it('keeps failed selected proof retryable and does not duplicate an active save', async () => {
  mockUploadTapInPhoto.mockRejectedValueOnce(new Error('offline'));
  let tree!: renderer.ReactTestRenderer;
  await act(async () => {
    tree = mount({
      initialPhotoUrl: 'file:///proof.jpg',
      autoSaveInitialPhoto: true,
    });
  });
  expect(tree.root.findByType(ComposerDisclosure).props.title).toBe(
    'Retry photo upload',
  );
  let finish!: (uri: string) => void;
  mockUploadTapInPhoto.mockImplementationOnce(
    () =>
      new Promise(resolve => {
        finish = resolve;
      }),
  );
  await act(async () => {
    const retry = tree.root.findByType(ComposerDisclosure).props.onPress;
    retry();
    retry();
  });
  expect(mockUploadTapInPhoto).toHaveBeenCalledTimes(2);
  expect(tree.root.findByType(ComposerDisclosure).props.disabled).toBe(true);
  await act(async () => {
    finish('https://example.test/proof.jpg');
  });
  expect(mockUpdateTapInDetails).toHaveBeenCalledTimes(1);
});
it('selects, previews, and removes a photo without saving until requested', async () => {
  mockLaunchImageLibrary.mockResolvedValue({
    assets: [{uri: 'file:///selected.jpg'}],
  });
  let tree!: renderer.ReactTestRenderer;
  await act(async () => {
    tree = mount();
  });
  await act(async () => {
    tree.root.findByType(ComposerDisclosure).props.onPress();
  });
  await act(async () => {
    tree.root
      .findByProps({testID: 'tap-in-details-photo-picker'})
      .props.onPress();
  });
  const pickerActions = jest
    .mocked(Alert.alert)
    .mock.calls.find(([title]) => title === 'Add Photo')?.[2] as Array<{
    onPress?: () => void;
    text: string;
  }>;
  await act(async () => {
    pickerActions
      .find(action => action.text === 'Choose from Library')
      ?.onPress?.();
  });
  expect(
    tree.root.findAll(
      node => node.props.testID === 'tap-in-details-photo-preview',
    )[0].props.source.uri,
  ).toBe('file:///selected.jpg');
  await act(async () => {
    button(tree, 'Remove photo').props.onPress();
  });
  expect(
    tree.root.findAll(
      node => node.props.testID === 'tap-in-details-photo-preview',
    ),
  ).toHaveLength(0);
  expect(mockUpdateTapInDetails).not.toHaveBeenCalled();
});

it('keeps Save Details out of a clean composer editor and restores it when dirty', async () => {
  let tree!: renderer.ReactTestRenderer;
  await act(async () => {
    tree = mount();
  });
  await act(async () => {
    tree.root.findByType(ComposerDisclosure).props.onPress();
  });
  expect(
    tree.root
      .findAllByType(DSButton)
      .some(item => item.props.label === 'Save Details'),
  ).toBe(false);
  await act(async () => {
    tree.root.findByType(DSInput).props.onChangeText('A note');
  });
  const save = button(tree, 'Save Details');
  expect(save.props.category).toBe('neutral');
  expect(save.props.variant).toBe('primary');
});

it('reports only user-driven composer editor expansion changes', async () => {
  const onExpansionChange = jest.fn();
  let tree!: renderer.ReactTestRenderer;
  await act(async () => {
    tree = mount({onExpansionChange});
  });
  expect(onExpansionChange).not.toHaveBeenCalled();

  await act(async () => {
    tree.root.findByType(ComposerDisclosure).props.onPress();
  });
  expect(onExpansionChange).toHaveBeenLastCalledWith(true);

  await act(async () => {
    tree.root
      .findAllByType(DSIconButton)
      .find(item => item.props.label === 'Close details editor')
      ?.props.onPress();
  });
  expect(onExpansionChange).toHaveBeenLastCalledWith(false);
});
