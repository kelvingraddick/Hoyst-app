import React, {useEffect, useState} from 'react';
import {Alert, Pressable, StyleSheet, View} from 'react-native';
import type {FirebaseAuthTypes} from '@react-native-firebase/auth';
import type {
  NativeStackNavigationProp,
  NativeStackScreenProps,
} from '@react-navigation/native-stack';
import {Apple, Chrome, Mail, Phone, X} from 'lucide-react-native';

import {GlassPanel} from '../../../design/components/GlassPanel';
import {HoystButton} from '../../../design/components/HoystButton';
import {HoystInput} from '../../../design/components/HoystInput';
import {HoystScreen} from '../../../design/components/HoystScreen';
import {HoystText} from '../../../design/components/HoystText';
import {useHoystTheme} from '../../../design/theme/useHoystTheme';
import {radius} from '../../../design/tokens/radius';
import {firebaseAuth} from '../../../lib/firebase/auth';
import type {
  AuthStackParamList,
  RootStackParamList,
  SignInMethod,
} from '../../../navigation/types';
import {useOnboardingStore} from '../../../store/onboarding-store';
import {useSessionStore} from '../../../store/session-store';
import {dismissAuthModals} from '../../../navigation/auth-modal-dismiss';
import {
  confirmPhoneSignIn,
  getSameEmailProviders,
  sendPasswordReset,
  signInWithApple,
  signInWithEmail,
  signInWithGoogle,
  signOutOfHoyst,
  startPhoneSignIn,
  type AuthServiceError,
} from '../services/auth-service';
import {continueAsGuestFromAuth} from '../services/auth-dismiss';
import {resolveSignInRouteIntent} from '../services/auth-route-intent';
import {formatPhoneNumberForDisplay} from '../services/phone-number';

type Props = NativeStackScreenProps<AuthStackParamList, 'SignIn'>;

function getErrorMessage(error: unknown) {
  const serviceError = error as AuthServiceError;

  if ('email' in serviceError) {
    const providerHint = serviceError.providers.length
      ? ` Existing providers: ${serviceError.providers.join(', ')}.`
      : '';

    return serviceError.email
      ? `An account already exists for ${serviceError.email}.${providerHint} Sign in with the original provider, then connect this one from settings.`
      : `An account already exists for that email.${providerHint} Sign in with the original provider first.`;
  }

  return serviceError.message ?? 'Authentication failed. Try again.';
}

export function SignInScreen({navigation, route}: Props): React.JSX.Element {
  const theme = useHoystTheme();
  const initialIntent = resolveSignInRouteIntent(route.params);
  const [method, setMethod] = useState<SignInMethod | undefined>(
    initialIntent.method,
  );
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [phoneNumber, setPhoneNumber] = useState('');
  const [smsCode, setSmsCode] = useState('');
  const [confirmation, setConfirmation] =
    useState<FirebaseAuthTypes.ConfirmationResult>();
  const [isBusy, setIsBusy] = useState(false);
  const [isDismissing, setIsDismissing] = useState(false);
  const [activeProvider, setActiveProvider] = useState<
    'apple' | 'google' | undefined
  >();
  const clearPendingAction = useSessionStore(state => state.clearPendingAction);
  const setGuest = useSessionStore(state => state.setGuest);
  const sessionStatus = useSessionStore(state => state.status);
  const markOnboardingSeen = useOnboardingStore(state => state.markSeen);
  const startOnboardingWizard = useOnboardingStore(
    state => state.startOnboardingWizard,
  );
  const startInviteOnboarding = useOnboardingStore(
    state => state.startInviteOnboarding,
  );
  const onboardingJourney = useOnboardingStore(state => state.journey);
  const rootNavigation =
    navigation.getParent<NativeStackNavigationProp<RootStackParamList>>();
  const isActionBusy = isBusy || isDismissing;
  const failureTitle = 'Sign in failed';
  const headerTitle = 'Welcome back';
  const headerBody =
    'Sign in to rejoin your circles, Tap In, and manage your profile.';
  const onboardingLinkLabel =
    onboardingJourney === 'invite'
      ? 'New to Hoyst? Create an account to join'
      : 'New to Hoyst? Get started';
  const activeProviderLabel =
    activeProvider === 'apple'
      ? 'Apple'
      : activeProvider === 'google'
      ? 'Google'
      : undefined;
  const authProviderColors = {
    apple: {
      backgroundColor: theme.isDark
        ? 'rgba(255,255,255,0.08)'
        : 'rgba(31,41,51,0.06)',
      borderColor: theme.isDark
        ? 'rgba(255,255,255,0.28)'
        : 'rgba(31,41,51,0.18)',
      foregroundColor: theme.text,
    },
    email: {
      backgroundColor: 'rgba(255,138,61,0.13)',
      borderColor: 'rgba(255,138,61,0.44)',
      foregroundColor: theme.accentWarmForeground,
    },
    google: {
      backgroundColor: 'rgba(66,133,244,0.12)',
      borderColor: theme.isDark
        ? 'rgba(66,133,244,0.42)'
        : 'rgba(26,95,199,0.45)',
      foregroundColor: theme.isDark ? '#4285F4' : '#1A5FC7',
    },
    phone: {
      backgroundColor: 'rgba(68,216,92,0.12)',
      borderColor: 'rgba(68,216,92,0.42)',
      foregroundColor: theme.successForeground,
    },
  };

  useEffect(() => {
    const nextIntent = resolveSignInRouteIntent(route.params);

    setMethod(nextIntent.method);
  }, [route.params]);

  useEffect(() => {
    if (
      onboardingJourney === 'invite' &&
      sessionStatus === 'authenticatedReady'
    ) {
      markOnboardingSeen();
    }
  }, [markOnboardingSeen, onboardingJourney, sessionStatus]);

  const runAuth = async (action: () => Promise<unknown>) => {
    setIsBusy(true);
    try {
      await action();
      return true;
    } catch (error) {
      Alert.alert(failureTitle, getErrorMessage(error));
      return false;
    } finally {
      setIsBusy(false);
    }
  };

  const handleEmail = () => {
    runAuth(() => signInWithEmail(email, password)).catch(() => undefined);
  };

  const handleProviderAuth = async (provider: 'apple' | 'google') => {
    setMethod(undefined);
    setActiveProvider(provider);

    try {
      await runAuth(provider === 'apple' ? signInWithApple : signInWithGoogle);
    } finally {
      setActiveProvider(undefined);
    }
  };

  const handleResetPassword = async () => {
    if (!email.trim()) {
      Alert.alert(
        'Add your email',
        'Enter your email before requesting a reset.',
      );
      return;
    }

    try {
      await sendPasswordReset(email);
      Alert.alert(
        'Reset sent',
        'Check your inbox for the password reset link.',
      );
    } catch (error) {
      Alert.alert('Reset failed', getErrorMessage(error));
    }
  };

  const handlePhoneStart = () => {
    setIsBusy(true);
    startPhoneSignIn(phoneNumber)
      .then(nextConfirmation => {
        setConfirmation(nextConfirmation);
        Alert.alert('Code sent', 'Enter the SMS code to continue.');
      })
      .catch(error => {
        Alert.alert(failureTitle, getErrorMessage(error));
      })
      .finally(() => setIsBusy(false));
  };

  const handlePhoneNumberChange = (nextPhoneNumber: string) => {
    setPhoneNumber(formatPhoneNumberForDisplay(nextPhoneNumber));
  };

  const handlePhoneConfirm = () => {
    if (!confirmation) {
      return;
    }

    runAuth(() => confirmPhoneSignIn(confirmation, smsCode)).catch(
      () => undefined,
    );
  };

  const explainSameEmailProviders = async () => {
    if (!email.trim()) {
      Alert.alert('Add your email', 'Enter an email to check providers.');
      return;
    }

    try {
      const providers = await getSameEmailProviders(email);
      Alert.alert(
        'Provider check',
        providers.length
          ? `Existing providers: ${providers.join(', ')}`
          : 'No existing providers found for that email.',
      );
    } catch (error) {
      Alert.alert('Provider check failed', getErrorMessage(error));
    }
  };

  const selectMethod = (nextMethod: SignInMethod) => {
    setActiveProvider(undefined);
    setMethod(nextMethod);
  };

  const startAccountCreation = () => {
    if (onboardingJourney === 'invite') {
      startInviteOnboarding();
    } else {
      startOnboardingWizard();
    }
    navigation.navigate('Welcome');
  };

  const dismissToGuest = async () => {
    setIsDismissing(true);
    try {
      await continueAsGuestFromAuth({
        clearPendingAction,
        dismissAuth: () => dismissAuthModals(rootNavigation),
        hasAuthenticatedUser: () => Boolean(firebaseAuth().currentUser),
        markOnboardingSeen,
        setGuest,
        signOut: signOutOfHoyst,
      });
    } catch (error) {
      Alert.alert(
        'Could not continue as guest',
        (error as {message?: string}).message ?? 'Try again.',
      );
    } finally {
      setIsDismissing(false);
    }
  };

  return (
    <HoystScreen>
      <View style={styles.topBar}>
        <Pressable
          accessibilityLabel="Continue as guest"
          accessibilityRole="button"
          disabled={isActionBusy}
          hitSlop={8}
          onPress={dismissToGuest}
          style={({pressed}) => [
            styles.closeButton,
            {
              backgroundColor: theme.surfaceSoft,
              borderColor: theme.border,
              opacity: isActionBusy ? 0.42 : pressed ? 0.82 : 1,
            },
          ]}>
          <X color={theme.text} size={21} strokeWidth={2.4} />
        </Pressable>
      </View>
      <View style={styles.header}>
        <HoystText variant="largeTitle">{headerTitle}</HoystText>
        <HoystText tone="muted">{headerBody}</HoystText>
      </View>
      {method === 'email' ? (
        <GlassPanel>
          <View style={styles.formStack}>
            <HoystText variant="title">Email</HoystText>
            <HoystInput
              autoCapitalize="none"
              keyboardType="email-address"
              onChangeText={setEmail}
              placeholder="Email"
              value={email}
            />
            <HoystInput
              onChangeText={setPassword}
              placeholder="Password"
              secureTextEntry
              showSecureTextToggle
              value={password}
            />
            <HoystButton
              label={isActionBusy ? 'Working...' : 'Sign in'}
              onPress={isActionBusy ? undefined : handleEmail}
            />
            <HoystButton
              label="Send password reset"
              onPress={isActionBusy ? undefined : handleResetPassword}
              variant="ghost"
            />
            <HoystButton
              label="Check same-email providers"
              onPress={isActionBusy ? undefined : explainSameEmailProviders}
              variant="ghost"
            />
          </View>
        </GlassPanel>
      ) : null}
      {method === 'phone' ? (
        <GlassPanel>
          <View style={styles.formStack}>
            <HoystText variant="title">Phone</HoystText>
            <HoystInput
              keyboardType="phone-pad"
              onChangeText={handlePhoneNumberChange}
              placeholder="+1 555 000 0000"
              value={phoneNumber}
            />
            {confirmation ? (
              <HoystInput
                keyboardType="number-pad"
                onChangeText={setSmsCode}
                placeholder="SMS code"
                value={smsCode}
              />
            ) : null}
            <HoystButton
              label={
                isActionBusy
                  ? 'Working...'
                  : confirmation
                  ? 'Sign in'
                  : 'Send sign-in code'
              }
              onPress={
                isActionBusy
                  ? undefined
                  : confirmation
                  ? handlePhoneConfirm
                  : handlePhoneStart
              }
            />
          </View>
        </GlassPanel>
      ) : null}
      {activeProviderLabel ? (
        <GlassPanel>
          <View style={styles.formStack}>
            <HoystText variant="title">Opening {activeProviderLabel}</HoystText>
            <HoystText tone="muted">
              Finish in the {activeProviderLabel} sheet to continue.
            </HoystText>
          </View>
        </GlassPanel>
      ) : null}
      <GlassPanel>
        <View style={styles.optionStack}>
          <HoystButton
            backgroundColor={authProviderColors.apple.backgroundColor}
            borderColor={authProviderColors.apple.borderColor}
            icon={
              <Apple
                color={authProviderColors.apple.foregroundColor}
                size={20}
                strokeWidth={2.3}
              />
            }
            label={
              activeProvider === 'apple'
                ? 'Opening Apple...'
                : 'Continue with Apple'
            }
            onPress={
              isActionBusy
                ? undefined
                : () => {
                    handleProviderAuth('apple').catch(() => undefined);
                  }
            }
            textColor={authProviderColors.apple.foregroundColor}
            variant="outline"
          />
          <HoystButton
            backgroundColor={authProviderColors.google.backgroundColor}
            borderColor={authProviderColors.google.borderColor}
            icon={
              <Chrome
                color={authProviderColors.google.foregroundColor}
                size={20}
                strokeWidth={2.3}
              />
            }
            label={
              activeProvider === 'google'
                ? 'Opening Google...'
                : 'Continue with Google'
            }
            onPress={
              isActionBusy
                ? undefined
                : () => {
                    handleProviderAuth('google').catch(() => undefined);
                  }
            }
            textColor={authProviderColors.google.foregroundColor}
            variant="outline"
          />
          {method !== 'email' ? (
            <HoystButton
              backgroundColor={authProviderColors.email.backgroundColor}
              borderColor={authProviderColors.email.borderColor}
              icon={
                <Mail
                  color={authProviderColors.email.foregroundColor}
                  size={20}
                  strokeWidth={2.3}
                />
              }
              label="Continue with Email"
              onPress={isActionBusy ? undefined : () => selectMethod('email')}
              textColor={authProviderColors.email.foregroundColor}
              variant="outline"
            />
          ) : null}
          {method !== 'phone' ? (
            <HoystButton
              backgroundColor={authProviderColors.phone.backgroundColor}
              borderColor={authProviderColors.phone.borderColor}
              icon={
                <Phone
                  color={authProviderColors.phone.foregroundColor}
                  size={20}
                  strokeWidth={2.3}
                />
              }
              label="Continue with Phone"
              onPress={isActionBusy ? undefined : () => selectMethod('phone')}
              textColor={authProviderColors.phone.foregroundColor}
              variant="outline"
            />
          ) : null}
        </View>
        <Pressable onPress={startAccountCreation} style={styles.modeFooter}>
          <HoystText tone="muted" variant="button">
            {onboardingLinkLabel}
          </HoystText>
        </Pressable>
      </GlassPanel>
    </HoystScreen>
  );
}

const styles = StyleSheet.create({
  closeButton: {
    alignItems: 'center',
    borderRadius: radius.pill,
    borderWidth: 1,
    height: 46,
    justifyContent: 'center',
    width: 46,
  },
  header: {
    gap: 10,
  },
  formStack: {
    gap: 12,
  },
  optionStack: {
    gap: 12,
  },
  modeFooter: {
    alignItems: 'center',
    paddingTop: 2,
  },
  topBar: {
    alignItems: 'flex-end',
    paddingTop: 22,
  },
});
