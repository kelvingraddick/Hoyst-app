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
  onContentSizeChange?: ScrollViewProps['onContentSizeChange'];
  onLayout?: ScrollViewProps['onLayout'];
  onScroll?: ScrollViewProps['onScroll'];
  padded?: boolean;
  scrollEnabled?: boolean;
  scrollEventThrottle?: ScrollViewProps['scrollEventThrottle'];
  scrollViewRef?: React.Ref<ScrollView>;
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
  onContentSizeChange,
  onLayout,
  onScroll,
  padded = true,
  scrollEnabled = true,
  scrollEventThrottle,
  scrollViewRef,
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
      onContentSizeChange={onContentSizeChange}
      onLayout={onLayout}
      onScroll={onScroll}
      ref={scrollViewRef}
      scrollEnabled={scrollEnabled}
      scrollEventThrottle={scrollEventThrottle}
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
