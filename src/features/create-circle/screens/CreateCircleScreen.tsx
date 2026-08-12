import React, {useEffect, useMemo, useRef, useState} from 'react';
import {Alert, Pressable, Share, StyleSheet, View} from 'react-native';
import {Check, Share2} from 'lucide-react-native';
import type {NativeStackScreenProps} from '@react-navigation/native-stack';

import {GlassPanel} from '../../../design/components/GlassPanel';
import {FrostedBackdrop} from '../../../design/components/FrostedBackdrop';
import {HoystButton} from '../../../design/components/HoystButton';
import {HoystChip} from '../../../design/components/HoystChip';
import {HoystInput} from '../../../design/components/HoystInput';
import {HoystScreen} from '../../../design/components/HoystScreen';
import {HoystText} from '../../../design/components/HoystText';
import {CircleCategoryPill} from '../../../design/components/CircleCategoryIcon';
import {radius} from '../../../design/tokens/radius';
import {useHoystTheme} from '../../../design/theme/useHoystTheme';
import {useUserProfileStore} from '../../../store/profile-store';
import {TimezonePicker} from '../../auth/components/TimezonePicker';
import {createCircle} from '../../circles/services/circle-service';
import {
  buildCreateCirclePayload,
  clampCircleMaxSize,
  createInitialCircleDraft,
  defaultMonthlyCommitmentFrequency,
  defaultWeeklyCommitmentFrequency,
  getPrivacyChoiceFields,
  normalizeSkipGraceRule,
} from '../services/create-circle-draft';
import type {
  CircleJoinMode,
  CirclePrivacyMode,
  CommitmentPace,
  CommitmentType,
  CreateCircleDraft,
} from '../../../types/models';
import type {RootStackParamList} from '../../../navigation/types';
import {CommitmentSetupScaffold} from '../components/CommitmentSetupScaffold';
import {
  categoryOptions,
  circleModeOptions,
  CommitmentTypeRuleSummary,
  commitmentPaceOptions,
  commitmentTypeOptions,
  formatAccessSummary,
  formatPaceSummary,
  formatJoinMode,
  formatSkipSummary,
  formatTimezoneSummary,
  getModeAwareSetupCopy,
  privacyOptions,
  publicJoinOptions,
  SetupNumericStepper,
  SetupOptionList,
  SetupSummaryRow,
} from '../components/CommitmentSetupFields';

type Props = NativeStackScreenProps<RootStackParamList, 'CreateCircle'>;
type WizardStep =
  | 'mode'
  | 'category'
  | 'title'
  | 'commitment'
  | 'commitmentFrequency'
  | 'grace'
  | 'privacy'
  | 'maxSize'
  | 'timezone'
  | 'review';

type CreatedCircle = {
  circleId: string;
  inviteCode?: string;
};

const groupWizardSteps: WizardStep[] = [
  'commitment',
  'mode',
  'category',
  'title',
  'commitmentFrequency',
  'grace',
  'privacy',
  'maxSize',
  'timezone',
  'review',
];

const personalWizardSteps: WizardStep[] = groupWizardSteps.filter(
  step => step !== 'title' && step !== 'privacy' && step !== 'maxSize',
);

const stepCopy: Record<WizardStep, {body: string; title: string}> = {
  mode: {
    body: 'Choose whether this Commitment is yours alone or shared with a Circle.',
    title: 'How do you want to commit?',
  },
  category: {
    body: 'Choose the category that best describes this Commitment.',
    title: 'What kind of Circle is this?',
  },
  commitment: {
    body: 'Make the Commitment specific enough that it is always clear what counts.',
    title: 'What is your Commitment?',
  },
  commitmentFrequency: {
    body: 'Choose the Goal for a Tap In and the Pace at which it is due.',
    title: 'Set the Goal and Pace',
  },
  grace: {
    body: 'Choose how many skips can protect Circle Progress.',
    title: 'Set the Skip allowance',
  },
  maxSize: {
    body: 'Smaller circles feel tighter. Larger circles create more social proof.',
    title: 'How many Members can join?',
  },
  privacy: {
    body: 'Choose who can discover it and how new Members enter.',
    title: 'Who can find and join it?',
  },
  review: {
    body: 'Check every detail before creating your Commitment.',
    title: 'Review your setup',
  },
  timezone: {
    body: 'This controls when each Tap In day resets for this Circle.',
    title: 'Choose the Circle timezone',
  },
  title: {
    body: 'Give the group a name Members can recognize and rally around.',
    title: 'What should this Circle be called?',
  },
};

function getInviteLink(inviteCode?: string) {
  return inviteCode ? `https://hoyst.app/join/${inviteCode}` : 'Invite ready';
}

export function CreateCircleScreen({navigation}: Props): React.JSX.Element {
  const theme = useHoystTheme();
  const profile = useUserProfileStore(state => state.profile);
  const initialDraftRef = useRef<CreateCircleDraft>(
    createInitialCircleDraft(profile?.timezone),
  );
  const allowExitRef = useRef(false);
  const [currentStep, setCurrentStep] = useState<WizardStep>('commitment');
  const [draft, setDraft] = useState<CreateCircleDraft>(() =>
    initialDraftRef.current,
  );
  const [createdCircle, setCreatedCircle] = useState<CreatedCircle>();
  const [isCreating, setIsCreating] = useState(false);
  const wizardSteps =
    draft.circleMode === 'personal' ? personalWizardSteps : groupWizardSteps;
  const currentIndex = wizardSteps.indexOf(currentStep);
  const isPersonal = draft.circleMode === 'personal';
  const modeCopy = getModeAwareSetupCopy(draft.circleMode);
  const copy = useMemo(() => {
    if (currentStep === 'category') {
      return {
        body: 'Choose the category that best describes this Commitment.',
        title: modeCopy.categoryPrompt,
      };
    }

    if (currentStep === 'grace') {
      return {
        body: `Choose how many skips can protect ${modeCopy.progressLabel}.`,
        title: 'Set the Skip allowance',
      };
    }

    if (currentStep === 'timezone') {
      return {
        body: `This controls when each Tap In day resets for this ${modeCopy.containerLabel}.`,
        title: `Choose the ${modeCopy.containerLabel} timezone`,
      };
    }

    return stepCopy[currentStep];
  }, [currentStep, modeCopy]);
  const skipRule = draft.graceRules.skip;
  const isDirty = useMemo(
    () => JSON.stringify(draft) !== JSON.stringify(initialDraftRef.current),
    [draft],
  );

  useEffect(
    () => {
      if (typeof navigation.addListener !== 'function') {
        return undefined;
      }

      return navigation.addListener('beforeRemove', event => {
        if (allowExitRef.current || !isDirty) {
          return;
        }

        event.preventDefault();
        Alert.alert(
          'Discard setup?',
          'Your Commitment setup will be lost.',
          [
            {style: 'cancel', text: 'Keep editing'},
            {
              onPress: () => {
                allowExitRef.current = true;
                navigation.dispatch(event.data.action);
              },
              style: 'destructive',
              text: 'Discard',
            },
          ],
        );
      });
    },
    [isDirty, navigation],
  );
  const canContinue = useMemo(() => {
    if (currentStep === 'category') {
      return draft.category.trim().length > 0;
    }

    if (currentStep === 'title') {
      const title = draft.title.trim();

      return title.length > 0 && title.length <= 80;
    }

    if (currentStep === 'commitment') {
      const commitment = draft.commitment.trim();

      return commitment.length > 0 && commitment.length <= 160;
    }

    if (currentStep === 'timezone') {
      return (
        draft.timezone.trim().length > 0 && draft.timezone.trim().length <= 80
      );
    }

    return true;
  }, [currentStep, draft]);

  const setField = <Key extends keyof CreateCircleDraft>(
    key: Key,
    value: CreateCircleDraft[Key],
  ) => {
    setDraft(current => ({...current, [key]: value}));
  };
  const setCommitmentType = (commitmentType: CommitmentType) => {
    setDraft(current => ({
      ...current,
      commitmentType,
      ...(commitmentType === 'build'
        ? {targetValue: current.targetValue ?? 1}
        : {}),
      ...(commitmentType === 'limit'
        ? {maximumValue: current.maximumValue ?? current.targetValue ?? 1}
        : {}),
      ...(commitmentType === 'avoid'
        ? {maximumValue: undefined, minimumValue: undefined, targetValue: 1}
        : {}),
    }));
  };
  const setQuantityField = (
    key: 'maximumValue' | 'minimumValue' | 'targetValue',
    value: string,
  ) => {
    const parsedValue = Number.parseInt(value, 10);
    const nextValue =
      Number.isFinite(parsedValue) && parsedValue >= 0 ? parsedValue : 0;

    setField(key, nextValue);
  };

  const setSkipRule = (nextRule: {allowance?: number; windowDays?: number}) => {
    setDraft(current => ({
      ...current,
      graceRules: {
        skip: normalizeSkipGraceRule({
          ...current.graceRules.skip,
          ...nextRule,
        }),
      },
    }));
  };

  const selectPrivacyMode = (privacyMode: CirclePrivacyMode) => {
    setDraft(current => {
      const publicJoinMode =
        current.joinMode === 'open' || current.joinMode === 'request_to_join'
          ? current.joinMode
          : 'request_to_join';
      const fields = getPrivacyChoiceFields(privacyMode, publicJoinMode);

      return {
        ...current,
        ...fields,
        privacyMode,
      };
    });
  };

  const selectPublicJoinMode = (
    joinMode: Extract<CircleJoinMode, 'open' | 'request_to_join'>,
  ) => {
    setDraft(current => ({
      ...current,
      joinMode,
      privacy: 'public',
      privacyMode: 'public',
    }));
  };

  const selectCommitmentPace = (commitmentPace: CommitmentPace) => {
    setDraft(current => ({
      ...current,
      commitmentCadence: commitmentPace,
      commitmentFrequency:
        commitmentPace === 'daily'
          ? {tapInsPerWeek: 7}
          : commitmentPace === 'monthly'
          ? defaultMonthlyCommitmentFrequency
          : current.commitmentFrequency.tapInsPerWeek >= 7
          ? defaultWeeklyCommitmentFrequency
          : current.commitmentFrequency,
    }));
  };

  const goBack = () => {
    if (currentIndex > 0) {
      setCurrentStep(wizardSteps[currentIndex - 1]);
      return;
    }

    navigation.goBack();
  };

  const goNext = () => {
    if (!canContinue) {
      return;
    }

    if (currentIndex < wizardSteps.length - 1) {
      setCurrentStep(wizardSteps[currentIndex + 1]);
    }
  };

  const handleCreate = async () => {
    if (!canContinue || isCreating) {
      return;
    }

    setIsCreating(true);
    try {
      const result = await createCircle(buildCreateCirclePayload(draft));
      allowExitRef.current = true;
      setCreatedCircle(result);
    } catch (error) {
      const message =
        (error as {message?: string}).message ??
        'Could not create this Commitment. Try again.';
      Alert.alert('Create failed', message);
    } finally {
      setIsCreating(false);
    }
  };

  const shareInvite = async () => {
    const inviteLink = getInviteLink(createdCircle?.inviteCode);

    await Share.share({
      message: `Join ${draft.title.trim()} on Hoyst: ${inviteLink}`,
      title: `Join ${draft.title.trim()} on Hoyst`,
    });
  };

  const renderContent = () => {
    if (currentStep === 'mode') {
      return (
        <SetupOptionList
          onSelect={value => setField('circleMode', value)}
          options={circleModeOptions}
          selected={draft.circleMode}
        />
      );
    }

    if (currentStep === 'category') {
      return (
        <SetupOptionList
          onSelect={value => setField('category', value)}
          options={categoryOptions}
          selected={draft.category}
        />
      );
    }

    if (currentStep === 'title') {
      return (
        <View style={styles.fieldBlock}>
          <HoystText tone="muted" variant="label">
            Circle name
          </HoystText>
          <HoystInput
            autoCapitalize="words"
            maxLength={80}
            onChangeText={value => setField('title', value)}
            placeholder="The 5AM Vanguard"
            value={draft.title}
          />
          <HoystText tone={canContinue ? 'muted' : 'danger'} variant="caption">
            {draft.title.trim().length}/80 characters
          </HoystText>
        </View>
      );
    }

    if (currentStep === 'commitment') {
      return (
        <View style={styles.fieldBlock}>
          <HoystText tone="muted" variant="label">
            Commitment statement
          </HoystText>
          <HoystInput
            blurOnSubmit
            maxLength={160}
            multiline
            numberOfLines={4}
            onChangeText={value => setField('commitment', value)}
            placeholder="Read 20 pages, then Tap In with one takeaway."
            returnKeyType="done"
            style={styles.textArea}
            textAlignVertical="top"
            value={draft.commitment}
          />
          <HoystText tone={canContinue ? 'muted' : 'danger'} variant="caption">
            {draft.commitment.trim().length}/160 characters
          </HoystText>
        </View>
      );
    }

    if (currentStep === 'commitmentFrequency') {
      return (
        <View style={styles.stack}>
          <SetupOptionList
            onSelect={setCommitmentType}
            options={commitmentTypeOptions}
            selected={draft.commitmentType}
          />
          {draft.commitmentType !== 'avoid' ? (
            <GlassPanel>
              <View style={styles.sectionHeader}>
                <HoystText variant="bodyStrong">
                  {draft.commitmentType === 'limit'
                    ? 'Goal range'
                    : 'Goal value'}
                </HoystText>
                <HoystChip
                  label={draft.commitmentType === 'limit' ? 'Limit' : 'Goal'}
                  tone={draft.commitmentType === 'limit' ? 'orange' : 'green'}
                />
              </View>
              {draft.commitmentType === 'build' ? (
                <View style={styles.fieldBlock}>
                  <HoystText tone="muted" variant="label">
                    Goal value
                  </HoystText>
                  <HoystInput
                    keyboardType="number-pad"
                    onChangeText={value =>
                      setQuantityField('targetValue', value)
                    }
                    value={`${draft.targetValue ?? 1}`}
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
                        setQuantityField('minimumValue', value)
                      }
                      value={`${draft.minimumValue ?? 0}`}
                    />
                  </View>
                  <View style={styles.fieldBlock}>
                    <HoystText tone="muted" variant="label">
                      Maximum amount
                    </HoystText>
                    <HoystInput
                      keyboardType="number-pad"
                      onChangeText={value =>
                        setQuantityField('maximumValue', value)
                      }
                      value={`${draft.maximumValue ?? draft.targetValue ?? 1}`}
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
                  onChangeText={value => setField('unitLabel', value)}
                  placeholder="pages, glasses, minutes"
                  value={draft.unitLabel}
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
            onSelect={selectCommitmentPace}
            options={commitmentPaceOptions}
            selected={draft.commitmentCadence}
          />
          {draft.commitmentCadence === 'weekly' ? (
            <>
              <SetupNumericStepper
                label="Tap Ins per week"
                max={7}
                min={1}
                onChange={value =>
                  setField('commitmentFrequency', {tapInsPerWeek: value})
                }
                value={draft.commitmentFrequency.tapInsPerWeek}
              />
              <HoystText tone="muted">
                {isPersonal
                  ? 'You Tap In this many days from Monday to Sunday in this Commitment timezone.'
                  : 'Each Member taps in this many days from Monday to Sunday in the Circle timezone.'}
              </HoystText>
            </>
          ) : draft.commitmentCadence === 'monthly' ? (
            <>
              <SetupNumericStepper
                label="Opportunities per month"
                max={31}
                min={1}
                onChange={value =>
                  setField('commitmentFrequency', {
                    opportunitiesPerPeriod: value,
                    tapInsPerWeek: Math.min(7, value),
                  })
                }
                value={
                  draft.commitmentFrequency.opportunitiesPerPeriod ??
                  draft.commitmentFrequency.tapInsPerWeek
                }
              />
              <HoystText tone="muted">
                Hoyst spreads these Opportunities across the month so upcoming
                Opportunities do not count against Momentum early.
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
      );
    }

    if (currentStep === 'grace') {
      const graceEnabled = skipRule.allowance > 0;

      return (
        <View style={styles.stack}>
          <Pressable
            accessibilityRole="switch"
            accessibilityState={{checked: graceEnabled}}
            onPress={() => setSkipRule({allowance: graceEnabled ? 0 : 1})}
            style={({pressed}) => [
              styles.toggleRow,
              {
                backgroundColor: theme.surface,
                borderColor: graceEnabled
                  ? theme.warningForeground
                  : theme.border,
                opacity: pressed ? 0.92 : 1,
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
            <HoystChip
              label={graceEnabled ? 'On' : 'Off'}
              tone={graceEnabled ? 'orange' : 'neutral'}
            />
          </Pressable>
          <SetupNumericStepper
            label="Skips allowed"
            max={30}
            min={0}
            onChange={allowance => setSkipRule({allowance})}
            value={skipRule.allowance}
          />
          <SetupNumericStepper
            label="Window days"
            max={365}
            min={1}
            onChange={windowDays => setSkipRule({windowDays})}
            value={skipRule.windowDays}
          />
        </View>
      );
    }

    if (currentStep === 'privacy') {
      const publicJoinMode =
        draft.joinMode === 'open' || draft.joinMode === 'request_to_join'
          ? draft.joinMode
          : 'request_to_join';

      return (
        <View style={styles.stack}>
          <SetupOptionList
            onSelect={selectPrivacyMode}
            options={privacyOptions}
            selected={draft.privacyMode}
          />
          {draft.privacyMode === 'public' ? (
            <GlassPanel>
              <View style={styles.sectionHeader}>
                <HoystText variant="bodyStrong">Public join rule</HoystText>
                <HoystChip
                  label={formatJoinMode(draft.joinMode)}
                  tone="green"
                />
              </View>
              <SetupOptionList
                onSelect={selectPublicJoinMode}
                options={publicJoinOptions}
                selected={publicJoinMode}
              />
            </GlassPanel>
          ) : null}
        </View>
      );
    }

    if (currentStep === 'maxSize') {
      return (
        <View style={styles.stack}>
          <SetupNumericStepper
            label="Maximum Members"
            max={100}
            min={2}
            onChange={value => setField('maxSize', clampCircleMaxSize(value))}
            value={draft.maxSize}
          />
          <View style={styles.sizePresets}>
            {[2, 5, 10, 25, 100].map(size => (
              <Pressable
                key={size}
                onPress={() => setField('maxSize', size)}
                style={({pressed}) => [
                  styles.presetButton,
                  {
                    backgroundColor:
                      draft.maxSize === size
                        ? `${theme.accentSecondaryForeground}22`
                        : theme.surfaceSoft,
                    borderColor:
                      draft.maxSize === size
                        ? theme.accentSecondaryForeground
                        : theme.border,
                    opacity: pressed ? 0.9 : 1,
                  },
                ]}>
                <HoystText variant="caption">{size}</HoystText>
              </Pressable>
            ))}
          </View>
        </View>
      );
    }

    if (currentStep === 'timezone') {
      return (
        <TimezonePicker
          helperText="This controls when each Tap In day resets."
          modalTitle={`${isPersonal ? 'Commitment' : 'Circle'} timezone`}
          onChange={value => setField('timezone', value)}
          value={draft.timezone}
        />
      );
    }

    return (
      <GlassPanel style={styles.summaryPanel}>
        <SetupSummaryRow
          label="Type"
          value={
            draft.circleMode === 'personal'
              ? 'Personal commitment'
              : 'Circle'
          }
        />
        <SetupSummaryRow
          label="Category"
          value={<CircleCategoryPill category={draft.category} />}
        />
        {draft.circleMode === 'group' ? (
          <SetupSummaryRow label="Circle name" value={draft.title.trim()} />
        ) : null}
        <SetupSummaryRow label="Commitment" value={draft.commitment.trim()} />
        <SetupSummaryRow
          label="Commitment type"
          value={<CommitmentTypeRuleSummary {...draft} />}
        />
        <SetupSummaryRow
          label="Pace"
          value={formatPaceSummary(
            draft.commitmentCadence,
            draft.commitmentFrequency,
          )}
        />
        <SetupSummaryRow
          label="Grace"
          value={
            skipRule.allowance > 0
              ? formatSkipSummary(skipRule.allowance, skipRule.windowDays)
              : 'No skips'
          }
        />
        {draft.circleMode === 'group' ? (
          <>
            <SetupSummaryRow
              label="Access"
              value={formatAccessSummary(
                draft.privacyMode,
                draft.joinMode,
              )}
            />
            <SetupSummaryRow
              label="Max size"
              value={`${draft.maxSize} Members`}
            />
          </>
        ) : null}
        <SetupSummaryRow
          label="Timezone"
          value={formatTimezoneSummary(draft.timezone.trim())}
        />
      </GlassPanel>
    );
  };

  if (createdCircle) {
    const inviteLink = getInviteLink(createdCircle.inviteCode);

    return (
      <HoystScreen
        background={<FrostedBackdrop />}
        contentContainerStyle={styles.content}>
        <View style={styles.successHeader}>
          <View
            style={[
              styles.successIcon,
              {
                backgroundColor: `${theme.success}20`,
                borderColor: theme.successForeground,
              },
            ]}>
            <Check color={theme.successForeground} size={28} strokeWidth={3} />
          </View>
          <View style={styles.heroCopy}>
            <HoystText style={styles.centerText} variant="largeTitle">
              {isPersonal ? 'Personal commitment created' : 'Circle created'}
            </HoystText>
            <HoystText style={styles.centerText} tone="muted">
              {isPersonal
                ? 'Your Commitment is private and ready for your first Tap In.'
                : 'Your invite link is ready to share with the right people.'}
            </HoystText>
          </View>
        </View>
        {!isPersonal ? (
          <GlassPanel style={styles.invitePanel}>
            <HoystText tone="muted" variant="label">
              Invite link
            </HoystText>
            <HoystText style={{color: theme.accentSecondaryForeground}}>
              {inviteLink}
            </HoystText>
          </GlassPanel>
        ) : null}
        <View style={styles.footerStack}>
          {!isPersonal ? (
            <HoystButton
              icon={
                <Share2
                  color={theme.onBrightAccent}
                  size={18}
                  strokeWidth={2.3}
                />
              }
              label="Share invite"
              onPress={() => {
                shareInvite().catch(() => undefined);
              }}
              variant="secondary"
            />
          ) : null}
          <HoystButton
            label={isPersonal ? 'View commitment' : 'View Circle'}
            onPress={() =>
              navigation.replace('CircleDetail', {
                circleId: createdCircle.circleId,
              })
            }
            variant="outline"
          />
        </View>
      </HoystScreen>
    );
  }

  return (
    <CommitmentSetupScaffold
      body={copy.body}
      eyebrow={`Step ${currentIndex + 1} of ${wizardSteps.length}`}
      onBack={goBack}
      onClose={() => navigation.goBack()}
      primaryAction={{
        disabled: !canContinue || isCreating,
        label:
          currentStep === 'review'
            ? isCreating
              ? 'Creating...'
              : draft.circleMode === 'personal'
              ? 'Create Personal Commitment'
              : 'Create Circle'
            : 'Continue',
        onPress:
          currentStep === 'review'
            ? () => {
                handleCreate().catch(() => undefined);
              }
            : goNext,
      }}
      progress={{current: currentIndex + 1, total: wizardSteps.length}}
      stepKey={currentStep}
      title={copy.title}>
      {renderContent()}
    </CommitmentSetupScaffold>
  );
}

const styles = StyleSheet.create({
  centerText: {
    textAlign: 'center',
  },
  content: {
    paddingBottom: 60,
  },
  fieldBlock: {
    gap: 8,
  },
  footerStack: {
    gap: 12,
    marginTop: 8,
  },
  heroCopy: {
    gap: 9,
  },
  invitePanel: {
    alignItems: 'center',
  },
  optionCopy: {
    flex: 1,
    gap: 4,
    minWidth: 0,
  },
  presetButton: {
    alignItems: 'center',
    borderRadius: radius.pill,
    borderWidth: 1,
    justifyContent: 'center',
    minHeight: 44,
    minWidth: 52,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  sectionHeader: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  sizePresets: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  stack: {
    gap: 12,
  },
  successHeader: {
    alignItems: 'center',
    gap: 18,
    paddingTop: 40,
  },
  successIcon: {
    alignItems: 'center',
    borderRadius: 28,
    borderWidth: 1,
    height: 56,
    justifyContent: 'center',
    width: 56,
  },
  summaryPanel: {
    gap: 14,
  },
  textArea: {
    minHeight: 128,
  },
  toggleRow: {
    alignItems: 'center',
    borderRadius: radius.md,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 12,
    minHeight: 86,
    padding: 14,
  },
});
