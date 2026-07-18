import React from 'react';
import {Image} from 'react-native';
import renderer, {act} from 'react-test-renderer';

import {PastCircleScreen} from '../src/features/circles/screens/PastCircleScreen';

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
    selector({user: {uid: 'former-1'}}),
}));

jest.mock('../src/features/circles/services/past-circle-service', () => ({
  subscribeToPastCircleTapIns: jest.fn(({onTapIns}) => {
    onTapIns([
      {
        coverageStatus: 'covered',
        currentValue: 20,
        dateKey: '2026-06-30',
        id: 'former-1',
        note: 'Strong ending',
        photoUrl: 'https://example.com/tap-in.jpg',
        status: 'done',
        unitLabel: 'pages',
      },
      {
        coverageStatus: 'skipped',
        dateKey: '2026-06-29',
        id: 'former-1',
        status: 'skip',
      },
    ]);
    return jest.fn();
  }),
}));

describe('PastCircleScreen', () => {
  it('shows only the former member summary and retained Tap In history', () => {
    const navigation = {goBack: jest.fn()};
    let screen: renderer.ReactTestRenderer | undefined;

    act(() => {
      screen = renderer.create(
        <PastCircleScreen
          navigation={navigation as never}
          route={
            {
              params: {
                summary: {
                  category: 'Learning',
                  circleId: 'past-1',
                  circleMode: 'group',
                  commitment: 'Read 20 pages',
                  id: 'past-1',
                  joinedAt: new Date('2026-01-01T12:00:00Z'),
                  leftAt: new Date('2026-07-01T12:00:00Z'),
                  privacy: 'private',
                  title: 'Book Club',
                },
              },
            } as never
          }
        />,
      );
    });

    const output = JSON.stringify(screen!.toJSON());

    expect(output).toContain('Book Club');
    expect(output).toContain('Read 20 pages');
    expect(output).toContain('Learning');
    expect(output).toContain('Jan 1, 2026 to Jul 1, 2026');
    expect(output).toContain('Strong ending');
    expect(output).toContain('Skipped');
    expect(output).not.toContain('Members');
    expect(output).not.toContain('Invite');
    expect(output).not.toContain('Thread');
    expect(screen!.root.findAllByType(Image)).toHaveLength(1);

    act(() => {
      screen!.root.findByProps({accessibilityLabel: 'Go back'}).props.onPress();
    });
    expect(navigation.goBack).toHaveBeenCalled();
  });
});
