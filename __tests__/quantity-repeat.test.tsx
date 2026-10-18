import React from 'react';
import {AppState, type AppStateStatus} from 'react-native';
import renderer, {act} from 'react-test-renderer';
import {useQuantityRepeat} from '../src/features/check-in/components/useQuantityRepeat';

let controls: ReturnType<typeof useQuantityRepeat>;
const increase = jest.fn();
const decrease = jest.fn();
function Harness({active = true, disabled = false, value = 10}) {
  controls = useQuantityRepeat({
    active,
    disabled,
    value,
    onIncrease: increase,
    onDecrease: decrease,
  });
  return null;
}

describe('quantity hold controls', () => {
  let tree: renderer.ReactTestRenderer;
  let appStateChange: (state: AppStateStatus) => void;
  beforeEach(() => {
    jest.useFakeTimers();
    increase.mockClear();
    decrease.mockClear();
    jest
      .spyOn(AppState, 'addEventListener')
      .mockImplementation((_event, listener) => {
        appStateChange = listener;
        return {remove: jest.fn()};
      });
    act(() => {
      tree = renderer.create(<Harness />);
    });
  });
  afterEach(() => {
    act(() => tree.unmount());
    jest.useRealTimers();
    jest.restoreAllMocks();
  });

  function startHold(direction: -1 | 1 = 1) {
    controls.pressIn(direction);
    jest.advanceTimersByTime(500);
    controls.longPress(direction);
  }

  it('takes one step on a short tap and supports accessibility presses without press-in', () => {
    controls.pressIn(1);
    jest.advanceTimersByTime(499);
    controls.pressOut();
    controls.press(1);
    expect(increase).toHaveBeenCalledTimes(1);
    controls.press(-1);
    expect(decrease).toHaveBeenCalledTimes(1);
  });

  it('accelerates through all three speeds and stops without a release step', () => {
    startHold();
    expect(increase).toHaveBeenCalledTimes(1);
    jest.advanceTimersByTime(149);
    expect(increase).toHaveBeenCalledTimes(1);
    jest.advanceTimersByTime(1);
    expect(increase).toHaveBeenCalledTimes(2);
    jest.advanceTimersByTime(1350); // Two seconds since press-in.
    const atTwoSeconds = increase.mock.calls.length;
    jest.advanceTimersByTime(75);
    expect(increase).toHaveBeenCalledTimes(atTwoSeconds + 1);
    jest.advanceTimersByTime(1950); // First repeat after four seconds is at 4025 ms.
    const atFourSeconds = increase.mock.calls.length;
    jest.advanceTimersByTime(40);
    expect(increase).toHaveBeenCalledTimes(atFourSeconds + 1);
    controls.pressOut();
    controls.press(1);
    jest.advanceTimersByTime(10000);
    expect(increase).toHaveBeenCalledTimes(atFourSeconds + 1);
    startHold();
    const restarted = increase.mock.calls.length;
    jest.advanceTimersByTime(149);
    expect(increase).toHaveBeenCalledTimes(restarted);
    jest.advanceTimersByTime(1);
    expect(increase).toHaveBeenCalledTimes(restarted + 1);
  });

  it.each([
    {active: false},
    {disabled: true},
    {value: Number.MAX_SAFE_INTEGER},
  ])('stops when the control becomes unavailable: %j', props => {
    startHold();
    act(() => tree.update(<Harness {...props} />));
    jest.advanceTimersByTime(10000);
    expect(increase).toHaveBeenCalledTimes(1);
  });

  it('stops decreasing at zero', () => {
    startHold(-1);
    act(() => tree.update(<Harness value={0} />));
    jest.advanceTimersByTime(10000);
    expect(decrease).toHaveBeenCalledTimes(1);
    controls.press(-1);
    expect(decrease).toHaveBeenCalledTimes(1);
  });

  it('allows a later accessibility press after a hold has ended', () => {
    startHold();
    controls.pressOut();
    jest.advanceTimersByTime(0);
    controls.press(1);
    expect(increase).toHaveBeenCalledTimes(2);
  });

  it.each<AppStateStatus>(['inactive', 'background'])(
    'stops on app state %s and suppresses release',
    state => {
      startHold();
      appStateChange(state);
      controls.press(1);
      jest.advanceTimersByTime(10000);
      expect(increase).toHaveBeenCalledTimes(1);
    },
  );

  it('cancels when a finger moves off the control and clears timers on unmount', () => {
    startHold();
    controls.pressOut();
    jest.advanceTimersByTime(1000);
    expect(increase).toHaveBeenCalledTimes(1);
    startHold();
    act(() => tree.unmount());
    jest.advanceTimersByTime(10000);
    expect(increase).toHaveBeenCalledTimes(2);
    expect(jest.getTimerCount()).toBe(0);
  });
});
