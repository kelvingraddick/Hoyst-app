import React from 'react';
import type {PropsWithChildren} from 'react';
import {
  ScrollView,
  StyleSheet,
  View,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import {SafeAreaView} from 'react-native-safe-area-context';

import {useHoystTheme} from '../theme/useHoystTheme';

type HoystScreenProps = PropsWithChildren<{
  contentContainerStyle?: StyleProp<ViewStyle>;
  padded?: boolean;
  scrollEnabled?: boolean;
  style?: ViewStyle;
}>;

export function HoystScreen({
  contentContainerStyle,
  children,
  padded = true,
  scrollEnabled = true,
  style,
}: HoystScreenProps): React.JSX.Element {
  const theme = useHoystTheme();

  return (
    <SafeAreaView style={[styles.safeArea, {backgroundColor: theme.background}]}>
      <ScrollView
        bounces={false}
        contentContainerStyle={[
          styles.content,
          padded ? styles.padded : undefined,
          contentContainerStyle,
          style,
        ]}
        scrollEnabled={scrollEnabled}
        showsVerticalScrollIndicator={false}>
        <View style={styles.stack}>{children}</View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
  },
  content: {
    flexGrow: 1,
    paddingBottom: 48,
  },
  padded: {
    paddingHorizontal: 18,
    paddingTop: 8,
  },
  stack: {
    gap: 16,
  },
});
