import React from 'react';
import renderer, {act} from 'react-test-renderer';
import {Alert} from 'react-native';

import {HoystButton} from '../src/design/components/HoystButton';
import {HoystInput} from '../src/design/components/HoystInput';
import {CreateCircleScreen} from '../src/features/create-circle/screens/CreateCircleScreen';

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

jest.mock('../src/store/profile-store', () => ({
  useUserProfileStore: (
    selector: (state: {profile: {timezone: string}}) => unknown,
  ) => selector({profile: {timezone: 'UTC'}}),
}));

jest.mock('../src/features/circles/services/circle-service', () => ({
  createCircle: jest.fn(),
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
      <CreateCircleScreen
        navigation={navigation as never}
        route={{} as never}
      />,
    );
  });

  return {beforeRemove: () => beforeRemove, navigation, tree: tree!};
}

function findButton(tree: renderer.ReactTestRenderer, label: string) {
  const button = tree.root
    .findAllByType(HoystButton)
    .find(candidate => candidate.props.label === label);

  if (!button) {
    throw new Error(`${label} button not found`);
  }

  return button;
}

function pressContinue(tree: renderer.ReactTestRenderer) {
  act(() => {
    findButton(tree, 'Continue').props.onPress();
  });
}

function selectOption(tree: renderer.ReactTestRenderer, id: string) {
  const option = tree.root.find(
    node => node.props.option?.id === id && typeof node.props.onPress === 'function',
  );
  act(() => option.props.onPress());
}

describe('CreateCircleScreen unified flow', () => {
  it('defines the Commitment before showing the default group choice', () => {
    const {tree} = renderScreen();
    let output = JSON.stringify(tree.toJSON());

    expect(output).toContain('What is your Commitment?');
    expect(output).not.toContain('Create a circle');
    expect(output).not.toContain('Personal commitment');

    const commitmentInput = tree.root.findByType(HoystInput);
    act(() => {
      commitmentInput.props.onChangeText('Read 20 pages');
    });
    pressContinue(tree);
    output = JSON.stringify(tree.toJSON());

    expect(output).toContain('How do you want to commit?');
    expect(output).toContain('Create a circle');
    expect(output).toContain('Personal commitment');
  });

  it('uses the shorter Personal path with exact mode-aware copy', () => {
    const {tree} = renderScreen();

    act(() => {
      tree.root
        .findByType(HoystInput)
        .props.onChangeText('Read 20 pages');
    });
    pressContinue(tree);
    selectOption(tree, 'personal');

    expect(JSON.stringify(tree.toJSON())).toContain('Step 2 of 7');
    pressContinue(tree);
    expect(JSON.stringify(tree.toJSON())).toContain(
      'What kind of Commitment is this?',
    );

    pressContinue(tree);
    let output = JSON.stringify(tree.toJSON());
    expect(output).toContain('Set the Commitment rules');
    expect(output).toContain('You Tap In');
    expect(output).not.toContain('Each member taps in');

    pressContinue(tree);
    output = JSON.stringify(tree.toJSON());
    expect(output).toContain('your Progression');
    expect(output).not.toContain('Circle Progression');

    pressContinue(tree);
    output = JSON.stringify(tree.toJSON());
    expect(output).toContain('this Commitment');

    pressContinue(tree);
    output = JSON.stringify(tree.toJSON());
    expect(output).toContain('Review your setup');
    expect(output).toContain('Personal commitment');
    expect(output).not.toContain('members');
    expect(findButton(tree, 'Create Personal Commitment')).toBeTruthy();
  });

  it('covers every group step and formats the final review for people', () => {
    const {tree} = renderScreen();
    const expectStep = (copy: string) =>
      expect(JSON.stringify(tree.toJSON())).toContain(copy);

    act(() => {
      tree.root
        .findByType(HoystInput)
        .props.onChangeText('Read 20 pages');
    });
    pressContinue(tree);
    expectStep('How do you want to commit?');
    pressContinue(tree);
    expectStep('What kind of Circle is this?');
    pressContinue(tree);
    expectStep('What should this circle be called?');
    act(() => {
      tree.root.findByType(HoystInput).props.onChangeText('Readers Together');
    });
    pressContinue(tree);
    expectStep('Set the Commitment rules');
    pressContinue(tree);
    expectStep('Set the skip allowance');
    pressContinue(tree);
    expectStep('Who can find and join it?');
    pressContinue(tree);
    expectStep('How many members can join?');
    pressContinue(tree);
    expectStep('Choose the Circle timezone');
    pressContinue(tree);

    const output = JSON.stringify(tree.toJSON());
    expect(output).toContain('Review your setup');
    expect(output).toContain('Public · Request approval');
    expect(output).toContain('2 skips every 7 days');
    expect(output).toContain('UTC');
    expect(findButton(tree, 'Create Circle')).toBeTruthy();
  });

  it('preserves the Circle name while modes are toggled', () => {
    const {tree} = renderScreen();

    act(() => {
      tree.root
        .findByType(HoystInput)
        .props.onChangeText('Read 20 pages');
    });
    pressContinue(tree);
    pressContinue(tree);
    pressContinue(tree);

    act(() => {
      tree.root.findByType(HoystInput).props.onChangeText('Readers Together');
    });

    const goBack = () =>
      act(() =>
        tree.root.findByProps({accessibilityLabel: 'Go back'}).props.onPress(),
      );
    goBack();
    goBack();
    selectOption(tree, 'personal');
    selectOption(tree, 'group');
    pressContinue(tree);
    pressContinue(tree);

    expect(tree.root.findByType(HoystInput).props.value).toBe(
      'Readers Together',
    );
  });

  it('warns before a dirty setup is discarded but not an untouched setup', () => {
    const alertSpy = jest.spyOn(Alert, 'alert').mockImplementation(jest.fn());
    const untouched = renderScreen();
    const untouchedEvent = {
      data: {action: {type: 'GO_BACK'}},
      preventDefault: jest.fn(),
    };

    act(() => untouched.beforeRemove()?.(untouchedEvent));
    expect(untouchedEvent.preventDefault).not.toHaveBeenCalled();

    const dirty = renderScreen();
    act(() => {
      dirty.tree.root
        .findByType(HoystInput)
        .props.onChangeText('Read 20 pages');
    });
    const dirtyEvent = {
      data: {action: {type: 'GO_BACK'}},
      preventDefault: jest.fn(),
    };
    act(() => dirty.beforeRemove()?.(dirtyEvent));

    expect(dirtyEvent.preventDefault).toHaveBeenCalled();
    expect(alertSpy).toHaveBeenCalledWith(
      'Discard setup?',
      'Your Commitment setup will be lost.',
      expect.arrayContaining([
        expect.objectContaining({text: 'Keep editing'}),
        expect.objectContaining({text: 'Discard'}),
      ]),
    );
    alertSpy.mockRestore();
  });
});
