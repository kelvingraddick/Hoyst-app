import React, {useEffect, useMemo, useRef, useState} from 'react';
import {
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  View,
} from 'react-native';
import type {
  NativeStackNavigationProp,
  NativeStackScreenProps,
} from '@react-navigation/native-stack';
import type {FirebaseAuthTypes} from '@react-native-firebase/auth';
import {SafeAreaView} from 'react-native-safe-area-context';
import {
  Apple,
  ArrowLeft,
  BellRing,
  CalendarCheck,
  CalendarDays,
  CalendarRange,
  Chrome,
  Clock3,
  Globe2,
  ImagePlus,
  Mail,
  Phone,
  Shield,
  Share2,
  Sparkles,
  Target,
  UserRound,
  UsersRound,
  X,
  type LucideIcon,
} from 'lucide-react-native';
import {launchImageLibrary} from 'react-native-image-picker';

import {BrandMark} from '../../../design/components/BrandMark';
import {CommitmentTypeIcon} from '../../../design/components/CommitmentTypeVisual';
import {FrostedBackdrop} from '../../../design/components/FrostedBackdrop';
import {GlassPanel} from '../../../design/components/GlassPanel';
import {HoystButton} from '../../../design/components/HoystButton';
import {HoystInput} from '../../../design/components/HoystInput';
import {HoystText} from '../../../design/components/HoystText';
import {HoystTapInMark} from '../../../design/components/HoystTapInMark';
import {LayeredAvatar} from '../../../design/components/LayeredAvatar';
import {SetupProgressBar} from '../../../design/components/SetupProgressBar';
import {useHoystTheme} from '../../../design/theme/useHoystTheme';
import {radius} from '../../../design/tokens/radius';
import {firebaseAuth} from '../../../lib/firebase/auth';
import {requestPushNotificationPermission} from '../../../lib/notifications';
import type {
  AuthStackParamList,
  RootStackParamList,
  SignInMethod,
} from '../../../navigation/types';
import {dismissAuthModals} from '../../../navigation/auth-modal-dismiss';
import {useOnboardingStore} from '../../../store/onboarding-store';
import {useSessionStore} from '../../../store/session-store';
import {useCircleInviteStore} from '../../../store/circle-invite-store';
import {useUserProfileStore} from '../../../store/profile-store';
import {
  getOnboardingProgressSteps,
  type OnboardingOption,
  type OnboardingStep,
} from '../services/onboarding-options';
import {getOnboardingStepCopy} from '../services/onboarding-copy';
import type {
  CommitmentPace,
  CommitmentType,
  CreateCircleDraft,
} from '../../../types/models';
import {TimezonePicker} from '../components/TimezonePicker';
import {normalizeHandle, validateHandle} from '../services/profile-validation';
import {isStarterCircleDraftReady} from '../services/onboarding-circle';
import {
  defaultCommitmentTargetValue,
  defaultMonthlyCommitmentFrequency,
  defaultWeeklyCommitmentFrequency,
  normalizeCommitmentPace,
  normalizeCommitmentFrequency,
  normalizeSkipGraceRule,
} from '../../create-circle/services/create-circle-draft';
import {
  categoryOptions as setupCategoryOptions,
  circleModeOptions as setupCircleModeOptions,
  commitmentPaceOptions as setupCommitmentPaceOptions,
  commitmentTypeOptions as setupCommitmentTypeOptions,
  formatAccessSummary,
  formatPaceSummary,
  formatCommitmentRulesSummary,
  formatSkipSummary,
  formatTimezoneSummary,
  privacyOptions as setupPrivacyOptions,
  publicJoinOptions as setupPublicJoinOptions,
  SetupNumericStepper,
  SetupOptionList,
} from '../../create-circle/components/CommitmentSetupFields';
import {
  confirmPhoneSignIn,
  registerWithEmail,
  signInWithApple,
  signInWithGoogle,
  signOutOfHoyst,
  startPhoneSignIn,
  type AuthServiceError,
} from '../services/auth-service';
import {continueAsGuestFromAuth} from '../services/auth-dismiss';
import {getWelcomeSignInParams} from '../services/auth-route-intent';
import {
  completeProfile,
  uploadProfileAvatar,
} from '../services/account-service';
import {getLocalTimezone} from '../services/timezone-options';
import {
  completeOnboardingSetup,
  shouldCreateStarterCircle,
} from '../services/onboarding-completion';
import {formatPhoneNumberForDisplay} from '../services/phone-number';

type Props = NativeStackScreenProps<AuthStackParamList, 'Welcome'>;

const stepIcons: Record<Exclude<OnboardingStep, 'welcome'>, LucideIcon> = {
  auth: UserRound,
  circleCapacity: UsersRound,
  circleCategory: Target,
  circleCommitment: Target,
  circleGrace: Shield,
  circleMode: UsersRound,
  circlePrivacy: Globe2,
  circleRules: CalendarRange,
  circleReview: Sparkles,
  circleTimezone: Clock3,
  circleTitle: UsersRound,
  coach: Sparkles,
  finishProfile: UserRound,
  notifications: BellRing,
};

const commitmentPaceIcons: Record<CommitmentPace, LucideIcon> = {
  daily: CalendarDays,
  monthly: CalendarCheck,
  weekly: CalendarRange,
};

function getInitialsFromName(name: string) {
  const initials = name
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map(part => part[0]?.toUpperCase() ?? '')
    .join('');

  return initials || 'YO';
}

function getErrorMessage(error: unknown) {
  const serviceError = error as AuthServiceError;

  return 'message' in serviceError
    ? serviceError.message
    : 'Authentication failed. Try again.';
}

function getStarterCirclePaceLabel(draft: CreateCircleDraft) {
  const commitmentPace = normalizeCommitmentPace(
    draft.commitmentCadence,
    draft.commitmentFrequency,
  );
  const commitmentFrequency = normalizeCommitmentFrequency(
    draft.commitmentFrequency,
    commitmentPace,
  );

  return formatPaceSummary(commitmentPace, commitmentFrequency);
}

function useAccentColor(accent: OnboardingOption<string>['accent']) {
  const theme = useHoystTheme();

  if (accent === 'green') {
    return theme.successForeground;
  }

  if (accent === 'orange') {
    return theme.accentWarmForeground;
  }

  if (accent === 'blue') {
    return theme.accentTertiaryForeground;
  }

  return theme.accentSecondaryForeground;
}

function IconButton({
  accessibilityLabel,
  disabled,
  icon: Icon,
  onPress,
}: {
  accessibilityLabel: string;
  disabled?: boolean;
  icon: LucideIcon;
  onPress: () => void;
}) {
  const theme = useHoystTheme();

  return (
    <Pressable
      accessibilityLabel={accessibilityLabel}
      accessibilityRole="button"
      accessibilityState={{disabled: Boolean(disabled)}}
      disabled={disabled}
      hitSlop={8}
      onPress={onPress}
      style={({pressed}) => [
        styles.iconButton,
        {
          backgroundColor: theme.surfaceSoft,
          borderColor: theme.border,
          opacity: disabled ? 0.35 : pressed ? 0.82 : 1,
        },
      ]}>
      <Icon color={theme.text} size={21} strokeWidth={2.4} />
    </Pressable>
  );
}

function ProgressHeader({
  currentStep,
  onBack,
  onClose,
  progressSteps,
}: {
  currentStep: OnboardingStep;
  onBack: () => void;
  onClose: () => void;
  progressSteps: OnboardingStep[];
}) {
  if (currentStep === 'welcome') {
    return null;
  }

  const progressIndex = Math.max(0, progressSteps.indexOf(currentStep));
  return (
    <View style={styles.progressHeader}>
      <IconButton
        accessibilityLabel="Go back"
        disabled={currentStep === 'coach'}
        icon={ArrowLeft}
        onPress={onBack}
      />
      <SetupProgressBar
        current={progressIndex + 1}
        testID="onboarding-setup-progress"
        total={progressSteps.length}
      />
      <IconButton
        accessibilityLabel="Continue as guest"
        icon={X}
        onPress={onClose}
      />
    </View>
  );
}

function CoachPrompt({
  currentStep,
  isInvite,
  isPersonal,
}: {
  currentStep: Exclude<OnboardingStep, 'welcome'>;
  isInvite: boolean;
  isPersonal: boolean;
}) {
  const theme = useHoystTheme();
  const copy = getOnboardingStepCopy(currentStep, isPersonal, isInvite);
  const Icon = stepIcons[currentStep];

  return (
    <View style={styles.coachRow}>
      <View style={styles.coachMark}>
        <HoystTapInMark size={62} testID="onboarding-floating-logo" />
      </View>
      <View
        style={[
          styles.speechBubble,
          {
            backgroundColor: theme.glassSurfaceStrong,
            borderColor: theme.glassBorder,
          },
        ]}>
        <View style={styles.speechHeader}>
          <View
            style={[
              styles.speechIcon,
              {backgroundColor: theme.surfaceSoft, borderColor: theme.border},
            ]}>
            <Icon
              color={theme.accentSecondaryForeground}
              size={17}
              strokeWidth={2.3}
            />
          </View>
          <HoystText variant="label">{copy.title}</HoystText>
        </View>
        <HoystText variant="title">{copy.prompt}</HoystText>
        <HoystText tone="muted">{copy.body}</HoystText>
      </View>
    </View>
  );
}

function PreviewRow({
  accent,
  commitmentType,
  detail,
  icon: Icon,
  label,
}: {
  accent: OnboardingOption<string>['accent'];
  commitmentType?: CommitmentType;
  detail: string;
  icon?: LucideIcon;
  label: string;
}) {
  const theme = useHoystTheme();
  const accentColor = useAccentColor(accent);

  return (
    <View
      style={[
        styles.previewRow,
        {
          backgroundColor: theme.glassSurfaceStrong,
          borderColor: theme.glassBorder,
        },
      ]}>
      <View
        style={[
          styles.previewIcon,
          commitmentType
            ? styles.previewCommitmentIcon
            : {
                backgroundColor: `${accentColor}20`,
                borderColor: `${accentColor}66`,
              },
        ]}>
        {commitmentType ? (
          <CommitmentTypeIcon
            commitmentType={commitmentType}
            decorative
            size={42}
          />
        ) : Icon ? (
          <Icon color={accentColor} size={20} strokeWidth={2.3} />
        ) : null}
      </View>
      <View style={styles.previewCopy}>
        <HoystText variant="label">{label}</HoystText>
        <HoystText tone="muted">{detail}</HoystText>
      </View>
    </View>
  );
}

function StickyCta({
  label,
  onPress,
  secondaryLabel,
  secondaryOnPress,
  disabled,
}: {
  disabled?: boolean;
  label: string;
  onPress: () => void;
  secondaryLabel?: string;
  secondaryOnPress?: () => void;
}) {
  return (
    <GlassPanel padding="compact" style={styles.footer} variant="nav">
      <HoystButton
        disabled={disabled}
        label={label}
        onPress={onPress}
        style={styles.cta}
      />
      {secondaryLabel && secondaryOnPress ? (
        <Pressable onPress={secondaryOnPress} style={styles.secondaryCta}>
          <HoystText tone="muted" variant="button">
            {secondaryLabel}
          </HoystText>
        </Pressable>
      ) : null}
    </GlassPanel>
  );
}

export function WelcomeScreen({navigation}: Props): React.JSX.Element {
  const theme = useHoystTheme();
  const scrollRef = useRef<ScrollView>(null);
  const [authMethod, setAuthMethod] = useState<SignInMethod>();
  const [circleSetupError, setCircleSetupError] = useState<string>();
  const [registrationEmail, setRegistrationEmail] = useState('');
  const [registrationPassword, setRegistrationPassword] = useState('');
  const [registrationPhoneNumber, setRegistrationPhoneNumber] = useState('');
  const [registrationSmsCode, setRegistrationSmsCode] = useState('');
  const [phoneConfirmation, setPhoneConfirmation] =
    useState<FirebaseAuthTypes.ConfirmationResult>();
  const [isBusy, setIsBusy] = useState(false);
  const [isRequestingPushPermission, setIsRequestingPushPermission] =
    useState(false);
  const [profileWasCompleted, setProfileWasCompleted] = useState(false);
  const [selectedAvatarUri, setSelectedAvatarUri] = useState<string>();
  const currentStep = useOnboardingStore(state => state.currentStep);
  const journey = useOnboardingStore(state => state.journey);
  const displayName = useOnboardingStore(state => state.displayName);
  const firstCircleSkipped = useOnboardingStore(
    state => state.firstCircleSkipped,
  );
  const getOnboardingPreferences = useOnboardingStore(
    state => state.getPreferences,
  );
  const handle = useOnboardingStore(state => state.handle);
  const starterCircleDraft = useOnboardingStore(
    state => state.starterCircleDraft,
  );
  const starterCircleSetupId = useOnboardingStore(
    state => state.starterCircleSetupId,
  );
  const timezone = useOnboardingStore(state => state.timezone);
  const clearStarterCircleSetup = useOnboardingStore(
    state => state.clearStarterCircleSetup,
  );
  const clearProfileCompletion = useOnboardingStore(
    state => state.clearProfileCompletion,
  );
  const markSeen = useOnboardingStore(state => state.markSeen);
  const nextStep = useOnboardingStore(state => state.nextStep);
  const prepareStarterCircleSetup = useOnboardingStore(
    state => state.prepareStarterCircleSetup,
  );
  const prepareProfileCompletion = useOnboardingStore(
    state => state.prepareProfileCompletion,
  );
  const previousStep = useOnboardingStore(state => state.previousStep);
  const setCurrentStep = useOnboardingStore(state => state.setCurrentStep);
  const setDisplayName = useOnboardingStore(state => state.setDisplayName);
  const setFirstCircleSkipped = useOnboardingStore(
    state => state.setFirstCircleSkipped,
  );
  const setHandle = useOnboardingStore(state => state.setHandle);
  const setStarterCircleField = useOnboardingStore(
    state => state.setStarterCircleField,
  );
  const setStarterCirclePrivacyMode = useOnboardingStore(
    state => state.setStarterCirclePrivacyMode,
  );
  const setStarterCirclePublicJoinMode = useOnboardingStore(
    state => state.setStarterCirclePublicJoinMode,
  );
  const setTimezone = useOnboardingStore(state => state.setTimezone);
  const clearPendingAction = useSessionStore(state => state.clearPendingAction);
  const setGuest = useSessionStore(state => state.setGuest);
  const status = useSessionStore(state => state.status);
  const user = useSessionStore(state => state.user);
  const profile = useUserProfileStore(state => state.profile);
  const invitePreview = useCircleInviteStore(state => state.preview);
  const rootNavigation =
    navigation.getParent<NativeStackNavigationProp<RootStackParamList>>();
  const handleValidation = useMemo(() => validateHandle(handle), [handle]);
  const shouldCreateCircle = shouldCreateStarterCircle({
    firstCircleSkipped,
    starterCircleDraft,
  });
  const accountAvatarUrl = profile?.avatarUrl ?? user?.photoURL ?? undefined;
  const avatarPreviewUri = selectedAvatarUri ?? accountAvatarUrl;
  const avatarInitials = getInitialsFromName(
    displayName.trim() || profile?.name || user?.displayName || 'You',
  );
  const publicJoinMode =
    starterCircleDraft.joinMode === 'open' ||
    starterCircleDraft.joinMode === 'request_to_join'
      ? starterCircleDraft.joinMode
      : 'request_to_join';
  const isPersonal = starterCircleDraft.circleMode === 'personal';
  const progressSteps =
    journey === 'invite'
      ? (['notifications', 'auth', 'finishProfile'] as OnboardingStep[])
      : getOnboardingProgressSteps(starterCircleDraft.circleMode);
  const starterCircleTitle =
    typeof starterCircleDraft.title === 'string'
      ? starterCircleDraft.title
      : '';
  const starterCircleCommitment =
    typeof starterCircleDraft.commitment === 'string'
      ? starterCircleDraft.commitment
      : '';
  const starterCircleCommitmentPace = normalizeCommitmentPace(
    starterCircleDraft.commitmentCadence,
    starterCircleDraft.commitmentFrequency,
  );
  const starterCircleCommitmentFrequency = normalizeCommitmentFrequency(
    starterCircleDraft.commitmentFrequency,
    starterCircleCommitmentPace,
  );
  const starterCirclePaceLabel = getStarterCirclePaceLabel(starterCircleDraft);
  const StarterCirclePaceIcon = commitmentPaceIcons[starterCircleCommitmentPace];
  const canContinue =
    currentStep === 'circleCategory'
      ? starterCircleDraft.category.trim().length > 0
      : currentStep === 'finishProfile'
      ? displayName.trim().length > 0 &&
        handleValidation.isValid &&
        timezone.trim().length > 0
      : currentStep === 'circleTitle'
      ? starterCircleTitle.trim().length > 0 &&
        starterCircleTitle.trim().length <= 80
      : currentStep === 'circleCommitment'
      ? starterCircleCommitment.trim().length > 0 &&
        starterCircleCommitment.trim().length <= 160
      : currentStep === 'circleCapacity'
      ? starterCircleDraft.maxSize >= 2 && starterCircleDraft.maxSize <= 100
      : currentStep === 'circleTimezone'
      ? starterCircleDraft.timezone.trim().length > 0 &&
        starterCircleDraft.timezone.trim().length <= 80
      : currentStep === 'circleReview'
      ? firstCircleSkipped || isStarterCircleDraftReady(starterCircleDraft)
      : true;

  useEffect(() => {
    scrollRef.current?.scrollTo({animated: false, y: 0});
  }, [currentStep]);
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
    google: {
      backgroundColor: 'rgba(66,133,244,0.12)',
      borderColor: theme.isDark
        ? 'rgba(66,133,244,0.42)'
        : 'rgba(26,95,199,0.45)',
      foregroundColor: theme.isDark ? '#4285F4' : '#1A5FC7',
    },
    email: {
      backgroundColor: 'rgba(255,138,61,0.13)',
      borderColor: 'rgba(255,138,61,0.44)',
      foregroundColor: theme.accentWarmForeground,
    },
    phone: {
      backgroundColor: 'rgba(68,216,92,0.12)',
      borderColor: 'rgba(68,216,92,0.42)',
      foregroundColor: theme.successForeground,
    },
  };

  const continueAsGuest = () => {
    continueAsGuestFromAuth({
      clearPendingAction,
      dismissAuth: () => dismissAuthModals(rootNavigation),
      hasAuthenticatedUser: () => Boolean(firebaseAuth().currentUser),
      markOnboardingSeen: markSeen,
      setGuest,
      signOut: signOutOfHoyst,
    }).catch(error => {
      Alert.alert(
        'Could not continue as guest',
        (error as {message?: string}).message ?? 'Try again.',
      );
    });
  };

  const runProviderAuth = async (provider: 'apple' | 'google') => {
    setIsBusy(true);
    try {
      if (provider === 'apple') {
        await signInWithApple();
      } else {
        await signInWithGoogle();
      }
    } catch (error) {
      Alert.alert('Sign in failed', getErrorMessage(error));
    } finally {
      setIsBusy(false);
    }
  };

  const selectRegistrationMethod = (nextMethod: SignInMethod) => {
    setAuthMethod(nextMethod);

    setPhoneConfirmation(undefined);
    setRegistrationSmsCode('');
  };

  const handleRegistrationPhoneNumberChange = (nextPhoneNumber: string) => {
    setRegistrationPhoneNumber(formatPhoneNumberForDisplay(nextPhoneNumber));
  };

  const registerWithEmailFromOnboarding = async () => {
    if (!registrationEmail.trim() || !registrationPassword) {
      Alert.alert(
        'Add your email',
        'Enter your email and password before creating an account.',
      );
      return;
    }

    setIsBusy(true);
    prepareProfileCompletion();
    setCurrentStep('finishProfile');
    try {
      await registerWithEmail(registrationEmail, registrationPassword);
    } catch (error) {
      clearProfileCompletion();
      setCurrentStep('auth');
      Alert.alert('Registration failed', getErrorMessage(error));
    } finally {
      setIsBusy(false);
    }
  };

  const sendRegistrationCode = async () => {
    if (!registrationPhoneNumber.trim()) {
      Alert.alert('Add your phone number', 'Enter your phone number first.');
      return;
    }

    setIsBusy(true);
    try {
      const nextConfirmation = await startPhoneSignIn(registrationPhoneNumber);
      setPhoneConfirmation(nextConfirmation);
      Alert.alert('Code sent', 'Enter the SMS code to continue.');
    } catch (error) {
      Alert.alert('Registration failed', getErrorMessage(error));
    } finally {
      setIsBusy(false);
    }
  };

  const confirmRegistrationCode = async () => {
    if (!phoneConfirmation || !registrationSmsCode.trim()) {
      Alert.alert('Add the SMS code', 'Enter the code from the text message.');
      return;
    }

    setIsBusy(true);
    prepareProfileCompletion();
    setCurrentStep('finishProfile');
    try {
      await confirmPhoneSignIn(phoneConfirmation, registrationSmsCode);
    } catch (error) {
      clearProfileCompletion();
      setCurrentStep('auth');
      Alert.alert('Registration failed', getErrorMessage(error));
    } finally {
      setIsBusy(false);
    }
  };

  const hasPendingStarterCircleSetup = useOnboardingStore(
    state => state.hasPendingStarterCircleSetup,
  );

  useEffect(() => {
    if (
      (status === 'authenticatedIncompleteProfile' ||
        (status === 'authenticatedReady' && hasPendingStarterCircleSetup)) &&
      currentStep === 'auth'
    ) {
      if (status === 'authenticatedIncompleteProfile') {
        prepareProfileCompletion();
      }
      setCurrentStep('finishProfile');
    }
  }, [
    currentStep,
    hasPendingStarterCircleSetup,
    prepareProfileCompletion,
    setCurrentStep,
    status,
  ]);

  useEffect(() => {
    if (
      status === 'authenticatedReady' &&
      currentStep === 'auth' &&
      !hasPendingStarterCircleSetup
    ) {
      markSeen();
    }
  }, [currentStep, hasPendingStarterCircleSetup, markSeen, status]);

  useEffect(() => {
    if (
      (status !== 'authenticatedIncompleteProfile' &&
        status !== 'authenticatedReady') ||
      currentStep !== 'finishProfile'
    ) {
      return;
    }

    if (!displayName.trim()) {
      setDisplayName(profile?.name ?? user?.displayName ?? '');
    }

    if (!handle.trim() && profile?.handle) {
      setHandle(profile.handle);
    }

    if (!timezone.trim()) {
      setTimezone(profile?.timezone ?? getLocalTimezone());
    }
  }, [
    currentStep,
    displayName,
    handle,
    profile?.handle,
    profile?.name,
    profile?.timezone,
    setDisplayName,
    setHandle,
    setTimezone,
    status,
    timezone,
    user?.displayName,
  ]);

  const submitFinishProfile = async () => {
    if (!canContinue) {
      if (!handleValidation.isValid) {
        Alert.alert('Handle needs a tweak', handleValidation.message);
      }
      return;
    }

    setIsBusy(true);
    setCircleSetupError(undefined);
    let didCompleteProfile = profileWasCompleted;

    try {
      const normalizedHandle = normalizeHandle(handle);
      const onboardingPreferences = getOnboardingPreferences();
      const setupId = shouldCreateCircle
        ? starterCircleSetupId ?? prepareStarterCircleSetup()
        : undefined;
      if (selectedAvatarUri && !user?.uid) {
        throw new Error('Sign in is required to upload your avatar.');
      }
      const avatarUrl =
        selectedAvatarUri && user?.uid
          ? await uploadProfileAvatar({
              uid: user.uid,
              uri: selectedAvatarUri,
            })
          : accountAvatarUrl;

      setHandle(normalizedHandle);

      const result = await completeOnboardingSetup(
        {
          firstCircleSkipped,
          profile: {
            ...(avatarUrl ? {avatarUrl} : {}),
            displayName: displayName.trim(),
            handle: normalizedHandle,
            ...(onboardingPreferences ? {onboardingPreferences} : {}),
            timezone: timezone.trim() || getLocalTimezone(),
          },
          starterCircleDraft,
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

      clearPendingAction();

      if (result.circleCreated) {
        clearStarterCircleSetup();
      }

      markSeen();
    } catch (error) {
      const message =
        (error as {message?: string}).message ?? 'Setup failed. Try again.';

      if (didCompleteProfile && shouldCreateCircle) {
        setCircleSetupError(message);
        return;
      }

      Alert.alert('Could not finish profile', message);
    } finally {
      setIsBusy(false);
    }
  };

  const skipFirstCircleAfterProfile = () => {
    setFirstCircleSkipped(true);
    clearPendingAction();
    markSeen();
  };

  const goNext = () => {
    if (!canContinue) {
      return;
    }

    if (
      currentStep === 'circleReview' &&
      isStarterCircleDraftReady(starterCircleDraft)
    ) {
      prepareStarterCircleSetup();
    }

    nextStep();
  };

  const selectStarterCommitmentType = (commitmentType: CommitmentType) => {
    setStarterCircleField('commitmentType', commitmentType);
    if (commitmentType === 'build' && starterCircleDraft.targetValue == null) {
      setStarterCircleField('targetValue', defaultCommitmentTargetValue);
    }
    if (commitmentType === 'limit') {
      setStarterCircleField(
        'maximumValue',
        starterCircleDraft.maximumValue ??
          starterCircleDraft.targetValue ??
          defaultCommitmentTargetValue,
      );
    }
    if (commitmentType === 'avoid') {
      setStarterCircleField('minimumValue', undefined);
      setStarterCircleField('maximumValue', undefined);
      setStarterCircleField('targetValue', defaultCommitmentTargetValue);
    }
  };

  const setStarterQuantityField = (
    key: 'maximumValue' | 'minimumValue' | 'targetValue',
    value: string,
  ) => {
    const parsedValue = Number.parseInt(value, 10);
    setStarterCircleField(
      key,
      Number.isFinite(parsedValue) && parsedValue >= 0 ? parsedValue : 0,
    );
  };

  const setStarterSkipRule = (nextRule: {
    allowance?: number;
    windowDays?: number;
  }) => {
    setStarterCircleField('graceRules', {
      skip: normalizeSkipGraceRule({
        ...starterCircleDraft.graceRules.skip,
        ...nextRule,
      }),
    });
  };

  const selectStarterCirclePace = (commitmentPace: CommitmentPace) => {
    setStarterCircleField('commitmentCadence', commitmentPace);
    setStarterCircleField(
      'commitmentFrequency',
      commitmentPace === 'daily'
        ? {tapInsPerWeek: 7}
        : commitmentPace === 'monthly'
        ? defaultMonthlyCommitmentFrequency
        : starterCircleCommitmentFrequency.tapInsPerWeek >= 7
        ? defaultWeeklyCommitmentFrequency
        : starterCircleCommitmentFrequency,
    );
  };

  const setStarterCircleWeeklyTapIns = (tapInsPerWeek: number) => {
    setStarterCircleField('commitmentCadence', 'weekly');
    setStarterCircleField(
      'commitmentFrequency',
      normalizeCommitmentFrequency({tapInsPerWeek}, 'weekly'),
    );
  };

  const setStarterCircleMonthlyTapIns = (opportunitiesPerPeriod: number) => {
    setStarterCircleField('commitmentCadence', 'monthly');
    setStarterCircleField(
      'commitmentFrequency',
      normalizeCommitmentFrequency(
        {
          opportunitiesPerPeriod,
          tapInsPerWeek: Math.min(7, opportunitiesPerPeriod),
        },
        'monthly',
      ),
    );
  };

  const continueFromNotifications = async (
    shouldRequestPermission: boolean,
  ) => {
    if (isRequestingPushPermission) {
      return;
    }

    if (!shouldRequestPermission) {
      nextStep();
      return;
    }

    setIsRequestingPushPermission(true);
    await requestPushNotificationPermission().catch(() => undefined);
    setIsRequestingPushPermission(false);
    nextStep();
  };

  const chooseProfileAvatar = async () => {
    const response = await launchImageLibrary({
      mediaType: 'photo',
      quality: 0.8,
      selectionLimit: 1,
    });

    if (response.errorMessage) {
      Alert.alert('Could not choose photo', response.errorMessage);
      return;
    }

    const uri = response.assets?.[0]?.uri;
    if (uri) {
      setSelectedAvatarUri(uri);
    }
  };

  const goBack = () => {
    if (journey === 'invite') {
      if (currentStep === 'finishProfile') {
        setCurrentStep('auth');
        return;
      }

      if (currentStep === 'auth') {
        setCurrentStep('notifications');
        return;
      }

      if (currentStep === 'notifications') {
        continueAsGuest();
        return;
      }
    }

    if (currentStep === 'finishProfile') {
      setCurrentStep('notifications');
      return;
    }

    previousStep();
  };

  const renderContent = () => {
    if (currentStep === 'welcome') {
      return (
        <View style={styles.welcomeBody}>
          <BrandMark isDark={theme.isDark} kind="logo" style={styles.logo} />
          <View style={styles.heroMark}>
            <HoystTapInMark size={104} testID="welcome-floating-logo" />
          </View>
          <View style={styles.heroCopy}>
            <HoystText style={styles.heroTitle} variant="largeTitle">
              Consistency feels lighter with the right support.
            </HoystText>
            <HoystText style={styles.heroText} tone="muted">
              Set a Pace, explore public Circles, and create an account
              only when you are ready to join or Tap In.
            </HoystText>
          </View>
        </View>
      );
    }

    return (
      <>
        {journey === 'invite' && invitePreview ? (
          <GlassPanel style={styles.inviteSummary}>
            <HoystText
              style={{color: theme.accentSecondaryForeground}}
              variant="label">
              INVITED CIRCLE
            </HoystText>
            <HoystText variant="subtitle">{invitePreview.title}</HoystText>
            <HoystText tone="muted">{invitePreview.commitment}</HoystText>
            <HoystText tone="muted" variant="caption">
              {invitePreview.cadenceLabel} · {invitePreview.memberCount} of{' '}
              {invitePreview.maxSize} Members
            </HoystText>
          </GlassPanel>
        ) : null}
        <CoachPrompt
          currentStep={currentStep}
          isInvite={journey === 'invite'}
          isPersonal={isPersonal}
        />
        {currentStep === 'coach' ? (
          <View style={styles.coachPreview}>
            <PreviewRow
              accent="green"
              detail="Pick the promise you want accountability around."
              icon={Target}
              label="Step one"
            />
            <PreviewRow
              accent="orange"
              detail="Choose Personal commitment or Create a circle, or skip setup for now."
              icon={Clock3}
              label="Step two"
            />
            <PreviewRow
              accent="purple"
              detail="Create an account, then finish your profile."
              icon={UsersRound}
              label="Step three"
            />
          </View>
        ) : null}
        {currentStep === 'finishProfile' ? (
          <View style={styles.profileFields}>
            <View
              style={[
                styles.avatarPanel,
                {backgroundColor: theme.surface, borderColor: theme.border},
              ]}>
              <LayeredAvatar
                imageSource={
                  avatarPreviewUri ? {uri: avatarPreviewUri} : undefined
                }
                initials={avatarInitials}
                size={72}
                state="done"
              />
              <View style={styles.avatarCopy}>
                <HoystText variant="bodyStrong">Profile photo</HoystText>
                <HoystText tone="muted">
                  Use your account photo or add one for your Hoyst profile.
                </HoystText>
                <View style={styles.avatarActions}>
                  <HoystButton
                    icon={
                      <ImagePlus
                        color={theme.accentSecondaryForeground}
                        size={18}
                        strokeWidth={2.3}
                      />
                    }
                    label={avatarPreviewUri ? 'Change photo' : 'Add photo'}
                    backgroundColor={theme.surfaceHigh}
                    borderColor={theme.borderStrong}
                    onPress={() => {
                      chooseProfileAvatar().catch(error => {
                        Alert.alert(
                          'Could not choose photo',
                          (error as {message?: string}).message ?? 'Try again.',
                        );
                      });
                    }}
                    textColor={theme.text}
                    variant="outline"
                  />
                  {selectedAvatarUri ? (
                    <HoystButton
                      label={
                        accountAvatarUrl ? 'Use account photo' : 'Clear photo'
                      }
                      onPress={() => setSelectedAvatarUri(undefined)}
                      variant="ghost"
                    />
                  ) : null}
                </View>
              </View>
            </View>
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
                placeholder="@daily_kelvin"
                value={handle}
              />
              {handle.length > 0 && !handleValidation.isValid ? (
                <HoystText tone="danger" variant="caption">
                  {handleValidation.message}
                </HoystText>
              ) : null}
            </View>
            <TimezonePicker onChange={setTimezone} value={timezone} />
            {shouldCreateCircle ? (
              <View style={styles.fieldBlock}>
                <HoystText tone="muted" variant="label">
                  {isPersonal ? 'Personal commitment' : 'First Circle'}
                </HoystText>
                <HoystText variant="bodyStrong">
                  {isPersonal
                    ? starterCircleCommitment.trim()
                    : starterCircleTitle.trim()}
                </HoystText>
                {!isPersonal ? (
                  <HoystText tone="muted">
                    {starterCircleCommitment.trim()}
                  </HoystText>
                ) : null}
                <HoystText tone="muted">{starterCirclePaceLabel}</HoystText>
              </View>
            ) : null}
            {circleSetupError ? (
              <View style={styles.recoveryPanel}>
                <View style={styles.fieldBlock}>
                  <HoystText variant="bodyStrong">
                    Profile saved. Commitment setup needs another try.
                  </HoystText>
                  <HoystText tone="muted">{circleSetupError}</HoystText>
                </View>
                <HoystButton
                  label={isBusy ? 'Retrying...' : 'Retry setup'}
                  onPress={
                    canContinue && !isBusy ? submitFinishProfile : undefined
                  }
                />
                <HoystButton
                  label="Skip for now"
                  onPress={skipFirstCircleAfterProfile}
                  variant="ghost"
                />
              </View>
            ) : null}
          </View>
        ) : null}
        {currentStep === 'circleTitle' ? (
          <View style={styles.fieldBlock}>
            <HoystText tone="muted" variant="label">
              Circle name
            </HoystText>
            <HoystInput
              autoCapitalize="words"
              maxLength={80}
              onChangeText={value => setStarterCircleField('title', value)}
              placeholder="The 5AM Vanguard"
              value={starterCircleTitle}
            />
            <HoystText
              tone={canContinue ? 'muted' : 'danger'}
              variant="caption">
              {starterCircleTitle.trim().length}/80 characters
            </HoystText>
          </View>
        ) : null}
        {currentStep === 'circleCommitment' ? (
          <View style={styles.fieldBlock}>
            <HoystText tone="muted" variant="label">
              Commitment statement
            </HoystText>
            <HoystInput
              maxLength={160}
              multiline
              numberOfLines={4}
              onChangeText={value => setStarterCircleField('commitment', value)}
              placeholder="Read 20 pages, then Tap In with one takeaway."
              style={styles.textArea}
              textAlignVertical="top"
              value={starterCircleCommitment}
            />
            <HoystText
              tone={canContinue ? 'muted' : 'danger'}
              variant="caption">
              {starterCircleCommitment.trim().length}/160 characters
            </HoystText>
          </View>
        ) : null}
        {currentStep === 'circleMode' ? (
          <SetupOptionList
            onSelect={value => setStarterCircleField('circleMode', value)}
            options={setupCircleModeOptions}
            selected={starterCircleDraft.circleMode}
          />
        ) : null}
        {currentStep === 'circleCategory' ? (
          <SetupOptionList
            onSelect={value => setStarterCircleField('category', value)}
            options={setupCategoryOptions}
            selected={starterCircleDraft.category}
          />
        ) : null}
        {currentStep === 'circleRules' ? (
          <View style={styles.stack}>
            <SetupOptionList
              onSelect={selectStarterCommitmentType}
              options={setupCommitmentTypeOptions}
              selected={starterCircleDraft.commitmentType}
            />
            {starterCircleDraft.commitmentType !== 'avoid' ? (
              <GlassPanel style={styles.rulePanel}>
                <HoystText variant="bodyStrong">
                  {starterCircleDraft.commitmentType === 'limit'
                    ? 'Goal range'
                    : 'Goal value'}
                </HoystText>
                {starterCircleDraft.commitmentType === 'build' ? (
                  <View style={styles.fieldBlock}>
                    <HoystText tone="muted" variant="label">
                      Goal value
                    </HoystText>
                    <HoystInput
                      keyboardType="number-pad"
                      onChangeText={value =>
                        setStarterQuantityField('targetValue', value)
                      }
                      value={`${starterCircleDraft.targetValue ?? 1}`}
                    />
                  </View>
                ) : (
                  <>
                    <View style={styles.fieldBlock}>
                      <HoystText tone="muted" variant="label">
                        Minimum amount
                      </HoystText>
                      <HoystInput
                        keyboardType="number-pad"
                        onChangeText={value =>
                          setStarterQuantityField('minimumValue', value)
                        }
                        value={`${starterCircleDraft.minimumValue ?? 0}`}
                      />
                    </View>
                    <View style={styles.fieldBlock}>
                      <HoystText tone="muted" variant="label">
                        Maximum amount
                      </HoystText>
                      <HoystInput
                        keyboardType="number-pad"
                        onChangeText={value =>
                          setStarterQuantityField('maximumValue', value)
                        }
                        value={`${
                          starterCircleDraft.maximumValue ??
                          starterCircleDraft.targetValue ??
                          1
                        }`}
                      />
                    </View>
                  </>
                )}
                <View style={styles.fieldBlock}>
                  <HoystText tone="muted" variant="label">
                    Unit label
                  </HoystText>
                  <HoystInput
                    maxLength={32}
                    onChangeText={value =>
                      setStarterCircleField('unitLabel', value)
                    }
                    placeholder="pages, glasses, minutes"
                    value={starterCircleDraft.unitLabel}
                  />
                </View>
              </GlassPanel>
            ) : (
              <HoystText tone="muted">
                {isPersonal
                  ? 'Avoid Commitments stay binary. Tap In once to confirm you stayed clear.'
                  : 'Avoid Circles stay binary. Each Member taps in once to confirm they stayed clear.'}
              </HoystText>
            )}
            <SetupOptionList
              onSelect={selectStarterCirclePace}
              options={setupCommitmentPaceOptions}
              selected={starterCircleCommitmentPace}
            />
            {starterCircleCommitmentPace === 'weekly' ? (
              <>
                <SetupNumericStepper
                  label="Tap Ins per week"
                  max={7}
                  min={1}
                  onChange={setStarterCircleWeeklyTapIns}
                  value={starterCircleCommitmentFrequency.tapInsPerWeek}
                />
                <HoystText tone="muted">
                  {isPersonal
                    ? 'You Tap In this many days from Monday to Sunday in this Commitment timezone.'
                    : 'Each Member taps in this many days from Monday to Sunday in the Circle timezone.'}
                </HoystText>
              </>
            ) : starterCircleCommitmentPace === 'monthly' ? (
              <>
                <SetupNumericStepper
                  label="Tap Ins per month"
                  max={31}
                  min={1}
                  onChange={setStarterCircleMonthlyTapIns}
                  value={
                    starterCircleCommitmentFrequency.opportunitiesPerPeriod ??
                    starterCircleCommitmentFrequency.tapInsPerWeek
                  }
                />
                <HoystText tone="muted">
                  Hoyst spaces these Opportunities across the month so future
                  Opportunities stay upcoming.
                </HoystText>
              </>
            ) : (
              <HoystText tone="muted">
                {isPersonal
                  ? 'You Tap In or Skip once each day. Your Progress resets at midnight in this Commitment timezone.'
                  : 'Each Member taps in or Skips once each day. Circle Progress resets at midnight in the Circle timezone.'}
              </HoystText>
            )}
          </View>
        ) : null}
        {currentStep === 'circleGrace' ? (
          <View style={styles.stack}>
            <Pressable
              accessibilityRole="switch"
              accessibilityState={{
                checked: starterCircleDraft.graceRules.skip.allowance > 0,
              }}
              onPress={() =>
                setStarterSkipRule({
                  allowance:
                    starterCircleDraft.graceRules.skip.allowance > 0 ? 0 : 1,
                })
              }
              style={({pressed}) => [
                styles.toggleRow,
                {
                  backgroundColor: theme.glassSurfaceStrong,
                  borderColor:
                    starterCircleDraft.graceRules.skip.allowance > 0
                      ? theme.warningForeground
                      : theme.glassBorder,
                  opacity: pressed ? 0.88 : 1,
                },
              ]}>
              <View style={styles.optionCopy}>
                <HoystText variant="bodyStrong">
                  Optional Skips protect Progress
                </HoystText>
                <HoystText tone="muted">
                  {isPersonal
                    ? 'Skips count as covered for your Progress.'
                    : 'Skips count as covered for Circle Progress.'}
                </HoystText>
              </View>
              <HoystText variant="bodyStrong">
                {starterCircleDraft.graceRules.skip.allowance > 0
                  ? 'On'
                  : 'Off'}
              </HoystText>
            </Pressable>
            <SetupNumericStepper
              label="Skips allowed"
              max={30}
              min={0}
              onChange={allowance => setStarterSkipRule({allowance})}
              value={starterCircleDraft.graceRules.skip.allowance}
            />
            <SetupNumericStepper
              label="Window days"
              max={365}
              min={1}
              onChange={windowDays => setStarterSkipRule({windowDays})}
              value={starterCircleDraft.graceRules.skip.windowDays}
            />
          </View>
        ) : null}
        {currentStep === 'circlePrivacy' ? (
          <View style={styles.optionStack}>
            <SetupOptionList
              onSelect={setStarterCirclePrivacyMode}
              options={setupPrivacyOptions}
              selected={starterCircleDraft.privacyMode}
            />
            {starterCircleDraft.privacyMode === 'public' ? (
              <View style={styles.nestedOptionStack}>
                <HoystText tone="muted" variant="label">
                  Public join rule
                </HoystText>
                <SetupOptionList
                  onSelect={setStarterCirclePublicJoinMode}
                  options={setupPublicJoinOptions}
                  selected={publicJoinMode}
                />
              </View>
            ) : null}
          </View>
        ) : null}
        {currentStep === 'circleCapacity' ? (
          <View style={styles.stack}>
            <SetupNumericStepper
              label="Maximum Members"
              max={100}
              min={2}
              onChange={value => setStarterCircleField('maxSize', value)}
              value={starterCircleDraft.maxSize}
            />
            <View style={styles.sizePresets}>
              {[2, 5, 10, 25, 100].map(size => (
                <Pressable
                  accessibilityRole="button"
                  key={size}
                  onPress={() => setStarterCircleField('maxSize', size)}
                  style={({pressed}) => [
                    styles.presetButton,
                    {
                      backgroundColor:
                        starterCircleDraft.maxSize === size
                          ? `${theme.accentSecondaryForeground}24`
                          : theme.glassSurfaceStrong,
                      borderColor:
                        starterCircleDraft.maxSize === size
                          ? theme.accentSecondaryForeground
                          : theme.glassBorder,
                      opacity: pressed ? 0.86 : 1,
                    },
                  ]}>
                  <HoystText variant="bodyStrong">{size}</HoystText>
                </Pressable>
              ))}
            </View>
          </View>
        ) : null}
        {currentStep === 'circleTimezone' ? (
          <TimezonePicker
            helperText={`This controls when each Tap In day resets for this ${
              isPersonal ? 'Commitment' : 'Circle'
            }.`}
            modalTitle={`${isPersonal ? 'Commitment' : 'Circle'} timezone`}
            onChange={value => setStarterCircleField('timezone', value)}
            value={starterCircleDraft.timezone}
          />
        ) : null}
        {currentStep === 'circleReview' ? (
          <View style={styles.coachPreview}>
            <PreviewRow
              accent="purple"
              detail={
                starterCircleDraft.circleMode === 'personal'
                  ? 'Personal commitment'
                  : 'Circle'
              }
              icon={UsersRound}
              label="Setup"
            />
            <PreviewRow
              accent="green"
              detail={starterCircleDraft.category}
              icon={Target}
              label="Category"
            />
            {starterCircleDraft.circleMode === 'group' ? (
              <PreviewRow
                accent="blue"
                detail={starterCircleTitle.trim()}
                icon={UsersRound}
                label="Circle name"
              />
            ) : null}
            <PreviewRow
              accent="orange"
              detail={starterCircleCommitment.trim()}
              icon={Target}
              label="Commitment"
            />
            <PreviewRow
              accent={
                starterCircleDraft.commitmentType === 'limit'
                  ? 'orange'
                  : starterCircleDraft.commitmentType === 'avoid'
                  ? 'purple'
                  : 'green'
              }
              detail={formatCommitmentRulesSummary(starterCircleDraft)}
              commitmentType={starterCircleDraft.commitmentType}
              label="Commitment rules"
            />
            <PreviewRow
              accent={
                starterCircleCommitmentPace === 'daily'
                  ? 'green'
                  : starterCircleCommitmentPace === 'monthly'
                  ? 'orange'
                  : 'blue'
              }
              detail={starterCirclePaceLabel}
              icon={StarterCirclePaceIcon}
              label="Pace"
            />
            <PreviewRow
              accent="orange"
              detail={formatSkipSummary(
                starterCircleDraft.graceRules.skip.allowance,
                starterCircleDraft.graceRules.skip.windowDays,
              )}
              icon={Shield}
              label="Skips"
            />
            {starterCircleDraft.circleMode === 'group' ? (
              <>
                <PreviewRow
                  accent="purple"
                  detail={formatAccessSummary(
                    starterCircleDraft.privacyMode,
                    starterCircleDraft.joinMode,
                  )}
                  icon={Share2}
                  label="Access"
                />
                <PreviewRow
                  accent="blue"
                  detail={`${starterCircleDraft.maxSize} Members`}
                  icon={UsersRound}
                  label="Capacity"
                />
              </>
            ) : null}
            <PreviewRow
              accent="blue"
              detail={formatTimezoneSummary(starterCircleDraft.timezone)}
              icon={Clock3}
              label="Timezone"
            />
          </View>
        ) : null}
        {currentStep === 'notifications' ? (
          <View style={styles.coachPreview}>
            <PreviewRow
              accent="green"
              detail="A helpful nudge before your Commitment slips away."
              icon={BellRing}
              label="Tap In reminders"
            />
            <PreviewRow
              accent="orange"
              detail="A last-call warning when there are 2 hours left."
              icon={Clock3}
              label="2-hour warnings"
            />
            {isPersonal ? (
              <PreviewRow
                accent="purple"
                detail="Commitment reminders and Progress updates stay focused on you."
                icon={Shield}
                label="Commitment updates"
              />
            ) : (
              <PreviewRow
                accent="purple"
                detail="Urgent Circle alerts right away, Circle activity in an evening recap."
                icon={Shield}
                label="Circle activity"
              />
            )}
          </View>
        ) : null}
        {currentStep === 'auth' ? (
          <View style={styles.authChoices}>
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
              label={isBusy ? 'Opening Apple...' : 'Continue with Apple'}
              onPress={isBusy ? undefined : () => runProviderAuth('apple')}
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
              label={isBusy ? 'Opening Google...' : 'Continue with Google'}
              onPress={isBusy ? undefined : () => runProviderAuth('google')}
              textColor={authProviderColors.google.foregroundColor}
              variant="outline"
            />
            {authMethod === 'email' ? (
              <View
                style={[
                  styles.inlineAuthForm,
                  {backgroundColor: theme.surface, borderColor: theme.border},
                ]}>
                <View style={styles.fieldBlock}>
                  <HoystText tone="muted" variant="label">
                    Email
                  </HoystText>
                  <HoystInput
                    autoCapitalize="none"
                    keyboardType="email-address"
                    onChangeText={setRegistrationEmail}
                    placeholder="Email"
                    value={registrationEmail}
                  />
                </View>
                <View style={styles.fieldBlock}>
                  <HoystText tone="muted" variant="label">
                    Password
                  </HoystText>
                  <HoystInput
                    onChangeText={setRegistrationPassword}
                    placeholder="Password"
                    secureTextEntry
                    showSecureTextToggle
                    value={registrationPassword}
                  />
                </View>
                <HoystButton
                  label={isBusy ? 'Working...' : 'Create account'}
                  onPress={
                    isBusy
                      ? undefined
                      : () => {
                          registerWithEmailFromOnboarding().catch(
                            () => undefined,
                          );
                        }
                  }
                />
              </View>
            ) : (
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
                onPress={
                  isBusy ? undefined : () => selectRegistrationMethod('email')
                }
                textColor={authProviderColors.email.foregroundColor}
                variant="outline"
              />
            )}
            {authMethod === 'phone' ? (
              <View
                style={[
                  styles.inlineAuthForm,
                  {backgroundColor: theme.surface, borderColor: theme.border},
                ]}>
                <View style={styles.fieldBlock}>
                  <HoystText tone="muted" variant="label">
                    Phone
                  </HoystText>
                  <HoystInput
                    keyboardType="phone-pad"
                    onChangeText={handleRegistrationPhoneNumberChange}
                    placeholder="+1 555 000 0000"
                    value={registrationPhoneNumber}
                  />
                </View>
                {phoneConfirmation ? (
                  <View style={styles.fieldBlock}>
                    <HoystText tone="muted" variant="label">
                      SMS code
                    </HoystText>
                    <HoystInput
                      keyboardType="number-pad"
                      onChangeText={setRegistrationSmsCode}
                      placeholder="SMS code"
                      value={registrationSmsCode}
                    />
                  </View>
                ) : null}
                <HoystButton
                  label={
                    isBusy
                      ? 'Working...'
                      : phoneConfirmation
                      ? 'Create account'
                      : 'Send registration code'
                  }
                  onPress={
                    isBusy
                      ? undefined
                      : () => {
                          const action = phoneConfirmation
                            ? confirmRegistrationCode
                            : sendRegistrationCode;

                          action().catch(() => undefined);
                        }
                  }
                />
              </View>
            ) : (
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
                onPress={
                  isBusy ? undefined : () => selectRegistrationMethod('phone')
                }
                textColor={authProviderColors.phone.foregroundColor}
                variant="outline"
              />
            )}
          </View>
        ) : null}
      </>
    );
  };

  const primaryLabel =
    currentStep === 'welcome'
      ? 'Get started'
      : currentStep === 'notifications'
      ? 'Enable reminders'
      : currentStep === 'finishProfile'
      ? isBusy
        ? 'Saving...'
        : shouldCreateCircle
        ? isPersonal
          ? 'Create Personal Commitment'
          : 'Create Circle'
        : 'Complete account'
      : currentStep === 'auth'
      ? 'Continue as guest'
      : 'Continue';
  const isCircleSetupStep =
    currentStep === 'circleTitle' ||
    currentStep === 'circleCommitment' ||
    currentStep === 'circleMode' ||
    currentStep === 'circleCategory' ||
    currentStep === 'circleRules' ||
    currentStep === 'circleGrace' ||
    currentStep === 'circlePrivacy' ||
    currentStep === 'circleCapacity' ||
    currentStep === 'circleTimezone' ||
    currentStep === 'circleReview';
  const secondaryLabel =
    currentStep === 'welcome'
      ? 'I already have an account'
      : currentStep === 'notifications'
      ? 'Not now'
      : isCircleSetupStep
      ? 'Skip for now'
      : undefined;
  const primaryAction =
    currentStep === 'welcome'
      ? () => setCurrentStep('coach')
      : currentStep === 'auth'
      ? continueAsGuest
      : currentStep === 'finishProfile'
      ? submitFinishProfile
      : currentStep === 'notifications'
      ? () => {
          continueFromNotifications(true).catch(() => undefined);
        }
      : goNext;
  const secondaryAction =
    currentStep === 'welcome'
      ? () => {
          navigation.navigate('SignIn', getWelcomeSignInParams());
        }
      : currentStep === 'notifications'
      ? () => {
          continueFromNotifications(false).catch(() => undefined);
        }
      : isCircleSetupStep
      ? () => {
          setFirstCircleSkipped(true);
          setCurrentStep('notifications');
        }
      : undefined;
  return (
    <SafeAreaView
      style={[styles.safeArea, {backgroundColor: theme.background}]}>
      <FrostedBackdrop />
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={styles.keyboardView}>
        <ProgressHeader
          currentStep={currentStep}
          onBack={goBack}
          onClose={continueAsGuest}
          progressSteps={progressSteps}
        />
        <ScrollView
          automaticallyAdjustKeyboardInsets
          bounces={false}
          contentContainerStyle={styles.scrollContent}
          keyboardDismissMode="interactive"
          keyboardShouldPersistTaps="handled"
          ref={scrollRef}
          showsVerticalScrollIndicator={false}>
          <View style={styles.content}>{renderContent()}</View>
        </ScrollView>
        <StickyCta
          disabled={!canContinue || isBusy || isRequestingPushPermission}
          label={primaryLabel}
          onPress={primaryAction}
          secondaryLabel={secondaryLabel}
          secondaryOnPress={secondaryAction}
        />
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
  },
  keyboardView: {
    flex: 1,
  },
  progressHeader: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 12,
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 8,
  },
  iconButton: {
    alignItems: 'center',
    borderRadius: 20,
    borderWidth: 1,
    height: 46,
    justifyContent: 'center',
    width: 46,
  },
  scrollContent: {
    flexGrow: 1,
    paddingBottom: 36,
    paddingHorizontal: 20,
    paddingTop: 16,
  },
  inviteSummary: {
    gap: 8,
    marginBottom: 18,
  },
  content: {
    flex: 1,
    gap: 18,
  },
  welcomeBody: {
    alignItems: 'center',
    flex: 1,
    gap: 28,
    justifyContent: 'center',
    minHeight: 520,
  },
  logo: {
    alignSelf: 'center',
    height: 52,
    width: 124,
  },
  heroMark: {
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 140,
  },
  heroCopy: {
    alignItems: 'center',
    gap: 12,
    maxWidth: 342,
  },
  heroTitle: {
    textAlign: 'center',
  },
  heroText: {
    textAlign: 'center',
  },
  coachRow: {
    alignItems: 'flex-start',
    flexDirection: 'row',
    gap: 12,
  },
  coachMark: {
    paddingTop: 6,
  },
  speechBubble: {
    borderRadius: 24,
    borderWidth: 1,
    flex: 1,
    gap: 10,
    padding: 16,
  },
  speechHeader: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 8,
  },
  speechIcon: {
    alignItems: 'center',
    borderRadius: 13,
    borderWidth: 1,
    height: 30,
    justifyContent: 'center',
    width: 30,
  },
  optionStack: {
    gap: 8,
  },
  stack: {
    gap: 12,
  },
  nestedOptionStack: {
    gap: 10,
    paddingTop: 6,
  },
  optionPressable: {
    width: '100%',
  },
  optionCard: {
    alignItems: 'center',
    borderRadius: 18,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 10,
    minHeight: 78,
    paddingHorizontal: 13,
    paddingVertical: 11,
  },
  optionIcon: {
    alignItems: 'center',
    borderRadius: 16,
    borderWidth: 1,
    flexShrink: 0,
    height: 42,
    justifyContent: 'center',
    width: 42,
  },
  optionCopy: {
    flexBasis: 0,
    flex: 1,
    gap: 3,
    justifyContent: 'center',
    minWidth: 0,
  },
  optionTitle: {
    lineHeight: 20,
  },
  optionDescription: {
    flexShrink: 1,
    lineHeight: 19,
  },
  optionCheck: {
    alignItems: 'center',
    borderRadius: 12,
    borderWidth: 1,
    flexShrink: 0,
    height: 24,
    justifyContent: 'center',
    width: 24,
  },
  coachPreview: {
    gap: 12,
  },
  previewRow: {
    alignItems: 'center',
    borderRadius: 20,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 13,
    minHeight: 82,
    padding: 14,
  },
  previewIcon: {
    alignItems: 'center',
    borderRadius: 16,
    borderWidth: 1,
    height: 44,
    justifyContent: 'center',
    width: 44,
  },
  previewCopy: {
    flex: 1,
    gap: 4,
    minWidth: 0,
  },
  previewCommitmentIcon: {
    backgroundColor: 'transparent',
    borderColor: 'transparent',
  },
  stepper: {
    alignItems: 'center',
    borderRadius: radius.md,
    borderWidth: 1,
    flexDirection: 'row',
    justifyContent: 'space-between',
    padding: 16,
  },
  stepperControls: {
    flexDirection: 'row',
    gap: 10,
  },
  stepperCopy: {
    gap: 4,
  },
  stepperValue: {
    fontSize: 22,
  },
  profileFields: {
    gap: 14,
  },
  avatarPanel: {
    alignItems: 'center',
    borderRadius: 20,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 14,
    padding: 14,
  },
  avatarCopy: {
    flex: 1,
    gap: 8,
    minWidth: 0,
  },
  avatarActions: {
    gap: 8,
  },
  recoveryPanel: {
    gap: 12,
  },
  fieldBlock: {
    gap: 8,
  },
  rulePanel: {
    gap: 14,
  },
  toggleRow: {
    alignItems: 'center',
    borderRadius: 20,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 12,
    minHeight: 84,
    padding: 14,
  },
  sizePresets: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  presetButton: {
    alignItems: 'center',
    borderRadius: radius.pill,
    borderWidth: 1,
    justifyContent: 'center',
    minHeight: 44,
    minWidth: 52,
    paddingHorizontal: 14,
  },
  textArea: {
    minHeight: 118,
  },
  authChoices: {
    gap: 12,
  },
  inlineAuthForm: {
    borderRadius: 20,
    borderWidth: 1,
    gap: 12,
    padding: 14,
  },
  footer: {
    marginBottom: 6,
    marginHorizontal: 12,
  },
  cta: {
    minHeight: 54,
  },
  secondaryCta: {
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 30,
  },
});
