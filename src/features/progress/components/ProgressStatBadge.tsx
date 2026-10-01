import React from 'react';
import {StyleSheet, View} from 'react-native';
import Svg, {Path, Rect} from 'react-native-svg';
import {useSystemTheme} from '../../../design/system';

/** Filled, local artwork matches the mock without changing shared stat icons. */
export function ProgressStatBadge({tone}: {tone: 'orange' | 'blue'}) {
  const theme = useSystemTheme();
  return (
    <View
      style={[styles.badge, {backgroundColor: theme.category[tone].surface}]}>
      <Svg width={22} height={22} viewBox="0 0 24 24" accessible={false}>
        {tone === 'orange' ? (
          <>
            <Path
              d="M12 1C13 6 18 7 18 12c2-2 2-4 2-4s3 4 3 8c0 5-4 8-10 8S3 21 3 16c0-4 3-7 5-10-1 5 2 6 3 4 1-2 1-5 1-9Z"
              fill="#FF6D00"
            />
            <Path
              d="M13 12c0 3-4 4-4 7 0 2 2 4 4 4s4-2 4-4c0-3-3-4-4-7Z"
              fill={theme.surface}
            />
          </>
        ) : (
          <>
            <Rect x={2} y={15} width={5} height={8} rx={2.5} fill="#18B9FF" />
            <Rect x={9.5} y={9} width={5} height={14} rx={2.5} fill="#18B9FF" />
            <Rect x={17} y={2} width={5} height={21} rx={2.5} fill="#18B9FF" />
          </>
        )}
      </Svg>
    </View>
  );
}
const styles = StyleSheet.create({
  badge: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
