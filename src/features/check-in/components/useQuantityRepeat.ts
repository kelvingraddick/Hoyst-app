import {useCallback, useEffect, useRef} from 'react';
import {AppState} from 'react-native';

type Direction = -1 | 1;

/** One repeat session shared by both buttons. Values stay with the controller. */
export function useQuantityRepeat({
  active,
  disabled,
  value,
  onDecrease,
  onIncrease,
}: {
  active: boolean;
  disabled?: boolean;
  value: number;
  onDecrease: () => void;
  onIncrease: () => void;
}) {
  const latest = useRef({active, disabled, value, onDecrease, onIncrease});
  latest.current = {active, disabled, value, onDecrease, onIncrease};
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const releaseTimer = useRef<ReturnType<typeof setTimeout> | undefined>(
    undefined,
  );
  const appActive = useRef(
    AppState.currentState !== 'background' &&
      AppState.currentState !== 'inactive',
  );
  const pressed = useRef<Direction | undefined>(undefined);
  const startedAt = useRef(0);
  const repeated = useRef(false);

  const stop = useCallback(() => {
    clearTimeout(timer.current);
    timer.current = undefined;
    pressed.current = undefined;
  }, []);

  const canStep = useCallback((direction: Direction) => {
    const current = latest.current;
    return (
      current.active &&
      appActive.current &&
      !current.disabled &&
      (direction === -1
        ? current.value > 0
        : current.value < Number.MAX_SAFE_INTEGER)
    );
  }, []);

  useEffect(() => {
    if (!active || disabled || (pressed.current && !canStep(pressed.current))) {
      stop();
      repeated.current = false;
    }
  }, [active, disabled, value, canStep, stop]);

  useEffect(() => {
    const subscription = AppState.addEventListener('change', state => {
      appActive.current = state === 'active';
      if (state !== 'active') {
        stop();
        repeated.current = false;
      }
    });
    return () => {
      subscription.remove();
      stop();
      clearTimeout(releaseTimer.current);
    };
  }, [stop]);

  const pressIn = (direction: Direction) => {
    stop();
    clearTimeout(releaseTimer.current);
    repeated.current = false;
    if (canStep(direction)) {
      pressed.current = direction;
      startedAt.current = Date.now();
    }
  };

  const longPress = (direction: Direction) => {
    if (pressed.current !== direction || !canStep(direction)) {
      return;
    }
    repeated.current = true;
    const tick = () => {
      if (pressed.current !== direction || !canStep(direction)) {
        stop();
        return;
      }
      const current = latest.current;
      (direction === -1 ? current.onDecrease : current.onIncrease)();
      const elapsed = Date.now() - startedAt.current;
      timer.current = setTimeout(
        tick,
        elapsed >= 4000 ? 40 : elapsed >= 2000 ? 75 : 150,
      );
    };
    tick();
  };

  return {
    pressIn,
    longPress,
    pressOut: () => {
      stop();
      // Ignore a release press in this event, then allow accessibility actions
      // that can arrive without a new press-in event.
      clearTimeout(releaseTimer.current);
      releaseTimer.current = setTimeout(() => {
        repeated.current = false;
      }, 0);
    },
    press: (direction: Direction) => {
      if (!repeated.current && canStep(direction)) {
        const current = latest.current;
        (direction === -1 ? current.onDecrease : current.onIncrease)();
      }
    },
  };
}
