import React, {useEffect, useRef} from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  View,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import {ArrowLeft, X} from 'lucide-react-native';
import {SafeAreaView} from 'react-native-safe-area-context';

import {FrostedBackdrop} from '../../../design/components/FrostedBackdrop';
import {GlassPanel} from '../../../design/components/GlassPanel';
import {HoystButton} from '../../../design/components/HoystButton';
import {HoystText} from '../../../design/components/HoystText';
import {SetupProgressBar} from '../../../design/components/SetupProgressBar';
import {SetupIconButton} from './CommitmentSetupFields';

type SetupAction = {
  disabled?: boolean;
  label: string;
  onPress: () => void;
};

type CommitmentSetupScaffoldProps = React.PropsWithChildren<{
  body?: string;
  contentContainerStyle?: StyleProp<ViewStyle>;
  eyebrow?: string;
  onBack: () => void;
  onClose?: () => void;
  primaryAction: SetupAction;
  progress?: {current: number; total: number};
  secondaryAction?: SetupAction;
  stepKey?: string;
  title: string;
}>;

export function CommitmentSetupScaffold({
  body,
  children,
  contentContainerStyle,
  eyebrow,
  onBack,
  onClose,
  primaryAction,
  progress,
  secondaryAction,
  stepKey,
  title,
}: CommitmentSetupScaffoldProps): React.JSX.Element {
  const scrollRef = useRef<ScrollView>(null);

  useEffect(() => {
    if (stepKey) {
      scrollRef.current?.scrollTo({animated: false, y: 0});
    }
  }, [stepKey]);

  return (
    <SafeAreaView style={styles.safeArea}>
      <FrostedBackdrop />
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={styles.keyboardView}>
        <View style={styles.header}>
          <SetupIconButton
            accessibilityLabel="Go back"
            icon={ArrowLeft}
            onPress={onBack}
          />
          {progress ? (
            <SetupProgressBar
              current={progress.current}
              testID="commitment-setup-progress"
              total={progress.total}
            />
          ) : (
            <View style={styles.headerSpacer} />
          )}
          {onClose ? (
            <SetupIconButton
              accessibilityLabel="Close commitment setup"
              icon={X}
              onPress={onClose}
            />
          ) : (
            <View style={styles.headerButtonSpacer} />
          )}
        </View>

        <ScrollView
          automaticallyAdjustKeyboardInsets
          bounces={false}
          contentContainerStyle={[styles.scrollContent, contentContainerStyle]}
          keyboardDismissMode="interactive"
          keyboardShouldPersistTaps="handled"
          ref={scrollRef}
          showsVerticalScrollIndicator={false}>
          <View style={styles.headingBlock}>
            {eyebrow ? (
              <HoystText tone="muted" variant="label">
                {eyebrow}
              </HoystText>
            ) : null}
            <HoystText variant="largeTitle">{title}</HoystText>
            {body ? <HoystText tone="muted">{body}</HoystText> : null}
          </View>
          <View style={styles.content}>{children}</View>
        </ScrollView>

        <View style={styles.footerWrap}>
          <GlassPanel padding="compact" style={styles.footer} variant="nav">
            <HoystButton
              disabled={primaryAction.disabled}
              label={primaryAction.label}
              onPress={primaryAction.onPress}
              style={styles.primaryAction}
            />
            {secondaryAction ? (
              <HoystButton
                disabled={secondaryAction.disabled}
                label={secondaryAction.label}
                onPress={secondaryAction.onPress}
                style={styles.secondaryAction}
                variant="ghost"
              />
            ) : null}
          </GlassPanel>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
  },
  keyboardView: {
    flex: 1,
  },
  header: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 12,
    paddingBottom: 8,
    paddingHorizontal: 20,
    paddingTop: 20,
  },
  headerButtonSpacer: {
    height: 44,
    width: 44,
  },
  headerSpacer: {
    flex: 1,
  },
  scrollContent: {
    gap: 20,
    paddingBottom: 32,
    paddingHorizontal: 20,
    paddingTop: 12,
  },
  headingBlock: {
    gap: 8,
  },
  content: {
    gap: 16,
  },
  footerWrap: {
    paddingBottom: 6,
    paddingHorizontal: 12,
    paddingTop: 8,
  },
  footer: {
    borderRadius: 30,
  },
  primaryAction: {
    minHeight: 54,
  },
  secondaryAction: {
    minHeight: 44,
  },
});
