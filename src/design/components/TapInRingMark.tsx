import React from 'react';
import {type StyleProp, type ViewStyle} from 'react-native';

import {PulseRing} from './PulseRing';
import type {PulseRingState} from './pulse-ring-state';

type TapInRingMarkProps = {
  animated?: boolean;
  innerSize?: number;
  isPressed?: boolean;
  outerSize?: number;
  state?: PulseRingState;
  style?: StyleProp<ViewStyle>;
  testID?: string;
};

export function TapInRingMark({
  animated,
  innerSize = 45,
  isPressed,
  outerSize = 81,
  state = 'idle',
  style,
  testID,
}: TapInRingMarkProps): React.JSX.Element {
  const strokeWidth = Math.max(
    3,
    Math.min(10, (outerSize - innerSize) / 2, outerSize * 0.12),
  );

  return (
    <PulseRing
      animated={animated}
      isPressed={isPressed}
      size={outerSize}
      state={state}
      strokeWidth={strokeWidth}
      style={style}
      testID={testID}
    />
  );
}
