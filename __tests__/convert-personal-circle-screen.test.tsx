import React from 'react';
import renderer, {act} from 'react-test-renderer';
import {Alert} from 'react-native';

import {HoystButton} from '../src/design/components/HoystButton';
import {HoystInput} from '../src/design/components/HoystInput';
import {ConvertPersonalCircleScreen} from '../src/features/circles/screens/ConvertPersonalCircleScreen';

const mockConvertPersonalCircle = jest.fn();

jest.mock('@react-native-community/blur', () => {
  const MockReact = require('react');
  const {View} = require('react-native');

  return {
    BlurView: ({children, ...props}: {children?: React.ReactNode}) =>
      MockReact.createElement(View, props, children),
  };
});

jest.mock('react-native-linear-gradient', () => {
  const MockReact = require('react');
  const {View} = require('react-native');

  return ({children, ...props}: {children?: React.ReactNode}) =>
    MockReact.createElement(View, props, children);
});

jest.mock('react-native-safe-area-context', () => {
  const MockReact = require('react');
  const {View} = require('react-native');

  return {
    SafeAreaView: ({children, ...props}: {children?: React.ReactNode}) =>
      MockReact.createElement(View, props, children),
    useSafeAreaInsets: () => ({bottom: 0, left: 0, right: 0, top: 0}),
  };
});

jest.mock('../src/store/settings-store', () => ({
  useSettingsStore: (selector: (state: {appearance: 'light'}) => unknown) =>
    selector({appearance: 'light'}),
}));

jest.mock('../src/features/circles/services/circle-service', () => ({
  convertPersonalCircle: (...args: unknown[]) =>
    mockConvertPersonalCircle(...args),
}));

function renderScreen() {
  let beforeRemove:
    | ((event: {
        data: {action: {type: string}};
        preventDefault: jest.Mock;
      }) => void)
    | undefined;
  const navigation = {
    addListener: jest.fn((eventName, listener) => {
      if (eventName === 'beforeRemove') {
        beforeRemove = listener;
      }
      return jest.fn();
    }),
    dispatch: jest.fn(),
    goBack: jest.fn(),
    replace: jest.fn(),
  };
  let tree: renderer.ReactTestRenderer | undefined;

  act(() => {
    tree = renderer.create(
      <ConvertPersonalCircleScreen
        navigation={navigation as never}
        route={
          {
            key: 'ConvertPersonalCircle',
            name: 'ConvertPersonalCircle',
            params: {circleId: 'personal-1'},
          } as never
        }
      />,
    );
  });

  return {beforeRemove: () => beforeRemove, navigation, tree: tree!};
}

describe('ConvertPersonalCircleScreen', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockConvertPersonalCircle.mockResolvedValue({
      circleId: 'personal-1',
      inviteCode: 'invite-1',
      inviteUrl: 'https://hoyst.app/join/invite-1',
    });
  });

  it('discloses historical visibility and converts with the selected setup', async () => {
    const {tree} = renderScreen();
    const output = JSON.stringify(tree.toJSON());

    expect(output).toContain(
      'All prior Tap Ins, notes, photos, and progress will become visible to future members.',
    );
    expect(output).toContain('Circle name');
    expect(output).toContain('Access');
    expect(output).toContain('Capacity');

    act(() => {
      tree.root.findByType(HoystInput).props.onChangeText('Reading Circle');
    });
    const convertButton = tree.root
      .findAllByType(HoystButton)
      .find(
        button =>
          button.props.label === 'Convert to Circle and create invite',
      );

    if (!convertButton) {
      throw new Error('Convert button not found');
    }

    await act(async () => {
      convertButton.props.onPress();
      await Promise.resolve();
    });

    expect(mockConvertPersonalCircle).toHaveBeenCalledWith({
      circleId: 'personal-1',
      joinMode: 'request_to_join',
      maxSize: 10,
      privacy: 'public',
      title: 'Reading Circle',
    });
    expect(JSON.stringify(tree.toJSON())).toContain(
      'https://hoyst.app/join/invite-1',
    );
  });

  it('uses radio semantics and warns before discarding a dirty conversion', () => {
    const alertSpy = jest.spyOn(Alert, 'alert').mockImplementation(jest.fn());
    const {beforeRemove, tree} = renderScreen();
    const radios = tree.root.findAll(
      node => node.props.accessibilityRole === 'radio',
    );

    expect(radios.length).toBeGreaterThanOrEqual(5);
    expect(radios.some(node => node.props.accessibilityState.selected)).toBe(
      true,
    );

    act(() => {
      tree.root.findByType(HoystInput).props.onChangeText('Reading Circle');
    });
    const event = {
      data: {action: {type: 'GO_BACK'}},
      preventDefault: jest.fn(),
    };
    act(() => beforeRemove()?.(event));

    expect(event.preventDefault).toHaveBeenCalled();
    expect(alertSpy).toHaveBeenCalledWith(
      'Discard Circle setup?',
      'Your Personal commitment will stay unchanged.',
      expect.any(Array),
    );
    alertSpy.mockRestore();
  });

  it('allows an untouched exit and bypasses the warning after conversion', async () => {
    const {beforeRemove, tree} = renderScreen();
    const untouchedEvent = {
      data: {action: {type: 'GO_BACK'}},
      preventDefault: jest.fn(),
    };

    act(() => beforeRemove()?.(untouchedEvent));
    expect(untouchedEvent.preventDefault).not.toHaveBeenCalled();

    act(() => {
      tree.root.findByType(HoystInput).props.onChangeText('Reading Circle');
    });
    const convertButton = tree.root
      .findAllByType(HoystButton)
      .find(button => button.props.label === 'Convert to Circle and create invite');

    if (!convertButton) {
      throw new Error('Convert button not found');
    }

    await act(async () => {
      convertButton.props.onPress();
      await Promise.resolve();
    });

    const completedEvent = {
      data: {action: {type: 'GO_BACK'}},
      preventDefault: jest.fn(),
    };
    act(() => beforeRemove()?.(completedEvent));
    expect(completedEvent.preventDefault).not.toHaveBeenCalled();
  });

  it('returns to a retryable state after a conversion failure', async () => {
    const alertSpy = jest.spyOn(Alert, 'alert').mockImplementation(jest.fn());
    mockConvertPersonalCircle
      .mockRejectedValueOnce(new Error('Temporary conversion error'))
      .mockResolvedValueOnce({
        circleId: 'personal-1',
        inviteCode: 'invite-2',
        inviteUrl: 'https://hoyst.app/join/invite-2',
      });
    const {tree} = renderScreen();

    act(() => {
      tree.root.findByType(HoystInput).props.onChangeText('Reading Circle');
    });
    const findConvertButton = () =>
      tree.root
        .findAllByType(HoystButton)
        .find(button =>
          String(button.props.label).includes('Convert to Circle'),
        );

    await act(async () => {
      findConvertButton()?.props.onPress();
      await Promise.resolve();
    });
    expect(alertSpy).toHaveBeenCalledWith(
      'Conversion failed',
      'Temporary conversion error',
    );
    expect(findConvertButton()?.props.disabled).toBe(false);

    await act(async () => {
      findConvertButton()?.props.onPress();
      await Promise.resolve();
    });
    expect(mockConvertPersonalCircle).toHaveBeenCalledTimes(2);
    expect(JSON.stringify(tree.toJSON())).toContain(
      'https://hoyst.app/join/invite-2',
    );
    alertSpy.mockRestore();
  });
});
