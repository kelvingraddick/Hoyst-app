import {useCallback, useState} from 'react';
import type {LayoutChangeEvent} from 'react-native';

/** Measure the space a component receives, including inside sheets and split views. */
export function useLayoutWidth(fallbackWidth: number) {
  const [measuredWidth, setMeasuredWidth] = useState<number>();
  const onLayout = useCallback((event: LayoutChangeEvent) => {
    const nextWidth = event.nativeEvent.layout.width;
    if (Number.isFinite(nextWidth) && nextWidth > 0) {
      setMeasuredWidth(nextWidth);
    }
  }, []);
  return {width: measuredWidth ?? Math.max(1, fallbackWidth), onLayout};
}
