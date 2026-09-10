import {
  getTapInComposerScreenOptions,
  getTapInSheetDetents,
} from '../src/navigation/tap-in-sheet-options';

describe('Tap In composer sheet options', () => {
  it('opens as a compact, expandable native form sheet', () => {
    expect(getTapInComposerScreenOptions('#F4F3FB')).toMatchObject({
      contentStyle: {backgroundColor: '#F4F3FB'},
      gestureEnabled: true,
      headerShown: false,
      presentation: 'formSheet',
      sheetAllowedDetents: [0.3, 0.92],
      sheetCornerRadius: 32,
      sheetExpandsWhenScrolledToEdge: true,
      sheetGrabberVisible: true,
      sheetInitialDetentIndex: 0,
      sheetLargestUndimmedDetentIndex: 'none',
    });
  });
});

it('fits short content while retaining an expanded stop and caps large content', () => {
  expect(getTapInSheetDetents(400, 800)).toEqual([0.5, 0.92]);
  expect(getTapInSheetDetents(480, 800)).toEqual([0.6, 0.92]);
  expect(getTapInSheetDetents(1200, 800)).toEqual([0.92]);
  expect(getTapInSheetDetents(0, 0)).toEqual([0.3, 0.92]);
});
