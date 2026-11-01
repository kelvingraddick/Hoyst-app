import {
  Platform,
  requireNativeComponent,
  type NativeSyntheticEvent,
  type ViewProps,
} from 'react-native';
import type {NavigationGeometry} from '../navigation-layout';

export const NavigationGeometryView =
  Platform.OS === 'ios'
    ? requireNativeComponent<
        ViewProps & {
          onGeometryChange: (
            event: NativeSyntheticEvent<NavigationGeometry>,
          ) => void;
        }
      >('HoystNavigationLayoutView')
    : null;
