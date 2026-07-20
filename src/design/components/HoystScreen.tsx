import React from 'react';
import type {PropsWithChildren} from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  View,
  type StyleProp,
  type ScrollViewProps,
  type ViewStyle,
} from 'react-native';
import {SafeAreaView} from 'react-native-safe-area-context';

import {useHoystTheme} from '../theme/useHoystTheme';

type HoystScreenProps = PropsWithChildren<{
  background?: React.ReactNode;
  contentContainerStyle?: StyleProp<ViewStyle>;
  keyboardAvoiding?: boolean;
  keyboardDismissMode?: ScrollViewProps['keyboardDismissMode'];
  keyboardShouldPersistTaps?: ScrollViewProps['keyboardShouldPersistTaps'];
  padded?: boolean;
  scrollEnabled?: boolean;
  stackStyle?: StyleProp<ViewStyle>;
  style?: ViewStyle;
}>;

export function HoystScreen({
  background,
  contentContainerStyle,
  children,
  keyboardAvoiding = false,
  keyboardDismissMode,
  keyboardShouldPersistTaps,
  padded = true,
  scrollEnabled = true,
  stackStyle,
  style,
}: HoystScreenProps): React.JSX.Element {
  const theme = useHoystTheme();

  const screenContent = (
    <ScrollView
      bounces={false}
      contentContainerStyle={[
        styles.content,
        padded ? styles.padded : undefined,
        contentContainerStyle,
        style,
      ]}
      keyboardDismissMode={keyboardDismissMode}
      keyboardShouldPersistTaps={keyboardShouldPersistTaps}
      scrollEnabled={scrollEnabled}
      showsVerticalScrollIndicator={false}>
      <View style={[styles.stack, stackStyle]}>{children}</View>
    </ScrollView>
  );

  return (
    <SafeAreaView
      style={[styles.safeArea, {backgroundColor: theme.background}]}>
      {background ? (
        <View pointerEvents="none" style={StyleSheet.absoluteFill}>
          {background}
        </View>
      ) : null}
      {keyboardAvoiding ? (
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          style={styles.safeArea}>
          {screenContent}
        </KeyboardAvoidingView>
      ) : (
        screenContent
      )}
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
    paddingHorizontal: 20,
    paddingTop: 8,
  },
  stack: {
    gap: 24,
  },
});
