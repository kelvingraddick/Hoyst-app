import React from 'react';
import renderer, {act} from 'react-test-renderer';
import {Circle, Path, Stop} from 'react-native-svg';

import {PulseRing} from '../src/design/components/PulseRing';
import {getHoystThemeColors} from '../src/design/tokens/colors';
import {
  getPulseRingStateForCircle,
  getPulseRingStateForCircles,
  type PulseRingState,
} from '../src/design/components/pulse-ring-state';
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

function getRenderedAngle({
  center,
  x,
  y,
}: {
  center: number;
  x: number;
  y: number;
}) {
  return (Math.atan2(y - center, x - center) * 180) / Math.PI + 90;
}

function getClockwiseSweep(startAngle: number, endAngle: number) {
  return (endAngle - startAngle + 360) % 360;
}

function getOuterArcSweep(path: string) {
  const arcMatch = path.match(
    /M ([\d.-]+) ([\d.-]+) A [\d.-]+ [\d.-]+ 0 [01] 1 ([\d.-]+) ([\d.-]+)/,
  );

  if (!arcMatch) {
    throw new Error(`Could not parse outer arc from path: ${path}`);
  }

  const [, startX, startY, endX, endY] = arcMatch.map(Number);
  const center = (72 + Math.max(18, 72 * 0.28)) / 2;
  const startAngle = getRenderedAngle({center, x: startX, y: startY});
  const endAngle = getRenderedAngle({center, x: endX, y: endY});

  return getClockwiseSweep(startAngle, endAngle);
}

function getCenterGlyphNodes(tree: renderer.ReactTestRenderer) {
  return tree.root.findAll(node =>
    String(node.props.testID ?? '').startsWith('pulse-ring-center-glyph-'),
  );
}

describe('PulseRing', () => {
  it('renders the main ring as cascading spectrum ribbons', () => {
    let tree: renderer.ReactTestRenderer | undefined;

    act(() => {
      tree = renderer.create(<PulseRing animated={false} state="idle" />);
    });

    const ribbons = tree!.root
      .findAllByType(Path)
      .filter(path =>
        String(path.props.testID).startsWith('pulse-ring-ribbon-'),
      );
    const underlays = tree!.root
      .findAllByType(Path)
      .filter(path =>
        String(path.props.testID).startsWith('pulse-ring-underlay-'),
      );
    const caps = tree!.root
      .findAllByType(Path)
      .filter(path => String(path.props.testID).startsWith('pulse-ring-cap-'));
    const ribbonStops = tree!.root
      .findAllByType(Stop)
      .map(stop => stop.props.stopColor);
    const allStrokedShapes = [
      ...tree!.root.findAllByType(Path),
      ...tree!.root.findAllByType(Circle),
    ];
    const centerFill = tree!.root.findByProps({
      testID: 'pulse-ring-center-fill',
    });
    const centerTint = tree!.root.findByProps({
      testID: 'pulse-ring-center-tint',
    });
    const innerGlow = tree!.root.findByProps({
      testID: 'pulse-ring-inner-glow',
    });

    expect(ribbons.map(ribbon => ribbon.props.testID)).toEqual([
      'pulse-ring-ribbon-green',
      'pulse-ring-ribbon-blue',
      'pulse-ring-ribbon-purple',
      'pulse-ring-ribbon-pink',
      'pulse-ring-ribbon-orange',
      'pulse-ring-ribbon-yellow',
    ]);
    expect(underlays.map(underlay => underlay.props.testID)).toEqual([
      'pulse-ring-underlay-green',
      'pulse-ring-underlay-blue',
      'pulse-ring-underlay-purple',
      'pulse-ring-underlay-pink',
      'pulse-ring-underlay-orange',
      'pulse-ring-underlay-yellow',
    ]);
    expect(caps.map(cap => cap.props.testID)).toEqual([
      'pulse-ring-cap-green',
      'pulse-ring-cap-blue',
      'pulse-ring-cap-purple',
      'pulse-ring-cap-pink',
      'pulse-ring-cap-orange',
      'pulse-ring-cap-yellow',
    ]);
    expect(ribbons.map(ribbon => ribbon.props.fill)).toEqual([
      expect.stringContaining('pulseRingRibbongreen'),
      expect.stringContaining('pulseRingRibbonblue'),
      expect.stringContaining('pulseRingRibbonpurple'),
      expect.stringContaining('pulseRingRibbonpink'),
      expect.stringContaining('pulseRingRibbonorange'),
      expect.stringContaining('pulseRingRibbonyellow'),
    ]);
    expect(underlays.map(underlay => underlay.props.fill)).toEqual([
      expect.stringContaining('pulseRingRibbongreen'),
      expect.stringContaining('pulseRingRibbonblue'),
      expect.stringContaining('pulseRingRibbonpurple'),
      expect.stringContaining('pulseRingRibbonpink'),
      expect.stringContaining('pulseRingRibbonorange'),
      expect.stringContaining('pulseRingRibbonyellow'),
    ]);
    expect(caps.map(cap => cap.props.fill)).toEqual([
      expect.stringContaining('pulseRingRibbongreen'),
      expect.stringContaining('pulseRingRibbonblue'),
      expect.stringContaining('pulseRingRibbonpurple'),
      expect.stringContaining('pulseRingRibbonpink'),
      expect.stringContaining('pulseRingRibbonorange'),
      expect.stringContaining('pulseRingRibbonyellow'),
    ]);
    expect(ribbons.map(ribbon => ribbon.props.stroke)).toEqual([
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
    ]);
    ribbons.forEach(ribbon => {
      expect(ribbon.props.d).toContain(' A ');
      expect(ribbon.props.d).toContain(' C ');
      expect(ribbon.props.d.match(/ C /g) ?? []).toHaveLength(3);
      expect(ribbon.props.d.match(/ A /g) ?? []).toHaveLength(1);
      expect(ribbon.props.d).not.toContain(' L ');
    });
    const ribbonSweeps = ribbons.map(ribbon =>
      getOuterArcSweep(ribbon.props.d),
    );
    const firstRibbonSweep = ribbonSweeps[0];

    expect(firstRibbonSweep).toBeGreaterThan(60);
    ribbonSweeps.forEach(sweep => {
      expect(sweep).toBeCloseTo(firstRibbonSweep, 4);
    });
    underlays.forEach(underlay => {
      expect(underlay.props.stroke).toBeUndefined();
      expect(getOuterArcSweep(underlay.props.d)).toBeGreaterThan(60);
    });
    const capSweeps = caps.map(cap => getOuterArcSweep(cap.props.d));
    const firstCapSweep = capSweeps[0];

    expect(firstCapSweep).toBeGreaterThan(40);
    capSweeps.forEach(sweep => {
      expect(sweep).toBeCloseTo(firstCapSweep, 4);
    });
    expect(centerFill.props.fill).toBe(
      getHoystThemeColors('light').surfaceMuted,
    );
    expect(centerFill.props.opacity).toBeUndefined();
    expect(centerTint.props.fill).toBe(getHoystThemeColors('light').textMuted);
    expect(centerTint.props.opacity).toBe(0.2);
    expect(innerGlow.props.fill).toBe('none');
    expect(innerGlow.props.opacity).toBe(0.78);
    expect(innerGlow.props.stroke).toEqual(
      expect.stringContaining('pulseInnerGlowGradient'),
    );
    expect(ribbonStops).toEqual(
      expect.arrayContaining([
        '#00C853',
        '#FFC400',
        '#FF6D00',
        '#FF1EA8',
        '#5A1CFF',
        '#18B9FF',
      ]),
    );
    expect(
      allStrokedShapes.some(shape =>
        `${shape.props.fill ?? ''}${shape.props.stroke ?? ''}`.includes(
          'pulseRingGradient',
        ),
      ),
    ).toBe(false);
    expect(getCenterGlyphNodes(tree!)).toHaveLength(0);
  });

  it('renders a solid center mask with state tint by default', () => {
    const theme = getHoystThemeColors('light');
    let tree: renderer.ReactTestRenderer | undefined;

    act(() => {
      tree = renderer.create(<PulseRing animated={false} state="active" />);
    });

    const centerFill = tree!.root.findByProps({
      testID: 'pulse-ring-center-fill',
    });
    const centerTint = tree!.root.findByProps({
      testID: 'pulse-ring-center-tint',
    });

    expect(centerFill.props.fill).toBe(theme.surfaceMuted);
    expect(centerFill.props.opacity).toBeUndefined();
    expect(centerTint.props.fill).toBe(theme.success);
    expect(centerTint.props.opacity).toBe(0.24);
    expect(getCenterGlyphNodes(tree!)).toHaveLength(0);
  });

  it('renders subtle contextual center tints without center glyphs', () => {
    const theme = getHoystThemeColors('light');
    const expectedStates: {
      backplateColor: string;
      backplateOpacity: number;
      state: PulseRingState;
    }[] = [
      {
        backplateColor: theme.textMuted,
        backplateOpacity: 0.2,
        state: 'idle',
      },
      {
        backplateColor: theme.success,
        backplateOpacity: 0.24,
        state: 'active',
      },
      {
        backplateColor: theme.warning,
        backplateOpacity: 0.24,
        state: 'atRisk',
      },
      {
        backplateColor: theme.accent,
        backplateOpacity: 0.24,
        state: 'streak',
      },
    ];

    expectedStates.forEach(({backplateColor, backplateOpacity, state}) => {
      let tree: renderer.ReactTestRenderer | undefined;

      act(() => {
        tree = renderer.create(
          <PulseRing animated={false} centerTreatment="state" state={state} />,
        );
      });

      const centerFill = tree!.root.findByProps({
        testID: 'pulse-ring-center-fill',
      });
      const centerTint = tree!.root.findByProps({
        testID: 'pulse-ring-center-tint',
      });

      expect(centerFill.props.fill).toBe(theme.surfaceMuted);
      expect(centerFill.props.opacity).toBeUndefined();
      expect(centerTint.props.fill).toBe(backplateColor);
      expect(centerTint.props.opacity).toBe(backplateOpacity);
      expect(getCenterGlyphNodes(tree!)).toHaveLength(0);
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

    const idleTrails = idleTree!.root
      .findAllByType(Path)
      .filter(path => String(path.props.stroke).includes('pulseTrailGradient'));
    const streakTrails = streakTree!.root
      .findAllByType(Path)
      .filter(path => String(path.props.stroke).includes('pulseTrailGradient'));
    const disabledTrails = streakWithoutTrailTree!.root
      .findAllByType(Path)
      .filter(path => String(path.props.stroke).includes('pulseTrailGradient'));

    expect(idleTrails).toHaveLength(0);
    expect(streakTrails).toHaveLength(1);
    expect(disabledTrails).toHaveLength(0);
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
