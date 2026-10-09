import React from 'react';
import {Pressable, StyleSheet, View} from 'react-native';
import {ChevronRight} from 'lucide-react-native';
import type {NativeStackNavigationProp} from '@react-navigation/native-stack';
import type {RootStackParamList} from '../../../navigation/types';
import {useSetupJourneyStore} from '../../../store/setup-journey-store';
import {useSessionStore} from '../../../store/session-store';
import {useOnboardingStore} from '../../../store/onboarding-store';
import {useCircleInviteStore} from '../../../store/circle-invite-store';
import {HoystText} from '../../../design/components/HoystText';
import {useHoystTheme} from '../../../design/theme/useHoystTheme';

export function SetupResumeBanner({
  navigation,
}: {
  navigation?: NativeStackNavigationProp<RootStackParamList>;
}) {
  const theme = useHoystTheme();
  const uid = useSessionStore(state => state.user?.uid);
  const records = useSetupJourneyStore(state => state.records);
  const pending = Object.entries(records).find(
    ([key, record]) =>
      !record.completed &&
      record.step !== 'welcome' &&
      (!record.ownerUid || record.ownerUid === uid) &&
      (!key.startsWith('create:') || key === `create:${uid}`),
  );
  if (!pending) return null;
  const [key, record] = pending;
  return (
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
      style={[
        styles.banner,
        {backgroundColor: theme.surfaceSoft, borderColor: theme.border},
      ]}>
      <View style={styles.flex}>
        <HoystText style={styles.title}>Finish setup</HoystText>
        <HoystText tone="muted" style={styles.copy}>
          {record.selection?.kind === 'circle'
            ? record.selection.circle.title
            : record.draft.title || 'Your starting point is still here.'}
        </HoystText>
      </View>
      <ChevronRight color={theme.accentForeground} size={20} />
    </Pressable>
  );
}
const styles = StyleSheet.create({
  banner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 14,
    borderRadius: 20,
    borderWidth: StyleSheet.hairlineWidth,
  },
  flex: {flex: 1},
  title: {fontSize: 16, lineHeight: 21, fontWeight: '700'},
  copy: {fontSize: 14, lineHeight: 20},
});
