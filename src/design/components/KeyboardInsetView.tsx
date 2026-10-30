import {
  requireNativeComponent,
  type NativeSyntheticEvent,
  type ViewProps,
} from 'react-native';

/** Native keyboardLayoutGuide measurement in the receiving view's coordinate space. */
export const KeyboardInsetView = requireNativeComponent<
  ViewProps & {
    onInsetChange: (event: NativeSyntheticEvent<{inset: number}>) => void;
  }
>('HoystKeyboardInsetView');
