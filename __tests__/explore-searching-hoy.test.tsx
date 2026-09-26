import React from 'react';
import {AccessibilityInfo, Animated} from 'react-native';
import renderer, {act} from 'react-test-renderer';
import {ExploreSearchingHoy} from '../src/features/explore/components/ExploreSearchingHoy';

it('respects Reduce Motion changes and stops the active loop on unmount', async () => {
  jest.spyOn(AccessibilityInfo, 'isReduceMotionEnabled').mockResolvedValue(true);
  let change!: (enabled: boolean) => void;
  const remove = jest.fn();
  jest.spyOn(AccessibilityInfo, 'addEventListener').mockImplementation(
    (...args: unknown[]) => {
      change = args[1] as (enabled: boolean) => void;
      return {remove} as unknown as ReturnType<
        typeof AccessibilityInfo.addEventListener
      >;
    },
  );
  const start = jest.fn();
  const stop = jest.fn();
  jest.spyOn(Animated, 'loop').mockReturnValue({start, stop, reset: jest.fn()});
  let screen!: renderer.ReactTestRenderer;
  await act(async () => {
    screen = renderer.create(<ExploreSearchingHoy searching />);
  });
  expect(start).not.toHaveBeenCalled();
  act(() => change(false));
  expect(start).toHaveBeenCalledTimes(1);
  act(() => change(true));
  expect(stop).toHaveBeenCalledTimes(1);
  act(() => change(false));
  expect(start).toHaveBeenCalledTimes(2);
  act(() => screen.unmount());
  expect(stop).toHaveBeenCalledTimes(2);
  expect(remove).toHaveBeenCalled();
  jest.restoreAllMocks();
});
