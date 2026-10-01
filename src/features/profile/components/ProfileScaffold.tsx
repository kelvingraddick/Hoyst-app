import React, {type ReactNode, type RefObject} from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StatusBar,
  StyleSheet,
  View,
  type ScrollViewProps,
} from 'react-native';
import LinearGradient from 'react-native-linear-gradient';
import {useSafeAreaInsets} from 'react-native-safe-area-context';
import {ArrowLeft, type LucideIcon} from 'lucide-react-native';
import {
  DesignSystemProvider,
  DSIconButton,
  DSText,
  useSystemTheme,
} from '../../../design/system';
import {useSettingsStore} from '../../../store/settings-store';
import {useUserProfileStore} from '../../../store/profile-store';
import {useSessionStore} from '../../../store/session-store';
import type {ProfileTint} from '../../../types/models';
import {getProfileTintColor} from '../services/profile-personalization';
import {useProfilePreview} from './ProfilePreviewContext';

export function ProfileTheme({children}: {children: ReactNode}) {
  const appearance = useSettingsStore(state => state.appearance);
  const preview = useProfilePreview();
  return (
    <DesignSystemProvider scheme={preview?.scheme ?? appearance}>
      {children}
    </DesignSystemProvider>
  );
}
export function ProfileScaffold({
  children,
  title,
  onBack,
  leading,
  trailing,
  tint,
  tab = false,
  scrollRef,
  ...props
}: ScrollViewProps & {
  title?: string;
  onBack?: () => void;
  leading?: ReactNode;
  trailing?: ReactNode;
  tint?: ProfileTint;
  tab?: boolean;
  scrollRef?: RefObject<ScrollView | null>;
}) {
  const theme = useSystemTheme();
  const insets = useSafeAreaInsets();
  const stored = useUserProfileStore(state => state.profile);
  const accountUid = useSessionStore(state => state.user?.uid);
  const storedTint =
    stored?.id === accountUid ? stored?.profileTint : undefined;
  const preview = useProfilePreview();
  const color = getProfileTintColor(
    tint ?? preview?.profile?.profileTint ?? storedTint,
  );
  return (
    <View style={[styles.flex, {backgroundColor: theme.canvas}]}>
      <StatusBar barStyle={theme.isDark ? 'light-content' : 'dark-content'} />
      <LinearGradient
        pointerEvents="none"
        colors={[
          `${color}${theme.isDark ? '32' : '45'}`,
          `${color}16`,
          `${color}00`,
        ]}
        locations={[0, 0.45, 1]}
        style={styles.tint}
      />
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView
          ref={scrollRef}
          automaticallyAdjustContentInsets={false}
          contentInsetAdjustmentBehavior="never"
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="on-drag"
          scrollIndicatorInsets={{top: insets.top}}
          {...props}
          contentContainerStyle={[
            styles.content,
            {
              paddingTop: insets.top + 16,
              paddingBottom: insets.bottom + (tab ? 134 : 32),
              paddingLeft: 22 + insets.left,
              paddingRight: 22 + insets.right,
            },
            props.contentContainerStyle,
          ]}>
          {title || onBack || leading || trailing ? (
            <View style={styles.header}>
              {leading}
              {onBack ? (
                <DSIconButton
                  label="Back"
                  onPress={onBack}
                  icon={<ArrowLeft color={theme.action} size={22} />}
                />
              ) : null}
              {title ? (
                <DSText
                  accessibilityRole="header"
                  variant="screenTitle"
                  style={styles.grow}>
                  {title}
                </DSText>
              ) : (
                <View style={styles.grow} />
              )}
              {trailing}
            </View>
          ) : null}
          {children}
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}
export function ProfileIcon({
  icon: Icon,
  tone = 'blue',
}: {
  icon: LucideIcon;
  tone?: 'blue' | 'green' | 'orange' | 'purple' | 'neutral' | 'danger' | 'gold';
}) {
  const theme = useSystemTheme();
  const background =
    tone === 'gold'
      ? theme.isDark
        ? '#493718'
        : '#FFF0BD'
      : tone === 'danger'
      ? `${theme.danger}16`
      : theme.category[tone].surface;
  const foreground =
    tone === 'gold'
      ? theme.isDark
        ? '#FFD269'
        : '#A36C00'
      : tone === 'danger'
      ? theme.danger
      : theme.category[tone].foreground;
  return (
    <View
      accessible={false}
      style={[styles.icon, {backgroundColor: background}]}>
      <Icon size={18} color={foreground} />
    </View>
  );
}
const styles = StyleSheet.create({
  flex: {flex: 1},
  tint: {position: 'absolute', top: 0, left: 0, right: 0, height: 320},
  content: {gap: 16},
  header: {flexDirection: 'row', alignItems: 'center', gap: 8, minHeight: 44},
  grow: {flex: 1},
  icon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
