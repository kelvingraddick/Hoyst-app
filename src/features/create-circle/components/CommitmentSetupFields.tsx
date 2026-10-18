import {categories, palettes} from '../../../shared/commitment-appearance';
import React from 'react';
import {
  Pressable,
  StyleSheet,
  View,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import {
  Camera,
  CircleCheck,
  CalendarCheck,
  CalendarDays,
  CalendarRange,
  Check,
  Globe2,
  Lock,
  Minus,
  Plus,
  Share2,
  ShieldQuestion,
  UserRound,
  UsersRound,
  type LucideIcon,
} from 'lucide-react-native';

import {
  CircleCategoryIcon,
  getCircleCategoryVisual,
} from '../../../design/components/CircleCategoryIcon';
import {
  CommitmentTypeIcon,
  CommitmentTypePill,
} from '../../../design/components/CommitmentTypeVisual';
import {HoystText} from '../../../design/components/HoystText';
import {radius} from '../../../design/tokens/radius';
import type {HoystTheme} from '../../../design/tokens/colors';
import {useSetupTheme} from '../services/setup-presentation';
import type {
  CircleJoinMode,
  CircleMode,
  CirclePrivacyMode,
  CommitmentPace,
  CommitmentFrequency,
  CommitmentType,
} from '../../../types/models';
import {
  getTimezoneOffsetLabel,
  getTimezonePickerOptions,
} from '../../auth/services/timezone-options';

export type SetupTone =
  | 'blue'
  | 'green'
  | 'neutral'
  | 'orange'
  | 'purple'
  | 'pink'
  | 'teal'
  | 'gold'
  | 'red';

export type SetupOption<T extends string> = {
  category?: string;
  commitmentType?: CommitmentType;
  description: string;
  icon?: LucideIcon;
  id: T;
  label: string;
  tone: SetupTone;
};

export const proofOptions: SetupOption<
  import('../../../shared/tap-in-proof').ProofRequirement
>[] = [
  {
    id: 'photo',
    label: 'Photo proof',
    description: 'Add a photo to complete each Tap In.',
    icon: Camera,
    tone: 'blue',
  },
  {
    id: 'none',
    label: 'No proof needed',
    description: 'Tap In without proof. Photos are optional.',
    icon: CircleCheck,
    tone: 'green',
  },
];

export const circleModeOptions: SetupOption<CircleMode>[] = [
  {
    description: 'Build accountability with other people in a shared Circle.',
    icon: UsersRound,
    id: 'group',
    label: 'Create a circle',
    tone: 'blue',
  },
  {
    description: 'Keep this Commitment private and just for you.',
    icon: UserRound,
    id: 'personal',
    label: 'Personal commitment',
    tone: 'green',
  },
];

export const commitmentTypeOptions: SetupOption<CommitmentType>[] = [
  {
    description: 'Reach the goal for each Tap In.',
    commitmentType: 'build',
    id: 'build',
    label: 'Build',
    tone: 'green',
  },
  {
    description: 'Stay inside the minimum-to-maximum Goal range.',
    commitmentType: 'limit',
    id: 'limit',
    label: 'Limit',
    tone: 'orange',
  },
  {
    description: 'Confirm you stayed clear for each Tap In.',
    commitmentType: 'avoid',
    id: 'avoid',
    label: 'Avoid',
    tone: 'blue',
  },
];

export const categoryOptions: SetupOption<string>[] = categories.map(
  ({label}) => ({
    category: label,
    id: label,
    label,
    description: '',
    tone: getCircleCategoryVisual(label).tone,
  }),
);

export const privacyOptions: SetupOption<CirclePrivacyMode>[] = [
  {
    description:
      'Discoverable in Explore. New Tap Ins may show your member name, profile avatar, and timestamp publicly. Notes and photos stay in the circle.',
    icon: Globe2,
    id: 'public',
    label: 'Public',
    tone: 'green',
  },
  {
    description: 'Hidden from Explore and joinable with your invite link.',
    icon: Share2,
    id: 'link_only',
    label: 'Link-only',
    tone: 'blue',
  },
  {
    description: 'Hidden from Explore, with every request approved by you.',
    icon: Lock,
    id: 'private',
    label: 'Private',
    tone: 'blue',
  },
];

export const publicJoinOptions: SetupOption<
  Extract<CircleJoinMode, 'open' | 'request_to_join'>
>[] = [
  {
    description: 'People can join immediately while seats are open.',
    icon: UsersRound,
    id: 'open',
    label: 'Open seats',
    tone: 'green',
  },
  {
    description: 'People request access before they can Tap In.',
    icon: ShieldQuestion,
    id: 'request_to_join',
    label: 'Request approval',
    tone: 'orange',
  },
];

export const commitmentPaceOptions: SetupOption<CommitmentPace>[] = [
  {
    description: 'Cover the Commitment once each day.',
    icon: CalendarDays,
    id: 'daily',
    label: 'Daily',
    tone: 'green',
  },
  {
    description: 'Set your Tap Ins per week.',
    icon: CalendarRange,
    id: 'weekly',
    label: 'Weekly',
    tone: 'blue',
  },
  {
    description: 'Set your Tap Ins per month.',
    icon: CalendarCheck,
    id: 'monthly',
    label: 'Monthly',
    tone: 'orange',
  },
];

export function getModeAwareSetupCopy(circleMode: CircleMode) {
  const isPersonal = circleMode === 'personal';

  return {
    paceSubject: isPersonal ? 'You Tap In' : 'Each Member taps in',
    categoryPrompt: isPersonal
      ? 'What kind of Commitment is this?'
      : 'What kind of Circle is this?',
    containerLabel: isPersonal ? 'Commitment' : 'Circle',
    progressLabel: isPersonal ? 'your Progress' : 'Circle Progress',
    reviewType: isPersonal ? 'Personal commitment' : 'Circle',
  };
}

export function getSetupToneColor(
  theme: Pick<HoystTheme, 'isDark'>,
  tone: SetupTone,
) {
  const palette = palettes[tone === 'neutral' ? 'gray' : tone];
  return theme.isDark ? palette.darkForeground : palette.foreground;
}

export function SetupIconButton({
  accessibilityLabel,
  disabled,
  icon: Icon,
  onPress,
}: {
  accessibilityLabel: string;
  disabled?: boolean;
  icon: LucideIcon;
  onPress: () => void;
}): React.JSX.Element {
  const theme = useSetupTheme();

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
          backgroundColor: theme.glassSurfaceStrong,
          borderColor: theme.glassBorder,
          opacity: disabled ? 0.36 : pressed ? 0.82 : 1,
        },
      ]}>
      <Icon color={theme.text} size={20} strokeWidth={2.4} />
    </Pressable>
  );
}

export function SetupOptionCard<T extends string>({
  isSelected,
  onPress,
  option,
}: {
  isSelected: boolean;
  onPress: () => void;
  option: SetupOption<T>;
}): React.JSX.Element {
  const theme = useSetupTheme();
  const accentColor = getSetupToneColor(theme, option.tone);
  const Icon = option.icon;
  const checkBackgroundColor = isSelected ? accentColor : 'transparent';

  return (
    <Pressable
      accessibilityLabel={option.label}
      accessibilityRole="radio"
      accessibilityState={{selected: isSelected}}
      onPress={onPress}
      style={({pressed}) => [
        styles.optionPressable,
        {opacity: pressed ? 0.88 : 1, transform: [{scale: pressed ? 0.99 : 1}]},
      ]}>
      <View
        style={[
          styles.optionCard,
          isSelected ? styles.optionCardSelected : undefined,
          {
            backgroundColor: isSelected
              ? `${accentColor}24`
              : theme.glassSurfaceStrong,
            borderColor: isSelected ? accentColor : theme.glassBorder,
          },
        ]}>
        <View
          style={[
            styles.optionIcon,
            option.category || option.commitmentType
              ? styles.categoryIcon
              : {
                  backgroundColor: `${accentColor}${isSelected ? '28' : '16'}`,
                  borderColor: `${accentColor}55`,
                },
          ]}>
          {option.category ? (
            <CircleCategoryIcon category={option.category} size={40} />
          ) : option.commitmentType ? (
            <CommitmentTypeIcon
              commitmentType={option.commitmentType}
              decorative
              size={42}
            />
          ) : Icon ? (
            <Icon color={accentColor} size={21} strokeWidth={2.3} />
          ) : null}
        </View>
        <View style={styles.optionCopy}>
          <HoystText style={styles.optionTitle} variant="bodyStrong">
            {option.label}
          </HoystText>
          <HoystText style={styles.optionDescription} tone="muted">
            {option.description}
          </HoystText>
        </View>
        <View
          style={[
            styles.optionCheck,
            {
              backgroundColor: checkBackgroundColor,
              borderColor: isSelected ? accentColor : theme.borderStrong,
            },
          ]}>
          {isSelected ? (
            <Check color={theme.onBrightAccent} size={15} strokeWidth={3} />
          ) : null}
        </View>
      </View>
    </Pressable>
  );
}

export function SetupOptionList<T extends string>({
  onSelect,
  options,
  selected,
  style,
}: {
  onSelect: (value: T) => void;
  options: SetupOption<T>[];
  selected: T;
  style?: StyleProp<ViewStyle>;
}): React.JSX.Element {
  return (
    <View accessibilityRole="radiogroup" style={[styles.optionStack, style]}>
      {options.map(option => (
        <SetupOptionCard
          isSelected={option.id === selected}
          key={option.id}
          onPress={() => onSelect(option.id)}
          option={option}
        />
      ))}
    </View>
  );
}

export function SetupNumericStepper({
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
}): React.JSX.Element {
  const theme = useSetupTheme();
  const update = (nextValue: number) =>
    onChange(Math.min(max, Math.max(min, Math.round(nextValue))));

  return (
    <View
      style={[
        styles.stepper,
        {
          backgroundColor: theme.glassSurfaceStrong,
          borderColor: theme.glassBorder,
        },
      ]}>
      <View style={styles.stepperCopy}>
        <HoystText tone="muted" variant="label">
          {label}
        </HoystText>
        <HoystText variant="title">{value}</HoystText>
      </View>
      <View style={styles.stepperControls}>
        <SetupIconButton
          accessibilityLabel={`Decrease ${label}`}
          disabled={value <= min}
          icon={Minus}
          onPress={() => update(value - 1)}
        />
        <SetupIconButton
          accessibilityLabel={`Increase ${label}`}
          disabled={value >= max}
          icon={Plus}
          onPress={() => update(value + 1)}
        />
      </View>
    </View>
  );
}

export function SetupSummaryRow({
  label,
  value,
}: {
  label: string;
  value: React.ReactNode;
}): React.JSX.Element {
  return (
    <View style={styles.summaryRow}>
      <HoystText tone="muted" variant="label">
        {label}
      </HoystText>
      {typeof value === 'string' ? (
        <HoystText style={styles.summaryValue}>{value}</HoystText>
      ) : (
        <View style={styles.summaryValueNode}>{value}</View>
      )}
    </View>
  );
}

export function formatJoinMode(joinMode: CircleJoinMode) {
  if (joinMode === 'open') {
    return 'Open seats';
  }
  if (joinMode === 'request_to_join') {
    return 'Request approval';
  }
  return 'Invite link';
}

export function formatPrivacyMode(privacyMode: CirclePrivacyMode) {
  if (privacyMode === 'public') {
    return 'Public';
  }
  if (privacyMode === 'link_only') {
    return 'Link-only';
  }
  return 'Private';
}

export function formatAccessSummary(
  privacyMode: CirclePrivacyMode,
  joinMode: CircleJoinMode,
) {
  return `${formatPrivacyMode(privacyMode)} · ${formatJoinMode(joinMode)}`;
}

export function formatSkipSummary(allowance: number, windowDays: number) {
  if (allowance <= 0) {
    return 'No skips';
  }
  return `${allowance} ${
    allowance === 1 ? 'skip' : 'skips'
  } every ${windowDays} ${windowDays === 1 ? 'day' : 'days'}`;
}

export function formatPaceSummary(
  pace: CommitmentPace,
  frequency: CommitmentFrequency,
) {
  if (pace === 'daily') {
    return 'Daily';
  }

  const count =
    pace === 'monthly'
      ? frequency.opportunitiesPerPeriod ?? frequency.tapInsPerWeek
      : frequency.tapInsPerWeek;
  const tapInLabel = count === 1 ? 'Tap In' : 'Tap Ins';

  return `${
    pace === 'monthly' ? 'Monthly' : 'Weekly'
  } · ${count} ${tapInLabel} per ${pace === 'monthly' ? 'month' : 'week'}`;
}

export function formatCommitmentRulesSummary({
  commitmentType,
  maximumValue,
  minimumValue,
  targetValue,
  unitLabel,
}: {
  commitmentType: CommitmentType;
  maximumValue?: number;
  minimumValue?: number;
  targetValue?: number;
  unitLabel: string;
}) {
  if (commitmentType === 'avoid') {
    return 'Avoid · Binary Tap In';
  }

  if (commitmentType === 'limit') {
    return `Limit · ${minimumValue ?? 0} to ${
      maximumValue ?? targetValue ?? 1
    } ${unitLabel}`.trim();
  }

  return `Build · ${targetValue ?? 1} ${unitLabel}`.trim();
}

export function CommitmentTypeRuleSummary({
  commitmentType,
  maximumValue,
  minimumValue,
  targetValue,
  unitLabel,
}: {
  commitmentType: CommitmentType;
  maximumValue?: number;
  minimumValue?: number;
  targetValue?: number;
  unitLabel: string;
}): React.JSX.Element {
  const ruleDetail =
    commitmentType === 'avoid'
      ? 'Binary Tap In'
      : commitmentType === 'limit'
      ? `${minimumValue ?? 0} to ${maximumValue ?? targetValue ?? 1} ${
          unitLabel.trim() || 'Tap In'
        }`
      : `${targetValue ?? 1} ${unitLabel.trim() || 'Tap In'}`;

  return (
    <View style={styles.commitmentRuleSummary}>
      <CommitmentTypePill commitmentType={commitmentType} uppercase />
      <HoystText
        numberOfLines={2}
        style={styles.commitmentRuleDetail}
        tone="muted"
        variant="caption">
        {ruleDetail}
      </HoystText>
    </View>
  );
}

export function formatTimezoneSummary(timezoneId: string, now = new Date()) {
  const option = getTimezonePickerOptions({
    currentTimezone: timezoneId,
    localTimezone: timezoneId,
    now,
  }).find(item => item.id === timezoneId);

  return (
    option?.label ??
    `${timezoneId} (${getTimezoneOffsetLabel(timezoneId, now)})`
  );
}

const styles = StyleSheet.create({
  commitmentRuleDetail: {
    flexShrink: 1,
    textAlign: 'right',
  },
  commitmentRuleSummary: {
    alignItems: 'flex-end',
    gap: 5,
  },
  iconButton: {
    alignItems: 'center',
    borderRadius: radius.pill,
    borderWidth: 1,
    height: 44,
    justifyContent: 'center',
    width: 44,
  },
  optionPressable: {
    borderRadius: 20,
    width: '100%',
  },
  optionCard: {
    alignItems: 'center',
    borderRadius: 20,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 12,
    minHeight: 84,
    paddingHorizontal: 14,
    paddingVertical: 14,
  },
  optionCardSelected: {
    borderWidth: 2,
  },
  optionIcon: {
    alignItems: 'center',
    borderRadius: 16,
    borderWidth: 1,
    flexShrink: 0,
    height: 44,
    justifyContent: 'center',
    width: 44,
  },
  categoryIcon: {
    backgroundColor: 'transparent',
    borderColor: 'transparent',
  },
  optionCopy: {
    flex: 1,
    gap: 4,
    minWidth: 0,
  },
  optionTitle: {
    lineHeight: 21,
  },
  optionDescription: {
    flexShrink: 1,
    lineHeight: 20,
  },
  optionCheck: {
    alignItems: 'center',
    borderRadius: radius.pill,
    borderWidth: 1,
    flexShrink: 0,
    height: 24,
    justifyContent: 'center',
    width: 24,
  },
  optionStack: {
    gap: 10,
  },
  stepper: {
    alignItems: 'center',
    borderRadius: 20,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 16,
    justifyContent: 'space-between',
    minHeight: 76,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  stepperCopy: {
    flex: 1,
    gap: 4,
    minWidth: 0,
  },
  stepperControls: {
    flexDirection: 'row',
    gap: 8,
  },
  summaryRow: {
    alignItems: 'flex-start',
    flexDirection: 'row',
    gap: 16,
    justifyContent: 'space-between',
    minHeight: 44,
    paddingVertical: 8,
  },
  summaryValue: {
    flex: 1,
    textAlign: 'right',
  },
  summaryValueNode: {
    alignItems: 'flex-end',
    flex: 1,
  },
});
