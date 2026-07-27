import React, {useEffect} from 'react';
import {CommonActions} from '@react-navigation/native';
import {Pressable, StyleSheet, View} from 'react-native';
import type {NativeStackScreenProps} from '@react-navigation/native-stack';
import {
  Clock3,
  DoorOpen,
  LogIn,
  RefreshCw,
  UserPlus,
  UsersRound,
  X,
} from 'lucide-react-native';

import {BrandMark} from '../../../design/components/BrandMark';
import {FrostedBackdrop} from '../../../design/components/FrostedBackdrop';
import {GlassPanel} from '../../../design/components/GlassPanel';
import {HoystButton} from '../../../design/components/HoystButton';
import {HoystScreen} from '../../../design/components/HoystScreen';
import {HoystText} from '../../../design/components/HoystText';
import {radius} from '../../../design/tokens/radius';
import {useHoystTheme} from '../../../design/theme/useHoystTheme';
import type {RootStackParamList} from '../../../navigation/types';
import {useOnboardingStore} from '../../../store/onboarding-store';
import {useCircleInviteStore} from '../../../store/circle-invite-store';
import {useSessionStore} from '../../../store/session-store';
import {subscribeToInviteMembership} from '../services/invite-service';

type Props = NativeStackScreenProps<RootStackParamList, 'CircleInvite'>;

function getJoinModeLabel(joinMode: string) {
  if (joinMode === 'request_to_join') {
    return 'Approval required';
  }

  if (joinMode === 'invite_only') {
    return 'Invite only';
  }

  return 'Open to join';
}

function InfoPill({icon, label}: {icon: React.ReactNode; label: string}) {
  const theme = useHoystTheme();

  return (
    <View
      style={[
        styles.infoPill,
        {backgroundColor: theme.surfaceSoft, borderColor: theme.border},
      ]}>
      {icon}
      <HoystText variant="caption">{label}</HoystText>
    </View>
  );
}

export function CircleInviteScreen({
  navigation,
  route,
}: Props): React.JSX.Element {
  const theme = useHoystTheme();
  const status = useSessionStore(state => state.status);
  const user = useSessionStore(state => state.user);
  const beginAuthFlow = useSessionStore(state => state.beginAuthFlow);
  const startInviteOnboarding = useOnboardingStore(
    state => state.startInviteOnboarding,
  );
  const startInviteSignIn = useOnboardingStore(
    state => state.startInviteSignIn,
  );
  const startInviteProfileCompletion = useOnboardingStore(
    state => state.startInviteProfileCompletion,
  );
  const inviteCode = useCircleInviteStore(state => state.inviteCode);
  const preview = useCircleInviteStore(state => state.preview);
  const resolutionStatus = useCircleInviteStore(
    state => state.resolutionStatus,
  );
  const joinStatus = useCircleInviteStore(state => state.joinStatus);
  const errorMessage = useCircleInviteStore(state => state.errorMessage);
  const consented = useCircleInviteStore(state => state.consented);
  const setInviteCode = useCircleInviteStore(state => state.setInviteCode);
  const consentToJoin = useCircleInviteStore(state => state.consentToJoin);
  const retryResolution = useCircleInviteStore(state => state.retryResolution);
  const retryJoin = useCircleInviteStore(state => state.retryJoin);
  const clearInvite = useCircleInviteStore(state => state.clearInvite);

  useEffect(() => {
    setInviteCode(route.params.inviteCode);
  }, [route.params.inviteCode, setInviteCode]);

  useEffect(() => {
    if (
      consented ||
      status !== 'authenticatedReady' ||
      !user?.uid ||
      !preview
    ) {
      return undefined;
    }

    return subscribeToInviteMembership({
      circleId: preview.circleId,
      onStatus: membershipStatus => {
        if (membershipStatus !== 'active' && membershipStatus !== 'pending') {
          return;
        }

        clearInvite();
        navigation.dispatch(
          CommonActions.reset({
            index: 1,
            routes: [
              {name: 'MainTabs'},
              {
                name: 'CircleDetail',
                params: {circleId: preview.circleId},
              },
            ],
          }),
        );
      },
      uid: user.uid,
    });
  }, [clearInvite, consented, navigation, preview, status, user?.uid]);

  const dismissInvite = () => {
    clearInvite();
    if (navigation.canGoBack()) {
      navigation.goBack();
      return;
    }

    navigation.replace('MainTabs', {screen: 'Home'});
  };

  const beginInviteOnboarding = () => {
    consentToJoin();
    startInviteOnboarding();
    beginAuthFlow();
    navigation.navigate('Auth', {screen: 'Welcome'});
  };

  const beginInviteSignIn = () => {
    consentToJoin();
    startInviteSignIn();
    beginAuthFlow();
    navigation.navigate('Auth', {
      params: {entryPoint: 'welcome'},
      screen: 'SignIn',
    });
  };

  const beginInviteProfile = () => {
    consentToJoin();
    startInviteProfileCompletion();
    navigation.navigate('Auth', {screen: 'Welcome'});
  };

  const joinReadyAccount = () => {
    consentToJoin();
  };

  const renderState = () => {
    if (
      resolutionStatus === 'idle' ||
      resolutionStatus === 'loading' ||
      inviteCode !== route.params.inviteCode
    ) {
      return (
        <GlassPanel style={styles.statePanel}>
          <HoystText variant="subtitle">Opening invitation...</HoystText>
          <HoystText tone="muted">
            Loading the Circle details securely.
          </HoystText>
        </GlassPanel>
      );
    }

    if (resolutionStatus === 'unavailable') {
      return (
        <GlassPanel style={styles.statePanel}>
          <HoystText variant="subtitle">Invite no longer available</HoystText>
          <HoystText tone="muted">
            Ask the Circle owner to share a new invitation.
          </HoystText>
          <HoystButton label="Done" onPress={dismissInvite} variant="outline" />
        </GlassPanel>
      );
    }

    if (resolutionStatus === 'error' || !preview) {
      return (
        <GlassPanel style={styles.statePanel}>
          <HoystText variant="subtitle">Could not open invitation</HoystText>
          <HoystText tone="muted">
            {errorMessage ?? 'Check your connection and try again.'}
          </HoystText>
          <HoystButton
            icon={
              <RefreshCw
                color={theme.actionForeground}
                size={18}
                strokeWidth={2.3}
              />
            }
            label="Retry"
            onPress={retryResolution}
          />
        </GlassPanel>
      );
    }

    const joinModeLabel = getJoinModeLabel(preview.joinMode);
    const joinLabel =
      preview.joinMode === 'request_to_join'
        ? 'Request to Join'
        : 'Join Circle';
    const isWorking = consented && joinStatus === 'joining';

    return (
      <>
        <View style={styles.heroCopy}>
          <HoystText tone="muted" variant="label">
            YOU’RE INVITED TO A CIRCLE
          </HoystText>
          <HoystText style={styles.title} variant="largeTitle">
            {preview.title}
          </HoystText>
          <HoystText style={styles.commitment} tone="muted">
            {preview.commitment}
          </HoystText>
        </View>

        <GlassPanel style={styles.overview}>
          <HoystText variant="subtitle">How this Circle works</HoystText>
          <View style={styles.infoGrid}>
            <InfoPill
              icon={
                <Clock3
                  color={theme.accentSecondaryForeground}
                  size={17}
                  strokeWidth={2.3}
                />
              }
              label={preview.cadenceLabel}
            />
            <InfoPill
              icon={
                <UsersRound
                  color={theme.accentSecondaryForeground}
                  size={17}
                  strokeWidth={2.3}
                />
              }
              label={`${preview.memberCount} of ${preview.maxSize} members`}
            />
            <InfoPill
              icon={
                <DoorOpen
                  color={theme.accentSecondaryForeground}
                  size={17}
                  strokeWidth={2.3}
                />
              }
              label={joinModeLabel}
            />
          </View>
          <HoystText tone="muted" variant="caption">
            Members follow the same Commitment and Tap In rhythm. Full Circle
            activity unlocks after you join.
          </HoystText>
        </GlassPanel>

        {errorMessage && joinStatus === 'error' && !preview.isFull ? (
          <GlassPanel style={styles.errorPanel}>
            <HoystText variant="bodyStrong">Join needs another try</HoystText>
            <HoystText tone="muted">{errorMessage}</HoystText>
            <HoystButton label="Retry" onPress={retryJoin} variant="outline" />
          </GlassPanel>
        ) : null}

        <View style={styles.actions}>
          {preview.isFull ? (
            <>
              <HoystButton disabled label="Circle full" />
              <HoystText
                style={styles.centerText}
                tone="muted"
                variant="caption">
                This Circle has reached its current capacity.
              </HoystText>
            </>
          ) : status === 'authenticatedReady' ? (
            <HoystButton
              disabled={isWorking}
              icon={
                <UserPlus
                  color={theme.actionForeground}
                  size={18}
                  strokeWidth={2.3}
                />
              }
              label={isWorking ? 'Joining...' : joinLabel}
              onPress={joinReadyAccount}
            />
          ) : status === 'authenticatedIncompleteProfile' ? (
            <HoystButton
              label="Finish Profile to Join"
              onPress={beginInviteProfile}
            />
          ) : (
            <>
              <HoystButton
                icon={
                  <UserPlus
                    color={theme.onPurpleAccent}
                    size={18}
                    strokeWidth={2.3}
                  />
                }
                label="Create Account to Join"
                onPress={beginInviteOnboarding}
                variant="secondary"
              />
              <HoystButton
                icon={
                  <LogIn
                    color={theme.actionForeground}
                    size={18}
                    strokeWidth={2.3}
                  />
                }
                label="I Already Have an Account"
                onPress={beginInviteSignIn}
                variant="outline"
              />
            </>
          )}
        </View>
      </>
    );
  };

  return (
    <HoystScreen
      background={<FrostedBackdrop />}
      contentContainerStyle={styles.content}>
      <View style={styles.topBar}>
        <BrandMark isDark={theme.isDark} kind="logo" style={styles.logo} />
        <Pressable
          accessibilityLabel="Close invitation"
          accessibilityRole="button"
          hitSlop={8}
          onPress={dismissInvite}
          style={({pressed}) => [
            styles.closeButton,
            {
              backgroundColor: theme.surfaceSoft,
              borderColor: theme.border,
              opacity: pressed ? 0.8 : 1,
            },
          ]}>
          <X color={theme.text} size={21} strokeWidth={2.4} />
        </Pressable>
      </View>
      <View style={styles.stack}>{renderState()}</View>
    </HoystScreen>
  );
}

const styles = StyleSheet.create({
  content: {
    paddingBottom: 70,
  },
  topBar: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  logo: {
    height: 34,
    width: 92,
  },
  closeButton: {
    alignItems: 'center',
    borderRadius: 22,
    borderWidth: 1,
    height: 44,
    justifyContent: 'center',
    width: 44,
  },
  stack: {
    gap: 20,
    paddingTop: 44,
  },
  heroCopy: {
    gap: 12,
  },
  title: {
    letterSpacing: -1.1,
  },
  commitment: {
    fontSize: 18,
    lineHeight: 26,
  },
  overview: {
    gap: 18,
  },
  infoGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  infoPill: {
    alignItems: 'center',
    borderRadius: radius.pill,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 7,
    paddingHorizontal: 12,
    paddingVertical: 9,
  },
  actions: {
    gap: 12,
  },
  centerText: {
    textAlign: 'center',
  },
  statePanel: {
    gap: 16,
  },
  errorPanel: {
    gap: 12,
  },
});
