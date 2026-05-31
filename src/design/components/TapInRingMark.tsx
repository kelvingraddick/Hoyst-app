import React from 'react';
import {type StyleProp, type ViewStyle} from 'react-native';

import {PulseRing} from './PulseRing';
import type {PulseRingState} from './pulse-ring-state';

type TapInRingMarkProps = {
  animated?: boolean;
  centerTreatment?: 'plain' | 'state';
  innerSize?: number;
  interactionKey?: number;
  isPressed?: boolean;
  outerSize?: number;
  showTrail?: boolean;
  state?: PulseRingState;
  style?: StyleProp<ViewStyle>;
  testID?: string;
};

export function TapInRingMark({
  animated,
  centerTreatment,
  innerSize = 45,
  interactionKey,
  isPressed,
  outerSize = 81,
  showTrail,
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
      centerTreatment={centerTreatment}
      interactionKey={interactionKey}
      isPressed={isPressed}
      showTrail={showTrail}
      size={outerSize}
      state={state}
      strokeWidth={strokeWidth}
      style={style}
      testID={testID}
    />
  );
}
