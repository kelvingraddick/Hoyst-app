import React, {useEffect, useMemo, useState} from 'react';
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
import {SafeAreaView} from 'react-native-safe-area-context';
import LinearGradient from 'react-native-linear-gradient';
import {
  Apple,
  ArrowLeft,
  Check,
  Chrome,
  Clock3,
  Globe2,
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

import {BrandMark} from '../../../design/components/BrandMark';
import {HoystButton} from '../../../design/components/HoystButton';
import {HoystInput} from '../../../design/components/HoystInput';
import {HoystText} from '../../../design/components/HoystText';
import {TapInRingMark} from '../../../design/components/TapInRingMark';
import {useHoystTheme} from '../../../design/theme/useHoystTheme';
import {gradients} from '../../../design/tokens/gradients';
import {radius} from '../../../design/tokens/radius';
import {firebaseAuth} from '../../../lib/firebase/auth';
import type {
  AuthStackParamList,
  RootStackParamList,
  SignInEntryPoint,
} from '../../../navigation/types';
import {dismissAuthModals} from '../../../navigation/auth-modal-dismiss';
import {useOnboardingStore} from '../../../store/onboarding-store';
import {useSessionStore} from '../../../store/session-store';
import {
  getOptionLabel,
  goalOptions,
  onboardingProgressSteps,
  type OnboardingOption,
  type OnboardingStep,
} from '../services/onboarding-options';
import type {CircleJoinMode, CirclePrivacyMode} from '../../../types/models';
import {normalizeHandle, validateHandle} from '../services/profile-validation';
import {isStarterCircleDraftReady} from '../services/onboarding-circle';
import {
  signInWithApple,
  signInWithGoogle,
  signOutOfHoyst,
  type AuthServiceError,
} from '../services/auth-service';
import {continueAsGuestFromAuth} from '../services/auth-dismiss';
import {
  getOnboardingSignInParams,
  getWelcomeSignInParams,
} from '../services/auth-route-intent';
import {completeProfile, getLocalTimezone} from '../services/account-service';
import {
  completeOnboardingSetup,
  shouldCreateStarterCircle,
} from '../services/onboarding-completion';

type Props = NativeStackScreenProps<AuthStackParamList, 'Welcome'>;

type StepCopy = {
  body: string;
  prompt: string;
  title: string;
};

const stepCopy: Record<Exclude<OnboardingStep, 'welcome'>, StepCopy> = {
  auth: {
    body: 'Create an account when you are ready to join, Tap In, or keep your rhythm across devices.',
    prompt: 'Pick the sign-in path that feels easiest.',
    title: 'Save your rhythm',
  },
  coach: {
    body: 'Let\'s help you create your account and a first circle you can invite people into.',
    prompt: 'A circle works best when the promise is small, visible, and repeatable.',
    title: 'Let\'s get started',
  },
  goal: {
    body: 'This helps Hoyst shape the first circle around the kind of accountability you want.',
    prompt: 'What are you trying to stay consistent with?',
    title: 'Start with the why',
  },
  circleDailyTask: {
    body: 'Make the daily action specific enough that members know what counts.',
    prompt: 'What will members do daily?',
    title: 'Define the promise',
  },
  circlePrivacy: {
    body: 'Choose who can discover it and how new members enter.',
    prompt: 'Who can find and join it?',
    title: 'Set the doors',
  },
  circleReview: {
    body: 'After account creation, Hoyst will save your profile and create this circle.',
    prompt: 'Ready to save your setup?',
    title: 'Review your first circle',
  },
  circleTitle: {
    body: 'Give the circle a name people can recognize and rally around.',
    prompt: 'What should this circle be called?',
    title: 'Name the circle',
  },
  finishProfile: {
    body: 'Add the profile details your circles will see. Handles are locked once saved.',
    prompt: 'Finish your profile',
    title: 'Last step',
  },
};

const stepIcons: Record<Exclude<OnboardingStep, 'welcome'>, LucideIcon> = {
  auth: UserRound,
  circleDailyTask: Target,
  circlePrivacy: Globe2,
  circleReview: Sparkles,
  circleTitle: UsersRound,
  coach: Sparkles,
  finishProfile: UserRound,
  goal: Target,
};

const circlePrivacyOptions: OnboardingOption<CirclePrivacyMode>[] = [
  {
    accent: 'green',
    description: 'Discoverable in Explore with your chosen join rule.',
    id: 'public',
    label: 'Public',
  },
  {
    accent: 'blue',
    description: 'Hidden from Explore and joinable only with your invite link.',
    id: 'link_only',
    label: 'Link-only',
  },
  {
    accent: 'purple',
    description: 'Hidden from Explore with invite-only requests for approval.',
    id: 'private',
    label: 'Private',
  },
];

const publicJoinOptions: OnboardingOption<
  Extract<CircleJoinMode, 'open' | 'request_to_join'>
>[] = [
  {
    accent: 'green',
    description: 'People can join immediately while seats are open.',
    id: 'open',
    label: 'Open seats',
  },
  {
    accent: 'orange',
    description: 'People request access before they can Tap In.',
    id: 'request_to_join',
    label: 'Request approval',
  },
];

function getErrorMessage(error: unknown) {
  const serviceError = error as AuthServiceError;

  return 'message' in serviceError
    ? serviceError.message
    : 'Authentication failed. Try again.';
}

function useAccentColor(accent: OnboardingOption<string>['accent']) {
  const theme = useHoystTheme();

  if (accent === 'green') {
    return theme.success;
  }

  if (accent === 'orange') {
    return theme.accentWarm;
  }

  if (accent === 'blue') {
    return theme.accentTertiary;
  }

  return theme.accentSecondary;
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
      disabled={disabled}
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
}: {
  currentStep: OnboardingStep;
  onBack: () => void;
  onClose: () => void;
}) {
  const theme = useHoystTheme();
  if (currentStep === 'welcome') {
    return null;
  }

  const progressIndex = Math.max(
    0,
    onboardingProgressSteps.indexOf(currentStep),
  );
  const progress = (progressIndex + 1) / onboardingProgressSteps.length;

  return (
    <View style={styles.progressHeader}>
      <IconButton
        accessibilityLabel="Go back"
        disabled={currentStep === 'coach' || currentStep === 'finishProfile'}
        icon={ArrowLeft}
        onPress={onBack}
      />
      <View
        style={[
          styles.progressTrack,
          {backgroundColor: theme.surfaceHigh, borderColor: theme.border},
        ]}>
        <LinearGradient
          colors={[...gradients.primaryRing]}
          end={{x: 1, y: 0}}
          start={{x: 0, y: 0}}
          style={[styles.progressFill, {width: `${Math.round(progress * 100)}%`}]}
        />
      </View>
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
}: {
  currentStep: Exclude<OnboardingStep, 'welcome'>;
}) {
  const theme = useHoystTheme();
  const copy = stepCopy[currentStep];
  const Icon = stepIcons[currentStep];

  return (
    <View style={styles.coachRow}>
      <View style={styles.coachMark}>
        <TapInRingMark innerSize={34} outerSize={62} />
      </View>
      <View
        style={[
          styles.speechBubble,
          {
            backgroundColor: theme.surface,
            borderColor: theme.borderStrong,
          },
        ]}>
        <View style={styles.speechHeader}>
          <View
            style={[
              styles.speechIcon,
              {backgroundColor: theme.surfaceSoft, borderColor: theme.border},
            ]}>
            <Icon color={theme.accentSecondary} size={17} strokeWidth={2.3} />
          </View>
          <HoystText variant="label">{copy.title}</HoystText>
        </View>
        <HoystText variant="title">{copy.prompt}</HoystText>
        <HoystText tone="muted">{copy.body}</HoystText>
      </View>
    </View>
  );
}

function OptionCard<T extends string>({
  icon: Icon,
  isSelected,
  option,
  onPress,
}: {
  icon: LucideIcon;
  isSelected: boolean;
  option: OnboardingOption<T>;
  onPress: () => void;
}) {
  const theme = useHoystTheme();
  const accentColor = useAccentColor(option.accent);

  return (
    <Pressable
      accessibilityRole="radio"
      accessibilityState={{selected: isSelected}}
      onPress={onPress}
      style={({pressed}) => [
        styles.optionPressable,
        {opacity: pressed ? 0.9 : 1, transform: [{scale: pressed ? 0.985 : 1}]},
      ]}>
      <View
        style={[
          styles.optionCard,
          {
            backgroundColor: isSelected ? `${accentColor}20` : theme.surface,
            borderColor: isSelected ? accentColor : theme.border,
          },
        ]}>
        <View
          style={[
            styles.optionIcon,
            {
              backgroundColor: isSelected
                ? `${accentColor}24`
                : theme.surfaceSoft,
              borderColor: isSelected ? accentColor : theme.border,
            },
          ]}>
          <Icon color={accentColor} size={20} strokeWidth={2.3} />
        </View>
        <View style={styles.optionCopy}>
          <HoystText
            numberOfLines={1}
            style={styles.optionTitle}
            variant="bodyStrong">
            {option.label}
          </HoystText>
          <HoystText
            numberOfLines={2}
            style={styles.optionDescription}
            tone="muted">
            {option.description}
          </HoystText>
        </View>
        <View
          style={[
            styles.optionCheck,
            {
              backgroundColor: isSelected ? accentColor : undefined,
              borderColor: isSelected ? accentColor : theme.borderStrong,
            },
          ]}>
          {isSelected ? (
            <Check color={theme.background} size={16} strokeWidth={3} />
          ) : null}
        </View>
      </View>
    </Pressable>
  );
}

function PreviewRow({
  accent,
  detail,
  icon: Icon,
  label,
}: {
  accent: OnboardingOption<string>['accent'];
  detail: string;
  icon: LucideIcon;
  label: string;
}) {
  const theme = useHoystTheme();
  const accentColor = useAccentColor(accent);

  return (
    <View
      style={[
        styles.previewRow,
        {backgroundColor: theme.surface, borderColor: theme.border},
      ]}>
      <View
        style={[
          styles.previewIcon,
          {backgroundColor: `${accentColor}20`, borderColor: `${accentColor}66`},
        ]}>
        <Icon color={accentColor} size={20} strokeWidth={2.3} />
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
  const theme = useHoystTheme();

  return (
    <View
      style={[
        styles.footer,
        {backgroundColor: theme.background, borderTopColor: theme.border},
      ]}>
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
    </View>
  );
}

export function WelcomeScreen({navigation}: Props): React.JSX.Element {
  const theme = useHoystTheme();
  const [circleSetupError, setCircleSetupError] = useState<string>();
  const [isBusy, setIsBusy] = useState(false);
  const [profileWasCompleted, setProfileWasCompleted] = useState(false);
  const currentStep = useOnboardingStore(state => state.currentStep);
  const displayName = useOnboardingStore(state => state.displayName);
  const firstCircleSkipped = useOnboardingStore(
    state => state.firstCircleSkipped,
  );
  const getOnboardingPreferences = useOnboardingStore(
    state => state.getPreferences,
  );
  const goal = useOnboardingStore(state => state.goal);
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
  const markSeen = useOnboardingStore(state => state.markSeen);
  const nextStep = useOnboardingStore(state => state.nextStep);
  const prepareStarterCircleSetup = useOnboardingStore(
    state => state.prepareStarterCircleSetup,
  );
  const previousStep = useOnboardingStore(state => state.previousStep);
  const setCurrentStep = useOnboardingStore(state => state.setCurrentStep);
  const setDisplayName = useOnboardingStore(state => state.setDisplayName);
  const setFirstCircleSkipped = useOnboardingStore(
    state => state.setFirstCircleSkipped,
  );
  const setGoal = useOnboardingStore(state => state.setGoal);
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
  const pendingAction = useSessionStore(state => state.pendingAction);
  const setGuest = useSessionStore(state => state.setGuest);
  const status = useSessionStore(state => state.status);
  const user = useSessionStore(state => state.user);
  const rootNavigation =
    navigation.getParent<NativeStackNavigationProp<RootStackParamList>>();
  const handleValidation = useMemo(() => validateHandle(handle), [handle]);
  const shouldCreateCircle = shouldCreateStarterCircle({
    firstCircleSkipped,
    starterCircleDraft,
  });
  const publicJoinMode =
    starterCircleDraft.joinMode === 'open' ||
    starterCircleDraft.joinMode === 'request_to_join'
      ? starterCircleDraft.joinMode
      : 'request_to_join';
  const canContinue =
    currentStep === 'goal'
      ? Boolean(goal)
      : currentStep === 'finishProfile'
        ? displayName.trim().length > 0 && handleValidation.isValid
        : currentStep === 'circleTitle'
          ? starterCircleDraft.title.trim().length > 0 &&
            starterCircleDraft.title.trim().length <= 80
          : currentStep === 'circleDailyTask'
            ? starterCircleDraft.dailyTask.trim().length > 0 &&
              starterCircleDraft.dailyTask.trim().length <= 160
            : currentStep === 'circleReview'
              ? firstCircleSkipped || isStarterCircleDraftReady(starterCircleDraft)
              : true;
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
      borderColor: 'rgba(66,133,244,0.42)',
      foregroundColor: '#4285F4',
    },
    email: {
      backgroundColor: 'rgba(255,138,61,0.13)',
      borderColor: 'rgba(255,138,61,0.44)',
      foregroundColor: theme.accentWarm,
    },
    phone: {
      backgroundColor: 'rgba(68,216,92,0.12)',
      borderColor: 'rgba(68,216,92,0.42)',
      foregroundColor: theme.success,
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

  useEffect(() => {
    if (status === 'authenticatedIncompleteProfile' && currentStep === 'auth') {
      setCurrentStep('finishProfile');
    }
  }, [currentStep, setCurrentStep, status]);

  useEffect(() => {
    if (
      status !== 'authenticatedIncompleteProfile' ||
      currentStep !== 'finishProfile'
    ) {
      return;
    }

    if (!displayName.trim() && user?.displayName) {
      setDisplayName(user.displayName);
    }

    if (!timezone.trim()) {
      setTimezone(getLocalTimezone());
    }
  }, [
    currentStep,
    displayName,
    setDisplayName,
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

      setHandle(normalizedHandle);

      const result = await completeOnboardingSetup(
        {
          firstCircleSkipped,
          profile: {
            ...(user?.photoURL ? {avatarUrl: user.photoURL} : {}),
            displayName: displayName.trim(),
            handle: normalizedHandle,
            ...(onboardingPreferences ? {onboardingPreferences} : {}),
            timezone: timezone.trim() || getLocalTimezone(),
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

  const renderOptions = <T extends string,>(
    options: OnboardingOption<T>[],
    selected: T | undefined,
    onSelect: (id: T) => void,
    Icon: LucideIcon,
  ) => (
    <View style={styles.optionStack}>
      {options.map(option => (
        <OptionCard
          icon={Icon}
          isSelected={selected === option.id}
          key={option.id}
          onPress={() => onSelect(option.id)}
          option={option}
        />
      ))}
    </View>
  );

  const renderContent = () => {
    if (currentStep === 'welcome') {
      return (
        <View style={styles.welcomeBody}>
          <BrandMark
            isDark={theme.isDark}
            kind="logo"
            style={styles.logo}
          />
          <View style={styles.heroMark}>
            <TapInRingMark innerSize={68} outerSize={118} />
          </View>
          <View style={styles.heroCopy}>
            <HoystText style={styles.heroTitle} variant="largeTitle">
              Consistency feels lighter in a circle.
            </HoystText>
            <HoystText style={styles.heroText} tone="muted">
              Shape your rhythm, explore public circles, and create an account
              only when you are ready to join or Tap In.
            </HoystText>
          </View>
        </View>
      );
    }

    return (
      <>
        <CoachPrompt currentStep={currentStep} />
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
              detail="Shape a first circle, or skip it and start from Home."
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
        {currentStep === 'goal'
          ? renderOptions(goalOptions, goal, setGoal, Target)
          : null}
        {currentStep === 'finishProfile' ? (
          <View style={styles.profileFields}>
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
            {shouldCreateCircle ? (
              <View style={styles.fieldBlock}>
                <HoystText tone="muted" variant="label">
                  First circle
                </HoystText>
                <HoystText>
                  {starterCircleDraft.title.trim()} -{' '}
                  {starterCircleDraft.dailyTask.trim()}
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
                  label={isBusy ? 'Retrying...' : 'Retry first circle'}
                  onPress={canContinue && !isBusy ? submitFinishProfile : undefined}
                />
                <HoystButton
                  label="Skip first circle"
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
              Circle title
            </HoystText>
            <HoystInput
              autoCapitalize="words"
              maxLength={80}
              onChangeText={value => setStarterCircleField('title', value)}
              placeholder="The 5AM Vanguard"
              value={starterCircleDraft.title}
            />
            <HoystText tone={canContinue ? 'muted' : 'danger'} variant="caption">
              {starterCircleDraft.title.trim().length}/80 characters
            </HoystText>
          </View>
        ) : null}
        {currentStep === 'circleDailyTask' ? (
          <View style={styles.fieldBlock}>
            <HoystText tone="muted" variant="label">
              Daily task description
            </HoystText>
            <HoystInput
              maxLength={160}
              multiline
              numberOfLines={4}
              onChangeText={value => setStarterCircleField('dailyTask', value)}
              placeholder="Read 20 pages, then Tap In with one takeaway."
              style={styles.textArea}
              textAlignVertical="top"
              value={starterCircleDraft.dailyTask}
            />
            <HoystText tone={canContinue ? 'muted' : 'danger'} variant="caption">
              {starterCircleDraft.dailyTask.trim().length}/160 characters
            </HoystText>
          </View>
        ) : null}
        {currentStep === 'circlePrivacy' ? (
          <View style={styles.optionStack}>
            {renderOptions(
              circlePrivacyOptions,
              starterCircleDraft.privacyMode,
              setStarterCirclePrivacyMode,
              Globe2,
            )}
            {starterCircleDraft.privacyMode === 'public' ? (
              <View style={styles.nestedOptionStack}>
                <HoystText tone="muted" variant="label">
                  Public join rule
                </HoystText>
                {renderOptions(
                  publicJoinOptions,
                  publicJoinMode,
                  setStarterCirclePublicJoinMode,
                  Shield,
                )}
              </View>
            ) : null}
          </View>
        ) : null}
        {currentStep === 'circleReview' ? (
          <View style={styles.coachPreview}>
            <PreviewRow
              accent="green"
              detail={getOptionLabel(goalOptions, goal, 'Explore momentum circles')}
              icon={Target}
              label="Primary goal"
            />
            <PreviewRow
              accent="blue"
              detail={starterCircleDraft.title.trim()}
              icon={UsersRound}
              label="Circle name"
            />
            <PreviewRow
              accent="orange"
              detail={starterCircleDraft.dailyTask.trim()}
              icon={Target}
              label="Daily task"
            />
            <PreviewRow
              accent="purple"
              detail={`${starterCircleDraft.privacyMode === 'link_only' ? 'Link-only' : starterCircleDraft.privacyMode}: ${
                starterCircleDraft.joinMode === 'open'
                  ? 'Open seats'
                  : starterCircleDraft.joinMode === 'request_to_join'
                    ? 'Request approval'
                    : 'Invite link'
              }`}
              icon={Share2}
              label="Access"
            />
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
              onPress={() => {
                setCurrentStep('auth');
                navigation.navigate(
                  'SignIn',
                  getOnboardingSignInParams('email', authEntryPoint),
                );
              }}
              textColor={authProviderColors.email.foregroundColor}
              variant="outline"
            />
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
              onPress={() => {
                setCurrentStep('auth');
                navigation.navigate(
                  'SignIn',
                  getOnboardingSignInParams('phone', authEntryPoint),
                );
              }}
              textColor={authProviderColors.phone.foregroundColor}
              variant="outline"
            />
          </View>
        ) : null}
      </>
    );
  };

  const primaryLabel =
    currentStep === 'welcome'
      ? 'Get started'
      : currentStep === 'circleReview'
        ? 'Continue to account'
        : currentStep === 'finishProfile'
          ? isBusy
            ? 'Saving...'
            : shouldCreateCircle
              ? 'Finish setup'
              : 'Complete account'
        : currentStep === 'auth'
          ? 'Continue as guest'
          : 'Continue';
  const isCircleSetupStep =
    currentStep === 'circleTitle' ||
    currentStep === 'circleDailyTask' ||
    currentStep === 'circlePrivacy' ||
    currentStep === 'circleReview';
  const secondaryLabel =
    currentStep === 'welcome'
      ? 'I already have an account'
      : isCircleSetupStep
        ? 'Skip first circle'
        : undefined;
  const authEntryPoint: SignInEntryPoint = pendingAction
    ? pendingAction.type === 'settings'
      ? 'settings'
      : 'protectedAction'
    : 'onboarding';
  const primaryAction =
    currentStep === 'welcome'
      ? () => setCurrentStep('coach')
      : currentStep === 'auth'
        ? continueAsGuest
        : currentStep === 'finishProfile'
          ? submitFinishProfile
        : goNext;
  const secondaryAction =
    currentStep === 'welcome'
      ? () => {
          navigation.navigate('SignIn', getWelcomeSignInParams());
        }
      : isCircleSetupStep
        ? () => {
            setFirstCircleSkipped(true);
            setCurrentStep('auth');
          }
        : undefined;

  return (
    <SafeAreaView style={[styles.safeArea, {backgroundColor: theme.background}]}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={styles.keyboardView}>
        <ProgressHeader
          currentStep={currentStep}
          onBack={previousStep}
          onClose={continueAsGuest}
        />
        <ScrollView
          bounces={false}
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}>
          <View style={styles.content}>{renderContent()}</View>
        </ScrollView>
        <StickyCta
          disabled={!canContinue || isBusy}
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
    paddingHorizontal: 18,
    paddingTop: 6,
  },
  iconButton: {
    alignItems: 'center',
    borderRadius: 18,
    borderWidth: 1,
    height: 42,
    justifyContent: 'center',
    width: 42,
  },
  progressTrack: {
    borderRadius: radius.pill,
    borderWidth: 1,
    flex: 1,
    height: 12,
    overflow: 'hidden',
  },
  progressFill: {
    borderRadius: radius.pill,
    height: '100%',
  },
  scrollContent: {
    flexGrow: 1,
    paddingBottom: 28,
    paddingHorizontal: 18,
    paddingTop: 18,
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
  profileFields: {
    gap: 14,
  },
  recoveryPanel: {
    gap: 12,
  },
  fieldBlock: {
    gap: 8,
  },
  textArea: {
    minHeight: 118,
  },
  authChoices: {
    gap: 12,
  },
  footer: {
    borderTopWidth: StyleSheet.hairlineWidth,
    gap: 12,
    paddingBottom: 14,
    paddingHorizontal: 18,
    paddingTop: 14,
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
