import React, {useMemo, useState} from 'react';
import {Alert, StyleSheet, View} from 'react-native';
import type {NativeStackScreenProps} from '@react-navigation/native-stack';

import {GlassPanel} from '../../../design/components/GlassPanel';
import {HoystButton} from '../../../design/components/HoystButton';
import {HoystInput} from '../../../design/components/HoystInput';
import {HoystScreen} from '../../../design/components/HoystScreen';
import {HoystText} from '../../../design/components/HoystText';
import type {AuthStackParamList} from '../../../navigation/types';
import {useOnboardingStore} from '../../../store/onboarding-store';
import {useSessionStore} from '../../../store/session-store';
import {completeProfile, getLocalTimezone} from '../services/account-service';
import {getProfileSignInParams} from '../services/auth-route-intent';
import {
  completeOnboardingSetup,
  shouldCreateStarterCircle,
} from '../services/onboarding-completion';
import {normalizeHandle, validateHandle} from '../services/profile-validation';

type Props = NativeStackScreenProps<AuthStackParamList, 'CompleteProfile'>;

export function CompleteProfileScreen({
  navigation,
}: Props): React.JSX.Element {
  const user = useSessionStore(state => state.user);
  const pendingAction = useSessionStore(state => state.pendingAction);
  const clearPendingAction = useSessionStore(state => state.clearPendingAction);
  const onboardingDisplayName = useOnboardingStore(state => state.displayName);
  const onboardingHandle = useOnboardingStore(state => state.handle);
  const onboardingTimezone = useOnboardingStore(state => state.timezone);
  const firstCircleSkipped = useOnboardingStore(
    state => state.firstCircleSkipped,
  );
  const getOnboardingPreferences = useOnboardingStore(state => state.getPreferences);
  const markOnboardingSeen = useOnboardingStore(state => state.markSeen);
  const clearStarterCircleSetup = useOnboardingStore(
    state => state.clearStarterCircleSetup,
  );
  const prepareStarterCircleSetup = useOnboardingStore(
    state => state.prepareStarterCircleSetup,
  );
  const setFirstCircleSkipped = useOnboardingStore(
    state => state.setFirstCircleSkipped,
  );
  const starterCircleDraft = useOnboardingStore(
    state => state.starterCircleDraft,
  );
  const starterCircleSetupId = useOnboardingStore(
    state => state.starterCircleSetupId,
  );
  const [displayName, setDisplayName] = useState(
    user?.displayName ?? onboardingDisplayName,
  );
  const [handle, setHandle] = useState(onboardingHandle);
  const [avatarUrl, setAvatarUrl] = useState(user?.photoURL ?? '');
  const [timezone, setTimezone] = useState(
    onboardingTimezone || getLocalTimezone(),
  );
  const [circleSetupError, setCircleSetupError] = useState<string>();
  const [profileWasCompleted, setProfileWasCompleted] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const handleValidation = useMemo(() => validateHandle(handle), [handle]);
  const shouldCreateCircle = shouldCreateStarterCircle({
    firstCircleSkipped,
    starterCircleDraft,
  });
  const canSubmit =
    displayName.trim().length > 0 && handleValidation.isValid && !isSaving;

  const onSubmit = async () => {
    if (!canSubmit) {
      if (!handleValidation.isValid) {
        Alert.alert('Handle needs a tweak', handleValidation.message);
      }
      return;
    }

    setIsSaving(true);
    setCircleSetupError(undefined);
    let didCompleteProfile = profileWasCompleted;
    try {
      const onboardingPreferences = getOnboardingPreferences();
      const setupId = shouldCreateCircle
        ? starterCircleSetupId ?? prepareStarterCircleSetup()
        : undefined;
      const result = await completeOnboardingSetup(
        {
          firstCircleSkipped,
          profile: {
            ...(avatarUrl.trim() ? {avatarUrl: avatarUrl.trim()} : {}),
            displayName: displayName.trim(),
            handle: normalizeHandle(handle),
            ...(onboardingPreferences ? {onboardingPreferences} : {}),
            timezone: timezone.trim() || 'UTC',
          },
          starterCircleDraft: {
            ...starterCircleDraft,
            timezone: timezone.trim() || starterCircleDraft.timezone,
          },
          starterCircleSetupId: setupId,
        },
        {
          completeProfile,
          onProfileCompleted: () => {
            didCompleteProfile = true;
            setProfileWasCompleted(true);
          },
        },
      );
      if (result.circleCreated && pendingAction?.type === 'createCircle') {
        clearPendingAction();
      }
      if (result.circleCreated) {
        clearStarterCircleSetup();
      }
      markOnboardingSeen();
    } catch (error) {
      const message =
        (error as {message?: string}).message ??
        'Setup failed. Try again.';

      if (didCompleteProfile && shouldCreateCircle) {
        setCircleSetupError(message);
        return;
      }

      Alert.alert('Could not finish profile', message);
    } finally {
      setIsSaving(false);
    }
  };

  const skipFirstCircleAfterProfile = () => {
    setFirstCircleSkipped(true);
    markOnboardingSeen();
  };

  return (
    <HoystScreen>
      <View style={styles.header}>
        <HoystText variant="largeTitle">Finish your profile</HoystText>
        <HoystText tone="muted">
          Choose the identity your circles will see. Handles are locked once
          saved.
        </HoystText>
      </View>
      <GlassPanel>
        <View style={styles.fieldBlock}>
          <HoystText tone="muted" variant="label">
            Display name
          </HoystText>
          <HoystInput
            autoCapitalize="words"
            onChangeText={setDisplayName}
            placeholder="Your name"
            value={displayName}
          />
        </View>
        <View style={styles.fieldBlock}>
          <HoystText tone="muted" variant="label">
            Handle
          </HoystText>
          <HoystInput
            autoCapitalize="none"
            onChangeText={setHandle}
            placeholder="@handle"
            value={handle}
          />
          {handle.length > 0 && !handleValidation.isValid ? (
            <HoystText tone="danger" variant="caption">
              {handleValidation.message}
            </HoystText>
          ) : null}
        </View>
        <View style={styles.fieldBlock}>
          <HoystText tone="muted" variant="label">
            Timezone
          </HoystText>
          <HoystInput
            autoCapitalize="none"
            onChangeText={setTimezone}
            placeholder="America/New_York"
            value={timezone}
          />
        </View>
        <View style={styles.fieldBlock}>
          <HoystText tone="muted" variant="label">
            Avatar URL
          </HoystText>
          <HoystInput
            autoCapitalize="none"
            onChangeText={setAvatarUrl}
            placeholder="Optional"
            value={avatarUrl}
          />
        </View>
        {shouldCreateCircle ? (
          <View style={styles.fieldBlock}>
            <HoystText tone="muted" variant="label">
              First circle
            </HoystText>
            <HoystText>
              {starterCircleDraft.title.trim()} - {starterCircleDraft.dailyTask.trim()}
            </HoystText>
          </View>
        ) : null}
        {circleSetupError ? (
          <View style={styles.recoveryPanel}>
            <View style={styles.fieldBlock}>
              <HoystText variant="bodyStrong">
                Profile saved. Circle creation needs another try.
              </HoystText>
              <HoystText tone="muted">{circleSetupError}</HoystText>
            </View>
            <HoystButton
              label={isSaving ? 'Retrying...' : 'Retry first circle'}
              onPress={canSubmit ? onSubmit : undefined}
            />
            <HoystButton
              label="Skip first circle"
              onPress={skipFirstCircleAfterProfile}
              variant="ghost"
            />
          </View>
        ) : null}
        <HoystButton
          label={
            isSaving
              ? 'Saving...'
              : shouldCreateCircle
                ? 'Finish setup'
                : 'Complete account'
          }
          onPress={canSubmit ? onSubmit : undefined}
        />
        {!user ? (
          <HoystButton
            label="Back to sign in"
            onPress={() =>
              navigation.navigate('SignIn', getProfileSignInParams())
            }
            variant="ghost"
          />
        ) : null}
      </GlassPanel>
    </HoystScreen>
  );
}

const styles = StyleSheet.create({
  fieldBlock: {
    gap: 8,
  },
  header: {
    gap: 10,
    paddingTop: 18,
  },
  recoveryPanel: {
    gap: 12,
  },
});
