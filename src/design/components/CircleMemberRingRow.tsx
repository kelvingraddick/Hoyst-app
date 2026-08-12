import React from 'react';
import {Pressable, StyleSheet, View, type ViewStyle} from 'react-native';
import {Check, UserPlus} from 'lucide-react-native';

import type {CircleMemberStatus} from '../../types/models';
import {actionMotion} from '../tokens/actions';
import {radius} from '../tokens/radius';
import {useHoystTheme} from '../theme/useHoystTheme';
import {GradientRing} from './GradientRing';
import {HoystText} from './HoystText';
import {LayeredAvatar} from './LayeredAvatar';
import {SectionEyebrow, SectionEyebrowTrailing} from './SectionEyebrow';

function getMemberStatusLabel(member: CircleMemberStatus) {
  if (member.membershipStatus === 'pending') {
    return 'Pending';
  }

  if (member.state === 'done') {
    return 'Done';
  }

  if (member.state === 'skipped') {
    return 'Skipped';
  }

  if (member.state === 'pending') {
    return 'Needed';
  }

  return 'Missed';
}

function getMemberProgressConfig(
  member: CircleMemberStatus,
  theme: ReturnType<typeof useHoystTheme>,
) {
  if (member.membershipStatus === 'pending') {
    return {
      progress: 0.34,
      ringColor: theme.accentSecondaryForeground,
      trackColor: `${theme.accentSecondary}12`,
    };
  }

  if (member.state === 'done') {
    return {
      progress: 1,
      ringColor: theme.successForeground,
      trackColor: `${theme.success}14`,
    };
  }

  if (member.state === 'skipped') {
    return {
      progress: 1,
      ringColor: theme.warningForeground,
      trackColor: `${theme.warning}14`,
    };
  }

  if (member.state === 'pending') {
    return {
      progress: 0.34,
      ringColor: theme.warningForeground,
      trackColor: `${theme.warning}12`,
    };
  }

  return {
    progress: 0.08,
    ringColor: theme.dangerForeground,
    trackColor: theme.ring,
  };
}

const RADIAL_SIZE = 266;
const CENTER_SIZE = 108;
const AVATAR_SLOT_SIZE = 78;
const AVATAR_RING_SIZE = 74;
const AVATAR_SIZE = 58;
const INVITE_VISUAL_SIZE = 64;
const INVITE_ICON_BUBBLE_SIZE = 28;
const INVITE_VISUAL_INSET = (AVATAR_SLOT_SIZE - INVITE_VISUAL_SIZE) / 2;
const RADIAL_RADIUS = 92;

type RadialLayout = 'default' | 'single-member-invite';

type MemberInviteAction = {
  accessibilityLabel: string;
  onPress: () => void;
};

function ProgressStatusBadge({member}: {member: CircleMemberStatus}) {
  const theme = useHoystTheme();

  if (member.state === 'done' && member.membershipStatus !== 'pending') {
    return (
      <View
        style={[
          styles.memberStatusBadge,
          {
            backgroundColor: theme.successForeground,
            borderColor: theme.surfaceStrong,
          },
        ]}>
        <Check color={theme.surfaceStrong} size={12} strokeWidth={3} />
      </View>
    );
  }

  const color =
    member.membershipStatus === 'pending'
      ? theme.accentSecondaryForeground
      : member.state === 'skipped'
      ? theme.warningForeground
      : member.state === 'missed'
      ? theme.dangerForeground
      : theme.warningForeground;

  return (
    <View
      style={[
        styles.memberStatusBadge,
        styles.memberStatusBadgeOpen,
        {
          backgroundColor: theme.surfaceStrong,
          borderColor: color,
        },
      ]}
    />
  );
}

function getRadialAngles(count: number, layout: RadialLayout = 'default') {
  if (count === 1) {
    return [-90];
  }

  if (layout === 'single-member-invite' && count === 2) {
    return [-90, 90];
  }

  if (count === 2) {
    return [-130, -50];
  }

  if (count === 4) {
    return [-90, 0, 90, 180];
  }

  return Array.from({length: count}, (_, index) => {
    const step = 360 / count;

    return -90 + step * index;
  });
}

function getRadialSlotStyle(
  index: number,
  count: number,
  layout: RadialLayout = 'default',
): ViewStyle {
  const angle = getRadialAngles(count, layout)[index] ?? -90;
  const radians = (angle * Math.PI) / 180;
  const center = RADIAL_SIZE / 2;
  const x = center + Math.cos(radians) * RADIAL_RADIUS - AVATAR_SLOT_SIZE / 2;
  const y = center + Math.sin(radians) * RADIAL_RADIUS - AVATAR_SLOT_SIZE / 2;

  return {
    left: x,
    top: y,
  };
}

function MemberAvatarSlot({member}: {member: CircleMemberStatus}) {
  const theme = useHoystTheme();
  const label = getMemberStatusLabel(member);
  const progress = getMemberProgressConfig(member, theme);

  return (
    <View
      accessibilityLabel={`${member.name}, ${label}`}
      accessible
      style={styles.radialAvatarFrame}>
      <GradientRing
        flatColor={progress.ringColor}
        progress={progress.progress}
        size={AVATAR_RING_SIZE}
        strokeWidth={5.5}
        trackColor={progress.trackColor}
      />
      <View style={styles.memberAvatarWrap}>
        <LayeredAvatar
          imageSource={member.avatarImage}
          imageUrl={member.avatarUrl}
          initials={member.initials}
          size={AVATAR_SIZE}
          state={member.state}
        />
      </View>
      <ProgressStatusBadge member={member} />
    </View>
  );
}

function MemberOverflowSlot({count}: {count: number}) {
  const theme = useHoystTheme();

  return (
    <View
      accessibilityLabel={`${count} more Members`}
      accessible
      style={[
        styles.overflowAvatarFrame,
        {
          backgroundColor: theme.surfaceHigh,
          borderColor: theme.borderStrong,
        },
      ]}
      testID="member-overflow-slot">
      <HoystText style={styles.overflowText}>{`+${count}`}</HoystText>
    </View>
  );
}

function MemberInviteSlot({
  inviteAction,
}: {
  inviteAction: MemberInviteAction;
}): React.JSX.Element {
  const theme = useHoystTheme();

  return (
    <Pressable
      accessibilityLabel={inviteAction.accessibilityLabel}
      accessibilityRole="button"
      hitSlop={4}
      onPress={inviteAction.onPress}
      style={({pressed}) => [
        styles.inviteAvatarPressable,
        {
          opacity: pressed ? actionMotion.pressedOpacity : 1,
          transform: [{scale: pressed ? actionMotion.pressedScale : 1}],
        },
      ]}
      testID="member-invite-slot">
      <View
        testID="member-invite-frame"
        style={[
          styles.inviteAvatarFrame,
          {
            backgroundColor: theme.surfaceHigh,
            borderColor: theme.borderStrong,
          },
        ]}>
        <View
          style={[
            styles.inviteIconBubble,
            {
              backgroundColor: theme.surfaceStrong,
              borderColor: theme.border,
            },
          ]}>
          <UserPlus
            color={theme.textSubtle}
            size={20}
            strokeWidth={2.4}
          />
        </View>
        <HoystText
          numberOfLines={1}
          style={[
            styles.inviteAvatarLabel,
            {color: theme.textSubtle},
          ]}
          testID="member-invite-label"
          variant="navLabel">
          Invite
        </HoystText>
      </View>
    </Pressable>
  );
}

// Radial Member cluster used on Circle Detail. It keeps Member status rings
// visible while making the section feel like a real group instead of a list.
export function CircleMemberRingRow({
  footerAction,
  inviteAction,
  maxVisible = 6,
  members,
  subtitle,
  title = 'Circle Members',
}: {
  footerAction?: React.ReactNode;
  inviteAction?: MemberInviteAction;
  maxVisible?: number;
  members: CircleMemberStatus[];
  subtitle: string;
  title?: string;
}): React.JSX.Element {
  const theme = useHoystTheme();
  const safeMaxVisible = Math.max(1, maxVisible);
  const inviteSlotCount = inviteAction ? 1 : 0;
  const maxMemberSlots = Math.max(1, safeMaxVisible - inviteSlotCount);
  const needsOverflow = members.length > maxMemberSlots;
  const visibleMemberCount =
    needsOverflow
      ? Math.max(1, maxMemberSlots - 1)
      : Math.min(members.length, maxMemberSlots);
  const visibleMembers = members.slice(0, visibleMemberCount);
  const overflowCount = Math.max(0, members.length - visibleMembers.length);
  const totalSlots =
    visibleMembers.length + (overflowCount > 0 ? 1 : 0) + inviteSlotCount;
  const radialLayout: RadialLayout =
    inviteAction && visibleMembers.length === 1 && overflowCount === 0
      ? 'single-member-invite'
      : 'default';
  const doneCount = members.filter(
    member => member.state === 'done' && member.membershipStatus !== 'pending',
  ).length;
  let radialSlotIndex = 0;

  return (
    <View style={styles.memberSection}>
      <View style={styles.progressSectionHeader}>
        <SectionEyebrow>{title}</SectionEyebrow>
        <SectionEyebrowTrailing>{subtitle}</SectionEyebrowTrailing>
      </View>
      {members.length > 0 || inviteAction ? (
        <View style={styles.memberCluster}>
          <View style={styles.radialStage}>
            <View
              accessibilityLabel={`${members.length} ${
                members.length === 1 ? 'Member' : 'Members'
              }, ${doneCount} done`}
              accessible
              style={[
                styles.centerSummary,
                {
                  backgroundColor: theme.surfaceStrong,
                  borderColor: theme.border,
                  shadowColor: theme.shadow,
                },
              ]}>
              <HoystText style={styles.centerCount}>{members.length}</HoystText>
              <HoystText
                numberOfLines={1}
                style={styles.centerLabel}
                tone="muted"
                variant="caption">
                {members.length === 1 ? 'Member' : 'Members'}
              </HoystText>
              <HoystText
                numberOfLines={1}
                style={styles.centerDetail}
                tone="success"
                variant="tiny">
                {doneCount} done
              </HoystText>
            </View>
            {visibleMembers.map(member => (
              <View
                key={member.id}
                testID={`member-slot-${member.id}`}
                style={[
                  styles.radialSlot,
                  getRadialSlotStyle(radialSlotIndex++, totalSlots, radialLayout),
                ]}>
                <MemberAvatarSlot member={member} />
              </View>
            ))}
            {overflowCount > 0 ? (
              <View
                style={[
                  styles.radialSlot,
                  getRadialSlotStyle(radialSlotIndex++, totalSlots, radialLayout),
                ]}>
                <MemberOverflowSlot count={overflowCount} />
              </View>
            ) : null}
            {inviteAction ? (
              <View
                testID="member-invite-radial-slot"
                style={[
                  styles.radialSlot,
                  getRadialSlotStyle(radialSlotIndex++, totalSlots, radialLayout),
                ]}>
                <MemberInviteSlot inviteAction={inviteAction} />
              </View>
            ) : null}
          </View>
          <View style={styles.memberLegend}>
            {visibleMembers.map(member => {
              const label = getMemberStatusLabel(member);
              const progress = getMemberProgressConfig(member, theme);

              return (
                <View
                  key={`${member.id}-legend`}
                  style={[
                    styles.memberLegendItem,
                    {
                      backgroundColor: theme.surfaceSoft,
                      borderColor: theme.border,
                    },
                  ]}>
                  <HoystText
                    numberOfLines={1}
                    style={styles.memberName}
                    variant="caption">
                    {member.name}
                  </HoystText>
                  <HoystText
                    numberOfLines={1}
                    style={[
                      styles.memberStatus,
                      {color: progress.ringColor},
                    ]}
                    variant="tiny">
                    {label}
                  </HoystText>
                </View>
              );
            })}
            {overflowCount > 0 ? (
              <View
                style={[
                  styles.memberLegendItem,
                  {
                    backgroundColor: theme.surfaceSoft,
                    borderColor: theme.border,
                  },
                ]}>
                <HoystText numberOfLines={1} variant="caption">
                  {`+${overflowCount} more`}
                </HoystText>
                <HoystText tone="muted" variant="tiny">
                  Overflow
                </HoystText>
              </View>
            ) : null}
          </View>
        </View>
      ) : (
        <HoystText tone="muted">
          Members will appear here once people join this Circle.
        </HoystText>
      )}
      {footerAction ? (
        <View style={styles.footerAction}>{footerAction}</View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  memberSection: {
    alignItems: 'stretch',
    gap: 14,
  },
  memberCluster: {
    alignItems: 'center',
    gap: 14,
  },
  progressSectionHeader: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 12,
    justifyContent: 'space-between',
  },
  progressSectionSubtitle: {
    flexShrink: 1,
    textAlign: 'right',
  },
  memberStatusBadge: {
    alignItems: 'center',
    borderRadius: radius.pill,
    borderWidth: 2.5,
    bottom: 2,
    height: 22,
    justifyContent: 'center',
    position: 'absolute',
    right: 3,
    width: 22,
  },
  memberStatusBadgeOpen: {
    borderWidth: 2.5,
  },
  radialStage: {
    alignItems: 'center',
    height: RADIAL_SIZE,
    justifyContent: 'center',
    position: 'relative',
    width: RADIAL_SIZE,
  },
  radialSlot: {
    height: AVATAR_SLOT_SIZE,
    position: 'absolute',
    width: AVATAR_SLOT_SIZE,
  },
  radialAvatarFrame: {
    alignItems: 'center',
    borderRadius: radius.pill,
    height: AVATAR_SLOT_SIZE,
    justifyContent: 'center',
    position: 'relative',
    width: AVATAR_SLOT_SIZE,
  },
  memberAvatarWrap: {
    alignItems: 'center',
    bottom: 0,
    justifyContent: 'center',
    left: 0,
    position: 'absolute',
    right: 0,
    top: 0,
  },
  overflowAvatarFrame: {
    alignItems: 'center',
    borderRadius: AVATAR_SLOT_SIZE / 2,
    borderWidth: 1.5,
    height: AVATAR_SLOT_SIZE,
    justifyContent: 'center',
    width: AVATAR_SLOT_SIZE,
  },
  overflowText: {
    fontSize: 18,
    fontWeight: '800',
    letterSpacing: 0,
    lineHeight: 22,
  },
  inviteAvatarFrame: {
    alignItems: 'center',
    borderRadius: INVITE_VISUAL_SIZE / 2,
    borderStyle: 'dashed',
    borderWidth: 1.8,
    gap: 3,
    height: INVITE_VISUAL_SIZE,
    justifyContent: 'center',
    left: INVITE_VISUAL_INSET,
    position: 'absolute',
    top: INVITE_VISUAL_INSET,
    width: INVITE_VISUAL_SIZE,
  },
  inviteIconBubble: {
    alignItems: 'center',
    borderRadius: INVITE_ICON_BUBBLE_SIZE / 2,
    borderWidth: 1,
    height: INVITE_ICON_BUBBLE_SIZE,
    justifyContent: 'center',
    width: INVITE_ICON_BUBBLE_SIZE,
  },
  inviteAvatarPressable: {
    borderRadius: AVATAR_SLOT_SIZE / 2,
    height: AVATAR_SLOT_SIZE,
    position: 'relative',
    width: AVATAR_SLOT_SIZE,
  },
  inviteAvatarLabel: {
    fontSize: 9.5,
    fontWeight: '700',
    letterSpacing: 0,
    lineHeight: 12,
    textTransform: 'none',
  },
  centerSummary: {
    alignItems: 'center',
    borderRadius: CENTER_SIZE / 2,
    borderWidth: 1,
    elevation: 4,
    height: CENTER_SIZE,
    justifyContent: 'center',
    shadowOffset: {height: 10, width: 0},
    shadowOpacity: 0.1,
    shadowRadius: 18,
    width: CENTER_SIZE,
  },
  centerCount: {
    fontSize: 30,
    fontWeight: '900',
    letterSpacing: 0,
    lineHeight: 34,
  },
  centerDetail: {
    marginTop: 4,
  },
  centerLabel: {
    fontSize: 12,
    lineHeight: 16,
  },
  memberLegend: {
    alignSelf: 'stretch',
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    justifyContent: 'center',
  },
  memberLegendItem: {
    alignItems: 'center',
    borderRadius: radius.md,
    borderWidth: 1,
    gap: 2,
    minWidth: 98,
    paddingHorizontal: 10,
    paddingVertical: 7,
  },
  memberName: {
    maxWidth: 108,
    textAlign: 'center',
  },
  memberStatus: {
    fontWeight: '800',
  },
  footerAction: {
    marginTop: 2,
  },
});
