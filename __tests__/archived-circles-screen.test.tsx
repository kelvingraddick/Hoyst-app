import React from 'react';
import renderer, {act} from 'react-test-renderer';

import {ArchivedCirclesScreen} from '../src/features/circles/screens/ArchivedCirclesScreen';

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

jest.mock('../src/store/session-store', () => ({
  useSessionStore: (selector: (state: {user: {uid: string}}) => unknown) =>
    selector({user: {uid: 'user-1'}}),
}));

jest.mock('../src/features/circles/services/archived-circle-service', () => ({
  subscribeToArchivedCircles: jest.fn(({onCircles}) => {
    onCircles([
      {
        archivedAt: new Date('2026-08-04T12:00:00Z'),
        category: 'Learning',
        circleMode: 'personal',
        commitment: 'Read 20 pages',
        id: 'personal-1',
        lifecycleStatus: 'archived',
        memberCount: 1,
        title: 'Read 20 pages',
        viewerRole: 'owner',
      },
      {
        archivedAt: new Date('2026-08-03T12:00:00Z'),
        category: 'Fitness',
        circleMode: 'group',
        commitment: 'Move for 30 minutes',
        id: 'circle-1',
        lifecycleStatus: 'archived',
        memberCount: 4,
        title: 'Morning Movers',
        viewerRole: 'member',
      },
    ]);
    return jest.fn();
  }),
}));

jest.mock('../src/features/circles/services/circle-service', () => ({
  unarchiveCircle: jest.fn(),
}));

describe('ArchivedCirclesScreen', () => {
  it('shows owner restore controls and member read-only entries', () => {
    const navigation = {goBack: jest.fn(), navigate: jest.fn()};
    let tree: renderer.ReactTestRenderer | undefined;

    act(() => {
      tree = renderer.create(
        <ArchivedCirclesScreen navigation={navigation as never} route={{} as never} />,
      );
    });

    const output = JSON.stringify(tree!.toJSON());

    expect(output).toContain('Archived commitments & circles');
    expect(output).toContain('Personal Commitments');
    expect(output).toContain('Circles');
    expect(output).toContain('Read 20 pages');
    expect(output).toContain('Unarchive Commitment');
    expect(output).toContain('Morning Movers');
    expect(output).toContain('4 members');
    expect(output).not.toContain('Unarchive Circle');

    act(() => {
      tree!.root
        .findByProps({accessibilityLabel: 'Open archived Circle Morning Movers'})
        .props.onPress();
    });
    expect(navigation.navigate).toHaveBeenCalledWith('CircleDetail', {
      circleId: 'circle-1',
    });
  });
});
