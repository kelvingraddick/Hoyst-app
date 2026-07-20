import {getTapInComposerScreenOptions} from '../src/navigation/tap-in-sheet-options';

describe('Tap In composer sheet options', () => {
  it('opens as a compact, expandable native form sheet', () => {
    expect(getTapInComposerScreenOptions('#F4F3FB')).toMatchObject({
      contentStyle: {backgroundColor: '#F4F3FB'},
      gestureEnabled: true,
      headerShown: false,
      presentation: 'formSheet',
      sheetAllowedDetents: [0.68, 0.92],
      sheetCornerRadius: 32,
      sheetExpandsWhenScrolledToEdge: true,
      sheetGrabberVisible: true,
      sheetInitialDetentIndex: 0,
      sheetLargestUndimmedDetentIndex: 'none',
    });
  });
});
