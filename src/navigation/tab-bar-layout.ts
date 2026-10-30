import type {EdgeInsets} from 'react-native-safe-area-context';

export function getTabBarLayout(insets: EdgeInsets, isIOS: boolean) {
  return {
    // The capsule's offsets already consume each inset. React Navigation's
    // symmetric internal safe-area padding would otherwise count it twice.
    paddingHorizontal: 0,
    left: 18 + insets.left,
    right: 18 + insets.right,
    bottom: Math.max(isIOS ? 18 : 12, insets.bottom),
  };
}
