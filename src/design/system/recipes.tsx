import React, {type ReactNode} from 'react';
import {
  Pressable,
  StyleSheet,
  View,
  type ImageSourcePropType,
} from 'react-native';
import {ArrowUpRight, Target} from 'lucide-react-native';
import {
  CircleCategoryIcon,
  getCircleCategoryVisual,
} from '../components/CircleCategoryIcon';
import {
  DSAvatar,
  DSButton,
  DSIconButton,
  DSListRow,
  DSStatus,
  DSSurface,
  DSText,
} from './primitives';
import {layout, space} from './tokens';
import {useSystemTheme} from './theme';

/** Presentation only. Existing screen controllers own eligibility, requests and focus. */
export type CommitmentPreviewProps = {
  title: string;
  category: string;
  description: string;
  goal?: {
    label: string;
    value: string;
  };
  context: string;
  expanded: boolean;
  onExpand: () => void;
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
  description,
  goal,
  context,
  expanded,
  onExpand,
  onDetails,
  status,
  members,
  action,
}: CommitmentPreviewProps) {
  const theme = useSystemTheme();
  const visual = getCircleCategoryVisual(category);
  const icon = (
    <CircleCategoryIcon category={category} size={layout.iconBackplate} />
  );
  const button = action ? (
    <DSButton
      label={action.label}
      onPress={action.onPress}
      busy={action.busy}
      disabled={action.disabled}
      compact
      category={visual.tone}
      variant={action.variant ?? (expanded ? 'primary' : 'outline')}
      accessibilityLabel={`${action.label} for ${title}`}
    />
  ) : null;
  if (!expanded) {
    return (
      <DSListRow
        title={title}
        subtitle={status}
        leading={icon}
        action={button}
        onPress={onExpand}
        accessibilityLabel={`Expand ${title}. ${status}`}
        testID={`preview-expand-${title}`}
      />
    );
  }
  return (
    <DSSurface category={visual.tone} raised style={styles.focused}>
      <View style={styles.header}>
        <Pressable
          onPress={onDetails}
          accessibilityRole="button"
          accessibilityLabel={`View details for ${title}`}
          style={styles.headerTarget}>
          <CircleCategoryIcon
            category={category}
            showBackplate={false}
            size={layout.iconBackplate}
          />
          <View style={styles.heading}>
            <DSText variant="title">{title}</DSText>
            <DSText
              variant="category"
              style={{color: theme.category[visual.tone].foreground}}>
              {visual.label.toUpperCase()}
            </DSText>
          </View>
        </Pressable>
      </View>
      <DSIconButton
        label={`View details for ${title}`}
        onPress={onDetails}
        style={styles.detailButton}
        icon={<ArrowUpRight color={theme.muted} size={layout.controlIcon} />}
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
              color={theme.muted}
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
      <View style={styles.footer}>
        <Pressable
          accessible={false}
          onPress={onDetails}
          style={styles.context}>
          {members?.length ? (
            <View style={styles.avatars}>
              {members.slice(0, 3).map((member, index) => (
                <View
                  key={member.id}
                  style={index ? styles.avatarOverlap : undefined}>
                  <DSAvatar name={member.name} source={member.source} />
                </View>
              ))}
            </View>
          ) : null}
          <DSText variant="secondary" tone="muted" style={styles.contextText}>
            {context}
          </DSText>
        </Pressable>
        {button}
        {!action ? <DSStatus label={status} /> : null}
      </View>
    </DSSurface>
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
  focused: {
    borderRadius: 18,
    gap: space.sm,
    paddingHorizontal: 18,
    paddingVertical: 12,
    position: 'relative',
  },
  header: {minHeight: layout.controlHeight},
  headerTarget: {
    flex: 1,
    minHeight: layout.controlHeight,
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md,
    paddingRight: layout.controlHeight,
  },
  detailButton: {position: 'absolute', right: 6, top: 0},
  heading: {flex: 1, gap: space.xs},
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
    gap: space.sm,
    minHeight: 44,
  },
  contextText: {flexShrink: 1},
  avatars: {flexDirection: 'row'},
  avatarOverlap: {marginLeft: -6},
});
