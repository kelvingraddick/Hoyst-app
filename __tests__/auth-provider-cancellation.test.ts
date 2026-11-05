import {
  signInWithApple,
  signInWithGoogle,
} from '../src/features/auth/services/auth-service';
import appleAuth from '@invertase/react-native-apple-authentication';
import {GoogleSignin} from '@react-native-google-signin/google-signin';
import {firebaseAuth} from '../src/lib/firebase/auth';

jest.mock('../src/config/env', () => ({env: {}}));
jest.mock('../src/lib/firebase/auth', () => ({
  firebaseAuth: jest.fn(() => ({signInWithCredential: jest.fn()})),
}));
jest.mock('@react-native-firebase/auth', () => ({
  AppleAuthProvider: {credential: jest.fn()},
  GoogleAuthProvider: {credential: jest.fn()},
}));
jest.mock('@invertase/react-native-apple-authentication', () => ({
  performRequest: jest.fn(),
  Operation: {LOGIN: 'login'},
  Scope: {FULL_NAME: 'name', EMAIL: 'email'},
  Error: {CANCELED: '1001'},
}));
jest.mock('@react-native-google-signin/google-signin', () => ({
  GoogleSignin: {hasPlayServices: jest.fn(), signIn: jest.fn()},
}));

beforeEach(() => jest.clearAllMocks());

it('distinguishes a cancelled Google picker from a missing authentication token', async () => {
  (GoogleSignin.signIn as jest.Mock).mockResolvedValueOnce({
    type: 'cancelled',
    data: null,
  });
  await expect(signInWithGoogle()).rejects.toMatchObject({
    code: 'auth/cancelled',
  });
  expect(firebaseAuth).not.toHaveBeenCalled();
  (GoogleSignin.signIn as jest.Mock).mockResolvedValueOnce({
    type: 'success',
    data: {},
  });
  await expect(signInWithGoogle()).rejects.toMatchObject({
    code: 'auth/missing-token',
  });
});

it('normalizes Apple cancellation while preserving genuine provider failures', async () => {
  (appleAuth.performRequest as jest.Mock).mockRejectedValueOnce({code: '1001'});
  await expect(signInWithApple()).rejects.toMatchObject({
    code: 'auth/cancelled',
  });
  expect(firebaseAuth).not.toHaveBeenCalled();
  (appleAuth.performRequest as jest.Mock).mockRejectedValueOnce({
    code: '1000',
    message: 'Unavailable',
  });
  await expect(signInWithApple()).rejects.toMatchObject({code: '1000'});
});
