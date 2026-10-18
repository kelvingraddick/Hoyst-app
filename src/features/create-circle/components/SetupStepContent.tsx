import React, {useEffect, useRef} from 'react';
import {Platform, Pressable, StyleSheet, View} from 'react-native';
import {Check, ChevronRight, Globe2, Link, Shield} from 'lucide-react-native';
import {CircularEmoji} from '../../../design/components/CircularEmoji';
import {SetupText as HoystText} from './SetupText';
import {SetupInput as HoystInput} from './SetupInput';
import {CircleCategoryIcon} from '../../../design/components/CircleCategoryIcon';
import {CommitmentTypeIcon} from '../../../design/components/CommitmentTypeVisual';
import {CommitmentAppearanceControl} from '../../../design/components/CommitmentAppearanceControl';
import {useSetupTheme} from '../services/setup-presentation';
import {
  categories,
  palettes,
  resolveAppearance,
} from '../../../shared/commitment-appearance';
import {TimezonePicker} from '../../auth/components/TimezonePicker';
import {
  getPrivacyChoiceFields,
  defaultMonthlyCommitmentFrequency,
  defaultWeeklyCommitmentFrequency,
} from '../services/create-circle-draft';
import {proofOptions, SetupNumericStepper} from './CommitmentSetupFields';
import {
  goalLabel,
  paceLabel,
  validateSetupStep,
  type SetupStep,
} from '../services/setup-journey';
import type {
  CreateCircleDraft,
  CommitmentPace,
  CommitmentType,
} from '../../../types/models';

export function SetupChoice({
  title,
  body,
  tag,
  compact,
  selected,
  onPress,
  icon,
  tone = 'blue',
  disabled = false,
}: {
  title: string;
  body?: string;
  tag?: string;
  compact?: boolean;
  selected?: boolean;
  onPress: () => void;
  icon?: React.ReactNode;
  tone?: keyof typeof palettes;
  disabled?: boolean;
}) {
  const theme = useSetupTheme();
  const palette = palettes[tone];
  return (
    <Pressable
      accessibilityRole="radio"
      accessibilityState={{selected: Boolean(selected), disabled}}
      accessibilityLabel={[tag, title, body].filter(Boolean).join('. ')}
      onPress={onPress}
      disabled={disabled}
      style={[
        styles.choice,
        compact ? {minHeight: 64} : undefined,
        disabled ? styles.disabled : undefined,
        {
          backgroundColor: theme.isDark
            ? palette.accent + '20'
            : palette.background,
          borderColor: selected ? palette.accent : 'transparent',
        },
      ]}>
      {icon}
      <View style={styles.flex}>
        {tag && (
          <HoystText
            style={[
              styles.tag,
              {
                color: theme.isDark
                  ? palette.darkForeground
                  : palette.foreground,
                backgroundColor: palette.accent + '18',
              },
            ]}>
            {tag}
          </HoystText>
        )}
        <HoystText style={styles.cardTitle}>{title}</HoystText>
        {body && (
          <HoystText tone="muted" style={styles.copy}>
            {body}
          </HoystText>
        )}
      </View>
      {selected ? (
        <View
          style={[
            styles.selectedMark,
            {
              backgroundColor: theme.isDark
                ? palette.accent
                : palette.foreground,
            },
          ]}>
          <Check color={theme.isDark ? '#070B1A' : '#FFFFFF'} size={18} />
        </View>
      ) : (
        <ChevronRight color={theme.textMuted} size={20} />
      )}
    </Pressable>
  );
}

export function ProofSelector({
  value,
  onChange,
  disabled = false,
}: {
  value: import('../../../shared/tap-in-proof').ProofRequirement;
  onChange: (
    value: import('../../../shared/tap-in-proof').ProofRequirement,
  ) => void;
  disabled?: boolean;
}) {
  const theme = useSetupTheme();
  return (
    <View
      accessibilityRole="radiogroup"
      accessibilityLabel="Tap In proof"
      style={styles.proofOptions}>
      {proofOptions.map(option => {
        const Icon = option.icon!;
        return (
          <SetupChoice
            key={option.id}
            title={option.label}
            body={option.description}
            tag={option.id === 'photo' ? 'Default' : undefined}
            tone={option.tone === 'neutral' ? 'gray' : option.tone}
            icon={<Icon size={24} color={theme.textMuted} />}
            selected={value === option.id}
            onPress={() => onChange(option.id)}
            disabled={disabled}
          />
        );
      })}
    </View>
  );
}

export function SetupField({
  label,
  value,
  onChange,
  maxLength,
  multiline,
  numeric,
  helper,
  disabled,
  prefix,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  maxLength?: number;
  multiline?: boolean;
  numeric?: boolean;
  helper?: string;
  disabled?: boolean;
  prefix?: string;
}) {
  const theme = useSetupTheme();
  return (
    <View style={styles.field}>
      <HoystText style={styles.fieldLabel}>{label}</HoystText>
      <View
        style={
          prefix
            ? [
                styles.prefixField,
                {backgroundColor: theme.surfaceHigh, borderColor: theme.border},
              ]
            : undefined
        }>
        {prefix && (
          <HoystText tone="muted" style={styles.prefix}>
            {prefix}
          </HoystText>
        )}
        <HoystInput
          accessibilityLabel={label}
          value={value}
          onChangeText={onChange}
          maxLength={maxLength}
          multiline={multiline}
          keyboardType={numeric ? 'number-pad' : 'default'}
          style={[styles.input, multiline && styles.multiline]}
          textAlignVertical={multiline ? 'top' : 'center'}
          editable={!disabled}
          containerStyle={prefix ? styles.prefixedInput : undefined}
        />
      </View>
      {helper && (
        <HoystText tone="muted" style={styles.helper}>
          {helper}
        </HoystText>
      )}
    </View>
  );
}

export function GoalEditor({
  draft,
  onChange,
  disabled = false,
}: {
  draft: CreateCircleDraft;
  onChange: (draft: CreateCircleDraft) => void;
  disabled?: boolean;
}) {
  const theme = useSetupTheme();
  const isBuild = draft.commitmentType === 'build';
  const isQuantity = draft.buildTrackingMode === 'quantity';
  const isNumeric = draft.commitmentType === 'limit' || (isBuild && isQuantity);
  // Initialize once per visit so clearing a unit or switching modes retains edits.
  const initializedTypes = useRef(new Set<CommitmentType>());
  useEffect(() => {
    if (
      !isNumeric ||
      disabled ||
      initializedTypes.current.has(draft.commitmentType)
    ) {
      return;
    }
    initializedTypes.current.add(draft.commitmentType);
    if (!draft.unitLabel.trim()) {
      onChange({...draft, unitLabel: 'minutes'});
    }
  }, [disabled, draft, isNumeric, onChange]);
  const set = (patch: Partial<CreateCircleDraft>) => {
    if (!disabled) {
      onChange({...draft, ...patch});
    }
  };
  const enableQuantity = () => {
    if (disabled) {
      return;
    }
    const needsDefault =
      !initializedTypes.current.has('build') &&
      (!draft.unitLabel.trim() || draft.unitLabel === 'Tap In');
    initializedTypes.current.add('build');
    set({
      buildTrackingMode: 'quantity',
      unitLabel: needsDefault ? 'minutes' : draft.unitLabel,
    });
  };
  const amount = (value: string) =>
    /^\d+$/.test(value) ? Number(value) : undefined;
  const units = isBuild
    ? ['minutes', 'pages', 'reps', 'steps', 'cups', 'hours']
    : ['minutes', 'hours', 'cups', 'drinks', 'items', 'pages'];
  const selectedUnit = draft.unitLabel.trim().toLowerCase();
  const previewIncomplete =
    isNumeric && Boolean(validateSetupStep('goal', draft));
  if (draft.commitmentType === 'avoid') {
    return (
      <HoystText style={styles.copy}>
        Confirm you stayed clear for each Tap In.
      </HoystText>
    );
  }
  return (
    <View style={styles.stack}>
      {!(isBuild && isQuantity) && (
        <View style={styles.row}>
          <CommitmentTypeIcon commitmentType={draft.commitmentType} />
          <HoystText style={styles.cardTitle}>
            {isBuild ? 'Build' : 'Limit'}
          </HoystText>
        </View>
      )}
      {isBuild && (
        <>
          <SetupChoice
            title="Just show up"
            compact
            tone="green"
            disabled={disabled}
            body="Confirm you did it."
            selected={!isQuantity}
            onPress={() => set({buildTrackingMode: 'confirmation'})}
          />
          <SetupChoice
            title="Track an amount"
            compact
            tone="blue"
            disabled={disabled}
            body="Record how much you did."
            selected={isQuantity}
            onPress={enableQuantity}
          />
        </>
      )}
      {isNumeric && (
        <>
          {isBuild ? (
            <SetupField
              label="Amount per Tap In"
              disabled={disabled}
              value={draft.targetValue?.toString() ?? ''}
              onChange={value => set({targetValue: amount(value)})}
              numeric
              maxLength={6}
            />
          ) : (
            <View style={styles.row}>
              <View style={styles.flex}>
                <SetupField
                  label="Minimum"
                  disabled={disabled}
                  value={draft.minimumValue?.toString() ?? '0'}
                  onChange={value => set({minimumValue: amount(value)})}
                  numeric
                  maxLength={6}
                />
              </View>
              <View style={styles.flex}>
                <SetupField
                  label="Maximum"
                  disabled={disabled}
                  value={draft.maximumValue?.toString() ?? ''}
                  onChange={value => set({maximumValue: amount(value)})}
                  numeric
                  maxLength={6}
                />
              </View>
            </View>
          )}
          <View
            testID="goal-unit-group"
            style={[
              styles.unitGroup,
              {backgroundColor: theme.surfaceSoft, borderColor: theme.border},
            ]}>
            <SetupField
              label="Unit"
              disabled={disabled}
              value={draft.unitLabel}
              onChange={unitLabel => set({unitLabel})}
              maxLength={32}
            />
            <View style={styles.chips}>
              {units.map(unit => (
                <Pressable
                  key={unit}
                  accessibilityRole="button"
                  accessibilityLabel={unit}
                  accessibilityState={{
                    selected: selectedUnit === unit,
                    disabled,
                  }}
                  disabled={disabled}
                  onPress={() => set({unitLabel: unit})}
                  style={[
                    styles.unitChip,
                    Platform.OS === 'android'
                      ? styles.androidUnitChip
                      : undefined,
                    disabled ? styles.disabled : undefined,
                    {
                      backgroundColor:
                        selectedUnit === unit
                          ? theme.accent
                          : theme.surfaceHigh,
                      borderColor:
                        selectedUnit === unit ? theme.accent : theme.border,
                    },
                  ]}>
                  <HoystText
                    style={[
                      styles.unitChipText,
                      {color: selectedUnit === unit ? '#FFFFFF' : theme.text},
                    ]}>
                    {unit}
                  </HoystText>
                </Pressable>
              ))}
            </View>
            <HoystText tone="muted" style={styles.helper}>
              Choose a common unit or type your own.
            </HoystText>
          </View>
        </>
      )}
      <View
        testID="goal-preview"
        style={[
          styles.goalPreview,
          {backgroundColor: theme.surfaceSoft, borderColor: theme.borderStrong},
        ]}>
        <HoystText style={styles.cardTitle}>Tap In preview</HoystText>
        <View style={[styles.previewSection, {borderColor: theme.border}]}>
          <HoystText tone="muted" style={styles.previewLabel}>
            For each Tap In
          </HoystText>
          <HoystText style={styles.copy}>
            {previewIncomplete
              ? 'Complete your goal to see a preview'
              : goalLabel(draft)}
          </HoystText>
        </View>
        <View style={styles.field}>
          <HoystText tone="muted" style={styles.previewLabel}>
            Pace
          </HoystText>
          <HoystText style={styles.copy}>{paceLabel(draft)}</HoystText>
        </View>
      </View>
    </View>
  );
}

export type SetupScreenCopy = {
  title: string;
  message: string;
  emphasis?: readonly string[];
};

export function setupCopy(
  step: SetupStep,
  draft: CreateCircleDraft,
): SetupScreenCopy {
  const personal = draft.circleMode === 'personal';
  const copy: Partial<Record<SetupStep, SetupScreenCopy>> = {
    mode: {
      title: 'How do you want to show up?',
      message:
        'Share the commitment with a Circle, or keep this one just for you.',
      emphasis: ['with a Circle', 'just for you'],
    },
    category: {
      title: 'What kind of commitment?',
      message: 'Pick the category that feels closest.',
      emphasis: ['category'],
    },
    name: {
      title: personal ? 'Name your commitment' : 'Name your Circle',
      message: personal
        ? 'Give it a name, then describe what you’ll show up for.'
        : 'Give it a name, then describe what everyone is committing to.',
      emphasis: [
        'a name',
        personal ? 'what you’ll show up for' : 'what everyone is committing to',
      ],
    },
    pace: {
      title: 'What pace fits your life?',
      message:
        'First, how often do you want to show up? We’ll set the goal for each Tap In next.',
      emphasis: ['how often', 'goal for each Tap In'],
    },
    frequency: {
      title:
        draft.commitmentCadence === 'monthly'
          ? 'Tap Ins per month'
          : 'Tap Ins per week',
      message: `Each Tap In opens in a spaced window during the ${
        draft.commitmentCadence === 'monthly' ? 'month' : 'week'
      }. Choose a pace you can repeat.`,
      emphasis: ['spaced window', 'pace you can repeat'],
    },
    type: {
      title: 'What kind of commitment?',
      message: 'Now, what counts as showing up for each Tap In?',
      emphasis: ['each Tap In'],
    },
    goal: {
      title: 'Goal for each Tap In',
      message: `Your pace is ${paceLabel(
        draft,
      ).toLowerCase()}. What should each one cover?`,
      emphasis: [paceLabel(draft).toLowerCase()],
    },
    proof: {
      title: 'Tap In proof',
      message:
        'Choose the proof needed to complete a Tap In. You can change this later.',
      emphasis: ['proof', 'complete a Tap In'],
    },
    privacy: {
      title: 'Who can find your Circle?',
      message:
        'Choose how visible your Circle should be. You can change this later.',
      emphasis: ['how visible', 'change this later'],
    },
    joining: {
      title: 'How can people join?',
      message: 'Let people take an open seat, or review each request first.',
      emphasis: ['open seat', 'review each request'],
    },
    capacity: {
      title: 'How big should your Circle be?',
      message: 'Pick a size that feels right. Your seat is included.',
      emphasis: ['Your seat is included'],
    },
    timezone: {
      title: 'When does your day begin?',
      message:
        'This timezone controls when your Tap In windows open and close.',
      emphasis: ['timezone', 'open and close'],
    },
    appearance: {
      title: 'Make it feel like yours',
      message:
        'Give your commitment a little personality. You can change this later.',
      emphasis: ['a little personality'],
    },
    review: {
      title: 'Ready to make it real?',
      message: 'Tap any detail to change it.',
      emphasis: ['Tap any detail'],
    },
  };
  return copy[step] ?? {title: 'Your setup', message: 'Let’s keep going.'};
}

export function SetupStepContent({
  step,
  draft,
  onChange,
  onEdit,
}: {
  step: SetupStep;
  draft: CreateCircleDraft;
  onChange: (draft: CreateCircleDraft) => void;
  onEdit: (step: SetupStep) => void;
}) {
  const theme = useSetupTheme();
  const set = (patch: Partial<CreateCircleDraft>) =>
    onChange({...draft, ...patch});
  const personal = draft.circleMode === 'personal';
  const typeIcon = (type: CommitmentType) => (
    <CommitmentTypeIcon commitmentType={type} />
  );
  if (step === 'proof') {
    return (
      <ProofSelector
        value={draft.proofRequirement ?? 'photo'}
        onChange={proofRequirement => set({proofRequirement})}
      />
    );
  }
  if (step === 'mode')
    return (
      <>
        <SetupChoice
          title="Shared Circle"
          tone="green"
          icon={
            <CircularEmoji
              kind="members"
              backgroundColor={theme.isDark ? '#10B96720' : '#E7F8EF'}
              size={40}
            />
          }
          body="Show up with other people."
          selected={!personal}
          onPress={() => set({circleMode: 'group'})}
        />
        <SetupChoice
          title="Personal commitment"
          tone="blue"
          icon={
            <CircularEmoji
              kind="personal"
              backgroundColor={
                theme.isDark
                  ? palettes.blue.accent + '20'
                  : palettes.blue.background
              }
              size={40}
            />
          }
          body="Private and just for you."
          selected={personal}
          onPress={() => set({circleMode: 'personal'})}
        />
      </>
    );
  if (step === 'category')
    return (
      <View style={styles.grid}>
        {categories.map(category => (
          <Pressable
            key={category.label}
            accessibilityRole="radio"
            accessibilityState={{selected: draft.category === category.label}}
            onPress={() => set({category: category.label})}
            style={[
              styles.category,
              {
                backgroundColor: theme.surfaceSoft,
                borderColor:
                  draft.category === category.label
                    ? theme.accent
                    : 'transparent',
              },
            ]}>
            <CircleCategoryIcon category={category.label} size={36} />
            <HoystText style={[styles.copy, styles.flex]}>
              {category.label}
            </HoystText>
            {draft.category === category.label && (
              <Check color={theme.accentForeground} size={16} />
            )}
          </Pressable>
        ))}
      </View>
    );
  if (step === 'name')
    return (
      <>
        <SetupField
          label={personal ? 'Commitment name' : 'Circle name'}
          value={draft.title}
          onChange={title => set({title})}
          maxLength={80}
          helper={`${draft.title.length}/80`}
        />
        <SetupField
          label="Commitment"
          value={draft.commitment}
          onChange={commitment => set({commitment})}
          multiline
          maxLength={160}
          helper={`${draft.commitment.length}/160`}
        />
        {personal && (
          <HoystText tone="muted" style={styles.helper}>
            Only you can see this commitment.
          </HoystText>
        )}
      </>
    );
  if (step === 'pace')
    return (
      <>
        {(['daily', 'weekly', 'monthly'] as CommitmentPace[]).map(pace => (
          <SetupChoice
            key={pace}
            title={pace[0].toUpperCase() + pace.slice(1)}
            body={
              pace === 'daily'
                ? '1 Tap In each day'
                : `Set your Tap Ins per ${pace === 'weekly' ? 'week' : 'month'}`
            }
            selected={draft.commitmentCadence === pace}
            tone={
              pace === 'daily' ? 'green' : pace === 'weekly' ? 'blue' : 'orange'
            }
            onPress={() =>
              set({
                commitmentCadence: pace,
                commitmentFrequency: {
                  ...draft.commitmentFrequency,
                  tapInsPerWeek:
                    draft.commitmentCadence === 'daily'
                      ? defaultWeeklyCommitmentFrequency.tapInsPerWeek
                      : draft.commitmentFrequency.tapInsPerWeek,
                  opportunitiesPerPeriod:
                    draft.commitmentFrequency.opportunitiesPerPeriod ??
                    defaultMonthlyCommitmentFrequency.opportunitiesPerPeriod,
                },
              })
            }
          />
        ))}
      </>
    );
  if (step === 'frequency') {
    const monthly = draft.commitmentCadence === 'monthly';
    const value = monthly
      ? draft.commitmentFrequency.opportunitiesPerPeriod ?? 16
      : draft.commitmentFrequency.tapInsPerWeek;
    const setValue = (count: number) =>
      set({
        commitmentFrequency: {
          ...draft.commitmentFrequency,
          ...(monthly
            ? {opportunitiesPerPeriod: count}
            : {tapInsPerWeek: count}),
        },
      });
    return (
      <>
        <SetupNumericStepper
          label={monthly ? 'Tap Ins per month' : 'Tap Ins per week'}
          value={value}
          min={1}
          max={monthly ? 31 : 7}
          onChange={setValue}
        />
        <View style={styles.chips}>
          {(monthly ? [4, 8, 12, 16, 20] : [2, 3, 4, 5, 7]).map(count => (
            <Pressable
              accessibilityRole="button"
              accessibilityState={{selected: value === count}}
              key={count}
              onPress={() => setValue(count)}
              style={[
                styles.chip,
                {
                  backgroundColor:
                    count === value ? theme.accent : theme.surfaceSoft,
                },
              ]}>
              <HoystText
                style={{color: count === value ? '#FFFFFF' : theme.text}}>
                {count}
              </HoystText>
            </Pressable>
          ))}
        </View>
        <HoystText style={styles.cardTitle}>{paceLabel(draft)}</HoystText>
        <HoystText tone="muted" style={styles.copy}>
          You’ll see when each window opens in Home.
        </HoystText>
      </>
    );
  }
  if (step === 'type')
    return (
      <>
        {(['build', 'limit', 'avoid'] as CommitmentType[]).map(type => (
          <SetupChoice
            key={type}
            title={type[0].toUpperCase() + type.slice(1)}
            body={
              type === 'build'
                ? 'Do something consistently or reach an amount.'
                : type === 'limit'
                ? 'Keep an amount within your chosen range.'
                : 'Confirm you stayed clear.'
            }
            icon={typeIcon(type)}
            tone={
              type === 'build' ? 'green' : type === 'limit' ? 'orange' : 'red'
            }
            selected={draft.commitmentType === type}
            onPress={() =>
              set({
                commitmentType: type,
                maximumValue: draft.maximumValue ?? 1,
                minimumValue: draft.minimumValue ?? 0,
              })
            }
          />
        ))}
      </>
    );
  if (step === 'goal') return <GoalEditor draft={draft} onChange={onChange} />;
  if (step === 'privacy')
    return (
      <>
        {(['public', 'link_only', 'private'] as const).map(privacyMode => (
          <SetupChoice
            key={privacyMode}
            title={
              privacyMode === 'public'
                ? 'Public'
                : privacyMode === 'link_only'
                ? 'Link only'
                : 'Private'
            }
            body={
              privacyMode === 'public'
                ? 'Discoverable in Explore. Public Tap In previews show your name, avatar, and time.'
                : privacyMode === 'link_only'
                ? 'Hidden from Explore. People with the link can join.'
                : 'Hidden from Explore. You approve every request.'
            }
            selected={draft.privacyMode === privacyMode}
            tone={
              privacyMode === 'public'
                ? 'green'
                : privacyMode === 'link_only'
                ? 'blue'
                : 'blue'
            }
            icon={
              privacyMode === 'public' ? (
                <Globe2 color={theme.successForeground} size={28} />
              ) : privacyMode === 'link_only' ? (
                <Link color={theme.accentTertiaryForeground} size={28} />
              ) : (
                <Shield color={theme.accentForeground} size={28} />
              )
            }
            onPress={() =>
              set({
                ...getPrivacyChoiceFields(
                  privacyMode,
                  draft.joinMode === 'request_to_join'
                    ? 'request_to_join'
                    : 'open',
                ),
                privacyMode,
              })
            }
          />
        ))}
        <HoystText tone="muted" style={styles.copy}>
          Notes and photos stay inside the Circle.
        </HoystText>
      </>
    );
  if (step === 'joining')
    return (
      <>
        <SetupChoice
          title="Open seats"
          body="People can join while seats are available."
          selected={draft.joinMode === 'open'}
          onPress={() => set({joinMode: 'open'})}
        />
        <SetupChoice
          title="Request approval"
          body="You review each request before they can Tap In."
          selected={draft.joinMode === 'request_to_join'}
          onPress={() => set({joinMode: 'request_to_join'})}
        />
      </>
    );
  if (step === 'capacity')
    return (
      <>
        <SetupNumericStepper
          label="People, including you"
          value={draft.maxSize}
          min={2}
          max={100}
          onChange={maxSize => set({maxSize})}
        />
        <View style={styles.chips}>
          {[2, 5, 10, 25, 100].map(maxSize => (
            <Pressable
              key={maxSize}
              accessibilityRole="button"
              onPress={() => set({maxSize})}
              style={[styles.chip, {backgroundColor: theme.surfaceSoft}]}>
              <HoystText>{maxSize}</HoystText>
            </Pressable>
          ))}
        </View>
      </>
    );
  if (step === 'timezone')
    return (
      <TimezonePicker
        actionColors={{fill: theme.accent, foreground: theme.accentForeground}}
        label="Timezone"
        modalTitle="Choose timezone"
        value={draft.timezone}
        onChange={timezone => set({timezone})}
      />
    );
  if (step === 'appearance') {
    const resolved = resolveAppearance(draft.category, draft.appearance);
    return (
      <>
        <View
          style={[
            styles.preview,
            styles.row,
            {
              backgroundColor: theme.isDark
                ? resolved.darkBackground
                : resolved.background,
            },
          ]}>
          <CircleCategoryIcon
            category={draft.category}
            appearance={draft.appearance}
            size={44}
          />
          <View style={styles.flex}>
            <HoystText style={styles.cardTitle}>{draft.title}</HoystText>
            <HoystText tone="muted" style={styles.copy}>
              {draft.commitment}
            </HoystText>
          </View>
        </View>
        <HoystText style={styles.section}>Emoji</HoystText>
        <CommitmentAppearanceControl
          emojiOnly
          category={draft.category}
          title={draft.title}
          appearance={draft.appearance}
          onChange={appearance => set({appearance})}
        />
        <HoystText style={styles.section}>Color</HoystText>
        <View style={styles.chips}>
          {(Object.keys(palettes) as Array<keyof typeof palettes>).map(
            palette => (
              <Pressable
                key={palette}
                accessibilityRole="button"
                accessibilityState={{selected: resolved.palette === palette}}
                onPress={() =>
                  set({appearance: {...draft.appearance, palette}})
                }
                style={[
                  styles.swatch,
                  {
                    backgroundColor: theme.isDark
                      ? palettes[palette].accent + '20'
                      : palettes[palette].background,
                    borderColor:
                      resolved.palette === palette
                        ? theme.accent
                        : 'transparent',
                  },
                ]}>
                <View
                  style={[
                    styles.dot,
                    {backgroundColor: palettes[palette].accent},
                  ]}
                />
                <HoystText style={styles.helper}>
                  {palettes[palette].label}
                </HoystText>
              </Pressable>
            ),
          )}
        </View>
      </>
    );
  }
  if (step === 'review') {
    const rows: Array<[string, string, SetupStep]> = [
      ['Category', draft.category, 'category'],
      ['Pace', paceLabel(draft), 'pace'],
      [
        'Goal for each Tap In',
        `${
          draft.commitmentType[0].toUpperCase() + draft.commitmentType.slice(1)
        } · ${goalLabel(draft)}`,
        'type',
      ],
      [
        'Proof',
        proofOptions.find(
          option => option.id === (draft.proofRequirement ?? 'photo'),
        )!.label,
        'proof',
      ],
      ...(!personal
        ? ([
            [
              'Visibility',
              draft.privacyMode === 'public'
                ? 'Public'
                : draft.privacyMode === 'link_only'
                ? 'Link only'
                : 'Private',
              'privacy',
            ],
            ...(draft.privacyMode === 'public'
              ? [
                  [
                    'Joining',
                    draft.joinMode === 'open'
                      ? 'Open seats'
                      : 'Request approval',
                    'joining',
                  ],
                ]
              : []),
            [
              'Circle size',
              `${draft.maxSize} people, including you`,
              'capacity',
            ],
          ] as Array<[string, string, SetupStep]>)
        : []),
      ['Timezone', draft.timezone, 'timezone'],
      [
        'Appearance',
        `${resolveAppearance(draft.category, draft.appearance).emoji} · ${
          palettes[resolveAppearance(draft.category, draft.appearance).palette]
            .label
        }`,
        'appearance',
      ],
    ];
    return (
      <>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`Edit ${
            personal ? 'Commitment name' : 'Circle name'
          }: ${draft.title}`}
          onPress={() => onEdit('name')}
          style={[
            styles.preview,
            styles.row,
            {
              backgroundColor: theme.isDark
                ? resolveAppearance(draft.category, draft.appearance)
                    .darkBackground
                : resolveAppearance(draft.category, draft.appearance)
                    .background,
            },
          ]}>
          <CircleCategoryIcon
            category={draft.category}
            appearance={draft.appearance}
            size={44}
          />
          <View style={styles.flex}>
            <HoystText style={styles.cardTitle}>{draft.title}</HoystText>
            <HoystText tone="muted" style={styles.copy}>
              {draft.commitment}
            </HoystText>
          </View>
          <ChevronRight color={theme.textMuted} size={18} />
        </Pressable>
        {rows.map(([label, value, target]) => (
          <Pressable
            key={label}
            accessibilityRole="button"
            accessibilityLabel={`Edit ${label}: ${value}`}
            onPress={() => onEdit(target)}
            style={[styles.summaryRow, {borderBottomColor: theme.border}]}>
            <HoystText style={[styles.copy, styles.flex]}>{label}</HoystText>
            <HoystText tone="muted" style={[styles.copy, styles.summaryValue]}>
              {value}
            </HoystText>
            <ChevronRight color={theme.textMuted} size={18} />
          </Pressable>
        ))}
      </>
    );
  }
  return null;
}

const styles = StyleSheet.create({
  proofOptions: {gap: 12},
  prefixField: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderRadius: 12,
  },
  prefix: {paddingLeft: 14, fontSize: 16},
  prefixedInput: {flex: 1, borderWidth: 0, backgroundColor: 'transparent'},
  tag: {
    alignSelf: 'flex-start',
    fontSize: 12,
    lineHeight: 16,
    fontWeight: '600',
    paddingHorizontal: 8,
    paddingVertical: 0,
    borderRadius: 12,
    marginBottom: 4,
  },
  selectedMark: {
    width: 26,
    height: 26,
    borderRadius: 13,
    alignItems: 'center',
    justifyContent: 'center',
  },
  flex: {flex: 1},
  row: {flexDirection: 'row', alignItems: 'center', gap: 12},
  stack: {gap: 16},
  field: {gap: 8},
  fieldLabel: {fontSize: 16, lineHeight: 21, fontWeight: '600'},
  input: {minHeight: 48, paddingVertical: 12, borderRadius: 12},
  multiline: {minHeight: 100},
  helper: {fontSize: 12, lineHeight: 16},
  choice: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderRadius: 20,
    borderWidth: 1.5,
    gap: 12,
    minHeight: 76,
  },
  cardTitle: {fontSize: 16, lineHeight: 21, fontWeight: '700'},
  copy: {fontSize: 14, lineHeight: 20},
  section: {fontSize: 18, lineHeight: 23, fontWeight: '600'},
  chips: {flexDirection: 'row', flexWrap: 'wrap', gap: 8},
  chip: {
    minHeight: 44,
    minWidth: 48,
    paddingHorizontal: 16,
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: 24,
  },
  unitGroup: {padding: 12, borderRadius: 20, borderWidth: 1, gap: 12},
  unitChip: {
    minHeight: 44,
    minWidth: 48,
    maxWidth: '100%',
    paddingHorizontal: 12,
    paddingVertical: 8,
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: 24,
    borderWidth: 1,
  },
  androidUnitChip: {minHeight: 48},
  disabled: {opacity: 0.5},
  unitChipText: {fontSize: 13, lineHeight: 18, fontWeight: '600'},
  goalPreview: {padding: 14, borderRadius: 20, borderWidth: 1, gap: 12},
  previewSection: {gap: 8, paddingBottom: 12, borderBottomWidth: 1},
  previewLabel: {fontSize: 12, lineHeight: 16, fontWeight: '600'},
  preview: {padding: 14, borderRadius: 20, gap: 4},
  grid: {flexDirection: 'row', flexWrap: 'wrap', gap: 8},
  category: {
    width: '48%',
    minHeight: 76,
    padding: 12,
    gap: 8,
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1.5,
    borderRadius: 16,
  },
  swatch: {
    width: '30%',
    padding: 12,
    minHeight: 64,
    alignItems: 'center',
    gap: 6,
    borderRadius: 16,
    borderWidth: 1.5,
  },
  dot: {height: 22, width: 22, borderRadius: 11},
  summaryRow: {
    minHeight: 52,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
    paddingVertical: 8,
  },
  summaryValue: {flex: 1.2, textAlign: 'right'},
});
