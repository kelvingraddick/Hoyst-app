import React, {useEffect, useRef, useState} from 'react';
import {
  Keyboard,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  TextInput,
  useWindowDimensions,
  View,
} from 'react-native';
import {
  SafeAreaProvider,
  useSafeAreaInsets,
} from 'react-native-safe-area-context';
import LinearGradient from 'react-native-linear-gradient';
import {ChevronLeft} from 'lucide-react-native';
import {SetupText as HoystText} from './SetupText';
import {SetupInputFocusContext} from './SetupInput';
import {HoyOrb} from '../../../design/components/HoyOrb';
import {HoystButton} from '../../../design/components/HoystButton';
import {useSetupTheme} from '../services/setup-presentation';
import {
  getHoyMessageSurfaceColors,
  hoyMessageSurface,
  HoyMessageText,
} from '../../../design/components/HoyMessage';

type Action = {label: string; onPress: () => void; disabled?: boolean};
type SetupJourneyFrameProps = React.PropsWithChildren<{
  title: string;
  brand?: React.ReactNode;
  footerNote?: string;
  message?: string;
  messageEmphasis?: readonly string[];
  footerVariant?: 'standard' | 'welcome';
  phase?: 'Discover' | 'Set up' | 'Start';
  step: string;
  onBack?: () => void;
  onLater?: () => void;
  primary?: Action;
  secondary?: Action;
  tertiary?: Action;
  tertiaryPresentation?: 'button' | 'link';
  error?: string;
}>;

export function SetupJourneyFrame(props: SetupJourneyFrameProps) {
  return (
    <SafeAreaProvider>
      <SetupJourneyFrameContent {...props} />
    </SafeAreaProvider>
  );
}

function SetupJourneyFrameContent({
  title,
  message,
  messageEmphasis,
  phase,
  step,
  children,
  onBack,
  onLater,
  primary,
  secondary,
  tertiary,
  error,
  brand,
  footerNote,
  footerVariant = 'standard',
  tertiaryPresentation = 'button',
}: SetupJourneyFrameProps) {
  const theme = useSetupTheme();
  const insets = useSafeAreaInsets();
  const {fontScale} = useWindowDimensions();
  const [keyboardVisible, setKeyboardVisible] = useState(
    () => (Keyboard.metrics()?.height ?? 0) > 0,
  );
  // RN forwards the native host's measurement methods on the ScrollView ref.
  const scroll = useRef<ScrollView & Pick<View, 'measureInWindow'>>(null);
  const scrollOffset = useRef(0);
  const revealFocusedInput = () => {
    requestAnimationFrame(() => {
      const input = TextInput.State.currentlyFocusedInput();
      if (input && (Keyboard.metrics()?.height ?? 0) > 0) {
        scroll.current?.measureInWindow(
          (_x, viewportY, _width, viewportHeight) => {
            input.measureInWindow(
              (_inputX, inputY, _inputWidth, inputHeight) => {
                const below =
                  inputY + inputHeight - (viewportY + viewportHeight - 8);
                const above = inputY - viewportY - 8;
                const adjustment = below > 0 ? below : above < 0 ? above : 0;
                if (adjustment) {
                  scroll.current?.scrollTo({
                    y: Math.max(0, scrollOffset.current + adjustment),
                    animated: false,
                  });
                }
              },
            );
          },
        );
      }
    });
  };
  useEffect(() => {
    const show = Keyboard.addListener(
      Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow',
      event => setKeyboardVisible(event.endCoordinates.height > 0),
    );
    const hide = Keyboard.addListener(
      Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide',
      () => setKeyboardVisible(false),
    );
    const shown = Keyboard.addListener('keyboardDidShow', revealFocusedInput);
    return () => {
      show.remove();
      hide.remove();
      shown.remove();
    };
  }, []);
  useEffect(() => {
    scroll.current?.scrollTo({y: 0, animated: false});
  }, [step]);
  return (
    <SetupInputFocusContext.Provider value={revealFocusedInput}>
      <View
        testID="setup-frame-root"
        style={[
          styles.screen,
          {
            backgroundColor: theme.isDark ? theme.background : '#FAFAF7',
            paddingTop: insets.top,
            paddingLeft: insets.left,
            paddingRight: insets.right,
          },
        ]}>
        <LinearGradient
          testID="setup-top-tint"
          pointerEvents="none"
          colors={[theme.setupTint, theme.isDark ? '#090B1200' : '#FAFAF700']}
          style={styles.fade}
        />
        <KeyboardAvoidingView
          style={styles.flex}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          {(onBack || onLater) && (
            <View style={styles.top}>
              {onBack ? (
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel="Go back"
                  onPress={onBack}
                  style={styles.touch}>
                  <ChevronLeft color={theme.textMuted} size={26} />
                </Pressable>
              ) : (
                <View />
              )}
              {onLater && (
                <Pressable
                  accessibilityRole="button"
                  onPress={onLater}
                  style={styles.touch}>
                  <HoystText
                    style={{color: theme.accentForeground, fontSize: 14}}>
                    Save for later
                  </HoystText>
                </Pressable>
              )}
            </View>
          )}
          {phase && (
            <View
              accessibilityLabel={`Setup phase: ${phase}`}
              style={[
                styles.progress,
                fontScale >= 1.6 && styles.progressAccessible,
              ]}>
              {(['Discover', 'Set up', 'Start'] as const).map(label => (
                <View key={label} style={styles.phase}>
                  <HoystText
                    style={[
                      styles.phaseLabel,
                      {
                        color:
                          phase === label
                            ? theme.accentForeground
                            : theme.textMuted,
                      },
                    ]}>
                    {label}
                  </HoystText>
                  <View
                    style={[
                      styles.bar,
                      {
                        backgroundColor:
                          phase === label
                            ? theme.accentSecondary
                            : theme.border,
                      },
                    ]}
                  />
                </View>
              ))}
            </View>
          )}
          <ScrollView
            ref={scroll}
            onLayout={revealFocusedInput}
            onContentSizeChange={revealFocusedInput}
            onScroll={event => {
              scrollOffset.current = event.nativeEvent.contentOffset.y;
            }}
            scrollEventThrottle={16}
            style={styles.flex}
            contentContainerStyle={styles.content}
            keyboardShouldPersistTaps="handled"
            keyboardDismissMode="interactive"
            automaticallyAdjustKeyboardInsets={false}
            automaticallyAdjustContentInsets={false}
            contentInsetAdjustmentBehavior="never"
            showsVerticalScrollIndicator={false}>
            {brand}
            <HoystText accessibilityRole="header" style={styles.heading}>
              {title}
            </HoystText>
            {message && (
              <View
                style={[styles.coach, fontScale >= 1.6 && styles.coachStacked]}>
                <View
                  style={[
                    hoyMessageSurface,
                    styles.bubble,
                    getHoyMessageSurfaceColors(theme.isDark),
                  ]}>
                  <HoyMessageText
                    message={message}
                    emphasis={messageEmphasis}
                  />
                </View>
                <View style={styles.hoy}>
                  <HoyOrb
                    animated={false}
                    presentation="home"
                    shadowTone={theme.isDark ? 'dark' : 'light'}
                    // Home compensates for image padding by 4/3; retain our 58-point artwork.
                    size={(58 * 3) / 4}
                    state="getting_started"
                    artworkSource={require('../../../assets/hoy/setup-friendly-blue.png')}
                    testID="setup-hoy-orb"
                  />
                </View>
              </View>
            )}
            <View style={styles.body}>{children}</View>
          </ScrollView>
          <View
            testID="setup-frame-footer"
            onLayout={revealFocusedInput}
            style={[
              styles.footer,
              {paddingBottom: 8 + (keyboardVisible ? 0 : insets.bottom)},
            ]}>
            {footerNote && (
              <HoystText tone="muted" style={{fontSize: 12, lineHeight: 16}}>
                {footerNote}
              </HoystText>
            )}
            {error && (
              <HoystText
                accessibilityRole="alert"
                tone="danger"
                style={styles.error}>
                {error}
              </HoystText>
            )}
            {primary && (
              <HoystButton
                {...primary}
                backgroundColor={theme.accent}
                textColor="#FFFFFF"
                borderColor={theme.accent}
                style={styles.action}
              />
            )}
            {secondary && footerVariant === 'welcome' ? (
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={`Already have an account? ${secondary.label}`}
                disabled={secondary.disabled}
                onPress={secondary.onPress}
                style={styles.footerLink}>
                <HoystText tone="muted" style={styles.accountPrompt}>
                  Already have an account?{' '}
                  <HoystText
                    style={[
                      styles.signInLink,
                      {color: theme.accentForeground},
                    ]}>
                    {secondary.label}
                  </HoystText>
                </HoystText>
              </Pressable>
            ) : secondary ? (
              <HoystButton
                {...secondary}
                variant="outline"
                borderColor={theme.accent}
                textColor={theme.accentForeground}
                style={[
                  styles.action,
                  {borderWidth: 1, borderColor: theme.accent},
                ]}
              />
            ) : null}
            {tertiary &&
            (footerVariant === 'welcome' || tertiaryPresentation === 'link') ? (
              <Pressable
                accessibilityRole="button"
                disabled={tertiary.disabled}
                onPress={tertiary.onPress}
                style={styles.footerLink}>
                <HoystText tone="muted" style={styles.browseLink}>
                  {tertiary.label}
                </HoystText>
              </Pressable>
            ) : tertiary ? (
              <HoystButton
                {...tertiary}
                variant="ghost"
                textColor={theme.textMuted}
                style={styles.action}
              />
            ) : null}
          </View>
        </KeyboardAvoidingView>
      </View>
    </SetupInputFocusContext.Provider>
  );
}
const styles = StyleSheet.create({
  screen: {flex: 1},
  flex: {flex: 1},
  fade: {position: 'absolute', top: 0, right: 0, left: 0, height: 340},
  top: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    minHeight: 48,
  },
  touch: {
    minHeight: Platform.OS === 'android' ? 48 : 44,
    minWidth: Platform.OS === 'android' ? 48 : 44,
    justifyContent: 'center',
    paddingHorizontal: 6,
  },
  progress: {
    flexDirection: 'row',
    gap: 8,
    paddingHorizontal: 74,
    paddingVertical: 10,
  },
  phase: {flex: 1, gap: 5},
  progressAccessible: {paddingHorizontal: 22},
  phaseLabel: {fontSize: 12, lineHeight: 16, textAlign: 'center'},
  bar: {height: 5, borderRadius: 5},
  content: {paddingHorizontal: 22, paddingTop: 12, paddingBottom: 16, gap: 20},
  heading: {fontSize: 24, lineHeight: 29, fontWeight: '700'},
  coach: {flexDirection: 'row', alignItems: 'center', gap: 12},
  coachStacked: {flexDirection: 'column-reverse', alignItems: 'stretch'},
  bubble: {flex: 1},
  hoy: {
    height: 58,
    width: 58,
    alignSelf: 'center',
    alignItems: 'center',
    justifyContent: 'center',
  },
  body: {gap: 12},
  footer: {paddingHorizontal: 22, paddingTop: 8, paddingBottom: 8, gap: 8},
  action: {minHeight: 48},
  footerLink: {
    minHeight: Platform.OS === 'android' ? 48 : 44,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 8,
  },
  accountPrompt: {
    fontSize: 14,
    lineHeight: 20,
    textAlign: 'center',
    fontWeight: '400',
  },
  signInLink: {fontSize: 14, lineHeight: 20, fontWeight: '600'},
  browseLink: {
    fontSize: 13,
    lineHeight: 18,
    fontWeight: '600',
    textAlign: 'center',
  },
  error: {fontSize: 14, lineHeight: 20},
});
