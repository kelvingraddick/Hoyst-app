import type {NativeStackNavigationOptions} from '@react-navigation/native-stack';

export const TAP_IN_EXPANDED_DETENT = 0.92;

/** Measured content includes the footer and its bottom safe-area clearance. */
export function getTapInSheetDetents(
  contentHeight: number,
  maximumHeight: number,
) {
  const compact = Math.min(
    TAP_IN_EXPANDED_DETENT,
    Math.max(
      0.3,
      Math.ceil((contentHeight / Math.max(1, maximumHeight)) * 1000) / 1000,
    ),
  );
  return compact >= TAP_IN_EXPANDED_DETENT
    ? [TAP_IN_EXPANDED_DETENT]
    : [compact, TAP_IN_EXPANDED_DETENT];
}

export function getTapInComposerScreenOptions(
  backgroundColor: string,
  detents = getTapInSheetDetents(0, 1),
): NativeStackNavigationOptions {
  return {
    contentStyle: {backgroundColor},
    gestureEnabled: true,
    headerShown: false,
    presentation: 'formSheet',
    sheetAllowedDetents: detents,
    sheetCornerRadius: 32,
    sheetExpandsWhenScrolledToEdge: true,
    sheetGrabberVisible: true,
    sheetInitialDetentIndex: 0,
    sheetLargestUndimmedDetentIndex: 'none',
  };
}

export function getTapInPickerScreenOptions(
  backgroundColor: string,
): NativeStackNavigationOptions {
  return {
    ...getTapInComposerScreenOptions(backgroundColor, [TAP_IN_EXPANDED_DETENT]),
    // The selector's list scroll must not hand off to the sheet pan gesture.
    // The grabber still provides native swipe dismissal.
    sheetExpandsWhenScrolledToEdge: false,
  };
}
