import React from 'react';
import {Image, StyleSheet} from 'react-native';
import renderer, {act} from 'react-test-renderer';
import {Path} from 'react-native-svg';

import {getBrandRing} from '../src/design/brand/usage';
import {PulseRing} from '../src/design/components/PulseRing';
import {
  getPulseRingStateForCircle,
  getPulseRingStateForCircles,
  type PulseRingState,
} from '../src/design/components/pulse-ring-state';
import {brandColors} from '../src/design/tokens/colors';
import type {CircleManagementCard} from '../src/types/models';

jest.mock('../src/store/settings-store', () => ({
  useSettingsStore: (selector: (state: {appearance: 'light'}) => unknown) =>
    selector({appearance: 'light'}),
}));

function circle(
  overrides: Partial<CircleManagementCard>,
): CircleManagementCard {
  return {
    category: 'Fitness',
    commitment: 'Move for 30 minutes',
    commitmentCadence: 'daily',
    commitmentFrequency: {tapInsPerWeek: 7},
    id: 'circle-1',
    inviteUrl: 'https://example.com/invite',
    joinMode: 'open',
    maxSize: 8,
    memberCount: 2,
    members: [],
    privacy: 'public',
    progressPercent: 42,
    remainingCheckIns: 1,
    state: 'active',
    streakDays: 4,
    streakLabel: 'Start today',
    title: 'Morning Movers',
    viewerHasCheckedIn: false,
    viewerHasTappedInToday: false,
    viewerMembershipStatus: 'active',
    viewerRole: 'member',
    viewerTodayStatus: 'rest',
    ...overrides,
  };
}

function flattenStyle(node: renderer.ReactTestInstance) {
  return StyleSheet.flatten(node.props.style);
}

describe('PulseRing', () => {
  it('renders the exact brand ring asset as the core ring', () => {
    let tree: renderer.ReactTestRenderer | undefined;

    act(() => {
      tree = renderer.create(<PulseRing animated={false} state="idle" />);
    });

    const baseDisk = tree!.root.findByProps({
      testID: 'pulse-ring-base',
    });
    const brandImage = tree!.root.findByProps({
      testID: 'pulse-ring-brand-image',
    });

    expect(flattenStyle(baseDisk)).toEqual(
      expect.objectContaining({
        backgroundColor: '#FFFFFF',
        borderColor: 'rgba(16, 24, 40, 0.06)',
        borderRadius: 36,
        borderWidth: 1,
        height: 72,
        shadowOffset: {height: 4, width: 0},
        shadowOpacity: 0.13,
        shadowRadius: 12,
        width: 72,
      }),
    );
    expect(brandImage.type).toBe(Image);
    expect(brandImage.props.source).toEqual(getBrandRing());
    expect(brandImage.props.resizeMode).toBe('contain');
    expect(StyleSheet.flatten(brandImage.props.style)).toEqual({
      height: 56,
      width: 56,
    });
    expect(
      tree!.root.findAll(node =>
        String(node.props.testID ?? '').startsWith('pulse-ring-spectrum-'),
      ),
    ).toHaveLength(0);
    expect(
      tree!.root.findAllByProps({testID: 'pulse-ring-center-fill'}),
    ).toHaveLength(0);
    expect(
      tree!.root.findAllByProps({testID: 'pulse-ring-center-tint'}),
    ).toHaveLength(0);
  });

  it('renders status colors only as subtle external glow', () => {
    const expectedStates: {
      glowColor: string;
      pulseColor: string;
      state: PulseRingState;
    }[] = [
      {
        glowColor: 'rgba(15, 23, 42, 0.08)',
        pulseColor: brandColors.graySoft,
        state: 'idle',
      },
      {
        glowColor: 'rgba(16, 185, 103, 0.18)',
        pulseColor: brandColors.spectrumGreen,
        state: 'active',
      },
      {
        glowColor: 'rgba(255, 109, 0, 0.2)',
        pulseColor: brandColors.orangeStrong,
        state: 'atRisk',
      },
      {
        glowColor: 'rgba(255, 30, 168, 0.18)',
        pulseColor: '#FF1EA8',
        state: 'streak',
      },
    ];

    expectedStates.forEach(({glowColor, pulseColor, state}) => {
      let tree: renderer.ReactTestRenderer | undefined;

      act(() => {
        tree = renderer.create(<PulseRing animated={false} state={state} />);
      });

      const statusGlow = tree!.root.findByProps({
        testID: 'pulse-ring-status-glow',
      });
      const ripple = tree!.root.findByProps({testID: 'pulse-ring-ripple'});

      expect(flattenStyle(statusGlow).backgroundColor).toBe(glowColor);
      expect(flattenStyle(ripple).borderColor).toBe(pulseColor);
      expect(
        tree!.root.findAllByProps({testID: 'pulse-ring-bottom-glow'}),
      ).toHaveLength(0);
      expect(
        tree!.root.findAllByProps({testID: 'pulse-ring-center-tint'}),
      ).toHaveLength(0);
      expect(
        tree!.root.findByProps({testID: 'pulse-ring-brand-image'}).props.source,
      ).toEqual(getBrandRing());
    });
  });

  it('renders a streak trail only in the streak state', () => {
    let idleTree: renderer.ReactTestRenderer | undefined;
    let streakTree: renderer.ReactTestRenderer | undefined;
    let streakWithoutTrailTree: renderer.ReactTestRenderer | undefined;

    act(() => {
      idleTree = renderer.create(<PulseRing animated={false} state="idle" />);
      streakTree = renderer.create(
        <PulseRing animated={false} state="streak" />,
      );
      streakWithoutTrailTree = renderer.create(
        <PulseRing animated={false} showTrail={false} state="streak" />,
      );
    });

    expect(
      idleTree!.root
        .findAllByType(Path)
        .filter(path => path.props.testID === 'pulse-ring-trail-path'),
    ).toHaveLength(0);
    expect(
      streakTree!.root
        .findAllByType(Path)
        .filter(path => path.props.testID === 'pulse-ring-trail-path'),
    ).toHaveLength(1);
    expect(streakTree!.root.findAllByType(Path)).toHaveLength(1);
    expect(
      streakTree!.root.findAll(
        node =>
          node.props.fill === brandColors.orangeStrong ||
          node.props.stopColor === brandColors.orangeStrong,
      ),
    ).toHaveLength(0);
    expect(
      streakTree!.root.findAll(
        node =>
          node.props.fill === brandColors.purpleBright ||
          node.props.stopColor === brandColors.purpleBright,
      ).length,
    ).toBeGreaterThan(0);
    expect(
      streakWithoutTrailTree!.root
        .findAllByType(Path)
        .filter(path => path.props.testID === 'pulse-ring-trail-path'),
    ).toHaveLength(0);
  });

  it('maps circle data to model-driven ring states', () => {
    expect(getPulseRingStateForCircle(circle({state: 'risk'}))).toBe('atRisk');
    expect(getPulseRingStateForCircle(circle({}))).toBe('active');
    expect(
      getPulseRingStateForCircle(
        circle({
          remainingCheckIns: 0,
          state: 'done',
          viewerHasCheckedIn: true,
          viewerHasTappedInToday: true,
          viewerTodayStatus: 'done',
        }),
      ),
    ).toBe('idle');
    expect(
      getPulseRingStateForCircle(
        circle({
          viewerHasCheckedIn: false,
          viewerMembershipStatus: 'pending',
        }),
      ),
    ).toBe('idle');
  });

  it('prioritizes at-risk circles over active circles for aggregate state', () => {
    expect(
      getPulseRingStateForCircles([
        circle({id: 'active'}),
        circle({id: 'risk', state: 'risk'}),
      ]),
    ).toBe('atRisk');
  });
});
