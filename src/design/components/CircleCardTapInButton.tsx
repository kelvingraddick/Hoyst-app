import React from 'react';
import {
  type GestureResponderEvent,
  type StyleProp,
  type ViewStyle,
} from 'react-native';

import {TapInPulseButton} from './TapInPulseButton';
import type {PulseRingState} from './pulse-ring-state';

type CircleCardTapInButtonProps = {
  disabled?: boolean;
  label?: string;
  onPress?: (event: GestureResponderEvent) => void;
  ringState?: PulseRingState;
  style?: StyleProp<ViewStyle>;
};

export function CircleCardTapInButton({
  disabled = false,
  label = 'Tap In',
  onPress,
  ringState = 'active',
  style,
}: CircleCardTapInButtonProps): React.JSX.Element {
  return (
    <TapInPulseButton
      disabled={disabled}
      label={label}
      onPress={onPress}
      ringState={ringState}
      style={style}
      variant="card"
    />
  );
}
