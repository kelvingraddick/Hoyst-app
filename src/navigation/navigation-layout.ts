import type {EdgeInsets} from 'react-native-safe-area-context';

type Rect = {x: number; y: number; width: number; height: number};
export type NavigationGeometry = {
  edge: 'unspecified' | 'leading' | 'trailing';
  rtl: boolean;
  bounds: Rect;
  insets: EdgeInsets;
  statusArea: Rect;
};
export type NavigationLayout = {
  mode: 'bottom' | 'rail';
  contentInsets: EdgeInsets;
  rail?: Rect;
  keyboardInset?: number;
};

export function getNavigationLayout(
  geometry: NavigationGeometry | null,
  insets: EdgeInsets,
): NavigationLayout {
  if (!geometry || geometry.edge === 'unspecified') {
    return {mode: 'bottom', contentInsets: insets};
  }
  const {bounds, statusArea, rtl} = geometry;
  const safe = geometry.insets;
  const isLeft = (geometry.edge === 'leading') !== Boolean(rtl);
  const margin = 4;
  const width = 88;
  const x = isLeft ? margin : bounds.width - margin - width;
  const intersectsStatus = () =>
    statusArea.width > 0 &&
    statusArea.height > 0 &&
    x < statusArea.x + statusArea.width &&
    x + width > statusArea.x;
  const bottom = Math.max(0, bounds.height - safe.bottom - 16);
  let top = Math.max(16, safe.top + 12);
  if (intersectsStatus()) {
    top = Math.max(top, statusArea.y + statusArea.height + 12);
  }
  // Keep the upper third free when UIKit supplies no useful vertical status
  // frame. This is a bottom-anchored navigation region, not a camera-size guess.
  // Long labels scroll within this region rather than expanding toward system UI.
  if (
    top > bottom - 100 ||
    (statusArea.height === 0 && (isLeft ? safe.left : safe.right) > 0)
  ) {
    top = Math.max(16, safe.top + 12, bounds.height / 3);
  }
  return {
    mode: 'rail',
    rail: {x, y: top, width, height: Math.max(1, bottom - top)},
    // The rail lives in the system's side strip. Preserve the screen's original
    // usable width; its existing content gutters separate controls from the rail.
    contentInsets: safe,
  };
}

export function getHomeTopPadding(topInset: number) {
  // HomeHeroHeader contributes the remaining four points.
  return Math.max(topInset, 12);
}
