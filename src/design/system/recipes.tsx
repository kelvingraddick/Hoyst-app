import type {CommitmentAppearance} from '../../shared/commitment-appearance';
import React, {type ReactNode} from 'react';
import {Target} from 'lucide-react-native';
import {
  Pressable,
  StyleSheet,
  View,
  type ImageSourcePropType,
} from 'react-native';
import {getCircleCategoryVisual} from '../components/CircleCategoryIcon';
import {
  CommitmentCardHeader,
  CommitmentCardSurface,
  getCommitmentCardColors,
} from '../components/CommitmentCardSurface';
import {
  DSAvatar,
  DSButton,
  DSIconButton,
  DSListRow,
  DSStatus,
  DSText,
} from './primitives';
import {space} from './tokens';
import {useSystemTheme} from './theme';

/** Presentation only. Existing screen controllers own eligibility and requests. */
export type CommitmentPreviewProps = {
  title: string;
  category: string;
  appearance?: CommitmentAppearance;
  description: string;
  goal?: {
    label: string;
    value: string;
  };
  context: string;
  streaks?: ReactNode;
  onDetails: () => void;
  status: string;
  members?: readonly {
    id: string;
    name: string;
    source?: ImageSourcePropType;
  }[];
  action?: {
    label: string;
    busy?: boolean;
    disabled?: boolean;
    onPress: () => void;
    variant?: 'primary' | 'outline' | 'quiet';
  };
};
export function DSCommitmentPreview({
  title,
  category,
  appearance,
  description,
  goal,
  context,
  streaks,
  onDetails,
  status,
  members,
  action,
}: CommitmentPreviewProps) {
  const theme = useSystemTheme();
  const visual = getCircleCategoryVisual(category, appearance);
  const colors = getCommitmentCardColors(category, appearance, theme.isDark);
  const button = action ? (
    <DSButton
      label={action.label}
      onPress={action.onPress}
      busy={action.busy}
      disabled={action.disabled}
      compact
      category={visual.tone}
      variant={action.variant ?? 'primary'}
      accessibilityLabel={`${action.label} for ${title}`}
    />
  ) : null;
  return (
    <CommitmentCardSurface
      colors={colors}
      footer={
        <View style={styles.footer}>
          <Pressable
            accessible={false}
            onPress={onDetails}
            style={[styles.context, !action && styles.statusContext]}>
            {members?.length ? (
              <View style={styles.avatars}>
                {members.slice(0, 2).map((member, index) => (
                  <View
                    key={member.id}
                    style={index ? styles.avatarOverlap : undefined}>
                    <DSAvatar
                      name={member.name}
                      source={member.source}
                      size={24}
                    />
                  </View>
                ))}
              </View>
            ) : null}
            <View style={styles.contextCopy}>
              <DSText
                variant="secondary"
                tone="muted"
                style={styles.contextText}>
                {context}
              </DSText>
              {action?.label.startsWith('Nudg') ? (
                <DSText variant="secondary" tone="muted">
                  {status}
                </DSText>
              ) : null}
            </View>
          </Pressable>
          {button}
          {!action ? (
            <View style={styles.completion}>
              <DSStatus label={status} />
            </View>
          ) : null}
        </View>
      }>
      <CommitmentCardHeader
        title={title}
        category={category}
        appearance={appearance}
        colors={colors}
        onPress={onDetails}
      />
      <Pressable
        accessible={false}
        onPress={onDetails}
        style={styles.descriptionTarget}>
        <DSText tone="muted">{description}</DSText>
        {goal ? (
          <View
            style={styles.goalLine}
            testID={`commitment-preview-goal-${title}`}>
            <Target
              accessible={false}
              color={colors.muted}
              size={14}
              strokeWidth={2.2}
              style={styles.goalIcon}
            />
            <DSText variant="secondary" tone="muted" style={styles.goalCopy}>
              {goal.label}
            </DSText>
            <DSText variant="secondary" tone="muted" style={styles.goalCopy}>
              {goal.label === 'Goal' ? ': ' : ' · '}
            </DSText>
            <DSText
              variant="secondary"
              tone="muted"
              style={[styles.goalCopy, styles.goalText]}>
              {goal.value}
            </DSText>
          </View>
        ) : null}
      </Pressable>
      {streaks}
    </CommitmentCardSurface>
  );
}

export function DSActivityPreview({
  name,
  avatar,
  message,
  timestamp,
  media,
  onPress,
}: {
  name: string;
  avatar?: ImageSourcePropType;
  message: string;
  timestamp: string;
  media?: ReactNode;
  onPress: () => void;
}) {
  // Row navigation includes any supplied thumbnail. No read side effects live here.
  return (
    <DSListRow
      title={message}
      titleVariant="body"
      subtitle={timestamp}
      leading={<DSAvatar name={name} source={avatar} />}
      onPress={onPress}
      action={
        media ? (
          <DSIconButton
            label={`View media: ${message}`}
            onPress={onPress}
            icon={media}
          />
        ) : undefined
      }
      accessibilityLabel={`${message}. ${timestamp}`}
    />
  );
}

const styles = StyleSheet.create({
  descriptionTarget: {gap: space.xs, minHeight: 20},
  goalLine: {
    alignItems: 'center',
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  goalCopy: {fontWeight: '600'},
  goalIcon: {marginRight: 3},
  goalText: {flexShrink: 1},
  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: space.md,
  },
  context: {
    alignItems: 'center',
    flexDirection: 'row',
    flexGrow: 1,
    flexShrink: 1,
    flexBasis: 140,
    minWidth: 140,
    gap: space.sm,
    minHeight: 44,
  },
  statusContext: {flexBasis: 100, minWidth: 100},
  completion: {flexShrink: 1},
  contextText: {flexShrink: 1},
  contextCopy: {flex: 1, gap: 4},
  avatars: {flexDirection: 'row'},
  avatarOverlap: {marginLeft: -6},
});
