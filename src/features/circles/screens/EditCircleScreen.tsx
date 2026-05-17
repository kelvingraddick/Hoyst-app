import React, {useEffect, useMemo, useState} from 'react';
import {Alert, Pressable, StyleSheet, View} from 'react-native';
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
  Save,
  Share2,
  Shield,
  Sparkles,
  UsersRound,
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
import type {RootStackParamList} from '../../../navigation/types';
import {useSessionStore} from '../../../store/session-store';
import {useUserProfileStore} from '../../../store/profile-store';
import {TimezonePicker} from '../../auth/components/TimezonePicker';
import {
  buildCircleEditDraft,
  buildCreateCirclePayload,
  clampCircleMaxSize,
  getPrivacyChoiceFields,
  isCircleMaxSizeBelowMemberCount,
  normalizeSkipGraceRule,
} from '../../create-circle/services/create-circle-draft';
import {subscribeToMemberCircleDetail} from '../../home/services/home-data-service';
import {updateCircle} from '../services/circle-service';
import type {
  CircleDetailModel,
  CircleJoinMode,
  CirclePrivacyMode,
  CreateCircleDraft,
} from '../../../types/models';

type Props = NativeStackScreenProps<RootStackParamList, 'EditCircle'>;
type Option<T extends string> = {
  description: string;
  icon: LucideIcon;
  id: T;
  label: string;
  tone: 'blue' | 'green' | 'orange' | 'purple';
};

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
    description: 'Hidden from Explore with requests for approval.',
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

function serializePayload(payload: unknown) {
  return JSON.stringify(payload);
}

export function EditCircleScreen({
  navigation,
  route,
}: Props): React.JSX.Element {
  const theme = useHoystTheme();
  const profile = useUserProfileStore(state => state.profile);
  const user = useSessionStore(state => state.user);
  const status = useSessionStore(state => state.status);
  const timezone = profile?.timezone ?? 'UTC';
  const [detail, setDetail] = useState<CircleDetailModel>();
  const [draft, setDraft] = useState<CreateCircleDraft>();
  const [draftCircleId, setDraftCircleId] = useState<string>();
  const [originalPayloadKey, setOriginalPayloadKey] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (status !== 'authenticatedReady' || !user?.uid) {
      setDetail(undefined);
      return undefined;
    }

    return subscribeToMemberCircleDetail({
      circleId: route.params.circleId,
      onDetail: setDetail,
      onError: () => setDetail(undefined),
      timezone,
      uid: user.uid,
    });
  }, [route.params.circleId, status, timezone, user?.uid]);

  useEffect(() => {
    if (
      !detail ||
      detail.viewerRole !== 'owner' ||
      draftCircleId === detail.id
    ) {
      return;
    }

    const nextDraft = buildCircleEditDraft(detail, timezone);
    setDraft(nextDraft);
    setDraftCircleId(detail.id);
    setOriginalPayloadKey(
      serializePayload(buildCreateCirclePayload(nextDraft)),
    );
  }, [detail, draftCircleId, timezone]);

  const payload = useMemo(
    () => (draft ? buildCreateCirclePayload(draft) : undefined),
    [draft],
  );
  const payloadKey = useMemo(
    () => (payload ? serializePayload(payload) : ''),
    [payload],
  );
  const maxSizeError =
    draft &&
    detail &&
    isCircleMaxSizeBelowMemberCount(draft.maxSize, detail.memberCount)
      ? `Max size cannot be below ${detail.memberCount} current members.`
      : undefined;
  const titleLength = draft?.title.trim().length ?? 0;
  const dailyTaskLength = draft?.dailyTask.trim().length ?? 0;
  const timezoneLength = draft?.timezone.trim().length ?? 0;
  const canSave = Boolean(
    detail?.viewerRole === 'owner' &&
      draft &&
      payload &&
      titleLength > 0 &&
      titleLength <= 80 &&
      dailyTaskLength > 0 &&
      dailyTaskLength <= 160 &&
      timezoneLength > 0 &&
      timezoneLength <= 80 &&
      !maxSizeError &&
      payloadKey !== originalPayloadKey &&
      !isSaving,
  );

  const setField = <Key extends keyof CreateCircleDraft>(
    key: Key,
    value: CreateCircleDraft[Key],
  ) => {
    setDraft(current => (current ? {...current, [key]: value} : current));
  };

  const setSkipRule = (nextRule: {allowance?: number; windowDays?: number}) => {
    setDraft(current =>
      current
        ? {
            ...current,
            graceRules: {
              skip: normalizeSkipGraceRule({
                ...current.graceRules.skip,
                ...nextRule,
              }),
            },
          }
        : current,
    );
  };

  const selectPrivacyMode = (privacyMode: CirclePrivacyMode) => {
    setDraft(current => {
      if (!current) {
        return current;
      }

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
    setDraft(current =>
      current
        ? {
            ...current,
            joinMode,
            privacy: 'public',
            privacyMode: 'public',
          }
        : current,
    );
  };

  const handleSave = async () => {
    if (!canSave || !payload) {
      return;
    }

    setIsSaving(true);
    try {
      await updateCircle({
        circleId: route.params.circleId,
        ...payload,
      });
      navigation.goBack();
    } catch (error) {
      const message =
        (error as {message?: string}).message ??
        'Could not save circle changes.';
      Alert.alert('Save failed', message);
    } finally {
      setIsSaving(false);
    }
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

  if (detail && detail.viewerRole !== 'owner') {
    return (
      <HoystScreen contentContainerStyle={styles.content}>
        <View style={styles.header}>
          <IconButton
            accessibilityLabel="Go back"
            icon={ArrowLeft}
            onPress={() => navigation.goBack()}
          />
          <View style={styles.headerCopy}>
            <HoystText variant="headline">Edit Circle</HoystText>
            <HoystText tone="muted">
              Only the circle owner can edit these settings.
            </HoystText>
          </View>
        </View>
      </HoystScreen>
    );
  }

  if (!detail || !draft) {
    return (
      <HoystScreen contentContainerStyle={styles.content}>
        <View style={styles.header}>
          <IconButton
            accessibilityLabel="Go back"
            icon={ArrowLeft}
            onPress={() => navigation.goBack()}
          />
          <View style={styles.headerCopy}>
            <HoystText variant="headline">Edit Circle</HoystText>
            <HoystText tone="muted">Loading owner settings...</HoystText>
          </View>
        </View>
      </HoystScreen>
    );
  }

  const skipRule = draft.graceRules.skip;
  const graceEnabled = skipRule.allowance > 0;
  const publicJoinMode =
    draft.joinMode === 'open' || draft.joinMode === 'request_to_join'
      ? draft.joinMode
      : 'request_to_join';

  return (
    <HoystScreen contentContainerStyle={styles.content}>
      <View style={styles.header}>
        <IconButton
          accessibilityLabel="Go back"
          icon={ArrowLeft}
          onPress={() => navigation.goBack()}
        />
        <View style={styles.headerCopy}>
          <HoystText tone="muted" variant="label">
            Owner settings
          </HoystText>
          <HoystText variant="headline">Edit Circle</HoystText>
        </View>
      </View>

      <GlassPanel>
        <View style={styles.sectionHeader}>
          <HoystText variant="title">Basics</HoystText>
          <HoystChip label={draft.category} tone="neutral" />
        </View>
        {renderOptions(categoryOptions, draft.category, value =>
          setField('category', value),
        )}
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
          <HoystText
            tone={titleLength > 0 && titleLength <= 80 ? 'muted' : 'danger'}
            variant="caption">
            {titleLength}/80 characters
          </HoystText>
        </View>
        <View style={styles.fieldBlock}>
          <HoystText tone="muted" variant="label">
            Daily task description
          </HoystText>
          <HoystInput
            maxLength={160}
            multiline
            numberOfLines={4}
            onChangeText={value => setField('dailyTask', value)}
            placeholder="Read 20 pages, then Tap In with one takeaway."
            style={styles.textArea}
            textAlignVertical="top"
            value={draft.dailyTask}
          />
          <HoystText
            tone={
              dailyTaskLength > 0 && dailyTaskLength <= 160 ? 'muted' : 'danger'
            }
            variant="caption">
            {dailyTaskLength}/160 characters
          </HoystText>
        </View>
      </GlassPanel>

      <GlassPanel>
        <View style={styles.sectionHeader}>
          <HoystText variant="title">Access</HoystText>
          <HoystChip
            label={`${getPrivacyLabel(draft.privacyMode)}: ${getJoinModeLabel(
              draft.joinMode,
            )}`}
            tone="green"
          />
        </View>
        {renderOptions(privacyOptions, draft.privacyMode, selectPrivacyMode)}
        {draft.privacyMode === 'public' ? (
          <View style={styles.nestedBlock}>
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
          </View>
        ) : null}
        <SummaryRow
          label="Visible setting"
          value={`${getPrivacyLabel(draft.privacyMode)}: ${getJoinModeLabel(
            draft.joinMode,
          )}`}
        />
      </GlassPanel>

      <GlassPanel>
        <View style={styles.sectionHeader}>
          <HoystText variant="title">Limits and Timing</HoystText>
          <HoystChip
            label={`${detail.memberCount}/${draft.maxSize} members`}
            tone={maxSizeError ? 'orange' : 'neutral'}
          />
        </View>
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
        {maxSizeError ? (
          <HoystText tone="danger" variant="caption">
            {maxSizeError}
          </HoystText>
        ) : null}
        <TimezonePicker
          helperText="This controls when each daily Tap In window resets."
          modalTitle="Circle timezone"
          onChange={value => setField('timezone', value)}
          value={draft.timezone}
        />
        {timezoneLength > 0 && timezoneLength <= 80 ? null : (
          <HoystText tone="danger" variant="caption">
            Choose a timezone before saving.
          </HoystText>
        )}
      </GlassPanel>

      <GlassPanel>
        <View style={styles.sectionHeader}>
          <HoystText variant="title">Skips</HoystText>
          <HoystChip
            label={graceEnabled ? 'On' : 'Off'}
            tone={graceEnabled ? 'orange' : 'neutral'}
          />
        </View>
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
      </GlassPanel>

      <HoystButton
        disabled={!canSave}
        icon={
          <Save color={theme.actionForeground} size={18} strokeWidth={2.4} />
        }
        label={isSaving ? 'Saving...' : 'Save Changes'}
        onPress={() => {
          handleSave().catch(() => undefined);
        }}
      />
    </HoystScreen>
  );
}

const styles = StyleSheet.create({
  content: {
    paddingBottom: 60,
  },
  fieldBlock: {
    gap: 8,
  },
  header: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 12,
  },
  headerCopy: {
    flex: 1,
    gap: 3,
    minWidth: 0,
  },
  iconButton: {
    alignItems: 'center',
    borderRadius: radius.pill,
    borderWidth: 1,
    height: 42,
    justifyContent: 'center',
    width: 42,
  },
  nestedBlock: {
    gap: 12,
    paddingTop: 4,
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
    minWidth: 0,
  },
  optionIcon: {
    alignItems: 'center',
    borderRadius: radius.pill,
    borderWidth: 1,
    height: 42,
    justifyContent: 'center',
    width: 42,
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
    minWidth: 46,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  sectionHeader: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 12,
    justifyContent: 'space-between',
  },
  sizePresets: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  stepper: {
    alignItems: 'center',
    borderRadius: radius.md,
    borderWidth: 1,
    flexDirection: 'row',
    justifyContent: 'space-between',
    minHeight: 76,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  stepperControls: {
    flexDirection: 'row',
    gap: 8,
  },
  stepperCopy: {
    gap: 4,
  },
  summaryRow: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 12,
  },
  summaryValue: {
    flex: 1,
    textAlign: 'right',
  },
  textArea: {
    minHeight: 116,
  },
  toggleRow: {
    alignItems: 'center',
    borderRadius: radius.md,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 12,
    minHeight: 76,
    padding: 14,
  },
});
