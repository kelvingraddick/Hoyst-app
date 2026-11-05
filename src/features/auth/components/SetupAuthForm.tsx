import React, {
  useCallback,
  useEffect,
  useRef,
  useState,
  type MutableRefObject,
} from 'react';
import {
  Image,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  View,
} from 'react-native';
import type {FirebaseAuthTypes} from '@react-native-firebase/auth';
import {Apple, ChevronDown, Mail, Phone} from 'lucide-react-native';
import {HoystButton} from '../../../design/components/HoystButton';
import {SetupInput as HoystInput} from '../../create-circle/components/SetupInput';
import {SetupText as HoystText} from '../../create-circle/components/SetupText';
import {useSetupTheme} from '../../create-circle/services/setup-presentation';
import {brandColors} from '../../../design/tokens/colors';
import {radius} from '../../../design/tokens/radius';
import {
  confirmPhoneSignIn,
  registerWithEmail,
  sendPasswordReset,
  signInWithApple,
  signInWithEmail,
  signInWithGoogle,
  startPhoneSignIn,
} from '../services/auth-service';
import {formatPhoneNumberForDisplay} from '../services/phone-number';

import {LegalAcknowledgment} from '../../legal/LegalAcknowledgment';
import {acceptLegalTerms} from '../../legal/policy-service';

export type AuthFormState = {
  title: string;
  message: string;
  emphasis?: readonly string[];
  label: string;
  busy: boolean;
  disabled: boolean;
  error?: string;
  method?: 'email' | 'phone' | 'reset';
};
export type SetupAuthGateway = Partial<{
  confirmPhoneSignIn: typeof confirmPhoneSignIn;
  registerWithEmail: typeof registerWithEmail;
  sendPasswordReset: typeof sendPasswordReset;
  signInWithApple: typeof signInWithApple;
  signInWithEmail: typeof signInWithEmail;
  signInWithGoogle: typeof signInWithGoogle;
  startPhoneSignIn: typeof startPhoneSignIn;
  acceptLegalTerms: typeof acceptLegalTerms;
}>;
export function SetupAuthForm({
  creating,
  actionRef,
  onState,
  initialMethod,
  backRef,
  gateway,
  busyRef,
}: {
  creating: boolean;
  actionRef: MutableRefObject<(() => void) | undefined>;
  onState: (state: AuthFormState) => void;
  initialMethod?: 'email' | 'phone';
  backRef?: MutableRefObject<(() => boolean) | undefined>;
  gateway?: SetupAuthGateway;
  busyRef?: MutableRefObject<boolean>;
}) {
  const theme = useSetupTheme();
  const [method, setMethod] = useState<'email' | 'phone' | 'reset' | undefined>(
    initialMethod,
  );
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [phone, setPhone] = useState('');
  const [country, setCountry] = useState({label: 'US', code: '+1'});
  const [choosingCountry, setChoosingCountry] = useState(false);
  const [code, setCode] = useState('');
  const [confirmation, setConfirmation] =
    useState<FirebaseAuthTypes.ConfirmationResult>();
  const [busy, setBusy] = useState(false);
  const localInFlight = useRef(false);
  const inFlight = busyRef ?? localInFlight;
  const [legalChecked, setLegalChecked] = useState(false);
  const [error, setError] = useState<string>();
  const [resetSent, setResetSent] = useState(false);
  const destination = phone.trim().startsWith('+')
    ? phone
    : `${country.code}${phone.replace(/\D/g, '')}`;
  const phoneDisplay = phone.trim().startsWith('+')
    ? phone
    : `${country.code} ${phone}`;
  const run = useCallback(
    async (
      action: () => Promise<unknown>,
      authenticates = false,
      provider?: 'apple' | 'google',
    ) => {
      if (inFlight.current) return;
      if (creating && method !== 'reset' && !legalChecked) {
        setError('Confirm you are 18 or older and agree to the Terms.');
        return;
      }
      setError(undefined);
      inFlight.current = true;
      setBusy(true);
      try {
        const result = (await action()) as {user?: {uid: string}} | undefined;
        if (creating && legalChecked && authenticates)
          await (gateway?.acceptLegalTerms ?? acceptLegalTerms)(
            result?.user?.uid,
          );
      } catch (failure) {
        const value = failure as {code?: string | number; message?: string};
        const code = String(value.code ?? '');
        if (code === 'auth/cancelled') return;
        setError(
          provider === 'apple' && code === '1000'
            ? 'Apple sign-in couldn’t finish. If prompted, sign in to your Apple Account in iPhone Settings, then try again.'
            : (method === 'email' || method === 'reset') &&
            [
              'auth/invalid-credential',
              'auth/wrong-password',
              'auth/user-not-found',
            ].includes(code)
            ? 'Email or password is incorrect. Try again or reset your password.'
            : code === 'linking-required' ||
              code.includes('account-exists-with-different-credential')
            ? 'This email already uses a different sign-in method. Sign in with that method.'
            : value.message ??
              'Could not continue. Check your details and try again.',
        );
      } finally {
        inFlight.current = false;
        setBusy(false);
      }
    },
    [creating, legalChecked, method, gateway?.acceptLegalTerms, inFlight],
  );
  const label = busy
    ? 'Working...'
    : method === 'reset'
    ? resetSent
      ? 'Back to sign in'
      : 'Send reset link'
    : method === 'email'
    ? creating
      ? 'Create account'
      : 'Sign in'
    : method === 'phone'
    ? confirmation
      ? 'Verify and continue'
      : 'Send code'
    : 'Choose a sign-in method';
  useEffect(() => {
    if (backRef)
      backRef.current = () => {
        if (busy) return true;
        if (method) {
          setMethod(undefined);
          setError(undefined);
          return true;
        }
        return false;
      };
    actionRef.current = () => {
      if (busy || (creating && method !== 'reset' && !legalChecked)) return;
      if (method === 'reset') {
        if (resetSent) {
          setPassword('');
          setMethod('email');
          setResetSent(false);
        } else {
          run(async () => {
            await (gateway?.sendPasswordReset ?? sendPasswordReset)(email);
            setResetSent(true);
          }).catch(() => undefined);
        }
      }
      if (method === 'email')
        run(
          () =>
            creating
              ? (gateway?.registerWithEmail ?? registerWithEmail)(
                  email,
                  password,
                )
              : (gateway?.signInWithEmail ?? signInWithEmail)(email, password),
          true,
        ).catch(() => undefined);
      if (method === 'phone')
        run(async () => {
          if (confirmation)
            return (gateway?.confirmPhoneSignIn ?? confirmPhoneSignIn)(
              confirmation,
              code,
            );
          setConfirmation(
            await (gateway?.startPhoneSignIn ?? startPhoneSignIn)(destination),
          );
          return undefined;
        }, Boolean(confirmation)).catch(() => undefined);
    };
    onState({
      method,
      label,
      busy,
      error,
      disabled:
        busy ||
        (creating && method !== 'reset' && !legalChecked) ||
        !method ||
        (method === 'email'
          ? !email.trim() || password.length < (creating ? 6 : 1)
          : method === 'phone'
          ? confirmation
            ? code.length !== 6
            : !phone.trim()
          : !resetSent && !email.trim()),
      title:
        method === 'reset'
          ? 'Reset your password'
          : method === 'phone'
          ? confirmation
            ? 'Check your messages'
            : 'Continue with your phone'
          : method === 'email'
          ? creating
            ? 'Create your account'
            : 'Sign in with email'
          : creating
          ? 'Give your setup a home'
          : 'Welcome back',
      message:
        method === 'reset'
          ? resetSent
            ? 'Check your inbox for the reset link.'
            : 'Tell me your email and I’ll send you a reset link.'
          : method === 'phone'
          ? confirmation
            ? `Your code is on its way to ${phoneDisplay}.`
            : 'I’ll send you a code so we know it’s you.'
          : creating
          ? 'Your starting point is saved. Let’s give it a home.'
          : 'Pick up where you left off.',
      emphasis:
        method === 'reset'
          ? ['reset link']
          : method === 'phone'
          ? confirmation
            ? [phoneDisplay]
            : ['a code']
          : creating
          ? ['starting point is saved']
          : ['where you left off'],
    });
  }, [
    actionRef,
    busy,
    code,
    confirmation,
    creating,
    email,
    error,
    label,
    method,
    onState,
    password,
    phone,
    phoneDisplay,
    destination,
    backRef,
    resetSent,
    legalChecked,
    run,
    gateway,
  ]);
  const select = (next: 'email' | 'phone' | undefined) => {
    setMethod(next);
    setError(undefined);
  };
  return (
    <View style={styles.stack}>
      {creating && method !== 'reset' ? (
        <LegalAcknowledgment
          checked={legalChecked}
          onChange={setLegalChecked}
          disabled={busy}
        />
      ) : null}
      {!method && (
        <>
          {Platform.OS === 'ios' && (
            <HoystButton
              label="Continue with Apple"
              disabled={busy || (creating && !legalChecked)}
              icon={<Apple color="#FFFFFF" size={20} />}
              backgroundColor="#070B1A"
              textColor="#FFFFFF"
              onPress={() => {
                run(
                  gateway?.signInWithApple ?? signInWithApple,
                  true,
                  'apple',
                ).catch(() => undefined);
              }}
            />
          )}
          <View>
            <HoystButton
              label="Continue with Google"
              icon={
                <Image
                  source={require('../../../assets/auth/google.png')}
                  style={{width: 20, height: 20}}
                />
              }
              disabled={busy || (creating && !legalChecked)}
              backgroundColor={brandColors.white}
              borderColor={brandColors.gray}
              textColor={brandColors.charcoal}
              onPress={() => {
                run(
                  gateway?.signInWithGoogle ?? signInWithGoogle,
                  true,
                  'google',
                ).catch(() => undefined);
              }}
            />
            {/* Keep the stroke above the fill without changing shared button layout. */}
            <View
              pointerEvents="none"
              style={[
                styles.googleBorder,
                busy ? styles.disabledBorder : undefined,
              ]}
            />
          </View>
          <HoystButton
            label="Continue with email"
            disabled={busy}
            backgroundColor={theme.accent}
            borderColor={theme.accent}
            textColor={brandColors.white}
            icon={<Mail color={brandColors.white} size={20} />}
            onPress={() => select('email')}
          />
          <HoystButton
            label="Continue with phone"
            disabled={busy}
            backgroundColor={theme.accent}
            borderColor={theme.accent}
            textColor={brandColors.white}
            icon={<Phone color={brandColors.white} size={20} />}
            onPress={() => select('phone')}
          />
        </>
      )}
      {(method === 'email' || method === 'reset') && (
        <>
          <HoystText style={styles.label}>Email</HoystText>
          <HoystInput
            style={styles.input}
            editable={!busy}
            accessibilityLabel="Email"
            value={email}
            onChangeText={setEmail}
            autoCapitalize="none"
            keyboardType="email-address"
            autoComplete="email"
            textContentType="emailAddress"
          />
        </>
      )}
      {method === 'email' && (
        <>
          <HoystText style={styles.label}>Password</HoystText>
          <HoystInput
            style={styles.input}
            editable={!busy}
            accessibilityLabel="Password"
            value={password}
            onChangeText={setPassword}
            secureTextEntry
            showSecureTextToggle
            autoCapitalize="none"
            textContentType={creating ? 'newPassword' : 'password'}
            autoComplete={creating ? 'new-password' : 'current-password'}
          />
          {creating ? (
            <HoystText tone="muted" style={styles.helper}>
              At least 6 characters
            </HoystText>
          ) : (
            <Pressable
              accessibilityRole="button"
              disabled={busy}
              onPress={() => {
                setMethod('reset');
                setError(undefined);
              }}
              style={styles.touch}>
              <HoystText style={{color: theme.accentForeground}}>
                Forgot password?
              </HoystText>
            </Pressable>
          )}
        </>
      )}
      {method === 'phone' && !confirmation && (
        <>
          <HoystText style={styles.label}>Phone number</HoystText>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Choose phone country code"
            disabled={busy}
            onPress={() => setChoosingCountry(true)}
            style={styles.touch}>
            <View style={{flexDirection: 'row', alignItems: 'center', gap: 8}}>
              <HoystText style={{color: theme.accentForeground}}>
                {country.label} {country.code}
              </HoystText>
              <ChevronDown color={theme.accentForeground} size={16} />
            </View>
          </Pressable>
          <HoystInput
            style={styles.input}
            editable={!busy}
            accessibilityLabel="Phone number"
            placeholder={
              country.code ? '(202) 555-0142' : '+ country code and number'
            }
            value={phone}
            onChangeText={value => setPhone(formatPhoneNumberForDisplay(value))}
            keyboardType="phone-pad"
            textContentType="telephoneNumber"
          />
          <HoystText tone="muted" style={styles.helper}>
            We’ll send a verification code by text.
          </HoystText>
        </>
      )}
      {method === 'phone' && confirmation && (
        <>
          <HoystText style={styles.label}>Verification code</HoystText>
          <HoystInput
            style={styles.input}
            editable={!busy}
            accessibilityLabel="Verification code"
            placeholder="6-digit code"
            value={code}
            onChangeText={value =>
              setCode(value.replace(/\D/g, '').slice(0, 6))
            }
            maxLength={6}
            keyboardType="number-pad"
            textContentType="oneTimeCode"
            autoComplete="sms-otp"
          />
          <Pressable
            accessibilityRole="button"
            disabled={busy}
            onPress={() => {
              setConfirmation(undefined);
              setCode('');
            }}
            style={styles.touch}>
            <HoystText style={{color: theme.accentForeground}}>
              Use a different number
            </HoystText>
          </Pressable>
          <Pressable
            accessibilityRole="button"
            disabled={busy}
            onPress={() => {
              run(async () => {
                setConfirmation(
                  await (gateway?.startPhoneSignIn ?? startPhoneSignIn)(
                    destination,
                  ),
                );
                setCode('');
              }).catch(() => undefined);
            }}
            style={styles.touch}>
            <HoystText style={{color: theme.accentForeground}}>
              Resend code
            </HoystText>
          </Pressable>
        </>
      )}
      {method && (
        <Pressable
          accessibilityRole="button"
          disabled={busy}
          onPress={() => select(undefined)}
          style={styles.touch}>
          <HoystText tone="muted">Use another sign-in method</HoystText>
        </Pressable>
      )}
      <Modal
        visible={choosingCountry}
        transparent
        animationType="slide"
        onRequestClose={() => setChoosingCountry(false)}>
        <View
          style={{
            flex: 1,
            backgroundColor: '#00000060',
            justifyContent: 'flex-end',
          }}>
          <View
            style={{
              backgroundColor: theme.background,
              padding: 22,
              borderTopLeftRadius: 20,
              borderTopRightRadius: 20,
            }}>
            <HoystText variant="title">Choose country code</HoystText>
            <ScrollView>
              {[
                {label: 'US', code: '+1'},
                {label: 'Canada', code: '+1'},
                {label: 'United Kingdom', code: '+44'},
                {label: 'Australia', code: '+61'},
                {label: 'India', code: '+91'},
                {label: 'Other', code: ''},
              ].map(option => (
                <Pressable
                  key={option.label}
                  accessibilityRole="button"
                  onPress={() => {
                    setCountry(option);
                    setPhone('');
                    setChoosingCountry(false);
                  }}
                  style={styles.touch}>
                  <HoystText>
                    {option.label} {option.code}
                  </HoystText>
                </Pressable>
              ))}
            </ScrollView>
            <HoystButton
              label="Cancel"
              variant="ghost"
              onPress={() => setChoosingCountry(false)}
            />
          </View>
        </View>
      </Modal>
    </View>
  );
}
const styles = StyleSheet.create({
  googleBorder: {
    ...StyleSheet.absoluteFillObject,
    borderWidth: 1,
    borderColor: brandColors.gray,
    borderRadius: radius.pill,
  },
  disabledBorder: {opacity: 0.42},
  input: {borderRadius: 12, minHeight: 48, paddingVertical: 12},
  stack: {gap: 12},
  label: {fontSize: 16, lineHeight: 21, fontWeight: '600'},
  helper: {fontSize: 12, lineHeight: 16},
  touch: {minHeight: 44, justifyContent: 'center'},
});
