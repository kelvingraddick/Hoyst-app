import React, {useState} from 'react';
import {
  LayoutChangeEvent,
  Pressable,
  StyleSheet,
  View,
} from 'react-native';
import {
  Apple,
  ArrowLeft,
  BookOpen,
  Dumbbell,
  Globe2,
  Lock,
  Share2,
  Shield,
  Sparkles,
} from 'lucide-react-native';
import type {NativeStackScreenProps} from '@react-navigation/native-stack';

import {CategoryTile} from '../../../design/components/CategoryTile';
import {GlassPanel} from '../../../design/components/GlassPanel';
import {HoystButton} from '../../../design/components/HoystButton';
import {HoystChip} from '../../../design/components/HoystChip';
import {HoystInput} from '../../../design/components/HoystInput';
import {HoystScreen} from '../../../design/components/HoystScreen';
import {HoystText} from '../../../design/components/HoystText';
import {StepSection} from '../../../design/components/StepSection';
import {useHoystTheme} from '../../../design/theme/useHoystTheme';
import {initialCreateCircleDraft} from '../../circles/mockData';
import type {CreateCircleDraft} from '../../../types/models';
import type {RootStackParamList} from '../../../navigation/types';

type Props = NativeStackScreenProps<RootStackParamList, 'CreateCircle'>;
type DraftErrors = Partial<Record<'category' | 'title' | 'dailyTask', string>>;

const CATEGORY_OPTIONS = [
  {label: 'Fitness', icon: Dumbbell},
  {label: 'Nutrition', icon: Apple},
  {label: 'Sobriety', icon: Shield},
  {label: 'Skills', icon: BookOpen},
  {label: 'Custom', icon: Sparkles},
] as const;

function TopControl({
  children,
  onPress,
}: {
  children: React.ReactNode;
  onPress?: () => void;
}) {
  const theme = useHoystTheme();

  return (
    <Pressable
      onPress={onPress}
      style={({pressed}) => [
        styles.topControl,
        {
          backgroundColor: theme.surfaceSoft,
          borderColor: theme.border,
          opacity: pressed ? 0.92 : 1,
        },
      ]}>
      {children}
    </Pressable>
  );
}

function Slider({
  max,
  min,
  onChange,
  value,
}: {
  max: number;
  min: number;
  onChange: (nextValue: number) => void;
  value: number;
}) {
  const theme = useHoystTheme();
  const [trackWidth, setTrackWidth] = useState(0);
  const percentage = ((value - min) / (max - min)) * 100;

  const updateValueFromLocation = (locationX: number) => {
    if (!trackWidth) {
      return;
    }

    const ratio = Math.min(1, Math.max(0, locationX / trackWidth));
    const nextValue = Math.round(min + ratio * (max - min));
    onChange(nextValue);
  };

  return (
    <View style={styles.sliderWrap}>
      <View style={styles.sliderHeader}>
        <HoystText tone="muted" variant="tiny">
          Max Size
        </HoystText>
        <HoystText style={{color: theme.accentSecondary}} variant="bodyStrong">
          {value} Members
        </HoystText>
      </View>
      <Pressable
        onLayout={(event: LayoutChangeEvent) =>
          setTrackWidth(event.nativeEvent.layout.width)
        }
        onPress={event => updateValueFromLocation(event.nativeEvent.locationX)}
        style={[styles.sliderTrack, {backgroundColor: theme.surfaceHigh}]}>
        <View
          style={[
            styles.sliderFill,
            {
              backgroundColor: theme.accentSecondary,
              width: `${percentage}%`,
            },
          ]}
        />
        <View
          style={[
            styles.sliderThumb,
            {
              backgroundColor: theme.accentSecondary,
              left: `${percentage}%`,
            },
          ]}
        />
      </Pressable>
      <View style={styles.sliderLabels}>
        <HoystText tone="muted" variant="tiny">
          Intimate 03
        </HoystText>
        <HoystText tone="muted" variant="tiny">
          Squad {max}
        </HoystText>
      </View>
    </View>
  );
}

export function CreateCircleScreen({
  navigation,
}: Props): React.JSX.Element {
  const theme = useHoystTheme();
  const [draft, setDraft] = useState<CreateCircleDraft>(initialCreateCircleDraft);
  const [errors, setErrors] = useState<DraftErrors>({});
  const [saved, setSaved] = useState(false);
  const [created, setCreated] = useState(false);

  const setField = <Key extends keyof CreateCircleDraft,>(
    key: Key,
    value: CreateCircleDraft[Key],
  ) => {
    setSaved(false);
    setCreated(false);
    setDraft(current => ({...current, [key]: value}));
  };

  const validate = () => {
    const nextErrors: DraftErrors = {};
    if (!draft.category) {
      nextErrors.category = 'Choose a category';
    }
    if (!draft.title.trim()) {
      nextErrors.title = 'Circle title is required';
    }
    if (!draft.dailyTask.trim()) {
      nextErrors.dailyTask = 'Daily task is required';
    }
    setErrors(nextErrors);
    return Object.keys(nextErrors).length === 0;
  };

  const handleCreate = () => {
    if (!validate()) {
      return;
    }

    setCreated(true);
    setSaved(false);
  };

  return (
    <HoystScreen contentContainerStyle={styles.content}>
      <View style={styles.topBar}>
        <TopControl onPress={() => navigation.goBack()}>
          <ArrowLeft color={theme.text} size={18} strokeWidth={2.3} />
        </TopControl>
        <View style={styles.topIcons}>
          <TopControl>
            <Globe2 color={theme.textMuted} size={16} strokeWidth={2.2} />
          </TopControl>
          <TopControl>
            <Lock color={theme.accentSecondary} size={16} strokeWidth={2.2} />
          </TopControl>
        </View>
      </View>

      <View style={styles.topAccent} />

      <StepSection
        description="What focus area defines this Circle?"
        title="Step 1: Category">
        <View style={styles.categoryGrid}>
          {CATEGORY_OPTIONS.map(option => (
            <CategoryTile
              icon={option.icon}
              isSelected={draft.category === option.label}
              key={option.label}
              label={option.label}
              onPress={() => setField('category', option.label)}
            />
          ))}
        </View>
        {errors.category ? (
          <HoystText tone="danger" variant="caption">
            {errors.category}
          </HoystText>
        ) : null}
      </StepSection>

      <StepSection
        description="Define your mission and daily requirement."
        title="Step 2: Core Identity">
        <View style={styles.fieldBlock}>
          <HoystText tone="muted" variant="label">
            Circle Title
          </HoystText>
          <HoystInput
            onChangeText={value => setField('title', value)}
            placeholder="e.g. The 5AM Vanguard"
            value={draft.title}
          />
          {errors.title ? (
            <HoystText tone="danger" variant="caption">
              {errors.title}
            </HoystText>
          ) : null}
        </View>
        <View style={styles.fieldBlock}>
          <HoystText tone="muted" variant="label">
            Daily Task
          </HoystText>
          <HoystInput
            onChangeText={value => setField('dailyTask', value)}
            placeholder="e.g. Read 20 pages"
            value={draft.dailyTask}
          />
          {errors.dailyTask ? (
            <HoystText tone="danger" variant="caption">
              {errors.dailyTask}
            </HoystText>
          ) : null}
        </View>
      </StepSection>

      <StepSection
        description="Scale and visibility controls."
        title="Step 3: Logistics">
        <GlassPanel>
          <View style={styles.privacyRow}>
            <View style={styles.privacyCopy}>
              <View style={styles.privacyTitle}>
                <Globe2 color={theme.accentSecondary} size={18} strokeWidth={2.2} />
                <HoystText variant="bodyStrong">
                  {draft.privacy === 'public' ? 'Public Circle' : 'Private Circle'}
                </HoystText>
              </View>
              <HoystText tone="muted" variant="caption">
                Visible in discovery feed
              </HoystText>
            </View>
            <Pressable
              onPress={() =>
                setField('privacy', draft.privacy === 'public' ? 'private' : 'public')
              }
              style={[
                styles.switchTrack,
                {
                  backgroundColor:
                    draft.privacy === 'public'
                      ? theme.accentSecondary
                      : theme.surfaceHigh,
                },
              ]}>
              <View
                style={[
                  styles.switchThumb,
                  draft.privacy === 'public'
                    ? styles.switchThumbRight
                    : styles.switchThumbLeft,
                ]}
              />
            </Pressable>
          </View>
          <Slider
            max={15}
            min={3}
            onChange={value => setField('maxSize', value)}
            value={draft.maxSize}
          />
        </GlassPanel>
      </StepSection>

      <StepSection
        description="Ready to gather your crew?"
        title="Step 4: Launch">
        <GlassPanel>
          <View style={styles.launchIcon}>
            <Share2 color={theme.text} size={18} strokeWidth={2.2} />
          </View>
          <View style={styles.launchCopy}>
            <HoystText tone="muted" variant="caption">
              Your Invite Link
            </HoystText>
            <HoystText style={{color: theme.accentSecondary}}>
              {draft.inviteCode}
            </HoystText>
          </View>
          <HoystButton
            icon={<Share2 color={theme.text} size={18} strokeWidth={2.2} />}
            label="Share Link"
            variant="outline"
          />
        </GlassPanel>
      </StepSection>

      <View style={styles.footer}>
        <Pressable
          onPress={() => {
            setSaved(true);
            setCreated(false);
          }}>
          <HoystText tone="muted" variant="caption">
            Save Draft
          </HoystText>
        </Pressable>
        <View style={styles.createButton}>
          <HoystButton label="Create Circle" onPress={handleCreate} variant="secondary" />
        </View>
      </View>

      {saved ? (
        <HoystChip label="Draft saved locally" tone="green" />
      ) : null}
      {created ? (
        <HoystChip label="Prototype circle ready" tone="purple" />
      ) : null}
    </HoystScreen>
  );
}

const styles = StyleSheet.create({
  content: {
    paddingBottom: 60,
  },
  topBar: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  topControl: {
    alignItems: 'center',
    borderRadius: 16,
    borderWidth: 1,
    height: 34,
    justifyContent: 'center',
    minWidth: 34,
    paddingHorizontal: 8,
  },
  topIcons: {
    flexDirection: 'row',
    gap: 10,
  },
  topAccent: {
    backgroundColor: '#8b5cf6',
    borderRadius: 999,
    height: 4,
    width: 58,
  },
  categoryGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  fieldBlock: {
    gap: 8,
  },
  privacyRow: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  privacyCopy: {
    gap: 6,
  },
  privacyTitle: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 8,
  },
  switchTrack: {
    borderRadius: 999,
    justifyContent: 'center',
    padding: 3,
    width: 48,
  },
  switchThumb: {
    backgroundColor: '#ffffff',
    borderRadius: 999,
    height: 18,
    width: 18,
  },
  switchThumbLeft: {
    alignSelf: 'flex-start',
  },
  switchThumbRight: {
    alignSelf: 'flex-end',
  },
  sliderWrap: {
    gap: 12,
  },
  sliderHeader: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  sliderTrack: {
    borderRadius: 999,
    height: 8,
    justifyContent: 'center',
    position: 'relative',
  },
  sliderFill: {
    borderRadius: 999,
    height: '100%',
  },
  sliderThumb: {
    borderRadius: 999,
    height: 18,
    marginLeft: -9,
    position: 'absolute',
    top: -5,
    width: 18,
  },
  sliderLabels: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  launchIcon: {
    alignItems: 'center',
    alignSelf: 'center',
    backgroundColor: '#8b5cf6',
    borderRadius: 16,
    height: 48,
    justifyContent: 'center',
    width: 48,
  },
  launchCopy: {
    alignItems: 'center',
    gap: 6,
  },
  footer: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  createButton: {
    minWidth: 180,
  },
});
