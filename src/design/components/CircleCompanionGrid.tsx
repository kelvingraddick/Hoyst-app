import React from 'react';
import {
  Pressable,
  ScrollView,
  StyleSheet,
  View,
  useWindowDimensions,
} from 'react-native';
import {ArrowUp, Check, UserPlus} from 'lucide-react-native';

import type {CircleMemberStatus} from '../../types/models';
import {actionMotion} from '../tokens/actions';
import {brandColors} from '../tokens/colors';
import {radius} from '../tokens/radius';
import {useHoystTheme} from '../theme/useHoystTheme';
import {GlassPanel} from './GlassPanel';
import {GradientRing} from './GradientRing';
import {HoystText} from './HoystText';
import {LayeredAvatar} from './LayeredAvatar';
import {NudgeActionButton} from './NudgeActionButton';
import {SectionEyebrow, SectionEyebrowTrailing} from './SectionEyebrow';
import type {PulseRingState} from './pulse-ring-state';

type CompanionInviteAction = {
  accessibilityLabel: string;
  onPress: () => void;
};

type CompanionSlot =
  | {kind: 'member'; member: CircleMemberStatus}
  | {kind: 'invite'; inviteAction: CompanionInviteAction};

type CircleCompanionGridProps = {
  canTapInViewer?: boolean;
  footerAction?: React.ReactNode;
  inviteAction?: CompanionInviteAction;
  members: CircleMemberStatus[];
  nudgedMemberIds?: ReadonlySet<string>;
  nudgingMemberIds?: ReadonlySet<string>;
  onNudgeMember?: (member: CircleMemberStatus) => void;
  onTapInViewer?: () => void;
  subtitle: string;
  tapInRingState?: PulseRingState;
  title?: string;
  viewerUid?: string;
};

const GRID_GAP = 12;
const PAGE_SIDE_INSET = 40;
const OVERFLOW_PEEK = 34;
const AVATAR_RING_SIZE = 64;
const AVATAR_RING_STROKE_WIDTH = 4.5;
const AVATAR_SIZE = 56;
const NEEDED_RING_COLOR = '#F5A623';
const NEEDED_LABEL_COLOR = '#C2410C';

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

function buildCompanionSlots(
  members: CircleMemberStatus[],
  inviteAction?: CompanionInviteAction,
): CompanionSlot[] {
  if (!inviteAction) {
    return members.map(member => ({kind: 'member', member}));
  }

  const inviteSlot: CompanionSlot = {kind: 'invite', inviteAction};

  if (members.length >= 4) {
    return [
      ...members.slice(0, 3).map(member => ({kind: 'member' as const, member})),
      inviteSlot,
      ...members.slice(3).map(member => ({kind: 'member' as const, member})),
    ];
  }

  return [
    ...members.map(member => ({kind: 'member' as const, member})),
    inviteSlot,
  ];
}

function chunkSlots(slots: CompanionSlot[]) {
  const pages: CompanionSlot[][] = [];

  for (let index = 0; index < slots.length; index += 4) {
    pages.push(slots.slice(index, index + 4));
  }

  return pages;
}

function StatusBadge({member}: {member: CircleMemberStatus}) {
  const theme = useHoystTheme();

  if (member.state === 'done' && member.membershipStatus !== 'pending') {
    return (
      <View
        style={[
          styles.statusBadge,
          {
            backgroundColor: theme.successForeground,
            borderColor: theme.surfaceStrong,
          },
        ]}>
        <Check color={theme.surfaceStrong} size={12} strokeWidth={3} />
      </View>
    );
  }

  const progress = getMemberProgressConfig(member, theme);

  return (
    <View
      style={[
        styles.statusBadge,
        {
          backgroundColor: progress.ringColor,
          borderColor: theme.surfaceStrong,
        },
      ]}>
      {member.state === 'pending' && member.membershipStatus !== 'pending' ? (
        <ArrowUp color="#FFFFFF" size={13} strokeWidth={3.2} />
      ) : (
        <View style={styles.statusBadgeDot} />
      )}
    </View>
  );
}

function CompanionAvatar({member}: {member: CircleMemberStatus}) {
  const theme = useHoystTheme();
  const progress = getMemberProgressConfig(member, theme);

  return (
    <View style={styles.avatarFrame}>
      <GradientRing
        flatColor={progress.ringColor}
        progress={progress.progress}
        size={AVATAR_RING_SIZE}
        strokeWidth={AVATAR_RING_STROKE_WIDTH}
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

function MemberTapInButton({
  onPress,
}: {
  onPress: () => void;
}): React.JSX.Element {
  const theme = useHoystTheme();

  return (
    <Pressable
      accessibilityLabel="Tap In"
      accessibilityRole="button"
      onPress={onPress}
      style={({pressed}) => [
        styles.memberTapInPressable,
        {
          opacity: pressed ? actionMotion.pressedOpacity : 1,
          shadowColor: theme.accentSecondaryForeground,
          transform: [{scale: pressed ? actionMotion.pressedScale : 1}],
        },
      ]}>
      <View
        style={[
          styles.memberTapInFill,
          {backgroundColor: brandColors.purpleBright},
        ]}>
        <HoystText
          numberOfLines={1}
          style={styles.memberTapInLabel}
          variant="button">
          Tap In
        </HoystText>
      </View>
    </Pressable>
  );
}

function CompanionMemberCard({
  canTapInViewer,
  cardWidth,
  member,
  nudgedMemberIds,
  nudgingMemberIds,
  onNudgeMember,
  onTapInViewer,
  viewerUid,
}: {
  canTapInViewer: boolean;
  cardWidth: number;
  member: CircleMemberStatus;
  nudgedMemberIds: ReadonlySet<string>;
  nudgingMemberIds: ReadonlySet<string>;
  onNudgeMember?: (member: CircleMemberStatus) => void;
  onTapInViewer?: () => void;
  viewerUid?: string;
}) {
  const theme = useHoystTheme();
  const progress = getMemberProgressConfig(member, theme);
  const statusLabel = getMemberStatusLabel(member);
  const isViewer = Boolean(viewerUid && member.id === viewerUid);
  const displayName = isViewer ? `${member.name} · You` : member.name;
  const canNudge =
    !isViewer &&
    member.membershipStatus !== 'pending' &&
    member.state === 'pending' &&
    Boolean(onNudgeMember);
  const showViewerTapIn = isViewer && canTapInViewer && Boolean(onTapInViewer);
  const isNudging = nudgingMemberIds.has(member.id);
  const isNudged = nudgedMemberIds.has(member.id);

  return (
    <GlassPanel
      padding="none"
      style={[styles.card, {height: cardWidth, width: cardWidth}]}
      variant="card">
      <View
        accessible
        accessibilityLabel={`${displayName}, ${statusLabel}`}
        style={styles.memberCardInner}
        testID={`circle-companion-card-${member.id}`}>
        <CompanionAvatar member={member} />
        <View style={styles.memberCopy}>
          <HoystText
            adjustsFontSizeToFit
            minimumFontScale={0.82}
            numberOfLines={1}
            style={styles.memberName}>
            {displayName}
          </HoystText>
          <HoystText
            numberOfLines={1}
            style={[
              styles.memberStatus,
              {color: progress.labelColor ?? progress.ringColor},
            ]}>
            {statusLabel}
          </HoystText>
        </View>
        {showViewerTapIn && onTapInViewer ? (
          <MemberTapInButton onPress={onTapInViewer} />
        ) : canNudge ? (
          <NudgeActionButton
            isLoading={isNudging}
            isSent={isNudged}
            label={isNudged ? 'Nudged' : 'Nudge'}
            onPress={() => onNudgeMember?.(member)}
            size="mini"
            style={styles.memberAction}
            targetCount={1}
          />
        ) : (
          <View style={styles.memberActionSpacer} />
        )}
      </View>
    </GlassPanel>
  );
}

function InviteCard({
  cardWidth,
  inviteAction,
}: {
  cardWidth: number;
  inviteAction: CompanionInviteAction;
}) {
  const theme = useHoystTheme();

  return (
    <Pressable
      accessibilityLabel={inviteAction.accessibilityLabel}
      accessibilityRole="button"
      onPress={inviteAction.onPress}
      style={({pressed}) => [
        styles.invitePressable,
        {
          opacity: pressed ? actionMotion.pressedOpacity : 1,
          transform: [{scale: pressed ? actionMotion.pressedScale : 1}],
          height: cardWidth,
          width: cardWidth,
        },
      ]}>
      <GlassPanel
        padding="none"
        style={[
          styles.inviteCard,
          {
            borderColor: theme.isDark
              ? 'rgba(255,255,255,0.22)'
              : 'rgba(142,147,176,0.34)',
            height: cardWidth,
            width: cardWidth,
          },
        ]}>
        <View
          style={styles.inviteCardInner}
          testID="circle-companion-invite-card">
          <View
            style={[
              styles.inviteIconRing,
              {
                borderColor: theme.isDark
                  ? 'rgba(255,255,255,0.20)'
                  : 'rgba(142,147,176,0.24)',
              },
            ]}>
            <View
              style={[
                styles.inviteIconBubble,
                {
                  backgroundColor: theme.isDark
                    ? 'rgba(255,255,255,0.08)'
                    : 'rgba(142,147,176,0.10)',
                },
              ]}>
              <UserPlus color={theme.textSubtle} size={24} strokeWidth={2.4} />
            </View>
          </View>
          <View style={styles.memberCopy}>
            <HoystText
              numberOfLines={1}
              style={styles.memberName}
              variant="bodyStrong">
              Invite
            </HoystText>
            <HoystText
              numberOfLines={1}
              style={[styles.inviteSubtitle, {color: theme.textMuted}]}>
              Grow your crew
            </HoystText>
          </View>
          <View
            style={[
              styles.inviteButton,
              {
                backgroundColor: theme.isDark
                  ? 'rgba(255,255,255,0.08)'
                  : 'rgba(142,147,176,0.12)',
              },
            ]}>
            <HoystText
              numberOfLines={1}
              style={[styles.inviteButtonLabel, {color: theme.textSubtle}]}>
              Add
            </HoystText>
          </View>
        </View>
      </GlassPanel>
    </Pressable>
  );
}

function SlotCard({
  canTapInViewer,
  cardWidth,
  nudgedMemberIds,
  nudgingMemberIds,
  onNudgeMember,
  onTapInViewer,
  slot,
  viewerUid,
}: {
  canTapInViewer: boolean;
  cardWidth: number;
  nudgedMemberIds: ReadonlySet<string>;
  nudgingMemberIds: ReadonlySet<string>;
  onNudgeMember?: (member: CircleMemberStatus) => void;
  onTapInViewer?: () => void;
  slot: CompanionSlot;
  viewerUid?: string;
}) {
  if (slot.kind === 'invite') {
    return (
      <InviteCard cardWidth={cardWidth} inviteAction={slot.inviteAction} />
    );
  }

  return (
    <CompanionMemberCard
      canTapInViewer={canTapInViewer}
      cardWidth={cardWidth}
      member={slot.member}
      nudgedMemberIds={nudgedMemberIds}
      nudgingMemberIds={nudgingMemberIds}
      onNudgeMember={onNudgeMember}
      onTapInViewer={onTapInViewer}
      viewerUid={viewerUid}
    />
  );
}

export function CircleCompanionGrid({
  canTapInViewer = false,
  footerAction,
  inviteAction,
  members,
  nudgedMemberIds = new Set(),
  nudgingMemberIds = new Set(),
  onNudgeMember,
  onTapInViewer,
  subtitle,
  title = 'Circle Companions',
  viewerUid,
}: CircleCompanionGridProps): React.JSX.Element {
  const {width} = useWindowDimensions();
  const slots = React.useMemo(
    () => buildCompanionSlots(members, inviteAction),
    [inviteAction, members],
  );
  const pages = React.useMemo(() => chunkSlots(slots), [slots]);
  const hasOverflow = slots.length > 4;
  const pageWidth = Math.max(
    294,
    width - PAGE_SIDE_INSET - (hasOverflow ? OVERFLOW_PEEK : 0),
  );
  const cardWidth = (pageWidth - GRID_GAP) / 2;

  return (
    <View style={styles.section}>
      <View style={styles.header}>
        <SectionEyebrow>{title}</SectionEyebrow>
        <SectionEyebrowTrailing>{subtitle}</SectionEyebrowTrailing>
      </View>
      {slots.length > 0 ? (
        hasOverflow ? (
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            style={styles.scroller}
            testID="circle-companion-grid-scroll"
            contentContainerStyle={styles.scrollerContent}>
            {pages.map((page, pageIndex) => (
              <View
                key={`page-${pageIndex}`}
                style={[styles.page, {width: pageWidth}]}
                testID={`circle-companion-grid-page-${pageIndex}`}>
                {page.map(slot => (
                  <SlotCard
                    canTapInViewer={canTapInViewer}
                    cardWidth={cardWidth}
                    key={
                      slot.kind === 'invite'
                        ? 'invite'
                        : `member-${slot.member.id}`
                    }
                    nudgedMemberIds={nudgedMemberIds}
                    nudgingMemberIds={nudgingMemberIds}
                    onNudgeMember={onNudgeMember}
                    onTapInViewer={onTapInViewer}
                    slot={slot}
                    viewerUid={viewerUid}
                  />
                ))}
              </View>
            ))}
          </ScrollView>
        ) : (
          <View
            style={[styles.page, styles.staticPage, {width: pageWidth}]}
            testID="circle-companion-grid-page-0">
            {slots.map(slot => (
              <SlotCard
                canTapInViewer={canTapInViewer}
                cardWidth={cardWidth}
                key={
                  slot.kind === 'invite' ? 'invite' : `member-${slot.member.id}`
                }
                nudgedMemberIds={nudgedMemberIds}
                nudgingMemberIds={nudgingMemberIds}
                onNudgeMember={onNudgeMember}
                onTapInViewer={onTapInViewer}
                slot={slot}
                viewerUid={viewerUid}
              />
            ))}
          </View>
        )
      ) : (
        <HoystText tone="muted">
          Companions will appear here once people join this Circle.
        </HoystText>
      )}
      {footerAction ? (
        <View style={styles.footerAction}>{footerAction}</View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  avatarFrame: {
    alignItems: 'center',
    height: 68,
    justifyContent: 'center',
    position: 'relative',
    width: 68,
  },
  avatarWrap: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
  },
  card: {
    minHeight: 148,
  },
  footerAction: {
    marginTop: 2,
  },
  header: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 12,
    justifyContent: 'space-between',
  },
  inviteButton: {
    alignItems: 'center',
    borderRadius: radius.pill,
    height: 32,
    justifyContent: 'center',
    minWidth: 86,
    paddingHorizontal: 14,
  },
  inviteButtonLabel: {
    fontSize: 14,
    fontWeight: '800',
    letterSpacing: 0,
    lineHeight: 18,
  },
  inviteCard: {
    borderRadius: radius.lg,
    borderStyle: 'dashed',
    borderWidth: 1.8,
    minHeight: 148,
  },
  inviteCardInner: {
    alignItems: 'center',
    gap: 7,
    height: '100%',
    justifyContent: 'center',
    minHeight: 148,
    paddingHorizontal: 12,
    paddingVertical: 14,
  },
  inviteIconBubble: {
    alignItems: 'center',
    borderRadius: radius.pill,
    height: 42,
    justifyContent: 'center',
    width: 42,
  },
  inviteIconRing: {
    alignItems: 'center',
    borderRadius: radius.pill,
    borderStyle: 'dashed',
    borderWidth: 1.8,
    height: 62,
    justifyContent: 'center',
    width: 62,
  },
  invitePressable: {
    borderRadius: radius.lg,
  },
  inviteSubtitle: {
    fontSize: 11,
    fontWeight: '600',
    letterSpacing: 0,
    lineHeight: 15,
    textAlign: 'center',
  },
  memberAction: {
    alignSelf: 'center',
    maxWidth: 140,
    minWidth: 96,
  },
  memberActionSpacer: {
    height: 0,
  },
  memberCardInner: {
    alignItems: 'center',
    gap: 7,
    height: '100%',
    justifyContent: 'center',
    minHeight: 148,
    paddingHorizontal: 10,
    paddingVertical: 12,
  },
  memberCopy: {
    alignItems: 'center',
    gap: 2,
    minWidth: 0,
    width: '100%',
  },
  memberName: {
    fontSize: 16,
    fontWeight: '800',
    letterSpacing: 0,
    lineHeight: 20,
    maxWidth: '100%',
    textAlign: 'center',
  },
  memberStatus: {
    fontSize: 10.5,
    fontWeight: '900',
    letterSpacing: 1.2,
    lineHeight: 14,
    textAlign: 'center',
    textTransform: 'uppercase',
  },
  memberTapInFill: {
    alignItems: 'center',
    borderRadius: radius.pill,
    height: 34,
    justifyContent: 'center',
    minWidth: 96,
    paddingHorizontal: 14,
  },
  memberTapInLabel: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '800',
    letterSpacing: 0,
    lineHeight: 18,
    textAlign: 'center',
  },
  memberTapInPressable: {
    alignSelf: 'center',
    borderRadius: radius.pill,
    elevation: 5,
    flexShrink: 0,
    shadowOffset: {height: 8, width: 0},
    shadowOpacity: 0.22,
    shadowRadius: 12,
  },
  page: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: GRID_GAP,
  },
  scroller: {
    marginHorizontal: -20,
  },
  scrollerContent: {
    gap: GRID_GAP,
    paddingHorizontal: 20,
  },
  section: {
    alignItems: 'stretch',
    gap: 14,
  },
  staticPage: {
    alignSelf: 'stretch',
  },
  statusBadge: {
    alignItems: 'center',
    borderRadius: radius.pill,
    borderWidth: 2.5,
    bottom: 3,
    height: 21,
    justifyContent: 'center',
    position: 'absolute',
    right: 5,
    width: 21,
  },
  statusBadgeDot: {
    backgroundColor: '#FFFFFF',
    borderRadius: 3,
    height: 6,
    width: 6,
  },
});
