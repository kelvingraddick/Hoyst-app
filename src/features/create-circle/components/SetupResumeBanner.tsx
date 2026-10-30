import React from 'react';
import {
  Alert,
  Pressable,
  StyleSheet,
  useWindowDimensions,
  View,
} from 'react-native';
import {ChevronRight, X} from 'lucide-react-native';
import type {NativeStackNavigationProp} from '@react-navigation/native-stack';
import type {RootStackParamList} from '../../../navigation/types';
import {useSetupJourneyStore} from '../../../store/setup-journey-store';
import {useSessionStore} from '../../../store/session-store';
import {useOnboardingStore} from '../../../store/onboarding-store';
import {useCircleInviteStore} from '../../../store/circle-invite-store';
import {HoystText} from '../../../design/components/HoystText';
import {useHoystTheme} from '../../../design/theme/useHoystTheme';
import {getSystemTheme} from '../../../design/system/tokens';
import {homeTypography} from '../../../design/tokens/home';

export function SetupResumeBanner({
  navigation,
}: {
  navigation?: NativeStackNavigationProp<RootStackParamList>;
}) {
  const theme = useHoystTheme();
  const palette = getSystemTheme(theme.isDark ? 'dark' : 'light');
  const {fontScale} = useWindowDimensions();
  const largeType = fontScale >= 1.5;
  const uid = useSessionStore(state => state.user?.uid);
  const records = useSetupJourneyStore(state => state.records);
  const pending = Object.entries(records).find(
    ([key, record]) =>
      !record.completed &&
      record.step !== 'welcome' &&
      (!record.ownerUid || record.ownerUid === uid) &&
      (!key.startsWith('create:') || key === `create:${uid}`),
  );
  if (!pending) {
    return null;
  }
  const [key, record] = pending;
  const confirmDiscard = () => {
    Alert.alert(
      'Discard this setup?',
      "Your saved setup will be removed. Circles you've already created or joined won't be affected.",
      [
        {text: 'Keep setup', style: 'cancel'},
        {
          text: 'Discard setup',
          style: 'destructive',
          onPress: () => {
            const store = useSetupJourneyStore.getState();
            const current = store.records[key];
            const session = useSessionStore.getState();
            if (
              current?.requestId !== record.requestId ||
              session.user?.uid !== uid
            ) {
              return;
            }
            const onboarding = useOnboardingStore.getState();
            if (onboarding.starterCircleSetupId === current.requestId) {
              if (
                current.pendingAction &&
                session.pendingAction === current.pendingAction
              ) {
                session.clearPendingAction();
              }
              // Prevent the legacy mirror from recreating this discarded draft.
              onboarding.clearStarterCircleSetup();
            }
            const inviteCode = key.startsWith('invite:')
              ? key.slice('invite:'.length)
              : current.selection?.kind === 'circle'
              ? current.selection.inviteCode
              : undefined;
            const invite = useCircleInviteStore.getState();
            if (inviteCode && invite.inviteCode === inviteCode) {
              invite.clearInvite();
            }
            store.discard(key);
          },
        },
      ],
    );
  };
  return (
    <View
      style={[
        styles.banner,
        {backgroundColor: palette.surface, shadowColor: palette.shadow},
      ]}>
      <Pressable
        testID="resume-commitment-setup"
        accessibilityRole="button"
        accessibilityLabel="Finish setup"
        onPress={() => {
          if (key.startsWith('create:')) {
            navigation?.navigate('CreateCircle');
            return;
          }
          const inviteCode =
            record.selection?.kind === 'circle'
              ? record.selection.inviteCode
              : undefined;
          if (inviteCode) {
            useCircleInviteStore.getState().setInviteCode(inviteCode);
            if (record.step !== 'joinPreview')
              useCircleInviteStore.getState().consentToJoin();
          }
          useOnboardingStore.setState({
            hasSeenOnboarding: false,
            hasPendingProfileCompletion: true,
            hasPendingStarterCircleSetup: true,
            starterCircleSetupId: record.requestId,
            journey: inviteCode ? 'invite' : 'standard',
            currentStep: record.step === 'profile' ? 'finishProfile' : 'auth',
          });
          if (record.pendingAction)
            useSessionStore.getState().setPendingAction(record.pendingAction);
          navigation?.navigate('Auth', {
            screen: 'Welcome',
            params: {setupKey: key},
          });
        }}
        style={[styles.resumeTarget, largeType && styles.largeResumeTarget]}>
        <View style={styles.copy}>
          <HoystText style={styles.title}>Finish setup</HoystText>
          <HoystText tone="muted" style={styles.supporting}>
            {record.selection?.kind === 'circle'
              ? record.selection.circle.title
              : record.draft.title || 'Your starting point is still here.'}
          </HoystText>
        </View>
        {/* Remeasure the pill when Dynamic Type changes while Home is open. */}
        <View
          key={fontScale}
          style={[
            styles.resumePill,
            largeType && styles.largeResume,
            {backgroundColor: `${palette.action}12`},
          ]}>
          <HoystText style={[styles.resume, {color: palette.action}]}>
            Resume
          </HoystText>
          <ChevronRight color={palette.action} size={16} />
        </View>
      </Pressable>
      <Pressable
        testID="discard-commitment-setup"
        accessibilityRole="button"
        accessibilityLabel="Discard saved setup"
        accessibilityHint="Opens a confirmation before removing this saved setup."
        onPress={confirmDiscard}
        style={[styles.dismiss, largeType && styles.largeDismiss]}>
        <X color={palette.muted} size={16} />
      </Pressable>
    </View>
  );
}
const styles = StyleSheet.create({
  banner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    minHeight: 76,
    padding: 12,
    borderRadius: 20,
    shadowOffset: {width: 0, height: 4},
    shadowOpacity: 0.04,
    shadowRadius: 10,
    elevation: 1,
  },
  resumeTarget: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    minHeight: 52,
  },
  largeResumeTarget: {alignItems: 'stretch', flexDirection: 'column'},
  dismiss: {
    alignItems: 'center',
    justifyContent: 'center',
    width: 44,
    minHeight: 44,
  },
  largeDismiss: {alignSelf: 'flex-start'},
  copy: {flex: 1, gap: 3, minWidth: 0},
  title: homeTypography.title,
  supporting: homeTypography.secondary,
  resumePill: {
    alignItems: 'center',
    borderRadius: 24,
    flexDirection: 'row',
    gap: 3,
    minHeight: 44,
    paddingHorizontal: 12,
  },
  largeResume: {alignSelf: 'flex-end'},
  resume: homeTypography.action,
});
