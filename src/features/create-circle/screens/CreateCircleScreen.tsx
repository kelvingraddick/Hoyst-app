import React, {useMemo, useState} from 'react';
import {Alert, Pressable, Share, StyleSheet, View} from 'react-native';
import {
  ArrowLeft,
  BookOpen,
  Check,
  Dumbbell,
  Flame,
  Globe2,
  Lock,
  Minus,
  Plus,
  Share2,
  Shield,
  Sparkles,
  UsersRound,
  X,
  type LucideIcon,
} from 'lucide-react-native';
import type {NativeStackScreenProps} from '@react-navigation/native-stack';

import {GlassPanel} from '../../../design/components/GlassPanel';
import {HoystButton} from '../../../design/components/HoystButton';
import {HoystChip} from '../../../design/components/HoystChip';
import {HoystInput} from '../../../design/components/HoystInput';
import {HoystScreen} from '../../../design/components/HoystScreen';
import {HoystText} from '../../../design/components/HoystText';
import {radius} from '../../../design/tokens/radius';
import {useHoystTheme} from '../../../design/theme/useHoystTheme';
import {useUserProfileStore} from '../../../store/profile-store';
import {TimezonePicker} from '../../auth/components/TimezonePicker';
import {createCircle} from '../../circles/services/circle-service';
import {
  buildCreateCirclePayload,
  clampCircleMaxSize,
  createInitialCircleDraft,
  getPrivacyChoiceFields,
  normalizeSkipGraceRule,
} from '../services/create-circle-draft';
import type {
  CircleJoinMode,
  CirclePrivacyMode,
  CreateCircleDraft,
} from '../../../types/models';
import type {RootStackParamList} from '../../../navigation/types';

type Props = NativeStackScreenProps<RootStackParamList, 'CreateCircle'>;
type WizardStep =
  | 'category'
  | 'title'
  | 'dailyTask'
  | 'grace'
  | 'privacy'
  | 'maxSize'
  | 'timezone'
  | 'review';

type CreatedCircle = {
  circleId: string;
  inviteCode?: string;
};

type Option<T extends string> = {
  description: string;
  icon: LucideIcon;
  id: T;
  label: string;
  tone: 'blue' | 'green' | 'orange' | 'purple';
};

const wizardSteps: WizardStep[] = [
  'category',
  'title',
  'dailyTask',
  'grace',
  'privacy',
  'maxSize',
  'timezone',
  'review',
];

const categoryOptions: Array<Option<string>> = [
  {
    description: 'Training plans, walks, lifts, runs, and recovery.',
    icon: Dumbbell,
    id: 'Fitness',
    label: 'Fitness',
    tone: 'green',
  },
  {
    description: 'Sleep, mindfulness, nutrition, and care routines.',
    icon: Flame,
    id: 'Wellness',
    label: 'Wellness',
    tone: 'purple',
  },
  {
    description: 'Focused sessions, study blocks, and maker momentum.',
    icon: BookOpen,
    id: 'Deep Work',
    label: 'Deep work',
    tone: 'blue',
  },
  {
    description: 'Private, steady check-ins for staying grounded.',
    icon: Shield,
    id: 'Sobriety',
    label: 'Sobriety',
    tone: 'orange',
  },
  {
    description: 'A flexible lane for anything specific to your people.',
    icon: Sparkles,
    id: 'Custom',
    label: 'Custom',
    tone: 'purple',
  },
];

const privacyOptions: Array<Option<CirclePrivacyMode>> = [
  {
    description: 'Discoverable in Explore with your chosen join rule.',
    icon: Globe2,
    id: 'public',
    label: 'Public',
    tone: 'green',
  },
  {
    description: 'Hidden from Explore and joinable only with your invite link.',
    icon: Share2,
    id: 'link_only',
    label: 'Link-only',
    tone: 'blue',
  },
  {
    description: 'Hidden from Explore with invite-only requests for approval.',
    icon: Lock,
    id: 'private',
    label: 'Private',
    tone: 'purple',
  },
];

const publicJoinOptions: Array<
  Option<Extract<CircleJoinMode, 'open' | 'request_to_join'>>
> = [
  {
    description: 'People can join immediately while seats are open.',
    icon: UsersRound,
    id: 'open',
    label: 'Open seats',
    tone: 'green',
  },
  {
    description: 'People request access before they can Tap In.',
    icon: Shield,
    id: 'request_to_join',
    label: 'Request approval',
    tone: 'orange',
  },
];

const stepCopy: Record<WizardStep, {body: string; title: string}> = {
  category: {
    body: 'Pick the lane that sets expectations before anyone joins.',
    title: 'What kind of circle is this?',
  },
  dailyTask: {
    body: 'Make the daily action specific enough that members know what counts.',
    title: 'What will members do daily?',
  },
  grace: {
    body: 'Skips can keep streaks intact when life gets loud.',
    title: 'How forgiving should the streak be?',
  },
  maxSize: {
    body: 'Smaller circles feel tighter. Larger circles create more social proof.',
    title: 'How many members can join?',
  },
  privacy: {
    body: 'Choose who can discover it and how new members enter.',
    title: 'Who can find and join it?',
  },
  review: {
    body: 'Check the details before Hoyst creates the real circle.',
    title: 'Ready to launch?',
  },
  timezone: {
    body: 'This controls when each daily Tap In window resets.',
    title: 'What timezone should it follow?',
  },
  title: {
    body: 'Give the group a name members can recognize and rally around.',
    title: 'What should this circle be called?',
  },
};

function getToneColor(
  theme: ReturnType<typeof useHoystTheme>,
  tone: Option<string>['tone'],
) {
  if (tone === 'green') {
    return theme.success;
  }

  if (tone === 'orange') {
    return theme.warning;
  }

  if (tone === 'blue') {
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
      accessibilityRole="button"
      disabled={disabled}
      hitSlop={8}
      onPress={disabled ? undefined : onPress}
      style={({pressed}) => [
        styles.iconButton,
        {
          backgroundColor: theme.surfaceSoft,
          borderColor: theme.border,
          opacity: disabled ? 0.36 : pressed ? 0.88 : 1,
        },
      ]}>
      <Icon color={theme.text} size={18} strokeWidth={2.4} />
    </Pressable>
  );
}

function OptionCard<T extends string>({
  isSelected,
  onPress,
  option,
}: {
  isSelected: boolean;
  onPress: () => void;
  option: Option<T>;
}) {
  const theme = useHoystTheme();
  const accentColor = getToneColor(theme, option.tone);
  const Icon = option.icon;

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
          <HoystText numberOfLines={1} variant="bodyStrong">
            {option.label}
          </HoystText>
          <HoystText numberOfLines={2} tone="muted">
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
            <Check color={theme.background} size={15} strokeWidth={3} />
          ) : null}
        </View>
      </View>
    </Pressable>
  );
}

function ProgressHeader({
  currentStep,
  onBack,
  onClose,
}: {
  currentStep: WizardStep;
  onBack: () => void;
  onClose: () => void;
}) {
  const theme = useHoystTheme();
  const currentIndex = wizardSteps.indexOf(currentStep);
  const progress = ((currentIndex + 1) / wizardSteps.length) * 100;

  return (
    <View style={styles.progressHeader}>
      <IconButton
        accessibilityLabel="Go back"
        disabled={currentIndex === 0}
        icon={ArrowLeft}
        onPress={onBack}
      />
      <View
        style={[
          styles.progressTrack,
          {backgroundColor: theme.surfaceHigh, borderColor: theme.border},
        ]}>
        <View
          style={[
            styles.progressFill,
            {
              backgroundColor: theme.accentSecondary,
              width: `${Math.round(progress)}%`,
            },
          ]}
        />
      </View>
      <IconButton
        accessibilityLabel="Close create circle"
        icon={X}
        onPress={onClose}
      />
    </View>
  );
}

function NumericStepper({
  label,
  max,
  min,
  onChange,
  value,
}: {
  label: string;
  max: number;
  min: number;
  onChange: (value: number) => void;
  value: number;
}) {
  const theme = useHoystTheme();
  const update = (nextValue: number) =>
    onChange(Math.min(max, Math.max(min, Math.round(nextValue))));

  return (
    <View
      style={[
        styles.stepper,
        {backgroundColor: theme.surfaceSoft, borderColor: theme.border},
      ]}>
      <View style={styles.stepperCopy}>
        <HoystText tone="muted" variant="label">
          {label}
        </HoystText>
        <HoystText variant="title">{value}</HoystText>
      </View>
      <View style={styles.stepperControls}>
        <IconButton
          accessibilityLabel={`Decrease ${label}`}
          disabled={value <= min}
          icon={Minus}
          onPress={() => update(value - 1)}
        />
        <IconButton
          accessibilityLabel={`Increase ${label}`}
          disabled={value >= max}
          icon={Plus}
          onPress={() => update(value + 1)}
        />
      </View>
    </View>
  );
}

function SummaryRow({label, value}: {label: string; value: string}) {
  return (
    <View style={styles.summaryRow}>
      <HoystText tone="muted" variant="label">
        {label}
      </HoystText>
      <HoystText style={styles.summaryValue}>{value}</HoystText>
    </View>
  );
}

function getInviteLink(inviteCode?: string) {
  return inviteCode ? `https://hoyst.app/join/${inviteCode}` : 'Invite ready';
}

function getJoinModeLabel(joinMode: CircleJoinMode) {
  if (joinMode === 'open') {
    return 'Open seats';
  }

  if (joinMode === 'request_to_join') {
    return 'Request approval';
  }

  return 'Invite link';
}

function getPrivacyLabel(privacyMode: CirclePrivacyMode) {
  if (privacyMode === 'public') {
    return 'Public';
  }

  if (privacyMode === 'link_only') {
    return 'Link-only';
  }

  return 'Private';
}

export function CreateCircleScreen({navigation}: Props): React.JSX.Element {
  const theme = useHoystTheme();
  const profile = useUserProfileStore(state => state.profile);
  const [currentStep, setCurrentStep] = useState<WizardStep>('category');
  const [draft, setDraft] = useState<CreateCircleDraft>(() =>
    createInitialCircleDraft(profile?.timezone),
  );
  const [createdCircle, setCreatedCircle] = useState<CreatedCircle>();
  const [isCreating, setIsCreating] = useState(false);
  const currentIndex = wizardSteps.indexOf(currentStep);
  const copy = stepCopy[currentStep];
  const skipRule = draft.graceRules.skip;
  const canContinue = useMemo(() => {
    if (currentStep === 'category') {
      return draft.category.trim().length > 0;
    }

    if (currentStep === 'title') {
      const title = draft.title.trim();

      return title.length > 0 && title.length <= 80;
    }

    if (currentStep === 'dailyTask') {
      const dailyTask = draft.dailyTask.trim();

      return dailyTask.length > 0 && dailyTask.length <= 160;
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

  const goBack = () => {
    if (currentIndex > 0) {
      setCurrentStep(wizardSteps[currentIndex - 1]);
    }
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
      setCreatedCircle(result);
    } catch (error) {
      const message =
        (error as {message?: string}).message ??
        'Could not create this circle. Try again.';
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

  const renderOptions = <T extends string>(
    options: Array<Option<T>>,
    selected: T,
    onSelect: (id: T) => void,
  ) => (
    <View style={styles.optionStack}>
      {options.map(option => (
        <OptionCard
          isSelected={selected === option.id}
          key={option.id}
          onPress={() => onSelect(option.id)}
          option={option}
        />
      ))}
    </View>
  );

  const renderContent = () => {
    if (currentStep === 'category') {
      return renderOptions(categoryOptions, draft.category, value =>
        setField('category', value),
      );
    }

    if (currentStep === 'title') {
      return (
        <View style={styles.fieldBlock}>
          <HoystText tone="muted" variant="label">
            Circle title
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

    if (currentStep === 'dailyTask') {
      return (
        <View style={styles.fieldBlock}>
          <HoystText tone="muted" variant="label">
            Daily task description
          </HoystText>
          <HoystInput
            blurOnSubmit
            maxLength={160}
            multiline
            numberOfLines={4}
            onChangeText={value => setField('dailyTask', value)}
            placeholder="Read 20 pages, then Tap In with one takeaway."
            returnKeyType="done"
            style={styles.textArea}
            textAlignVertical="top"
            value={draft.dailyTask}
          />
          <HoystText tone={canContinue ? 'muted' : 'danger'} variant="caption">
            {draft.dailyTask.trim().length}/160 characters
          </HoystText>
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
                borderColor: graceEnabled ? theme.warning : theme.border,
                opacity: pressed ? 0.92 : 1,
              },
            ]}>
            <View style={styles.optionCopy}>
              <HoystText variant="bodyStrong">
                Optional skips protect streaks
              </HoystText>
              <HoystText tone="muted">
                Skips count as covered for circle progress.
              </HoystText>
            </View>
            <HoystChip
              label={graceEnabled ? 'On' : 'Off'}
              tone={graceEnabled ? 'orange' : 'neutral'}
            />
          </Pressable>
          <NumericStepper
            label="Skips allowed"
            max={30}
            min={0}
            onChange={allowance => setSkipRule({allowance})}
            value={skipRule.allowance}
          />
          <NumericStepper
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
          {renderOptions(privacyOptions, draft.privacyMode, selectPrivacyMode)}
          {draft.privacyMode === 'public' ? (
            <GlassPanel>
              <View style={styles.sectionHeader}>
                <HoystText variant="bodyStrong">Public join rule</HoystText>
                <HoystChip
                  label={getJoinModeLabel(draft.joinMode)}
                  tone="green"
                />
              </View>
              {renderOptions(
                publicJoinOptions,
                publicJoinMode,
                selectPublicJoinMode,
              )}
            </GlassPanel>
          ) : null}
        </View>
      );
    }

    if (currentStep === 'maxSize') {
      return (
        <View style={styles.stack}>
          <NumericStepper
            label="Maximum members"
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
                        ? `${theme.accentSecondary}22`
                        : theme.surfaceSoft,
                    borderColor:
                      draft.maxSize === size
                        ? theme.accentSecondary
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
          helperText="This controls when each daily Tap In window resets."
          modalTitle="Circle timezone"
          onChange={value => setField('timezone', value)}
          value={draft.timezone}
        />
      );
    }

    return (
      <GlassPanel style={styles.summaryPanel}>
        <SummaryRow label="Category" value={draft.category} />
        <SummaryRow label="Title" value={draft.title.trim()} />
        <SummaryRow label="Daily task" value={draft.dailyTask.trim()} />
        <SummaryRow
          label="Grace"
          value={
            skipRule.allowance > 0
              ? `${skipRule.allowance} skip per ${skipRule.windowDays} days`
              : 'Off'
          }
        />
        <SummaryRow
          label="Privacy"
          value={`${getPrivacyLabel(draft.privacyMode)}: ${getJoinModeLabel(
            draft.joinMode,
          )}`}
        />
        <SummaryRow label="Max size" value={`${draft.maxSize} members`} />
        <SummaryRow label="Timezone" value={draft.timezone.trim()} />
      </GlassPanel>
    );
  };

  if (createdCircle) {
    const inviteLink = getInviteLink(createdCircle.inviteCode);

    return (
      <HoystScreen contentContainerStyle={styles.content}>
        <View style={styles.successHeader}>
          <View
            style={[
              styles.successIcon,
              {
                backgroundColor: `${theme.success}20`,
                borderColor: theme.success,
              },
            ]}>
            <Check color={theme.success} size={28} strokeWidth={3} />
          </View>
          <View style={styles.heroCopy}>
            <HoystText style={styles.centerText} variant="display">
              Circle created
            </HoystText>
            <HoystText style={styles.centerText} tone="muted">
              Your invite link is ready to share with the right people.
            </HoystText>
          </View>
        </View>
        <GlassPanel style={styles.invitePanel}>
          <HoystText tone="muted" variant="label">
            Invite link
          </HoystText>
          <HoystText style={{color: theme.accentSecondary}}>
            {inviteLink}
          </HoystText>
        </GlassPanel>
        <View style={styles.footerStack}>
          <HoystButton
            icon={<Share2 color={theme.text} size={18} strokeWidth={2.3} />}
            label="Share Invite"
            onPress={() => {
              shareInvite().catch(() => undefined);
            }}
            variant="secondary"
          />
          <HoystButton
            label="View Circle"
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
    <HoystScreen
      contentContainerStyle={styles.content}
      keyboardAvoiding
      keyboardDismissMode="interactive"
      keyboardShouldPersistTaps="handled">
      <ProgressHeader
        currentStep={currentStep}
        onBack={goBack}
        onClose={() => navigation.goBack()}
      />
      <View style={styles.heroCopy}>
        <HoystText tone="muted" variant="label">
          Step {currentIndex + 1} of {wizardSteps.length}
        </HoystText>
        <HoystText variant="display">{copy.title}</HoystText>
        <HoystText tone="muted">{copy.body}</HoystText>
      </View>
      {renderContent()}
      <View style={styles.footerStack}>
        <HoystButton
          disabled={!canContinue || isCreating}
          label={
            currentStep === 'review'
              ? isCreating
                ? 'Creating...'
                : 'Create Circle'
              : 'Continue'
          }
          onPress={
            currentStep === 'review'
              ? () => {
                  handleCreate().catch(() => undefined);
                }
              : goNext
          }
        />
      </View>
    </HoystScreen>
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
  iconButton: {
    alignItems: 'center',
    borderRadius: radius.pill,
    borderWidth: 1,
    height: 46,
    justifyContent: 'center',
    width: 46,
  },
  invitePanel: {
    alignItems: 'center',
  },
  optionCard: {
    alignItems: 'center',
    borderRadius: radius.md,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 12,
    minHeight: 84,
    padding: 14,
  },
  optionCheck: {
    alignItems: 'center',
    borderRadius: radius.pill,
    borderWidth: 1,
    height: 24,
    justifyContent: 'center',
    width: 24,
  },
  optionCopy: {
    flex: 1,
    gap: 4,
  },
  optionIcon: {
    alignItems: 'center',
    borderRadius: radius.md,
    borderWidth: 1,
    height: 44,
    justifyContent: 'center',
    width: 44,
  },
  optionPressable: {
    borderRadius: radius.md,
  },
  optionStack: {
    gap: 10,
  },
  presetButton: {
    alignItems: 'center',
    borderRadius: radius.pill,
    borderWidth: 1,
    minWidth: 52,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  progressFill: {
    borderRadius: radius.pill,
    height: '100%',
  },
  progressHeader: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 12,
    paddingTop: 14,
    paddingBottom: 8,
  },
  progressTrack: {
    borderRadius: radius.pill,
    borderWidth: 1,
    flex: 1,
    height: 12,
    overflow: 'hidden',
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
  summaryRow: {
    gap: 5,
  },
  summaryValue: {
    fontSize: 17,
    fontWeight: '700',
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
