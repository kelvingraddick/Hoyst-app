import React from 'react';
import renderer, {act} from 'react-test-renderer';
import {UsersRound} from 'lucide-react-native';

import {CircleCardTapInButton} from '../src/design/components/CircleCardTapInButton';
import {OpportunityCard} from '../src/design/components/OpportunityCard';
import type {CircleManagementCard} from '../src/types/models';

jest.mock('@react-native-community/blur', () => ({
  BlurView: ({children, ...props}: {children?: React.ReactNode}) => {
    const MockReact = require('react');
    const {View} = require('react-native');

    return MockReact.createElement(View, props, children);
  },
}));

jest.mock('react-native-linear-gradient', () => {
  const MockReact = require('react');
  const {View} = require('react-native');

  return ({children, ...props}: {children?: React.ReactNode}) =>
    MockReact.createElement(View, props, children);
});

jest.mock('react-native-haptic-feedback', () => ({
  trigger: jest.fn(),
}));

jest.mock('../src/store/settings-store', () => ({
  useSettingsStore: (selector: (state: {appearance: 'light'}) => unknown) =>
    selector({appearance: 'light'}),
}));

function circle(
  overrides: Partial<CircleManagementCard>,
): CircleManagementCard {
  return {
    category: 'Deep Work',
    commitment: 'Focus for 45 minutes',
    commitmentCadence: 'daily',
    commitmentFrequency: {tapInsPerWeek: 7},
    completionRate: 72,
    id: 'circle-1',
    inviteUrl: 'https://example.com/invite',
    joinMode: 'open',
    maxSize: 8,
    memberCount: 3,
    members: [],
    privacy: 'public',
    progressPercent: 72,
    remainingCheckIns: 0,
    state: 'active',
    streakDays: 4,
    streakLabel: 'Already tapped in',
    title: 'Deep Work Crew',
    viewerHasCheckedIn: true,
    viewerMembershipStatus: 'active',
    viewerRole: 'member',
    viewerTodayStatus: 'done',
    ...overrides,
  };
}

describe('OpportunityCard', () => {
  it('uses category color for the companion icon', () => {
    let tree: renderer.ReactTestRenderer | undefined;

    act(() => {
      tree = renderer.create(<OpportunityCard card={circle({})} />);
    });

    const companionIcon = tree!.root.findByType(UsersRound);

    expect(companionIcon.props.color).toBe('#086CA8');
  });

  it('passes active pulse state and preserves the Tap In handler', () => {
    const onTapInPress = jest.fn();
    const stopPropagation = jest.fn();
    let tree: renderer.ReactTestRenderer | undefined;

    act(() => {
      tree = renderer.create(
        <OpportunityCard
          card={circle({
            remainingCheckIns: 2,
            viewerHasCheckedIn: false,
            viewerHasTappedInToday: false,
            viewerTodayStatus: 'rest',
          })}
          onTapInPress={onTapInPress}
        />,
      );
    });

    const button = tree!.root.findByType(CircleCardTapInButton);

    expect(button.props.ringState).toBe('active');

    act(() => {
      button.props.onPress({stopPropagation});
    });

    expect(stopPropagation).toHaveBeenCalled();
    expect(onTapInPress).toHaveBeenCalled();
  });
});
