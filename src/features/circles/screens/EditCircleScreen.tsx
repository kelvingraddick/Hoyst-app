import {
  GoalEditor,
  ProofSelector,
} from '../../create-circle/components/SetupStepContent';
import {validateSetup} from '../../create-circle/services/setup-journey';
import {CommitmentAppearanceControl} from '../../../design/components/CommitmentAppearanceControl';
import React, {useEffect, useMemo, useRef, useState} from 'react';
import {Alert, Pressable, StyleSheet, View} from 'react-native';
import {ArrowLeft} from 'lucide-react-native';
import type {NativeStackScreenProps} from '@react-navigation/native-stack';

import {GlassPanel} from '../../../design/components/GlassPanel';
import {FrostedBackdrop} from '../../../design/components/FrostedBackdrop';
import {HoystChip} from '../../../design/components/HoystChip';
import {HoystInput} from '../../../design/components/HoystInput';
import {HoystScreen} from '../../../design/components/HoystScreen';
import {HoystText} from '../../../design/components/HoystText';
import {CircleCategoryPill} from '../../../design/components/CircleCategoryIcon';
import {radius} from '../../../design/tokens/radius';
import {useSetupTheme} from '../../create-circle/services/setup-presentation';
import type {RootStackParamList} from '../../../navigation/types';
import {useSessionStore} from '../../../store/session-store';
import {useUserProfileStore} from '../../../store/profile-store';
import {TimezonePicker} from '../../auth/components/TimezonePicker';
import {
  buildCircleEditDraft,
  buildCreateCirclePayload,
  clampCircleMaxSize,
  defaultMonthlyCommitmentFrequency,
  defaultWeeklyCommitmentFrequency,
  getPrivacyChoiceFields,
  isCircleMaxSizeBelowMemberCount,
} from '../../create-circle/services/create-circle-draft';
import {subscribeToMemberCircleDetail} from '../../home/services/home-data-service';
import {updateCircle} from '../services/circle-service';
import {CommitmentSetupScaffold} from '../../create-circle/components/CommitmentSetupScaffold';
import {
  categoryOptions as setupCategoryOptions,
  commitmentPaceOptions as setupCommitmentPaceOptions,
  commitmentTypeOptions as setupCommitmentTypeOptions,
  formatAccessSummary,
  formatJoinMode,
  privacyOptions as setupPrivacyOptions,
  publicJoinOptions as setupPublicJoinOptions,
  SetupIconButton,
  SetupNumericStepper,
  SetupOptionList,
  SetupSummaryRow,
} from '../../create-circle/components/CommitmentSetupFields';
import type {
  CircleDetailModel,
  CircleJoinMode,
  CirclePrivacyMode,
  CommitmentPace,
  CommitmentType,
  CreateCircleDraft,
} from '../../../types/models';

type Props = NativeStackScreenProps<RootStackParamList, 'EditCircle'>;

function serializePayload(payload: unknown) {
  return JSON.stringify(payload);
}

export function EditCircleScreen({
  navigation,
  route,
}: Props): React.JSX.Element {
  const theme = useSetupTheme();
  const allowExitRef = useRef(false);
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
    draft.circleMode !== 'personal' &&
    isCircleMaxSizeBelowMemberCount(draft.maxSize, detail.memberCount)
      ? `Max size cannot be below ${detail.memberCount} current Members.`
      : undefined;
  const titleLength = draft?.title.trim().length ?? 0;
  const commitmentLength = draft?.commitment.trim().length ?? 0;
  const timezoneLength = draft?.timezone.trim().length ?? 0;
  const canSave = Boolean(
    detail?.viewerRole === 'owner' &&
      draft &&
      payload &&
      (draft.circleMode === 'personal' ||
        (titleLength > 0 && titleLength <= 80)) &&
      commitmentLength > 0 &&
      commitmentLength <= 160 &&
      timezoneLength > 0 &&
      timezoneLength <= 80 &&
      !maxSizeError &&
      !validateSetup(draft) &&
      payloadKey !== originalPayloadKey &&
      !isSaving,
  );
  const isDirty = Boolean(
    originalPayloadKey && payloadKey && payloadKey !== originalPayloadKey,
  );

  useEffect(() => {
    if (typeof navigation.addListener !== 'function') {
      return undefined;
    }

    return navigation.addListener('beforeRemove', event => {
      if (allowExitRef.current || !isDirty) {
        return;
      }

      event.preventDefault();
      Alert.alert('Discard changes?', 'Your unsaved changes will be lost.', [
        {style: 'cancel', text: 'Keep editing'},
        {
          onPress: () => {
            allowExitRef.current = true;
            navigation.dispatch(event.data.action);
          },
          style: 'destructive',
          text: 'Discard',
        },
      ]);
    });
  }, [isDirty, navigation]);

  const setField = <Key extends keyof CreateCircleDraft>(
    key: Key,
    value: CreateCircleDraft[Key],
  ) => {
    setDraft(current => (current ? {...current, [key]: value} : current));
  };
  const setCommitmentType = (commitmentType: CommitmentType) => {
    setDraft(current =>
      current
        ? {
            ...current,
            commitmentType,
            ...(commitmentType === 'build'
              ? {targetValue: current.targetValue ?? 1}
              : {}),
            ...(commitmentType === 'limit'
              ? {
                  maximumValue:
                    current.maximumValue ?? current.targetValue ?? 1,
                }
              : {}),
            ...(commitmentType === 'avoid'
              ? {
                  maximumValue: undefined,
                  minimumValue: undefined,
                  targetValue: 1,
                }
              : {}),
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

  const selectCommitmentPace = (commitmentPace: CommitmentPace) => {
    setDraft(current =>
      current
        ? {
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
          }
        : current,
    );
  };

  const handleSave = async () => {
    if (draft && validateSetup(draft)) {
      Alert.alert('Check your setup', validateSetup(draft));
      return;
    }
    if (!canSave || !payload) {
      return;
    }

    setIsSaving(true);
    try {
      await updateCircle({
        circleId: route.params.circleId,
        ...payload,
      });
      allowExitRef.current = true;
      navigation.goBack();
    } catch (error) {
      const message =
        (error as {message?: string}).message ??
        (draft?.circleMode === 'personal'
          ? 'Could not save Commitment changes.'
          : 'Could not save Circle changes.');
      Alert.alert('Save failed', message);
    } finally {
      setIsSaving(false);
    }
  };

  if (detail && detail.viewerRole !== 'owner') {
    return (
      <HoystScreen
        background={<FrostedBackdrop />}
        contentContainerStyle={styles.content}>
        <View style={styles.header}>
          <SetupIconButton
            accessibilityLabel="Go back"
            icon={ArrowLeft}
            onPress={() => navigation.goBack()}
          />
          <View style={styles.headerCopy}>
            <HoystText variant="largeTitle">Edit Circle</HoystText>
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
      <HoystScreen
        background={<FrostedBackdrop />}
        contentContainerStyle={styles.content}>
        <View style={styles.header}>
          <SetupIconButton
            accessibilityLabel="Go back"
            icon={ArrowLeft}
            onPress={() => navigation.goBack()}
          />
          <View style={styles.headerCopy}>
            <HoystText variant="largeTitle">Edit Circle</HoystText>
            <HoystText tone="muted">Loading owner settings...</HoystText>
          </View>
        </View>
      </HoystScreen>
    );
  }

  const isPersonal = draft.circleMode === 'personal';
  const publicJoinMode =
    draft.joinMode === 'open' || draft.joinMode === 'request_to_join'
      ? draft.joinMode
      : 'request_to_join';

  return (
    <CommitmentSetupScaffold
      body={
        isPersonal
          ? 'Update the Commitment Goal, Pace, and timing.'
          : 'Update the Circle name, rules, access, timing, and capacity.'
      }
      eyebrow="Owner settings"
      onBack={() => navigation.goBack()}
      primaryAction={{
        disabled: !canSave,
        label: isSaving ? 'Saving...' : 'Save changes',
        onPress: () => handleSave().catch(() => undefined),
      }}
      title={isPersonal ? 'Edit Commitment' : 'Edit Circle'}>
      <GlassPanel>
        <View style={styles.sectionHeader}>
          <HoystText variant="title">Basics</HoystText>
          <CircleCategoryPill
            category={draft.category}
            appearance={draft.appearance}
          />
        </View>
        <SetupOptionList
          onSelect={value => setField('category', value)}
          options={setupCategoryOptions}
          selected={draft.category}
        />
        <CommitmentAppearanceControl
          title={draft.title || draft.commitment}
          category={draft.category}
          appearance={draft.appearance}
          onChange={value => setField('appearance', value)}
        />
        {draft ? (
          <View style={styles.fieldBlock}>
            <HoystText tone="muted" variant="label">
              {isPersonal ? 'Commitment name' : 'Circle name'}
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
        ) : null}
        <View style={styles.fieldBlock}>
          <HoystText tone="muted" variant="label">
            Commitment statement
          </HoystText>
          <HoystInput
            maxLength={160}
            multiline
            numberOfLines={4}
            onChangeText={value => setField('commitment', value)}
            placeholder="Read 20 pages, then Tap In with one takeaway."
            style={styles.textArea}
            textAlignVertical="top"
            value={draft.commitment}
          />
          <HoystText
            tone={
              commitmentLength > 0 && commitmentLength <= 160
                ? 'muted'
                : 'danger'
            }
            variant="caption">
            {commitmentLength}/160 characters
          </HoystText>
        </View>
      </GlassPanel>

      {!isPersonal ? (
        <GlassPanel>
          <View style={styles.sectionHeader}>
            <HoystText variant="title">Access and capacity</HoystText>
            <HoystChip
              label={formatAccessSummary(draft.privacyMode, draft.joinMode)}
              tone="green"
            />
          </View>
          <SetupOptionList
            onSelect={selectPrivacyMode}
            options={setupPrivacyOptions}
            selected={draft.privacyMode}
          />
          {draft.privacyMode === 'public' ? (
            <View style={styles.nestedBlock}>
              <View style={styles.sectionHeader}>
                <HoystText variant="bodyStrong">Public join rule</HoystText>
                <HoystChip
                  label={formatJoinMode(draft.joinMode)}
                  tone="green"
                />
              </View>
              <SetupOptionList
                onSelect={selectPublicJoinMode}
                options={setupPublicJoinOptions}
                selected={publicJoinMode}
              />
            </View>
          ) : null}
          <SetupSummaryRow
            label="Visible setting"
            value={formatAccessSummary(draft.privacyMode, draft.joinMode)}
          />
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
                accessibilityRole="button"
                key={size}
                onPress={() => setField('maxSize', size)}
                style={({pressed}) => [
                  styles.presetButton,
                  {
                    backgroundColor:
                      draft.maxSize === size
                        ? `${theme.accentSecondaryForeground}22`
                        : theme.glassSurfaceStrong,
                    borderColor:
                      draft.maxSize === size
                        ? theme.accentSecondaryForeground
                        : theme.glassBorder,
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
        </GlassPanel>
      ) : null}

      <GlassPanel>
        <View style={styles.sectionHeader}>
          <HoystText variant="title">Commitment rules</HoystText>
        </View>
        <View style={styles.sectionHeader}>
          <HoystText variant="bodyStrong">Commitment type</HoystText>
          <HoystChip
            label={
              draft.commitmentType === 'limit'
                ? 'Limit'
                : draft.commitmentType === 'avoid'
                ? 'Avoid'
                : 'Build'
            }
            tone={
              draft.commitmentType === 'limit'
                ? 'orange'
                : draft.commitmentType === 'avoid'
                ? 'blue'
                : 'green'
            }
          />
        </View>
        <SetupOptionList
          onSelect={setCommitmentType}
          options={setupCommitmentTypeOptions}
          selected={draft.commitmentType}
        />
        <HoystText variant="bodyStrong">Goal for each Tap In</HoystText>
        <GoalEditor draft={draft} onChange={setDraft} disabled={isSaving} />
        <HoystText variant="bodyStrong">Tap In proof</HoystText>
        <ProofSelector
          value={draft.proofRequirement ?? 'none'}
          onChange={value => setField('proofRequirement', value)}
          disabled={isSaving}
        />
        <HoystText tone="muted">
          Changes apply to new Tap Ins. Saved Tap Ins keep their original proof
          rule.
        </HoystText>
      </GlassPanel>

      <GlassPanel>
        <View style={styles.sectionHeader}>
          <HoystText variant="title">Pace and timing</HoystText>
          <HoystChip
            label={
              draft.commitmentCadence === 'daily'
                ? 'Daily'
                : draft.commitmentCadence === 'monthly'
                ? `${
                    draft.commitmentFrequency.opportunitiesPerPeriod ??
                    draft.commitmentFrequency.tapInsPerWeek
                  }/month`
                : `${draft.commitmentFrequency.tapInsPerWeek}/week`
            }
            tone={draft.commitmentCadence === 'monthly' ? 'orange' : 'green'}
          />
        </View>
        <SetupOptionList
          onSelect={selectCommitmentPace}
          options={setupCommitmentPaceOptions}
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
              label="Tap Ins per month"
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
              Tap In windows are spaced across the month in the selected
              timezone.
            </HoystText>
          </>
        ) : (
          <HoystText tone="muted">
            {isPersonal
              ? 'This Commitment needs one Tap In or Skip each day.'
              : 'Daily Circles need one Tap In or Skip from each Member every day.'}
          </HoystText>
        )}
        <TimezonePicker
          actionColors={{
            fill: theme.accent,
            foreground: theme.accentForeground,
          }}
          helperText={`This controls when each Tap In day resets for this ${
            isPersonal ? 'Commitment' : 'Circle'
          }.`}
          modalTitle={`${isPersonal ? 'Commitment' : 'Circle'} timezone`}
          onChange={value => setField('timezone', value)}
          value={draft.timezone}
        />
        {timezoneLength > 0 && timezoneLength <= 80 ? null : (
          <HoystText tone="danger" variant="caption">
            Choose a timezone before saving.
          </HoystText>
        )}
      </GlassPanel>
    </CommitmentSetupScaffold>
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
  nestedBlock: {
    gap: 12,
    paddingTop: 4,
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
