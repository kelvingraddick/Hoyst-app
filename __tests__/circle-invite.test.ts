jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest/async-storage-mock'),
);

import AsyncStorage from '@react-native-async-storage/async-storage';

import {
  normalizeCircleInviteCode,
  parseCircleInviteUrl,
} from '../src/features/circle-invites/services/invite-url';
import type {CircleInvitePreview} from '../src/features/circle-invites/types';
import {useCircleInviteStore} from '../src/store/circle-invite-store';
import {useOnboardingStore} from '../src/store/onboarding-store';
import {
  buildCircleInvitePreview,
  createInviteCode,
  normalizeInviteCode,
  requiresMatchingCircleInvite,
} from '../functions/src/shared/invite-code';

const preview: CircleInvitePreview = {
  cadenceLabel: 'Daily',
  circleId: 'circle-1',
  commitment: 'Move for 30 minutes',
  isFull: false,
  joinMode: 'invite_only',
  maxSize: 8,
  memberCount: 3,
  title: 'Morning Movers',
};

describe('Circle invite URL parsing', () => {
  it('parses verified web and explicit app links', () => {
    expect(parseCircleInviteUrl('https://hoyst.app/join/AbC123xy')).toBe(
      'abc123xy',
    );
    expect(
      parseCircleInviteUrl('https://HOYST.APP/join/AbC123xy?source=share'),
    ).toBe('abc123xy');
    expect(parseCircleInviteUrl('hoyst://join/AbC123xy')).toBe('abc123xy');
    expect(parseCircleInviteUrl('hoyst:///join/AbC123xy')).toBe('abc123xy');
  });

  it('rejects unrelated hosts, paths, and malformed codes', () => {
    expect(
      parseCircleInviteUrl('https://example.com/join/abc123xy'),
    ).toBeUndefined();
    expect(
      parseCircleInviteUrl('https://hoyst.app/circles/abc123xy'),
    ).toBeUndefined();
    expect(
      parseCircleInviteUrl('https://hoyst.app.evil.example/join/abc123xy'),
    ).toBeUndefined();
    expect(
      parseCircleInviteUrl('https://hoyst.app/join/bad_code'),
    ).toBeUndefined();
    expect(normalizeCircleInviteCode('abc')).toBeUndefined();
  });
});

describe('persisted Circle invite state', () => {
  beforeEach(async () => {
    await AsyncStorage.clear();
    useCircleInviteStore.getState().clearInvite();
    useCircleInviteStore.setState({
      hasCheckedInitialUrl: false,
      hasHydrated: true,
    });
  });

  it('keeps consent and the preview when the same link is delivered twice', () => {
    const store = useCircleInviteStore.getState();

    store.setInviteCode('abc123xy');
    useCircleInviteStore.getState().setResolvedPreview('abc123xy', preview);
    useCircleInviteStore.getState().consentToJoin();
    useCircleInviteStore.getState().setInviteCode('abc123xy');

    expect(useCircleInviteStore.getState()).toMatchObject({
      consented: true,
      inviteCode: 'abc123xy',
      preview,
      resolutionStatus: 'ready',
    });
  });

  it('clears consent and preview when a different invitation arrives', () => {
    const store = useCircleInviteStore.getState();

    store.setInviteCode('abc123xy');
    useCircleInviteStore.getState().setResolvedPreview('abc123xy', preview);
    useCircleInviteStore.getState().consentToJoin();
    useCircleInviteStore.getState().setInviteCode('new12345');

    expect(useCircleInviteStore.getState()).toMatchObject({
      consented: false,
      inviteCode: 'new12345',
      joinStatus: 'idle',
      resolutionStatus: 'idle',
    });
    expect(useCircleInviteStore.getState().preview).toBeUndefined();
  });

  it('preserves the pending invitation through transient join retries', () => {
    const store = useCircleInviteStore.getState();

    store.setInviteCode('abc123xy');
    useCircleInviteStore.getState().setResolvedPreview('abc123xy', preview);
    useCircleInviteStore.getState().consentToJoin();
    useCircleInviteStore.getState().setJoinError('Try again.');
    useCircleInviteStore.getState().retryJoin();

    expect(useCircleInviteStore.getState()).toMatchObject({
      consented: true,
      errorMessage: undefined,
      inviteCode: 'abc123xy',
      joinStatus: 'idle',
      preview,
      resolutionStatus: 'ready',
    });
  });

  it('persists only the invitation needed to continue after relaunch', async () => {
    const store = useCircleInviteStore.getState();

    store.setInviteCode('abc123xy');
    useCircleInviteStore.getState().setResolvedPreview('abc123xy', preview);
    useCircleInviteStore.getState().consentToJoin();
    await new Promise(resolve => setImmediate(resolve));

    const saved = await AsyncStorage.getItem('hoyst-circle-invite-v1');

    expect(saved).toBeTruthy();
    expect(JSON.parse(saved ?? '{}').state).toEqual({
      consented: true,
      inviteCode: 'abc123xy',
      preview,
    });
  });
});

describe('invite onboarding journey', () => {
  beforeEach(() => {
    useOnboardingStore.getState().reset();
    useOnboardingStore.setState({hasHydrated: true});
  });

  it('replaces starter Circle creation with compact invite onboarding', () => {
    useOnboardingStore.getState().startInviteOnboarding();

    expect(useOnboardingStore.getState()).toMatchObject({
      currentStep: 'notifications',
      firstCircleSkipped: true,
      hasPendingStarterCircleSetup: false,
      journey: 'invite',
      starterCircleSetupId: undefined,
    });
  });

  it('routes signed-out and incomplete-profile members to the right step', () => {
    useOnboardingStore.getState().startInviteSignIn();
    expect(useOnboardingStore.getState()).toMatchObject({
      currentStep: 'auth',
      journey: 'invite',
    });

    useOnboardingStore.getState().startInviteProfileCompletion();
    expect(useOnboardingStore.getState()).toMatchObject({
      currentStep: 'finishProfile',
      hasPendingProfileCompletion: true,
      journey: 'invite',
    });
  });

  it('returns to standard onboarding after invite profile completion', () => {
    useOnboardingStore.getState().startInviteProfileCompletion();
    useOnboardingStore.getState().markSeen();

    expect(useOnboardingStore.getState()).toMatchObject({
      hasPendingProfileCompletion: false,
      hasSeenOnboarding: true,
      journey: 'standard',
    });
  });
});

describe('Circle invite backend helpers', () => {
  it('generates cryptographically random lowercase 16-character codes', () => {
    const codes = new Set(Array.from({length: 20}, createInviteCode));

    expect(codes.size).toBe(20);
    for (const code of codes) {
      expect(code).toMatch(/^[a-f0-9]{16}$/);
    }
  });

  it('normalizes legacy codes while rejecting unsafe values', () => {
    expect(normalizeInviteCode(' YIG941R4 ')).toBe('yig941r4');
    expect(normalizeInviteCode('bad_code')).toBeUndefined();
    expect(normalizeInviteCode('short')).toBeUndefined();
  });

  it('returns only the approved limited Circle preview fields', () => {
    expect(
      buildCircleInvitePreview('circle-1', {
        commitment: 'Move for 30 minutes',
        commitmentCadence: 'daily',
        joinMode: 'invite_only',
        maxSize: 8,
        memberCount: 3,
        ownerUid: 'private-owner',
        title: 'Morning Movers',
      }),
    ).toEqual(preview);
  });

  it('requires matching links for private and invite-only Circles', () => {
    expect(
      requiresMatchingCircleInvite({
        joinMode: 'open',
        privacy: 'private',
      }),
    ).toBe(true);
    expect(
      requiresMatchingCircleInvite({
        joinMode: 'invite_only',
        privacy: 'public',
      }),
    ).toBe(true);
    expect(
      requiresMatchingCircleInvite({
        joinMode: 'open',
        privacy: 'public',
      }),
    ).toBe(false);
    expect(
      requiresMatchingCircleInvite({
        joinMode: 'request_to_join',
        privacy: 'public',
      }),
    ).toBe(false);
  });
});
