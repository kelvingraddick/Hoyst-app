import React from 'react';
import {Pressable, ScrollView, StyleSheet, View} from 'react-native';
import {ArrowUp, Check, UserPlus} from 'lucide-react-native';

import type {CircleMemberStatus} from '../../../types/models';
import {actionMotion, touchTarget} from '../../../design/tokens/actions';
import {radius} from '../../../design/tokens/radius';
import {useHoystTheme} from '../../../design/theme/useHoystTheme';
import {GradientRing} from '../../../design/components/GradientRing';
import {HoystText} from '../../../design/components/HoystText';
import {LayeredAvatar} from '../../../design/components/LayeredAvatar';
import {
  SectionEyebrow,
  SectionEyebrowTrailing,
} from '../../../design/components/SectionEyebrow';

type MemberInviteAction = {
  accessibilityLabel: string;
  onPress: () => void;
};

export type CircleMemberStripAction = {
  accessibilityLabel: string;
  disabled?: boolean;
  isLoading?: boolean;
  label: string;
  onPress: () => void;
  tone: 'nudge' | 'primary' | 'review';
};

type CircleMemberStripProps = {
  action?: CircleMemberStripAction;
  inviteAction?: MemberInviteAction;
  members: CircleMemberStatus[];
  onSelectMember: (member: CircleMemberStatus) => void;
  selectedMemberId?: string;
  subtitle: string;
  title?: string;
  viewerUid?: string;
};

const AVATAR_SIZE = 54;
const RING_SIZE = 62;
const RING_STROKE_WIDTH = 4;
const NEEDED_RING_COLOR = '#F5A623';
const NEEDED_LABEL_COLOR = '#C2410C';

function getMemberStatusLabel(member: CircleMemberStatus) {
  if (member.membershipStatus === 'pending') {
    return 'Pending approval';
  }

  if (member.state === 'done') {
    return 'Tapped in';
  }

  if (member.state === 'skipped') {
    return 'Skipped';
  }

  if (member.state === 'pending') {
    return 'Needs Tap In';
  }

  return 'Missed';
}

function getMemberProgressConfig(
  member: CircleMemberStatus,
  theme: ReturnType<typeof useHoystTheme>,
) {
  if (member.membershipStatus === 'pending') {
    return {
      labelColor: theme.accentSecondaryForeground,
      progress: 0.34,
      ringColor: theme.accentSecondaryForeground,
      trackColor: `${theme.accentSecondary}12`,
    };
  }

  if (member.state === 'done') {
    return {
      labelColor: theme.successForeground,
      progress: 1,
      ringColor: theme.successForeground,
      trackColor: `${theme.success}14`,
    };
  }

  if (member.state === 'skipped') {
    return {
      labelColor: theme.warningForeground,
      progress: 1,
      ringColor: theme.warningForeground,
      trackColor: `${theme.warning}14`,
    };
  }

  if (member.state === 'pending') {
    return {
      labelColor: NEEDED_LABEL_COLOR,
      progress: 0.34,
      ringColor: NEEDED_RING_COLOR,
      trackColor: 'rgba(245,166,35,0.16)',
    };
  }

  return {
    labelColor: theme.dangerForeground,
    progress: 0.08,
    ringColor: theme.dangerForeground,
    trackColor: theme.ring,
  };
}

function StatusBadge({member}: {member: CircleMemberStatus}) {
  const theme = useHoystTheme();
  const progress = getMemberProgressConfig(member, theme);

  return (
    <View
      style={[
        styles.statusBadge,
        {
          backgroundColor: progress.ringColor,
          borderColor: theme.background,
        },
      ]}>
      {member.state === 'done' && member.membershipStatus !== 'pending' ? (
        <Check color="#FFFFFF" size={11} strokeWidth={3.1} />
      ) : member.state === 'pending' &&
        member.membershipStatus !== 'pending' ? (
        <ArrowUp color="#FFFFFF" size={12} strokeWidth={3} />
      ) : (
        <View style={styles.statusBadgeDot} />
      )}
    </View>
  );
}

function MemberAvatar({member}: {member: CircleMemberStatus}) {
  const theme = useHoystTheme();
  const progress = getMemberProgressConfig(member, theme);

  return (
    <View style={styles.avatarFrame}>
      <GradientRing
        flatColor={progress.ringColor}
        progress={progress.progress}
        size={RING_SIZE}
        strokeWidth={RING_STROKE_WIDTH}
        trackColor={progress.trackColor}
      />
      <View pointerEvents="none" style={styles.avatarWrap}>
        <LayeredAvatar
          chrome="minimal"
          imageSource={member.avatarImage}
          imageUrl={member.avatarUrl}
          initials={member.initials}
          size={AVATAR_SIZE}
          state={member.state}
        />
      </View>
      <StatusBadge member={member} />
    </View>
  );
}

function MemberStripItem({
  isSelected,
  member,
  onPress,
  viewerUid,
}: {
  isSelected: boolean;
  member: CircleMemberStatus;
  onPress: () => void;
  viewerUid?: string;
}) {
  const theme = useHoystTheme();
  const statusLabel = getMemberStatusLabel(member);
  const isViewer = Boolean(viewerUid && member.id === viewerUid);
  const displayName = isViewer ? `${member.name} · You` : member.name;
  const selectedSurfaceStyle = isSelected
    ? {
        backgroundColor: theme.isDark
          ? 'rgba(255,255,255,0.08)'
          : 'rgba(16,24,40,0.055)',
      }
    : undefined;

  return (
    <Pressable
      accessibilityLabel={`${displayName}, ${statusLabel}`}
      accessibilityRole="button"
      accessibilityState={{selected: isSelected}}
      onPress={onPress}
      style={({pressed}) => [
        styles.memberPressable,
        {
          opacity: pressed ? actionMotion.pressedOpacity : 1,
          transform: [{scale: pressed ? actionMotion.pressedScale : 1}],
        },
      ]}
      testID={`circle-member-strip-member-${member.id}`}>
      <View style={[styles.memberItem, selectedSurfaceStyle]}>
        <MemberAvatar member={member} />
        <HoystText numberOfLines={1} style={styles.memberName}>
          {isViewer ? 'You' : member.name}
        </HoystText>
      </View>
    </Pressable>
  );
}

function InviteStripItem({inviteAction}: {inviteAction: MemberInviteAction}) {
  const theme = useHoystTheme();
  const inviteSurfaceStyle = {
    backgroundColor: theme.isDark
      ? 'rgba(255,255,255,0.07)'
      : 'rgba(16,24,40,0.055)',
    borderColor: theme.borderStrong,
  };

  return (
    <Pressable
      accessibilityLabel={inviteAction.accessibilityLabel}
      accessibilityRole="button"
      onPress={inviteAction.onPress}
      style={({pressed}) => [
        styles.memberPressable,
        {
          opacity: pressed ? actionMotion.pressedOpacity : 1,
          transform: [{scale: pressed ? actionMotion.pressedScale : 1}],
        },
      ]}
      testID="circle-member-strip-invite">
      <View style={styles.memberItem}>
        <View style={[styles.inviteAvatar, inviteSurfaceStyle]}>
          <UserPlus color={theme.textMuted} size={22} strokeWidth={2.3} />
        </View>
        <HoystText numberOfLines={1} style={styles.memberName}>
          Invite
        </HoystText>
      </View>
    </Pressable>
  );
}

function SelectedMemberAction({
  action,
  member,
  viewerUid,
}: {
  action?: CircleMemberStripAction;
  member: CircleMemberStatus;
  viewerUid?: string;
}) {
  const theme = useHoystTheme();
  const statusLabel = getMemberStatusLabel(member);
  const isViewer = Boolean(viewerUid && member.id === viewerUid);
  const accentColor =
    action?.tone === 'nudge'
      ? theme.accentSecondaryForeground
      : action?.tone === 'review'
      ? theme.accentSecondaryForeground
      : theme.actionForeground;
  const actionBackground =
    action?.tone === 'primary'
      ? theme.isDark
        ? '#15171D'
        : '#15171D'
      : theme.isDark
      ? 'rgba(122,85,255,0.20)'
      : 'rgba(122,85,255,0.12)';

  return (
    <View
      style={[
        styles.selectedAction,
        {backgroundColor: theme.surfaceSoft, borderColor: theme.border},
      ]}
      testID="circle-member-strip-selected-action">
      <View style={styles.selectedCopy}>
        <HoystText numberOfLines={1} style={styles.selectedName}>
          {isViewer ? `${member.name} · You` : member.name}
        </HoystText>
        <HoystText numberOfLines={1} style={styles.selectedStatus} tone="muted">
          {statusLabel}
        </HoystText>
      </View>
      {action ? (
        <Pressable
          accessibilityLabel={action.accessibilityLabel}
          accessibilityRole="button"
          accessibilityState={{
            busy: action.isLoading,
            disabled: action.disabled,
          }}
          disabled={action.disabled}
          onPress={action.disabled ? undefined : action.onPress}
          style={({pressed}) => [
            styles.selectedActionButton,
            {
              backgroundColor: actionBackground,
              opacity: action.disabled
                ? 0.56
                : pressed
                ? actionMotion.pressedOpacity
                : 1,
              transform: [
                {
                  scale:
                    pressed && !action.disabled ? actionMotion.pressedScale : 1,
                },
              ],
            },
          ]}>
          <HoystText
            numberOfLines={1}
            style={[styles.selectedActionLabel, {color: accentColor}]}
            variant="caption">
            {action.label}
          </HoystText>
        </Pressable>
      ) : null}
    </View>
  );
}

export function CircleMemberStrip({
  action,
  inviteAction,
  members,
  onSelectMember,
  selectedMemberId,
  subtitle,
  title = 'Circle Members',
  viewerUid,
}: CircleMemberStripProps): React.JSX.Element {
  const selectedMember = members.find(member => member.id === selectedMemberId);

  return (
    <View style={styles.section}>
      <View style={styles.header}>
        <SectionEyebrow>{title}</SectionEyebrow>
        <SectionEyebrowTrailing>{subtitle}</SectionEyebrowTrailing>
      </View>
      {members.length > 0 ? (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.scrollerContent}
          style={styles.scroller}
          testID="circle-member-strip">
          {members.map(member => (
            <MemberStripItem
              isSelected={member.id === selectedMemberId}
              key={member.id}
              member={member}
              onPress={() => onSelectMember(member)}
              viewerUid={viewerUid}
            />
          ))}
          {inviteAction ? (
            <InviteStripItem inviteAction={inviteAction} />
          ) : null}
        </ScrollView>
      ) : (
        <HoystText tone="muted">
          Members will appear here once people join this Circle.
        </HoystText>
      )}
      {selectedMember ? (
        <SelectedMemberAction
          action={action}
          member={selectedMember}
          viewerUid={viewerUid}
        />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  avatarFrame: {
    alignItems: 'center',
    height: RING_SIZE + 4,
    justifyContent: 'center',
    position: 'relative',
    width: RING_SIZE + 4,
  },
  avatarWrap: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
  },
  header: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 12,
    justifyContent: 'space-between',
  },
  inviteAvatar: {
    alignItems: 'center',
    borderRadius: (RING_SIZE + 4) / 2,
    borderStyle: 'dashed',
    borderWidth: 1.5,
    height: RING_SIZE + 4,
    justifyContent: 'center',
    width: RING_SIZE + 4,
  },
  memberItem: {
    alignItems: 'center',
    borderRadius: radius.md,
    gap: 4,
    paddingHorizontal: 4,
    paddingVertical: 5,
    width: 76,
  },
  memberName: {
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 0,
    lineHeight: 15,
    maxWidth: 70,
    textAlign: 'center',
  },
  memberPressable: {
    borderRadius: radius.md,
  },
  scroller: {
    marginHorizontal: -4,
  },
  scrollerContent: {
    gap: 4,
    paddingHorizontal: 4,
  },
  section: {
    gap: 10,
  },
  selectedAction: {
    alignItems: 'center',
    borderRadius: radius.lg,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 12,
    minHeight: touchTarget.minimum + 8,
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  selectedActionButton: {
    alignItems: 'center',
    borderRadius: radius.pill,
    justifyContent: 'center',
    minHeight: 34,
    paddingHorizontal: 14,
  },
  selectedActionLabel: {
    fontSize: 13,
    fontWeight: '800',
    lineHeight: 17,
  },
  selectedCopy: {
    flex: 1,
    gap: 1,
    minWidth: 0,
  },
  selectedName: {
    fontSize: 14,
    fontWeight: '800',
    lineHeight: 18,
  },
  selectedStatus: {
    fontSize: 12,
    fontWeight: '600',
    lineHeight: 15,
  },
  statusBadge: {
    alignItems: 'center',
    borderRadius: 10,
    borderWidth: 2,
    bottom: 1,
    height: 20,
    justifyContent: 'center',
    position: 'absolute',
    right: 0,
    width: 20,
  },
  statusBadgeDot: {
    backgroundColor: '#FFFFFF',
    borderRadius: 3,
    height: 6,
    width: 6,
  },
});
