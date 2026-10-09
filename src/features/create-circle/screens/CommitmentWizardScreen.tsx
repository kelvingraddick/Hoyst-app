import React, {useCallback, useEffect, useMemo, useRef, useState} from 'react';
import {
  ActivityIndicator,
  BackHandler,
  Image,
  Platform,
  Pressable,
  StyleSheet,
  View,
} from 'react-native';
import {CommonActions, useFocusEffect} from '@react-navigation/native';
import type {NativeStackNavigationProp} from '@react-navigation/native-stack';
import {DateTime} from 'luxon';
import {launchImageLibrary} from 'react-native-image-picker';
import {Check, ChevronDown, Pencil, UserRound} from 'lucide-react-native';
import {firebaseAuth} from '../../../lib/firebase/auth';
import {firebaseFirestore} from '../../../lib/firebase/firestore';
import {requestPushNotificationPermission} from '../../../lib/notifications';
import type {RootStackParamList} from '../../../navigation/types';
import {useSessionStore} from '../../../store/session-store';
import {useUserProfileStore} from '../../../store/profile-store';
import {useOnboardingStore} from '../../../store/onboarding-store';
import {useCircleInviteStore} from '../../../store/circle-invite-store';
import {useSetupJourneyStore} from '../../../store/setup-journey-store';
import {BrandMark} from '../../../design/components/BrandMark';
import {
  CircleCategoryIcon,
  getCircleCategoryVisual,
} from '../../../design/components/CircleCategoryIcon';
import {SetupInput as HoystInput} from '../components/SetupInput';
import {SetupText as HoystText} from '../components/SetupText';
import {useSetupTheme} from '../services/setup-presentation';
import {softShadow} from '../../../design/system/tokens';
import {categories} from '../../../shared/commitment-appearance';
import {
  checkProfileUsername,
  completeProfile,
  uploadProfileAvatar,
} from '../../auth/services/account-service';
import {
  SetupAuthForm,
  type AuthFormState,
} from '../../auth/components/SetupAuthForm';
import {suggestPublicCircles} from '../../explore/services/explore-service';
import {createCircle, joinCircle} from '../../circles/services/circle-service';
import {buildCreateCirclePayload} from '../services/create-circle-draft';
import {
  applyStarter,
  createSetupJourney,
  goalLabel,
  paceLabel,
  recommendStarters,
  setupSteps,
  validateSetup,
  validateSetupStep,
  type CircleSuggestion,
  type SetupJourney,
  type SetupStep,
} from '../services/setup-journey';
import {SetupJourneyFrame} from '../components/SetupJourneyFrame';
import {
  SetupChoice,
  SetupField,
  SetupStepContent,
  setupCopy,
} from '../components/SetupStepContent';

export type SetupGateway = Partial<{
  getCurrentUser: () =>
    | {uid: string; displayName?: string | null}
    | undefined
    | null;
  createCircle: typeof createCircle;
  joinCircle: typeof joinCircle;
  completeProfile: typeof completeProfile;
  checkProfileUsername: typeof checkProfileUsername;
  uploadProfileAvatar: typeof uploadProfileAvatar;
  suggestPublicCircles: typeof suggestPublicCircles;
  requestPushNotificationPermission: typeof requestPushNotificationPermission;
  checkEligibility: (
    circleId: string,
    uid: string,
    timezone: string,
  ) => Promise<boolean>;
}>;
type Props = {
  navigation: Pick<
    NativeStackNavigationProp<RootStackParamList>,
    'dispatch' | 'navigate' | 'replace'
  >;
  entry: 'onboarding' | 'create' | 'invite';
  gateway?: SetupGateway;
  setupKey?: string;
  inviteCode?: string;
  onSignIn?: () => void;
};
const legacySteps: Record<string, SetupStep> = {
  welcome: 'welcome',
  coach: 'interests',
  circleCommitment: 'suggestions',
  circleMode: 'mode',
  circleCategory: 'category',
  circleTitle: 'name',
  circleRules: 'pace',
  circlePrivacy: 'privacy',
  circleCapacity: 'capacity',
  circleTimezone: 'timezone',
  circleReview: 'review',
  notifications: 'account',
  auth: 'account',
  finishProfile: 'profile',
};
const initialAuth: AuthFormState = {
  title: 'Give your setup a home',
  message: 'Your starting point is saved. Let’s give it a home.',
  emphasis: ['starting point is saved'],
  label: 'Choose a sign-in method',
  busy: false,
  disabled: true,
};

export function CommitmentWizardScreen({
  navigation,
  entry,
  setupKey,
  inviteCode,
  onSignIn,
  gateway,
}: Props) {
  const theme = useSetupTheme();
  const user = useSessionStore(state => state.user);
  const sessionStatus = useSessionStore(state => state.status);
  const profile = useUserProfileStore(state => state.profile);
  const hydrated = useSetupJourneyStore(state => state.hydrated);
  const ensure = useSetupJourneyStore(state => state.ensure);
  const update = useSetupJourneyStore(state => state.update);
  const legacyJourney = useOnboardingStore(state => state.journey);
  const pendingInviteCode = useCircleInviteStore(state => state.inviteCode);
  const invitePreview = useCircleInviteStore(state => state.preview);
  const inviteResolution = useCircleInviteStore(
    state => state.resolutionStatus,
  );
  const activeInvite =
    inviteCode ?? (legacyJourney === 'invite' ? pendingInviteCode : undefined);
  const key =
    setupKey ??
    (activeInvite
      ? `invite:${activeInvite}`
      : entry === 'create'
      ? `create:${user?.uid ?? 'guest'}`
      : 'onboarding');
  const record = useSetupJourneyStore(state => state.records[key]);
  const initialized = useRef<string | undefined>(undefined);
  const finished = useRef(false);
  const saving = useRef(false);
  const authAction = useRef<(() => void) | undefined>(undefined);
  const authBack = useRef<(() => boolean) | undefined>(undefined);
  const backAction = useRef<(() => void) | undefined>(undefined);
  const [authUi, setAuthUi] = useState(initialAuth);
  const [error, setError] = useState<string>();
  const [circles, setCircles] = useState<CircleSuggestion[]>([]);
  const [discoveryBusy, setDiscoveryBusy] = useState(false);
  const [discoveryError, setDiscoveryError] = useState(false);
  const [usernameState, setUsernameState] = useState<
    'checking' | 'available' | 'taken' | 'error' | undefined
  >();
  const [eligible, setEligible] = useState<boolean>();
  const [eligibilityError, setEligibilityError] = useState(false);
  const [checkTick, setCheckTick] = useState(0);
  const isOnboarding = entry !== 'create';
  const existingInviteMembership =
    user?.uid && invitePreview?.viewerUid === user.uid
      ? invitePreview.viewerMembershipStatus
      : undefined;
  const patch = useCallback(
    (value: Partial<SetupJourney>) => {
      if (!finished.current) {
        update(key, value);
      }
    },
    [key, update],
  );
  const setStep = useCallback(
    (step: SetupStep) => {
      setError(undefined);
      patch({step});
    },
    [patch],
  );

  useEffect(() => {
    if (!hydrated || finished.current || initialized.current === key) return;
    initialized.current = key;
    const existing = useSetupJourneyStore.getState().records[key];
    if (existing && !existing.completed) {
      patch({deferred: false});
    } else {
      const legacy = useOnboardingStore.getState();
      const initial = createSetupJourney(
        entry === 'create'
          ? 'suggestions'
          : activeInvite
          ? 'joinPreview'
          : sessionStatus === 'authenticatedIncompleteProfile'
          ? 'profile'
          : 'welcome',
        profile?.timezone,
      );
      if (
        isOnboarding &&
        !activeInvite &&
        legacy.hasPendingStarterCircleSetup &&
        legacy.currentStep !== 'welcome' &&
        legacy.starterCircleDraft.commitment
      ) {
        initial.draft = {
          ...legacy.starterCircleDraft,
          title:
            legacy.starterCircleDraft.title.trim() ||
            legacy.starterCircleDraft.commitment.slice(0, 80),
        };
        initial.requestId = legacy.starterCircleSetupId ?? initial.requestId;
        initial.step = legacySteps[legacy.currentStep] ?? 'review';
        initial.interests = legacy.categories ?? [];
      }
      if (entry === 'create') initial.interests = legacy.categories ?? [];
      const pendingAction = useSessionStore.getState().pendingAction;
      initial.pendingAction = pendingAction;
      if (
        !activeInvite &&
        pendingAction &&
        !legacy.hasPendingStarterCircleSetup
      )
        initial.step =
          pendingAction.type === 'createCircle' ? 'suggestions' : 'account';
      initial.needsReminders = isOnboarding && !profile?.onboardingStatus;
      initial.profileDraft = {
        name:
          profile?.name ||
          user?.displayName ||
          (legacy.hasPendingProfileCompletion ? legacy.displayName : '') ||
          '',
        handle:
          profile?.handle ||
          (legacy.hasPendingProfileCompletion ? legacy.handle : '') ||
          '',
        avatarUrl: profile?.avatarUrl,
      };
      if (existing) update(key, initial);
      else ensure(key, initial);
    }
    if (isOnboarding)
      useOnboardingStore.setState({
        hasSeenOnboarding: false,
        hasPendingProfileCompletion: true,
        hasPendingStarterCircleSetup: true,
        starterCircleSetupId:
          useSetupJourneyStore.getState().records[key]?.requestId,
        journey: activeInvite ? 'invite' : 'standard',
        currentStep: 'auth',
      });
  }, [
    activeInvite,
    ensure,
    entry,
    hydrated,
    isOnboarding,
    key,
    patch,
    profile,
    sessionStatus,
    update,
    user,
  ]);

  useEffect(() => {
    if (!activeInvite || !record || record.result) return;
    if (
      existingInviteMembership &&
      record.step === 'full' &&
      record.selection?.kind === 'circle' &&
      record.selection.circle.id === invitePreview?.circleId
    ) {
      patch({step: 'joinPreview'});
      return;
    }
    if (record.selection) return;
    if (pendingInviteCode !== activeInvite) {
      useCircleInviteStore.getState().setInviteCode(activeInvite);
      return;
    }
    if (inviteResolution === 'unavailable') {
      if (record.step !== 'unavailable') patch({step: 'unavailable'});
      return;
    }
    if (!invitePreview) return;
    const circle: CircleSuggestion = {
      id: invitePreview.circleId,
      title: invitePreview.title,
      commitment: invitePreview.commitment,
      category: invitePreview.category ?? 'General',
      appearance: invitePreview.appearance,
      memberCount: invitePreview.memberCount,
      maxSize: invitePreview.maxSize,
      joinMode: invitePreview.joinMode,
      groupStreakDays: 0,
      commitmentCadence: invitePreview.commitmentCadence ?? 'daily',
      commitmentFrequency: invitePreview.commitmentFrequency ?? {
        tapInsPerWeek: 7,
      },
      commitmentType: invitePreview.commitmentType ?? 'build',
      buildTrackingMode: invitePreview.buildTrackingMode,
      targetValue: invitePreview.targetValue,
      minimumValue: invitePreview.minimumValue,
      maximumValue: invitePreview.maximumValue,
      unitLabel: invitePreview.unitLabel ?? 'Tap In',
      timezone: invitePreview.timezone ?? 'UTC',
    };
    patch({
      selection: {kind: 'circle', circle, inviteCode: activeInvite},
      step:
        invitePreview.isFull && !existingInviteMembership
          ? 'full'
          : 'joinPreview',
    });
  }, [
    activeInvite,
    existingInviteMembership,
    invitePreview,
    inviteResolution,
    patch,
    pendingInviteCode,
    record,
  ]);

  useEffect(() => {
    if (record?.step !== 'suggestions') return;
    let active = true;
    const timeout = setTimeout(() => {
      setDiscoveryBusy(true);
      setDiscoveryError(false);
      (gateway?.suggestPublicCircles ?? suggestPublicCircles)({
        query: record.customText.slice(0, 120),
        categories: record.interests,
      })
        .then(next => {
          if (active) setCircles(next);
        })
        .catch(() => {
          if (active) {
            setCircles([]);
            setDiscoveryError(true);
          }
        })
        .finally(() => {
          if (active) setDiscoveryBusy(false);
        });
    }, 300);
    return () => {
      active = false;
      clearTimeout(timeout);
    };
  }, [
    gateway?.suggestPublicCircles,
    record?.customText,
    record?.interests,
    record?.step,
  ]);

  useEffect(() => {
    if (record?.step !== 'profile' || !user?.uid) return;
    const handle = record.profileDraft?.handle.trim().toLowerCase() ?? '';
    if (!/^[a-z0-9_]{3,20}$/.test(handle)) {
      setUsernameState(undefined);
      return;
    }
    let active = true;
    setUsernameState('checking');
    const timeout = setTimeout(() => {
      (gateway?.checkProfileUsername ?? checkProfileUsername)(handle)
        .then(result => {
          if (active)
            setUsernameState(
              result.available || handle === profile?.handle
                ? 'available'
                : 'taken',
            );
        })
        .catch(() => {
          if (active) setUsernameState('error');
        });
    }, 300);
    return () => {
      active = false;
      clearTimeout(timeout);
    };
  }, [
    gateway?.checkProfileUsername,
    profile?.handle,
    record?.profileDraft?.handle,
    record?.step,
    user?.uid,
  ]);

  useEffect(() => {
    if (
      record?.step !== 'finish' ||
      !record.result ||
      !user?.uid ||
      record.result.membership === 'pending'
    )
      return;
    let active = true;
    setEligible(undefined);
    setEligibilityError(false);
    const circleId = record.result.circleId;
    if (gateway?.checkEligibility) {
      const timezone =
        record.selection?.kind === 'circle'
          ? record.selection.circle.timezone
          : record.draft.timezone;
      gateway
        .checkEligibility(circleId, user.uid, timezone)
        .then(value => {
          if (active) setEligible(value);
        })
        .catch(() => {
          if (active) setEligibilityError(true);
        });
      return () => {
        active = false;
      };
    }
    Promise.all([
      firebaseFirestore()
        .collection('circles')
        .doc(circleId)
        .collection('members')
        .doc(user.uid)
        .get(),
      firebaseFirestore()
        .collection('userPrivate')
        .doc(user.uid)
        .collection('opportunities')
        .where('circleId', '==', circleId)
        .get(),
    ])
      .then(([membership, opportunities]) => {
        if (!active) return;
        const timezone =
          record.selection?.kind === 'circle'
            ? record.selection.circle.timezone
            : record.draft.timezone;
        const today = DateTime.now().setZone(timezone).toISODate() ?? '';
        setEligible(
          membership.data()?.status === 'active' &&
            opportunities.docs.some(doc => {
              const opportunity = doc.data();
              return (
                opportunity.availableDateKey <= today &&
                opportunity.expiresDateKey >= today &&
                ['available', 'upcoming'].includes(opportunity.status)
              );
            }),
        );
      })
      .catch(() => {
        if (active) setEligibilityError(true);
      });
    return () => {
      active = false;
    };
  }, [
    gateway,
    checkTick,
    record?.draft.timezone,
    record?.result,
    record?.selection,
    record?.step,
    user?.uid,
  ]);

  const finish = useCallback(
    (destination: 'home' | 'circle' | 'tapIn' = 'home') => {
      const current = useSetupJourneyStore.getState().records[key];
      if (!current || current.status !== 'saved' || finished.current) return;
      const pendingAction =
        current.pendingAction ?? useSessionStore.getState().pendingAction;
      const circleId = current.result?.circleId;
      finished.current = true;
      useOnboardingStore.getState().completeSavedSetup(current.requestId);
      useSetupJourneyStore.getState().discard(key);
      useSessionStore.getState().clearPendingAction();
      if (current.selection?.kind === 'circle' && current.selection.inviteCode)
        useCircleInviteStore.getState().clearInvite();
      if (!circleId && pendingAction) {
        const target =
          pendingAction.type === 'createCircle'
            ? {name: 'CreateCircle'}
            : pendingAction.type === 'joinCircle'
            ? {
                name: 'CircleDetail',
                params: {
                  circleId: pendingAction.circleId,
                  resumeAction: 'join',
                },
              }
            : pendingAction.type === 'tapIn'
            ? {
                name: 'TapInComposer',
                params: {
                  circleId: pendingAction.circleId,
                  source: pendingAction.source,
                },
              }
            : {name: 'TapInPicker'};
        navigation.dispatch(
          CommonActions.reset({index: 1, routes: [{name: 'MainTabs'}, target]}),
        );
        return;
      }
      navigation.dispatch(
        CommonActions.reset({
          index: destination !== 'home' && circleId ? 1 : 0,
          routes: [
            {name: 'MainTabs', params: {screen: 'Home'}},
            ...(destination !== 'home' && circleId
              ? [
                  {
                    name:
                      destination === 'tapIn'
                        ? 'TapInComposer'
                        : 'CircleDetail',
                    params:
                      destination === 'tapIn'
                        ? {circleId, source: 'tap_in'}
                        : {circleId},
                  },
                ]
              : []),
          ],
        }),
      );
    },
    [key, navigation],
  );

  const later = () => {
    if (saving.current || authUi.busy) return;
    patch({
      deferred: true,
      pendingAction:
        useSessionStore.getState().pendingAction ?? record?.pendingAction,
    });
    if (isOnboarding) {
      useOnboardingStore.getState().markSeen();
      useOnboardingStore.getState().clearStarterCircleSetup();
      useSessionStore.getState().clearPendingAction();
      if (activeInvite) useCircleInviteStore.getState().clearInvite();
    }
    navigation.dispatch(
      CommonActions.reset({
        index: 0,
        routes: [{name: 'MainTabs', params: {screen: 'Home'}}],
      }),
    );
  };

  const save = useCallback(async () => {
    const current = useSetupJourneyStore.getState().records[key];
    const account = gateway?.getCurrentUser
      ? gateway.getCurrentUser()
      : firebaseAuth().currentUser;
    if (
      !current ||
      !account ||
      saving.current ||
      current.status === 'saved' ||
      current.status === 'saving'
    )
      return;
    const draft = current.submittedDraft ?? current.draft;
    const existingProfile = useUserProfileStore.getState().profile;
    const form = current.profileDraft ?? {
      name: account.displayName ?? '',
      handle: '',
    };
    if (
      !existingProfile?.onboardingStatus &&
      (!form.name.trim() ||
        !/^[a-z0-9_]{3,20}$/.test(form.handle.trim().toLowerCase()))
    ) {
      setError(
        'Enter your name and a username of 3 to 20 letters, numbers, or underscores.',
      );
      setStep('profile');
      return;
    }
    if (
      current.selection?.kind !== 'circle' &&
      draft.commitment &&
      validateSetup(draft)
    ) {
      setError(validateSetup(draft));
      return;
    }
    saving.current = true;
    patch({status: 'saving', submittedDraft: draft, ownerUid: account.uid});
    setError(undefined);
    let uploadingAvatar = false;
    try {
      let avatarUrl = form.avatarRemoved
        ? undefined
        : form.avatarUrl ?? existingProfile?.avatarUrl;
      if (form.avatarUri && !form.avatarUrl) {
        uploadingAvatar = true;
        avatarUrl = await (gateway?.uploadProfileAvatar ?? uploadProfileAvatar)(
          {
            uid: account.uid,
            uri: form.avatarUri,
            versioned: true,
          },
        );
        uploadingAvatar = false;
        patch({profileDraft: {...form, avatarUrl}});
      }
      const payload = {
        displayName: existingProfile?.onboardingStatus
          ? existingProfile.name
          : form.name.trim(),
        handle: existingProfile?.onboardingStatus
          ? existingProfile.handle
          : form.handle.trim().toLowerCase(),
        timezone: existingProfile?.timezone ?? draft.timezone,
        ...(form.avatarRemoved
          ? {avatarUrl: null}
          : avatarUrl
          ? {avatarUrl}
          : {}),
        onboardingPreferences: {categories: current.interests},
      };
      let result: SetupJourney['result'];
      if (current.selection?.kind === 'circle') {
        if (!existingProfile?.onboardingStatus)
          await (gateway?.completeProfile ?? completeProfile)(payload);
        const joined = await (gateway?.joinCircle ?? joinCircle)(
          current.selection.circle.id,
          current.selection.inviteCode,
        );
        result = {
          circleId: current.selection.circle.id,
          membership: joined.status,
        };
      } else if (draft.commitment.trim()) {
        if (isOnboarding) {
          const completed = await (gateway?.completeProfile ?? completeProfile)(
            {
              ...payload,
              starterCircle: {
                ...buildCreateCirclePayload(draft),
                setupId: current.requestId,
              },
            },
          );
          if (!completed.starterCircle)
            throw new Error('Could not confirm your commitment was saved.');
          result = {...completed.starterCircle, membership: 'active'};
        } else {
          const created = await (gateway?.createCircle ?? createCircle)({
            ...buildCreateCirclePayload(draft),
            requestId: current.requestId,
          });
          result = {...created, membership: 'active'};
        }
      } else {
        await (gateway?.completeProfile ?? completeProfile)(payload);
      }
      useOnboardingStore.setState({
        categories: current.interests,
        displayName: payload.displayName,
        handle: payload.handle,
        ...(useOnboardingStore.getState().starterCircleSetupId ===
        current.requestId
          ? {starterCircleDraft: draft}
          : {}),
      });
      patch({
        status: 'saved',
        result,
        step:
          isOnboarding &&
          (current.needsReminders ?? !existingProfile?.onboardingStatus)
            ? 'reminders'
            : 'finish',
      });
      if (!result && !isOnboarding) finish();
    } catch (failure) {
      const code = (failure as {code?: string}).code ?? '';
      if (uploadingAvatar) {
        patch({status: 'editing', step: 'profile', submittedDraft: undefined});
        setError(
          'Couldn’t upload your photo. Try again or remove it to continue.',
        );
      } else if (code.includes('already-exists')) {
        patch({status: 'editing', step: 'profile', submittedDraft: undefined});
        setUsernameState('taken');
      } else if (code.includes('invalid-argument')) {
        patch({
          status: 'editing',
          step: existingProfile?.onboardingStatus ? 'review' : 'profile',
          submittedDraft: undefined,
        });
      } else
        patch({
          status: 'error',
          step: code.includes('resource-exhausted')
            ? 'full'
            : code.includes('not-found')
            ? 'unavailable'
            : 'saveError',
        });
      if (!uploadingAvatar)
        setError(
          code.includes('already-exists')
            ? 'That username is taken. Try another.'
            : (
                (failure as {message?: string}).message ??
                'Could not confirm your setup was saved. Try again.'
              ).replace(/^\[[^\]]+\]\s*/, ''),
        );
    } finally {
      saving.current = false;
    }
  }, [finish, gateway, isOnboarding, key, patch, setStep]);

  useEffect(() => {
    if (
      !record ||
      saving.current ||
      record.step !== 'account' ||
      (sessionStatus !== 'authenticatedReady' &&
        sessionStatus !== 'authenticatedIncompleteProfile')
    )
      return;
    if (sessionStatus === 'authenticatedReady') {
      save().catch(() => undefined);
    } else {
      const form = record.profileDraft ?? {name: '', handle: ''};
      patch({
        profileDraft: {
          ...form,
          name: form.name || user?.displayName || '',
          avatarUrl: form.avatarRemoved
            ? undefined
            : form.avatarUrl ?? user?.photoURL,
        },
        step: 'profile',
      });
    }
  }, [patch, record, save, sessionStatus, setStep, user]);

  useEffect(() => {
    if (
      record?.step === 'welcome' &&
      sessionStatus === 'authenticatedIncompleteProfile'
    )
      setStep('profile');
  }, [record?.step, sessionStatus, setStep]);

  useFocusEffect(
    useCallback(() => {
      if (Platform.OS !== 'android') {
        return;
      }
      const listener = BackHandler.addEventListener('hardwareBackPress', () => {
        backAction.current?.();
        return true;
      });
      return () => listener.remove();
    }, []),
  );
  const localStarters = useMemo(
    () => recommendStarters(record?.customText ?? '', record?.interests ?? []),
    [record?.customText, record?.interests],
  );
  if (!hydrated || !record)
    return (
      <View style={[styles.loading, {backgroundColor: theme.background}]}>
        <ActivityIndicator color={theme.accent} />
      </View>
    );
  const {step, draft} = record;
  const busy =
    record.status === 'saving' || (step === 'account' && authUi.busy);
  const blockedEdits = Boolean(
    record.submittedDraft && ['error', 'saving'].includes(record.status),
  );
  const changeDraft = (next: typeof draft) => {
    if (blockedEdits) return;
    let updated = next;
    const counts = {
      ...(record.paceCounts ?? {
        weekly:
          draft.commitmentCadence === 'weekly'
            ? draft.commitmentFrequency.tapInsPerWeek
            : 4,
        monthly:
          draft.commitmentCadence === 'monthly'
            ? draft.commitmentFrequency.opportunitiesPerPeriod ??
              draft.commitmentFrequency.tapInsPerWeek
            : 16,
      }),
    };
    if (next.commitmentCadence !== draft.commitmentCadence)
      updated = {
        ...next,
        commitmentFrequency: {
          tapInsPerWeek: counts.weekly,
          opportunitiesPerPeriod: counts.monthly,
        },
      };
    else if (step === 'frequency') {
      if (next.commitmentCadence === 'weekly')
        counts.weekly = next.commitmentFrequency.tapInsPerWeek;
      else if (next.commitmentCadence === 'monthly')
        counts.monthly = next.commitmentFrequency.opportunitiesPerPeriod ?? 16;
    }
    const goalDrafts = {...record.goalDrafts};
    if (next.commitmentType !== draft.commitmentType) {
      goalDrafts[draft.commitmentType] = {
        targetValue: draft.targetValue,
        minimumValue: draft.minimumValue,
        maximumValue: draft.maximumValue,
        unitLabel: draft.unitLabel,
        buildTrackingMode: draft.buildTrackingMode,
      };
      updated = {
        ...updated,
        ...(goalDrafts[next.commitmentType] ??
          (next.commitmentType === 'limit' && draft.unitLabel === 'Tap In'
            ? {unitLabel: ''}
            : {})),
      };
    }
    patch({draft: updated, paceCounts: counts, goalDrafts});
  };
  const next = () => {
    const validation = validateSetupStep(step, draft);
    if (validation) {
      setError(validation);
      return;
    }
    if (record.reviewReturn) {
      const followUp =
        step === 'pace' && draft.commitmentCadence !== 'daily'
          ? 'frequency'
          : step === 'type' && draft.commitmentType !== 'avoid'
          ? 'goal'
          : undefined;
      patch({step: followUp ?? 'review', reviewReturn: Boolean(followUp)});
      return;
    }
    const steps = setupSteps(draft);
    const index = steps.indexOf(step);
    setStep(steps[index + 1] ?? 'review');
  };
  const back = () => {
    if (busy) return;
    if (step === 'finish') {
      finish();
      return;
    }
    if (step === 'reminders') {
      if (record.result) setStep('finish');
      else finish();
      return;
    }
    if (blockedEdits && step !== 'saveError') {
      setError('Try again to confirm the submitted setup before changing it.');
      return;
    }
    if (step === 'interests') {
      setStep('welcome');
      return;
    }
    if (step === 'suggestions') {
      if (isOnboarding) setStep('interests');
      else later();
      return;
    }
    if (record.reviewReturn || step === 'saveError') {
      patch({step: 'review', reviewReturn: false});
      return;
    }
    if (step === 'account' && authBack.current?.()) return;
    if (step === 'account' || step === 'profile') {
      setStep(record.selection?.kind === 'circle' ? 'joinPreview' : 'review');
      return;
    }
    const steps = setupSteps(draft);
    const index = steps.indexOf(step);
    if (index > 0) setStep(steps[index - 1]);
    else later();
  };
  backAction.current = back;
  const chooseAnother = () => {
    if (!activeInvite) {
      patch({
        selection: undefined,
        status: 'editing',
        submittedDraft: undefined,
        step: 'suggestions',
      });
      return;
    }
    useCircleInviteStore.getState().clearInvite();
    const normal =
      useSetupJourneyStore.getState().records.onboarding ??
      createSetupJourney('suggestions', profile?.timezone);
    ensure('onboarding', normal);
    update('onboarding', {
      ...normal,
      step: 'suggestions',
      completed: false,
      deferred: false,
      status: 'editing',
      selection:
        normal.selection?.kind === 'circle' ? undefined : normal.selection,
    });
    useOnboardingStore.setState({
      journey: 'standard',
      hasSeenOnboarding: false,
      hasPendingProfileCompletion: true,
      hasPendingStarterCircleSetup: true,
    });
    navigation.replace('Auth', {
      screen: 'Welcome',
      params: {setupKey: 'onboarding'},
    });
  };
  const signIn = () => {
    if (step === 'welcome') useOnboardingStore.getState().markSeen();
    if (onSignIn) onSignIn();
    else
      navigation.navigate('Auth', {
        screen: 'SignIn',
        params: {entryPoint: 'welcome'},
      });
  };
  let content: React.ReactNode;
  let copy = setupCopy(step, draft);
  let primary:
    | {label: string; onPress: () => void; disabled?: boolean}
    | undefined = {label: 'Continue', onPress: next, disabled: busy};
  let secondary:
    | {label: string; onPress: () => void; disabled?: boolean}
    | undefined;
  let tertiary:
    | {label: string; onPress: () => void; disabled?: boolean}
    | undefined;
  const contextCard = (
    title: string,
    commitment: string,
    category: string,
    appearance = draft.appearance,
    featured = false,
  ) => (
    <View
      style={[
        styles.card,
        {backgroundColor: theme.surfaceSoft},
        featured && styles.welcomeCard,
        featured && {
          backgroundColor: theme.isDark
            ? `${getCircleCategoryVisual(category, appearance).accentColor}20`
            : getCircleCategoryVisual(category, appearance).backplateColor,
          borderColor: theme.border,
          shadowColor: theme.isDark ? '#000000' : '#92723E',
        },
      ]}>
      <CircleCategoryIcon
        category={category}
        appearance={appearance}
        size={44}
      />
      <View style={styles.flex}>
        <HoystText style={styles.cardTitle}>{title}</HoystText>
        {title !== commitment && (
          <HoystText tone="muted" style={styles.copy}>
            {commitment}
          </HoystText>
        )}
      </View>
    </View>
  );
  if (step === 'welcome') {
    copy = {
      title: "Let's get started!",
      message:
        'Start with something small. I’ll help you find a commitment that fits your life.',
      emphasis: ['something small', 'fits your life'],
    };
    content = (
      <>
        {contextCard(
          'Walk for 20 minutes',
          'A little movement, 4 Tap Ins per week.',
          'Fitness',
          {},
          true,
        )}
      </>
    );
    primary = {
      label: 'Get started',
      onPress: () => setStep('interests'),
      disabled: false,
    };
    secondary = {label: 'Sign in', onPress: signIn};
    tertiary = {label: 'Browse for now', onPress: later};
  } else if (step === 'interests') {
    copy = {
      title: 'What matters to you?',
      message: 'Pick up to 3 interests. I’ll help you find a starting point.',
      emphasis: ['up to 3 interests'],
    };
    content = (
      <View style={styles.grid}>
        {categories.map(category => (
          <Pressable
            key={category.label}
            accessibilityRole="checkbox"
            accessibilityState={{
              checked: record.interests.includes(category.label),
            }}
            onPress={() => {
              const selected = record.interests.includes(category.label);
              if (!selected && record.interests.length === 3) {
                setError('Choose up to 3 interests.');
                return;
              }
              patch({
                interests: selected
                  ? record.interests.filter(value => value !== category.label)
                  : [...record.interests, category.label],
              });
              setError(undefined);
            }}
            style={[
              styles.interest,
              {
                backgroundColor: theme.surfaceSoft,
                borderColor: record.interests.includes(category.label)
                  ? theme.accent
                  : 'transparent',
              },
            ]}>
            <CircleCategoryIcon category={category.label} size={36} />
            <HoystText style={[styles.copy, styles.flex]}>
              {category.label}
            </HoystText>
            {record.interests.includes(category.label) && (
              <Check color={theme.accentForeground} size={16} />
            )}
          </Pressable>
        ))}
      </View>
    );
    primary = {
      label: 'Find my starting point',
      onPress: () => setStep('suggestions'),
      disabled: false,
    };
    tertiary = {
      label: 'Skip for now',
      onPress: () => {
        patch({interests: []});
        setStep('suggestions');
      },
    };
  } else if (step === 'suggestions') {
    copy = {
      title: 'What will you show up for?',
      message: 'A small promise is a good place to start.',
      emphasis: ['small promise'],
    };
    const templateCount = circles.length ? 2 : 3;
    content = (
      <>
        <HoystText style={styles.section}>Try one of these</HoystText>
        {localStarters.slice(0, 1).map(starter => (
          <SetupChoice
            key={starter.id}
            title={starter.commitment}
            tag="Create your own"
            body={paceLabel(applyStarter(draft, starter))}
            icon={<CircleCategoryIcon category={starter.category} size={40} />}
            tone={getCircleCategoryVisual(starter.category).palette}
            selected={
              record.selection?.kind === 'template' &&
              record.selection.id === starter.id
            }
            onPress={() =>
              patch({
                selection: {kind: 'template', id: starter.id},
                draft: applyStarter(draft, starter),
              })
            }
          />
        ))}
        {circles[0] && (
          <SetupChoice
            title={circles[0].title}
            tag="Join a Circle"
            body={`${circles[0].memberCount} of ${
              circles[0].maxSize
            } people · ${paceLabel(circles[0])}`}
            icon={
              <CircleCategoryIcon
                category={circles[0].category}
                appearance={circles[0].appearance}
                size={40}
              />
            }
            tone={
              getCircleCategoryVisual(
                circles[0].category,
                circles[0].appearance,
              ).palette
            }
            selected={
              record.selection?.kind === 'circle' &&
              record.selection.circle.id === circles[0].id
            }
            onPress={() =>
              patch({selection: {kind: 'circle', circle: circles[0]}})
            }
          />
        )}
        {localStarters.slice(1, templateCount).map(starter => (
          <SetupChoice
            key={starter.id}
            title={starter.commitment}
            tag="Create your own"
            body={paceLabel(applyStarter(draft, starter))}
            icon={<CircleCategoryIcon category={starter.category} size={40} />}
            tone={getCircleCategoryVisual(starter.category).palette}
            selected={
              record.selection?.kind === 'template' &&
              record.selection.id === starter.id
            }
            onPress={() =>
              patch({
                selection: {kind: 'template', id: starter.id},
                draft: applyStarter(draft, starter),
              })
            }
          />
        ))}
        {discoveryBusy && <ActivityIndicator color={theme.accent} />}
        {discoveryError && (
          <HoystText tone="muted" style={styles.helper}>
            Public Circles couldn’t load. You can still create your commitment.
          </HoystText>
        )}
        <View style={[styles.divider, {backgroundColor: theme.border}]} />
        <HoystText style={styles.section}>
          ..or create your own commitment
        </HoystText>
        <HoystInput
          accessibilityLabel="Your commitment"
          style={{borderRadius: 12, minHeight: 48}}
          placeholder="e.g. Take a short walk"
          value={record.customText}
          maxLength={160}
          onChangeText={customText =>
            patch({
              customText,
              selection: {kind: 'custom'},
              draft: {
                ...draft,
                commitment: customText,
                commitmentType: 'build',
                title: customText.slice(0, 80),
                buildTrackingMode: 'confirmation',
              },
            })
          }
        />
      </>
    );
    primary = {
      label: 'Make it mine',
      disabled: !record.selection || busy,
      onPress: () => {
        if (record.selection?.kind === 'circle') setStep('joinPreview');
        else next();
      },
    };
  } else if (step === 'joinPreview') {
    const selection = record.selection;
    copy = {
      title:
        activeInvite || (selection?.kind === 'circle' && selection.inviteCode)
          ? 'You’re invited'
          : 'A little easier together',
      message: 'See if this Circle feels right for you.',
      emphasis: ['this Circle'],
    };
    if (selection?.kind === 'circle') {
      const circle = selection.circle;
      content = (
        <>
          {contextCard(
            circle.title,
            circle.commitment,
            circle.category,
            circle.appearance,
          )}
          <HoystText style={styles.cardTitle}>{paceLabel(circle)}</HoystText>
          <HoystText style={styles.copy}>
            Goal for each Tap In:{' '}
            {goalLabel({
              ...circle,
              buildTrackingMode:
                circle.buildTrackingMode ??
                ((circle.targetValue ?? 1) > 1 ? 'quantity' : 'confirmation'),
            })}
          </HoystText>
          <HoystText tone="muted" style={styles.copy}>
            {circle.memberCount} of {circle.maxSize} people ·{' '}
            {circle.joinMode === 'request_to_join'
              ? 'Request approval'
              : 'Open seats'}
          </HoystText>
          <HoystText tone="muted" style={styles.copy}>
            {circle.timezone}
          </HoystText>
          <HoystText tone="muted" style={styles.helper}>
            {selection.inviteCode
              ? 'This invitation gives you access to the Circle’s joining rules.'
              : 'Public Tap In previews show your name, avatar, and time. Notes and photos stay in the Circle.'}
          </HoystText>
        </>
      );
    } else content = <ActivityIndicator color={theme.accent} />;
    primary = {
      label:
        sessionStatus === 'authenticatedReady'
          ? existingInviteMembership
            ? 'View Circle'
            : record.selection?.kind === 'circle' &&
              record.selection.circle.joinMode === 'request_to_join'
            ? 'Request to join'
            : 'Join Circle'
          : activeInvite
          ? 'Accept invite'
          : 'Continue to join',
      disabled: busy || !selection,
      onPress: () => {
        if (activeInvite) useCircleInviteStore.getState().consentToJoin();
        if (sessionStatus === 'authenticatedReady')
          save()
            .then(() => {
              if (existingInviteMembership) finish('circle');
            })
            .catch(() => undefined);
        else setStep('account');
      },
    };
    tertiary = {
      label: 'Choose another',
      onPress: () => {
        if (activeInvite) later();
        else setStep('suggestions');
      },
    };
  } else if (step === 'account') {
    copy = {
      title: authUi.title,
      message: authUi.message,
      emphasis: authUi.emphasis,
    };
    content = (
      <SetupAuthForm
        creating
        actionRef={authAction}
        backRef={authBack}
        onState={setAuthUi}
      />
    );
    primary = authUi.method
      ? {
          label: authUi.label,
          disabled: authUi.disabled || busy,
          onPress: () => authAction.current?.(),
        }
      : undefined;
    tertiary = {
      label: 'Already have an account? Sign in',
      onPress: signIn,
      disabled: busy,
    };
  } else if (step === 'profile') {
    copy = {
      title: 'Make yourself known',
      message: 'What should we call you? A photo helps people recognize you.',
      emphasis: ['call you', 'A photo'],
    };
    const form = record.profileDraft ?? {
      name: profile?.name ?? user?.displayName ?? '',
      handle: profile?.handle ?? '',
    };
    const profilePatch = (value: Partial<typeof form>) =>
      !busy && patch({profileDraft: {...form, ...value}});
    const pickPhoto = async () => {
      try {
        const picked = await launchImageLibrary({
          mediaType: 'photo',
          selectionLimit: 1,
          quality: 0.8,
        });
        if (picked.errorCode)
          throw new Error(picked.errorMessage ?? 'Could not open photos.');
        if (picked.assets?.[0]?.uri)
          profilePatch({
            avatarUri: picked.assets[0].uri,
            avatarUrl: undefined,
            avatarRemoved: false,
          });
      } catch (failure) {
        setError((failure as Error).message);
      }
    };
    content = (
      <>
        <View style={styles.photoWrap}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Add optional profile photo"
            disabled={busy}
            onPress={() => {
              pickPhoto().catch(() => undefined);
            }}
            style={[styles.avatar, {backgroundColor: theme.surfaceSoft}]}>
            {form.avatarUri || form.avatarUrl ? (
              <Image
                source={{uri: form.avatarUri ?? form.avatarUrl}}
                style={styles.avatarImage}
              />
            ) : (
              <UserRound color={theme.accentForeground} size={40} />
            )}
            <View style={[styles.pencil, {backgroundColor: theme.surfaceHigh}]}>
              <Pencil color={theme.accentForeground} size={16} />
            </View>
          </Pressable>
          <Pressable
            accessibilityRole="button"
            disabled={busy}
            onPress={() => {
              pickPhoto().catch(() => undefined);
            }}
            style={styles.touch}>
            <HoystText style={{color: theme.accentForeground}}>
              Add photo
            </HoystText>
          </Pressable>
          <HoystText tone="muted" style={styles.helper}>
            Optional
          </HoystText>
          {(form.avatarUri || form.avatarUrl) && (
            <Pressable
              accessibilityRole="button"
              onPress={() =>
                profilePatch({
                  avatarUri: undefined,
                  avatarUrl: undefined,
                  avatarRemoved: true,
                })
              }
              style={styles.touch}>
              <HoystText tone="muted" style={styles.helper}>
                Remove photo
              </HoystText>
            </Pressable>
          )}
        </View>
        <SetupField
          label="Name"
          disabled={busy}
          value={form.name}
          maxLength={60}
          onChange={name => profilePatch({name})}
        />
        <SetupField
          label="Username"
          prefix="@"
          disabled={busy}
          value={form.handle}
          maxLength={20}
          onChange={handle =>
            profilePatch({
              handle: handle.toLowerCase().replace(/[^a-z0-9_]/g, ''),
            })
          }
          helper="3 to 20 letters, numbers, or underscores"
        />
        {usernameState && (
          <HoystText
            tone={
              usernameState === 'taken'
                ? 'danger'
                : usernameState === 'available'
                ? 'success'
                : 'muted'
            }
            style={styles.helper}>
            {usernameState === 'checking'
              ? 'Checking username…'
              : usernameState === 'available'
              ? 'Username available'
              : usernameState === 'taken'
              ? 'That username is taken'
              : 'Could not check the username. Saving will check it again.'}
          </HoystText>
        )}
      </>
    );
    primary = {
      label: busy ? 'Saving…' : 'Save and continue',
      disabled:
        busy ||
        !form.name.trim() ||
        !/^[a-z0-9_]{3,20}$/.test(form.handle) ||
        usernameState === 'taken' ||
        usernameState === 'checking',
      onPress: () => {
        save().catch(() => undefined);
      },
    };
  } else if (step === 'reminders') {
    copy = {
      title: 'A little nudge?',
      message: 'I can remind you when your next Tap In opens. Want me to?',
      emphasis: ['next Tap In opens'],
    };
    const title =
      record.selection?.kind === 'circle'
        ? record.selection.circle.title
        : draft.title;
    content = (
      <>
        <HoystText tone="muted" style={styles.helper}>
          Example notification
        </HoystText>
        <View
          style={[
            styles.notification,
            {
              backgroundColor: theme.isDark
                ? '#242431'
                : Platform.OS === 'ios'
                ? '#E9E9EE'
                : '#F2F2F5',
            },
          ]}>
          {Platform.OS === 'ios' ? (
            <Image
              source={require('../../../assets/brand/icon-black.png')}
              style={styles.notificationIcon}
            />
          ) : null}
          <View style={styles.flex}>
            <View style={styles.notificationHeader}>
              <View
                style={{flexDirection: 'row', alignItems: 'center', gap: 8}}>
                {Platform.OS === 'android' && (
                  <Image
                    source={require('../../../assets/brand/icon-black.png')}
                    style={styles.smallIcon}
                  />
                )}
                <HoystText
                  style={
                    Platform.OS === 'android' ? styles.copy : styles.cardTitle
                  }>
                  Hoyst
                </HoystText>
                {Platform.OS === 'android' && (
                  <HoystText tone="muted" style={styles.helper}>
                    · now
                  </HoystText>
                )}
              </View>
              {Platform.OS === 'android' ? (
                <ChevronDown color={theme.textMuted} size={16} />
              ) : (
                <HoystText tone="muted" style={styles.helper}>
                  now
                </HoystText>
              )}
            </View>
            <HoystText style={styles.cardTitle}>
              Ready for your next Tap In?
            </HoystText>
            <HoystText style={styles.copy}>
              Your Tap In window is open in {title || 'your Circle'}.
            </HoystText>
          </View>
        </View>
        <HoystText tone="muted" style={styles.helper}>
          You can change this later in Settings.
        </HoystText>
      </>
    );
    primary = {
      label: 'Enable reminders',
      disabled: busy,
      onPress: () => {
        (
          gateway?.requestPushNotificationPermission ??
          requestPushNotificationPermission
        )()
          .catch(() => false)
          .finally(() => {
            if (record.result) setStep('finish');
            else finish();
          });
      },
    };
    tertiary = {
      label: 'Not now',
      onPress: () => {
        if (record.result) setStep('finish');
        else finish();
      },
    };
  } else if (step === 'finish') {
    const pending = record.result?.membership === 'pending';
    const title =
      record.selection?.kind === 'circle'
        ? record.selection.circle.title
        : draft.title;
    const commitment =
      record.selection?.kind === 'circle'
        ? record.selection.circle.commitment
        : draft.commitment;
    copy = {
      title: pending
        ? 'Your request is in'
        : eligible
        ? 'Ready for your first Tap In?'
        : 'You’re in',
      message: pending
        ? 'The Circle owner will review your request. You can explore while you wait.'
        : eligible
        ? 'Your starting point is ready. Want to show up for it now?'
        : 'Your place is ready. Your first Tap In window will open with the next round.',
      emphasis: pending
        ? ['review your request']
        : eligible
        ? ['starting point is ready']
        : ['first Tap In window', 'next round'],
    };
    content = (
      <>
        {contextCard(
          title,
          commitment,
          record.selection?.kind === 'circle'
            ? record.selection.circle.category
            : draft.category,
        )}
        {pending && (
          <HoystText tone="muted" style={styles.copy}>
            Awaiting approval. You can Tap In once you’re approved and a window
            is open.
          </HoystText>
        )}
        {!pending && eligible === undefined && !eligibilityError && (
          <ActivityIndicator color={theme.accent} />
        )}
        {!pending && eligible === false && (
          <HoystText tone="muted" style={styles.copy}>
            Waiting for your first Tap In window.
          </HoystText>
        )}
        {eligibilityError && (
          <HoystText tone="danger" style={styles.copy}>
            Couldn’t check your next Tap In. Try again or view the Circle.
          </HoystText>
        )}
      </>
    );
    primary = {
      label: eligibilityError
        ? 'Check again'
        : eligible
        ? 'Tap In now'
        : 'Go to Home',
      disabled: busy,
      onPress: () => {
        if (eligibilityError) setCheckTick(value => value + 1);
        else finish(eligible ? 'tapIn' : 'home');
      },
    };
    tertiary = {
      label: eligible ? 'Not now' : 'View Circle',
      onPress: () => finish(eligible ? 'home' : 'circle'),
    };
  } else if (step === 'saveError') {
    copy = {
      title: 'Let’s try that again',
      message:
        'I couldn’t confirm your commitment was saved. Your setup is still here.',
      emphasis: ['Your setup is still here'],
    };
    content = contextCard(draft.title, draft.commitment, draft.category);
    primary = {
      label: busy ? 'Saving…' : 'Try again',
      disabled: busy,
      onPress: () => {
        save().catch(() => undefined);
      },
    };
    tertiary = {label: 'Save for later', onPress: later};
  } else if (step === 'full' || step === 'unavailable') {
    copy = {
      title:
        step === 'full'
          ? 'This Circle just filled up'
          : 'This invite isn’t available',
      message:
        step === 'full'
          ? 'That last seat was taken. Let’s find another good fit.'
          : 'The link may have changed. Ask the person who shared it for a new one.',
      emphasis: step === 'full' ? ['last seat was taken'] : ['a new one'],
    };
    primary = {
      label: 'Find another Circle',
      disabled: false,
      onPress: chooseAnother,
    };
    tertiary = {label: 'Create my own', onPress: chooseAnother};
  } else {
    content = (
      <SetupStepContent
        step={step}
        draft={draft}
        onChange={changeDraft}
        onEdit={target => {
          if (blockedEdits) {
            setError(
              'Try again to confirm the submitted setup before changing it.',
            );
            return;
          }
          patch({step: target, reviewReturn: true});
        }}
      />
    );
    if (step === 'review')
      primary = {
        label: busy
          ? 'Saving…'
          : isOnboarding && sessionStatus !== 'authenticatedReady'
          ? 'Continue'
          : 'Create commitment',
        disabled: busy,
        onPress: () => {
          const validation = validateSetup(draft);
          if (validation) {
            setError(validation);
            return;
          }
          if (sessionStatus === 'authenticatedReady')
            save().catch(() => undefined);
          else setStep('account');
        },
      };
  }
  const phase = ['welcome'].includes(step)
    ? undefined
    : [
        'interests',
        'suggestions',
        'joinPreview',
        'full',
        'unavailable',
      ].includes(step)
    ? 'Discover'
    : ['account', 'profile', 'reminders', 'finish', 'saveError'].includes(step)
    ? 'Start'
    : 'Set up';
  return (
    <SetupJourneyFrame
      brand={
        step === 'welcome' ? (
          <BrandMark
            kind="logo"
            isDark={theme.isDark}
            style={[
              styles.logo,
              // Align the artwork, accounting for each PNG's transparent gutter.
              {marginLeft: -(theme.isDark ? 83 : 94) / 20},
            ]}
          />
        ) : undefined
      }
      title={copy.title}
      message={copy.message}
      messageEmphasis={copy.emphasis}
      footerVariant={step === 'welcome' ? 'welcome' : 'standard'}
      phase={phase}
      step={step}
      onBack={step === 'welcome' || step === 'finish' ? undefined : back}
      onLater={
        ['welcome', 'reminders', 'finish', 'saveError'].includes(step)
          ? undefined
          : later
      }
      primary={primary}
      secondary={secondary}
      tertiary={tertiary}
      tertiaryPresentation={step === 'interests' ? 'link' : 'button'}
      footerNote={
        step === 'review'
          ? draft.circleMode === 'personal'
            ? 'Only you can see this commitment and its activity.'
            : draft.privacy === 'public'
            ? 'Public previews show your name, avatar, and Tap In time. Notes and photos stay in the Circle.'
            : 'This Circle is hidden from Explore.'
          : undefined
      }
      error={error}>
      {content}
    </SetupJourneyFrame>
  );
}

const styles = StyleSheet.create({
  loading: {flex: 1, alignItems: 'center', justifyContent: 'center'},
  flex: {flex: 1},
  logo: {alignSelf: 'flex-start', width: 95, height: 40},
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 14,
    borderRadius: 20,
  },
  cardTitle: {fontSize: 16, lineHeight: 21, fontWeight: '700'},
  welcomeCard: {...softShadow, borderWidth: StyleSheet.hairlineWidth},
  copy: {fontSize: 14, lineHeight: 20},
  section: {fontSize: 18, lineHeight: 23, fontWeight: '600'},
  helper: {fontSize: 12, lineHeight: 16},
  divider: {height: StyleSheet.hairlineWidth, marginVertical: 4},
  grid: {flexDirection: 'row', flexWrap: 'wrap', gap: 8},
  interest: {
    width: '48%',
    minHeight: 76,
    padding: 12,
    borderRadius: 16,
    borderWidth: 1.5,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  photoWrap: {alignItems: 'center', gap: 4},
  avatar: {
    height: 80,
    width: 80,
    borderRadius: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarImage: {height: 80, width: 80, borderRadius: 40},
  pencil: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    borderRadius: 14,
    height: 28,
    width: 28,
    alignItems: 'center',
    justifyContent: 'center',
  },
  touch: {minHeight: 44, justifyContent: 'center'},
  notification: {
    padding: 14,
    borderRadius: 20,
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
  },
  notificationHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
    marginBottom: 4,
  },
  notificationIcon: {
    height: 32,
    width: 32,
    borderRadius: 8,
    backgroundColor: '#FFFFFF',
  },
  smallIcon: {height: 18, width: 18, borderRadius: 4},
});
