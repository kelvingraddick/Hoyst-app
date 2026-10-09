import React, {createContext, useContext} from 'react';
import {HoystInput} from '../../../design/components/HoystInput';

export const SetupInputFocusContext = createContext<(() => void) | undefined>(
  undefined,
);

export function SetupInput(props: React.ComponentProps<typeof HoystInput>) {
  const reveal = useContext(SetupInputFocusContext);
  return (
    <HoystInput
      {...props}
      onFocus={event => {
        props.onFocus?.(event);
        reveal?.();
      }}
    />
  );
}
