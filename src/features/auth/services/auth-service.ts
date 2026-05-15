import {Platform} from 'react-native';
import appleAuth from '@invertase/react-native-apple-authentication';
import auth from '@react-native-firebase/auth';
import type {FirebaseAuthTypes} from '@react-native-firebase/auth';
import {GoogleSignin} from '@react-native-google-signin/google-signin';

import {env} from '../../../config/env';
import {firebaseAuth} from '../../../lib/firebase/auth';
import {formatPhoneNumberForFirebase} from './phone-number';

export type AuthLinkingRequired = {
  code: 'linking-required';
  email: string;
  providers: string[];
};

export type AuthServiceError = AuthLinkingRequired | {code: string; message: string};

function toAuthServiceError(error: unknown): AuthServiceError {
  const firebaseError = error as {
    code?: string;
    customData?: {email?: string};
    message?: string;
    userInfo?: {email?: string};
  };

  if (firebaseError.code === 'auth/account-exists-with-different-credential') {
    return {
      code: 'linking-required',
      email: firebaseError.userInfo?.email ?? firebaseError.customData?.email ?? '',
      providers: [],
    };
  }

  return {
    code: firebaseError.code ?? 'auth/unknown',
    message: firebaseError.message ?? 'Authentication failed. Try again.',
  };
}

async function toAuthServiceErrorWithProviderHints(
  error: unknown,
): Promise<AuthServiceError> {
  const serviceError = toAuthServiceError(error);

  if (
    serviceError.code !== 'linking-required' ||
    !('email' in serviceError) ||
    !serviceError.email
  ) {
    return serviceError;
  }

  try {
    return {
      ...serviceError,
      providers: await firebaseAuth().fetchSignInMethodsForEmail(
        serviceError.email,
      ),
    };
  } catch {
    return serviceError;
  }
}

async function signInWithCredential(
  credential: FirebaseAuthTypes.AuthCredential,
) {
  try {
    return await firebaseAuth().signInWithCredential(credential);
  } catch (error) {
    throw await toAuthServiceErrorWithProviderHints(error);
  }
}

export async function configureAuthProviders() {
  GoogleSignin.configure({
    iosClientId: env.googleIosClientId || undefined,
    webClientId: env.googleWebClientId || undefined,
  });
}

export async function registerWithEmail(email: string, password: string) {
  try {
    return await firebaseAuth().createUserWithEmailAndPassword(
      email.trim(),
      password,
    );
  } catch (error) {
    throw await toAuthServiceErrorWithProviderHints(error);
  }
}

export async function signInWithEmail(email: string, password: string) {
  try {
    return await firebaseAuth().signInWithEmailAndPassword(email.trim(), password);
  } catch (error) {
    throw await toAuthServiceErrorWithProviderHints(error);
  }
}

export async function sendPasswordReset(email: string) {
  try {
    return await firebaseAuth().sendPasswordResetEmail(email.trim());
  } catch (error) {
    throw await toAuthServiceErrorWithProviderHints(error);
  }
}

export async function startPhoneSignIn(phoneNumber: string) {
  try {
    return await firebaseAuth().signInWithPhoneNumber(
      formatPhoneNumberForFirebase(phoneNumber),
    );
  } catch (error) {
    throw await toAuthServiceErrorWithProviderHints(error);
  }
}

export async function confirmPhoneSignIn(
  confirmation: FirebaseAuthTypes.ConfirmationResult,
  code: string,
) {
  try {
    return await confirmation.confirm(code.trim());
  } catch (error) {
    throw await toAuthServiceErrorWithProviderHints(error);
  }
}

export async function signInWithApple() {
  if (Platform.OS !== 'ios') {
    throw {
      code: 'auth/provider-unavailable',
      message: 'Apple Sign In is available on iOS devices.',
    };
  }

  const response = await appleAuth.performRequest({
    requestedOperation: appleAuth.Operation.LOGIN,
    requestedScopes: [appleAuth.Scope.FULL_NAME, appleAuth.Scope.EMAIL],
  });

  if (!response.identityToken) {
    throw {code: 'auth/missing-token', message: 'Apple did not return a token.'};
  }

  const credential = auth.AppleAuthProvider.credential(
    response.identityToken,
    response.nonce,
  );

  return signInWithCredential(credential);
}

export async function signInWithGoogle() {
  await GoogleSignin.hasPlayServices({showPlayServicesUpdateDialog: true});
  const response = await GoogleSignin.signIn();
  const idToken = response.data?.idToken;

  if (!idToken) {
    throw {code: 'auth/missing-token', message: 'Google did not return a token.'};
  }

  const credential = auth.GoogleAuthProvider.credential(idToken);
  return signInWithCredential(credential);
}

export async function signOutOfHoyst() {
  await GoogleSignin.signOut().catch(() => undefined);
  return firebaseAuth().signOut();
}

export async function getSameEmailProviders(email: string) {
  return firebaseAuth().fetchSignInMethodsForEmail(email.trim());
}
