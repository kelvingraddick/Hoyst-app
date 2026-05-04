import React, {useState} from 'react';
import {Alert, StyleSheet, View} from 'react-native';
import type {FirebaseAuthTypes} from '@react-native-firebase/auth';
import type {NativeStackScreenProps} from '@react-navigation/native-stack';

import {GlassPanel} from '../../../design/components/GlassPanel';
import {HoystButton} from '../../../design/components/HoystButton';
import {HoystInput} from '../../../design/components/HoystInput';
import {HoystScreen} from '../../../design/components/HoystScreen';
import {HoystText} from '../../../design/components/HoystText';
import type {AuthStackParamList} from '../../../navigation/types';
import {
  confirmPhoneSignIn,
  getSameEmailProviders,
  registerWithEmail,
  sendPasswordReset,
  signInWithApple,
  signInWithEmail,
  signInWithGoogle,
  startPhoneSignIn,
  type AuthServiceError,
} from '../services/auth-service';

type Props = NativeStackScreenProps<AuthStackParamList, 'SignIn'>;
type EmailMode = 'signIn' | 'register';

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

export function SignInScreen({navigation}: Props): React.JSX.Element {
  const [emailMode, setEmailMode] = useState<EmailMode>('signIn');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [phoneNumber, setPhoneNumber] = useState('');
  const [smsCode, setSmsCode] = useState('');
  const [confirmation, setConfirmation] =
    useState<FirebaseAuthTypes.ConfirmationResult>();
  const [isBusy, setIsBusy] = useState(false);

  const runAuth = async (action: () => Promise<unknown>) => {
    setIsBusy(true);
    try {
      await action();
      navigation.navigate('CompleteProfile');
    } catch (error) {
      Alert.alert('Sign in failed', getErrorMessage(error));
    } finally {
      setIsBusy(false);
    }
  };

  const handleEmail = () => {
    runAuth(async () => {
      if (emailMode === 'register') {
        return registerWithEmail(email, password);
      }

      return signInWithEmail(email, password);
    }).catch(() => undefined);
  };

  const handleResetPassword = async () => {
    if (!email.trim()) {
      Alert.alert('Add your email', 'Enter your email before requesting a reset.');
      return;
    }

    try {
      await sendPasswordReset(email);
      Alert.alert('Reset sent', 'Check your inbox for the password reset link.');
    } catch (error) {
      Alert.alert('Reset failed', getErrorMessage(error));
    }
  };

  const handlePhoneStart = () => {
    setIsBusy(true);
    startPhoneSignIn(phoneNumber)
      .then(nextConfirmation => {
        setConfirmation(nextConfirmation);
        Alert.alert('Code sent', 'Enter the SMS code to finish signing in.');
      })
      .catch(error => {
        Alert.alert('Phone sign in failed', getErrorMessage(error));
      })
      .finally(() => setIsBusy(false));
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

  return (
    <HoystScreen>
      <View style={styles.header}>
        <HoystText variant="largeTitle">Welcome back</HoystText>
        <HoystText tone="muted">
          Sign in or create an account to join circles, Tap In, and manage your
          profile.
        </HoystText>
      </View>
      <GlassPanel>
        <View style={styles.modeRow}>
          <HoystButton
            label="Sign in"
            onPress={() => setEmailMode('signIn')}
            variant={emailMode === 'signIn' ? 'secondary' : 'outline'}
          />
          <HoystButton
            label="Register"
            onPress={() => setEmailMode('register')}
            variant={emailMode === 'register' ? 'secondary' : 'outline'}
          />
        </View>
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
          value={password}
        />
        <HoystButton
          label={isBusy ? 'Working...' : emailMode === 'register' ? 'Create account' : 'Sign in'}
          onPress={isBusy ? undefined : handleEmail}
        />
        <HoystButton
          label="Send password reset"
          onPress={handleResetPassword}
          variant="ghost"
        />
        <HoystButton
          label="Check same-email providers"
          onPress={explainSameEmailProviders}
          variant="ghost"
        />
      </GlassPanel>

      <GlassPanel>
        <HoystText variant="title">Phone</HoystText>
        <HoystInput
          keyboardType="phone-pad"
          onChangeText={setPhoneNumber}
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
          label={confirmation ? 'Confirm code' : 'Send SMS code'}
          onPress={confirmation ? handlePhoneConfirm : handlePhoneStart}
          variant="outline"
        />
      </GlassPanel>

      <GlassPanel>
        <HoystText variant="title">Social</HoystText>
        <HoystButton
          label="Continue with Apple"
          onPress={() => {
            runAuth(signInWithApple).catch(() => undefined);
          }}
          variant="ghost"
        />
        <HoystButton
          label="Continue with Google"
          onPress={() => {
            runAuth(signInWithGoogle).catch(() => undefined);
          }}
          variant="ghost"
        />
      </GlassPanel>
    </HoystScreen>
  );
}

const styles = StyleSheet.create({
  header: {
    gap: 10,
    paddingTop: 18,
  },
  modeRow: {
    flexDirection: 'row',
    gap: 10,
  },
});
