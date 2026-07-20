import type {NativeStackNavigationOptions} from '@react-navigation/native-stack';

export const TAP_IN_SHEET_DETENTS = [0.68, 0.92] as const;

export function getTapInComposerScreenOptions(
  backgroundColor: string,
): NativeStackNavigationOptions {
  return {
    contentStyle: {backgroundColor},
    gestureEnabled: true,
    headerShown: false,
    presentation: 'formSheet',
    sheetAllowedDetents: [...TAP_IN_SHEET_DETENTS],
    sheetCornerRadius: 32,
    sheetExpandsWhenScrolledToEdge: true,
    sheetGrabberVisible: true,
    sheetInitialDetentIndex: 0,
    sheetLargestUndimmedDetentIndex: 'none',
  };
}
