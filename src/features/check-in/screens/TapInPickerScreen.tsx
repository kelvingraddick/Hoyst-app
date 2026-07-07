import React, {useEffect, useState} from 'react';
import {
  Alert,
  Image,
  Pressable,
  Share,
  StyleSheet,
  View,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import LinearGradient from 'react-native-linear-gradient';
import {DateTime} from 'luxon';
import {
  ArrowRight,
  Check,
  Clock3,
  Globe2,
  Lock,
  Send,
  UsersRound,
  X,
  Zap,
} from 'lucide-react-native';
import type {NativeStackScreenProps} from '@react-navigation/native-stack';

import {getBrandIcon} from '../../../design/brand/usage';
import {
  CircleCategoryIcon,
  CircleCategoryPill,
  getCircleCategoryVisual,
} from '../../../design/components/CircleCategoryIcon';
import {FrostedBackdrop} from '../../../design/components/FrostedBackdrop';
import {GlassPanel} from '../../../design/components/GlassPanel';
import {HoystScreen} from '../../../design/components/HoystScreen';
import {HoystText} from '../../../design/components/HoystText';
import {LayeredAvatar} from '../../../design/components/LayeredAvatar';
import {NudgeActionButton} from '../../../design/components/NudgeActionButton';
import {SectionEyebrow} from '../../../design/components/SectionEyebrow';
import {HoystTapInMark} from '../../../design/components/HoystTapInMark';
import {triggerTapInPressHaptic} from '../../../lib/haptics/tap-in-haptics';
import {actionMotion} from '../../../design/tokens/actions';
import {brandColors} from '../../../design/tokens/colors';
import {radius} from '../../../design/tokens/radius';
import {useHoystTheme} from '../../../design/theme/useHoystTheme';
import type {RootStackParamList} from '../../../navigation/types';
import type {CircleManagementCard} from '../../../types/models';
import {useUserProfileStore} from '../../../store/profile-store';
import {useSessionStore} from '../../../store/session-store';
import {
  canTapInToday,
  createEmptyHomeData,
  sortHomeCircles,
  subscribeToHomeData,
  type HomeData,
} from '../../home/services/home-data-service';
import {nudgeCircleMembers} from '../../circles/services/circle-service';

type Props = NativeStackScreenProps<RootStackParamList, 'TapInPicker'>;

function getPeriodCopy(circle: CircleManagementCard) {
  if (circle.commitmentCadence === 'monthly') {
    return 'this month';
  }

  return circle.commitmentCadence === 'daily' ? 'today' : 'this week';
}

function getRemainingTapInsLabel(
  circle: CircleManagementCard,
  count = circle.viewerRemainingTapIns ?? circle.remainingCheckIns,
) {
  const periodCopy = getPeriodCopy(circle);

  return count === 1
    ? `1 Tap In left ${periodCopy}`
    : `${count} Tap Ins left ${periodCopy}`;
}

function getPriorityDeadlineLabel(
  circle: CircleManagementCard,
  fallbackTimezone: string,
) {
  if (circle.commitmentCadence !== 'daily') {
    return getRemainingTapInsLabel(circle);
  }

  const zone = circle.timezone?.trim() || fallbackTimezone;
  const now = DateTime.now().setZone(zone);
  const hoursLeft = Math.max(
    1,
    Math.ceil(now.endOf('day').diff(now, 'hours').hours),
  );

  return `${hoursLeft}h left today`;
}

function getShownUpCount(circle: CircleManagementCard) {
  return circle.members.filter(member => member.state === 'done').length;
}

function getShownUpLabel(circle: CircleManagementCard) {
  const shownUpCount = getShownUpCount(circle);

  return shownUpCount === 1 ? '1 showed up' : `${shownUpCount} showed up`;
}

function getProgressTone(
  circle: CircleManagementCard,
  theme: ReturnType<typeof useHoystTheme>,
) {
  if (circle.state === 'risk') {
    return theme.warningForeground;
  }

  if (circle.progressPercent >= 80) {
    return theme.successForeground;
  }

  if (circle.progressPercent >= 50) {
    return theme.accentSecondaryForeground;
  }

  return theme.warningForeground;
}

function AvatarPreview({
  circle,
  inverse = false,
  size = 40,
}: {
  circle: CircleManagementCard;
  inverse?: boolean;
  size?: number;
}) {
  return (
    <View style={styles.avatarRow}>
      {circle.members.slice(0, 3).map((member, index) => (
        <View
          key={member.id}
          style={[
            styles.avatarOffset,
            index === 0 ? undefined : styles.avatarOverlap,
          ]}>
          <LayeredAvatar
            chrome={inverse ? 'minimal' : 'default'}
            imageSource={member.avatarImage}
            imageUrl={member.avatarUrl}
            initials={member.initials}
            size={size}
            state={member.state}
          />
        </View>
      ))}
      {circle.members.length > 3 ? (
        <View
          style={[
            styles.moreCountBubble,
            inverse ? styles.moreCountBubbleInverse : undefined,
          ]}>
          <HoystText
            style={[
              styles.moreCount,
              inverse ? styles.moreCountInverse : undefined,
            ]}
            tone={inverse ? undefined : 'muted'}
            variant="caption">
            +{circle.members.length - 3}
          </HoystText>
        </View>
      ) : null}
    </View>
  );
}

function MetricPill({
  icon,
  label,
  tone,
}: {
  icon: React.ReactNode;
  label: string;
  tone: 'green' | 'orange' | 'purple';
}) {
  const theme = useHoystTheme();
  const palette =
    tone === 'green'
      ? {
          backgroundColor: 'rgba(68,216,92,0.14)',
          borderColor: 'rgba(68,216,92,0.28)',
          color: theme.successForeground,
        }
      : tone === 'purple'
      ? {
          backgroundColor: 'rgba(139,92,246,0.16)',
          borderColor: 'rgba(139,92,246,0.28)',
          color: theme.accentSecondaryForeground,
        }
      : {
          backgroundColor: 'rgba(255,138,61,0.14)',
          borderColor: 'rgba(255,138,61,0.28)',
          color: theme.warningForeground,
        };

  return (
    <View
      style={[
        styles.metricPill,
        {
          backgroundColor: palette.backgroundColor,
          borderColor: palette.borderColor,
        },
      ]}>
      {icon}
      <HoystText
        numberOfLines={1}
        style={[styles.metricPillLabel, {color: palette.color}]}>
        {label}
      </HoystText>
    </View>
  );
}

function SectionHeader({
  count,
  icon,
  title,
}: {
  count: string;
  icon?: React.ReactNode;
  title: string;
}) {
  return (
    <View style={styles.sectionHeader}>
      <View style={styles.sectionTitleRow}>
        {icon}
        <SectionEyebrow>{title}</SectionEyebrow>
      </View>
      <HoystText tone="muted" variant="caption">
        {count}
      </HoystText>
    </View>
  );
}

function PickerTapInButton({
  label,
  onPress,
  style,
  testID,
}: {
  label: string;
  onPress: () => void;
  style?: StyleProp<ViewStyle>;
  testID?: string;
}) {
  const theme = useHoystTheme();

  return (
    <Pressable
      accessibilityLabel={label}
      accessibilityRole="button"
      onPress={onPress}
      onPressIn={() => {
        triggerTapInPressHaptic();
      }}
      style={({pressed}) => [
        styles.pickerTapInPressable,
        {
          opacity: pressed ? actionMotion.pressedOpacity : 1,
          shadowColor: theme.actionShadowColor,
          transform: [{scale: pressed ? actionMotion.pressedScale : 1}],
        },
        style,
      ]}
      testID={testID}>
      <View style={styles.pickerTapInFrame}>
        <Image
          accessibilityIgnoresInvertColors
          resizeMode="contain"
          source={getBrandIcon(true)}
          style={styles.pickerTapInLogo}
        />
        <HoystText numberOfLines={1} style={styles.pickerTapInLabel}>
          {label}
        </HoystText>
      </View>
    </Pressable>
  );
}

function PriorityTapCard({
  circle,
  onPress,
  timezone,
}: {
  circle: CircleManagementCard;
  onPress: () => void;
  timezone: string;
}) {
  const visual = getCircleCategoryVisual(circle.category);

  return (
    <LinearGradient
      colors={[visual.accentColor, visual.accentDark]}
      end={{x: 1, y: 1}}
      start={{x: 0, y: 0}}
      style={styles.priorityCard}
      testID={`tap-in-priority-card-${circle.id}`}>
      <View style={styles.priorityContent}>
        <View style={styles.priorityTopRow}>
          <View style={styles.priorityPill}>
            <CircleCategoryIcon
              category={circle.category}
              shape="roundedSquare"
              size={18}
            />
            <HoystText style={styles.priorityPillText} variant="caption">
              {circle.category.toUpperCase()}
            </HoystText>
          </View>
          <View style={[styles.priorityPill, styles.priorityDeadlinePill]}>
            <Clock3 color="#FFD6A8" size={15} strokeWidth={2.4} />
            <HoystText style={styles.priorityPillText} variant="caption">
              {getPriorityDeadlineLabel(circle, timezone)}
            </HoystText>
          </View>
        </View>

        <View style={styles.priorityCopy}>
          <HoystText numberOfLines={2} style={styles.priorityTitle}>
            {circle.title}
          </HoystText>
          <HoystText numberOfLines={2} style={styles.priorityDescription}>
            {circle.commitment}
          </HoystText>
        </View>

        <View style={styles.priorityStatsRow}>
          <UsersRound
            color="rgba(255,255,255,0.72)"
            size={16}
            strokeWidth={2.3}
          />
          <HoystText
            numberOfLines={1}
            style={styles.priorityStat}
            variant="button">
            {circle.memberCount}/{circle.maxSize} members
          </HoystText>
          <View style={styles.priorityDot} />
          <HoystText
            numberOfLines={1}
            style={styles.priorityStat}
            variant="button">
            {getShownUpLabel(circle)}
          </HoystText>
        </View>

        <View style={styles.priorityFooter}>
          <AvatarPreview circle={circle} inverse size={40} />
          <PickerTapInButton
            label="Tap In"
            onPress={onPress}
            style={styles.priorityAction}
            testID={`tap-in-picker-priority-action-${circle.id}`}
          />
        </View>
      </View>
    </LinearGradient>
  );
}

function DueTapCard({
  circle,
  onPress,
}: {
  circle: CircleManagementCard;
  onPress: () => void;
}) {
  const theme = useHoystTheme();
  const progressTone = getProgressTone(circle, theme);
  const privacyIcon =
    circle.privacy === 'public' ? (
      <Globe2 color={theme.textSubtle} size={15} strokeWidth={2.1} />
    ) : (
      <Lock color={theme.textSubtle} size={15} strokeWidth={2.1} />
    );

  return (
    <GlassPanel style={styles.dueCard}>
      <View style={styles.cardHeader}>
        <CircleCategoryPill category={circle.category} uppercase />
        <View
          style={[
            styles.progressBadge,
            {
              backgroundColor: `${progressTone}14`,
              borderColor: `${progressTone}55`,
            },
          ]}>
          <Clock3 color={progressTone} size={13} strokeWidth={2.4} />
          <HoystText style={[styles.progressBadgeText, {color: progressTone}]}>
            {circle.progressLabel ?? `${circle.progressPercent}%`}
          </HoystText>
        </View>
      </View>

      <View style={styles.cardCopy}>
        <HoystText
          adjustsFontSizeToFit
          minimumFontScale={0.88}
          numberOfLines={2}
          style={styles.cardTitle}>
          {circle.title}
        </HoystText>
        <View style={styles.taskRow}>
          {privacyIcon}
          <HoystText numberOfLines={2} style={styles.taskCopy} tone="muted">
            {circle.commitment}
          </HoystText>
        </View>
      </View>

      <View style={styles.cardMetaRow}>
        <View style={styles.managementItem}>
          <UsersRound color={theme.textSubtle} size={15} strokeWidth={2.1} />
          <HoystText style={styles.cardMetaText} tone="muted">
            {circle.memberCount}/{circle.maxSize} members
          </HoystText>
        </View>
        <View
          style={[styles.managementDot, {backgroundColor: theme.borderStrong}]}
        />
        <HoystText style={[styles.cardMetaText, {color: progressTone}]}>
          {getRemainingTapInsLabel(circle)}
        </HoystText>
      </View>

      <View style={styles.cardFooter}>
        <AvatarPreview circle={circle} />
        <PickerTapInButton
          label="Tap In Today"
          onPress={onPress}
          style={styles.primaryActionWrap}
          testID={`tap-in-picker-due-action-${circle.id}`}
        />
      </View>
    </GlassPanel>
  );
}

function EmptyState({body, title}: {body: string; title: string}) {
  return (
    <GlassPanel style={styles.emptyPanel}>
      <View style={styles.emptyState}>
        <HoystTapInMark size={62} />
        <HoystText style={styles.centerText} variant="title">
          {title}
        </HoystText>
        <HoystText style={styles.centerText} tone="muted">
          {body}
        </HoystText>
      </View>
    </GlassPanel>
  );
}

function StillUsefulEmptyCard() {
  const theme = useHoystTheme();

  return (
    <GlassPanel style={styles.stillUsefulEmptyCard}>
      <View style={styles.stillUsefulEmptyRow}>
        <View
          style={[
            styles.emptyCheckTile,
            {
              backgroundColor: theme.isDark
                ? 'rgba(68,216,92,0.14)'
                : '#E2F0E3',
            },
          ]}>
          <Check color={theme.successForeground} size={18} strokeWidth={2.8} />
        </View>
        <View style={styles.stillUsefulEmptyCopy}>
          <HoystText style={styles.stillUsefulEmptyTitle}>
            Nothing else needs you
          </HoystText>
          <HoystText style={styles.stillUsefulEmptyBody} tone="muted">
            Your active circles are clear for now.
          </HoystText>
        </View>
      </View>
    </GlassPanel>
  );
}

export function TapInPickerScreen({navigation}: Props): React.JSX.Element {
  const theme = useHoystTheme();
  const [homeData, setHomeData] = useState<HomeData>(() =>
    createEmptyHomeData(),
  );
  const [isLoadingHomeData, setIsLoadingHomeData] = useState(false);
  const [hasHomeDataError, setHasHomeDataError] = useState(false);
  const [nudgedCircleIds, setNudgedCircleIds] = useState<ReadonlySet<string>>(
    () => new Set(),
  );
  const [nudgingCircleIds, setNudgingCircleIds] = useState<ReadonlySet<string>>(
    () => new Set(),
  );
  const profile = useUserProfileStore(state => state.profile);
  const status = useSessionStore(state => state.status);
  const user = useSessionStore(state => state.user);
  const timezone = profile?.timezone ?? 'UTC';
  const canLoadCircles = status === 'authenticatedReady' && Boolean(user?.uid);

  useEffect(() => {
    if (!canLoadCircles || !user?.uid) {
      setHomeData(createEmptyHomeData(timezone));
      setIsLoadingHomeData(false);
      setHasHomeDataError(false);
      return undefined;
    }

    setIsLoadingHomeData(true);
    setHasHomeDataError(false);

    return subscribeToHomeData({
      onData: data => {
        setHomeData(data);
        setHasHomeDataError(false);
        setIsLoadingHomeData(false);
      },
      onError: () => {
        setHasHomeDataError(true);
        setIsLoadingHomeData(false);
      },
      timezone,
      uid: user.uid,
    });
  }, [canLoadCircles, timezone, user?.uid]);

  const activeCircles = sortHomeCircles(
    homeData.circles.filter(
      circle => circle.viewerMembershipStatus !== 'pending',
    ),
  );
  const dueCircles = sortHomeCircles(activeCircles.filter(canTapInToday));
  const priorityCircle = dueCircles[0];
  const remainingDueCircles = dueCircles.slice(1);
  const secondaryCircles = sortHomeCircles(
    activeCircles.filter(circle => !canTapInToday(circle)),
  );
  const atRiskCount = activeCircles.filter(
    circle => circle.state === 'risk',
  ).length;
  const coveredCount = activeCircles.filter(
    circle => circle.viewerHasTappedInToday,
  ).length;
  const showLoadingState = isLoadingHomeData;
  const showDataErrorState =
    hasHomeDataError && !isLoadingHomeData && activeCircles.length === 0;
  const showNoActiveCirclesState =
    !hasHomeDataError && !isLoadingHomeData && activeCircles.length === 0;
  const showAllTappedInState =
    !hasHomeDataError &&
    !isLoadingHomeData &&
    activeCircles.length > 0 &&
    dueCircles.length === 0;

  const openTapIn = (circleId: string) => {
    navigation.replace('TapInComposer', {
      circleId,
      source: 'tap_in',
    });
  };

  const openCircle = (circleId: string) => {
    navigation.navigate('CircleDetail', {circleId});
  };

  const shareInvite = (circle: CircleManagementCard) => {
    if (!circle.inviteUrl) {
      return;
    }

    Share.share({
      title: `Join ${circle.title} on Hoyst`,
      message: `Join ${circle.title} on Hoyst: ${circle.inviteUrl}`,
      url: circle.inviteUrl,
    }).catch(() => undefined);
  };

  const nudgeCircle = (circle: CircleManagementCard) => {
    if ((circle.nudgeTargetCount ?? 0) <= 0) {
      openCircle(circle.id);
      return;
    }

    if (nudgedCircleIds.has(circle.id) || nudgingCircleIds.has(circle.id)) {
      return;
    }

    setNudgingCircleIds(currentNudgingCircleIds => {
      const nextNudgingCircleIds = new Set(currentNudgingCircleIds);
      nextNudgingCircleIds.add(circle.id);
      return nextNudgingCircleIds;
    });

    nudgeCircleMembers(circle.id)
      .then(result => {
        setNudgedCircleIds(currentNudgedCircleIds => {
          const nextNudgedCircleIds = new Set(currentNudgedCircleIds);
          nextNudgedCircleIds.add(circle.id);
          return nextNudgedCircleIds;
        });

        Alert.alert(
          'Nudge sent',
          result.nudged > 0
            ? `${result.nudged} member${result.nudged === 1 ? '' : 's'} nudged.`
            : 'Everyone is covered right now.',
        );
      })
      .catch(error => {
        Alert.alert(
          'Nudge failed',
          (error as {message?: string}).message ?? 'Could not send a nudge.',
        );
      })
      .finally(() => {
        setNudgingCircleIds(currentNudgingCircleIds => {
          if (!currentNudgingCircleIds.has(circle.id)) {
            return currentNudgingCircleIds;
          }

          const nextNudgingCircleIds = new Set(currentNudgingCircleIds);
          nextNudgingCircleIds.delete(circle.id);
          return nextNudgingCircleIds;
        });
      });
  };

  return (
    <HoystScreen
      background={<FrostedBackdrop />}
      contentContainerStyle={styles.content}>
      <View style={styles.closeRow}>
        <Pressable
          accessibilityLabel="Close Tap In picker"
          accessibilityRole="button"
          hitSlop={8}
          onPress={() => navigation.goBack()}
          style={({pressed}) => [
            styles.closeButton,
            {
              backgroundColor: theme.surfaceSoft,
              borderColor: theme.border,
              opacity: pressed ? 0.92 : 1,
            },
          ]}>
          <X color={theme.text} size={20} strokeWidth={2.5} />
        </Pressable>
      </View>

      <View style={styles.heroPanel}>
        <View style={styles.heroIconWrap}>
          <HoystTapInMark size={78} testID="tap-in-picker-logo" />
        </View>
        <View style={styles.headerCopy}>
          <HoystText style={[styles.centerText, styles.heroTitle]}>
            {coveredCount} of {activeCircles.length} tapped in
          </HoystText>
          <HoystText style={styles.heroSubtitle}>
            Clear the circles that need you, then you're done for today.
          </HoystText>
        </View>
        <View style={styles.summaryChips}>
          <MetricPill
            icon={
              <Zap
                color={theme.warningForeground}
                size={14}
                strokeWidth={2.6}
              />
            }
            label={`${dueCircles.length} TAP TODAY`}
            tone="orange"
          />
          <MetricPill
            icon={
              <Clock3
                color={theme.accentSecondaryForeground}
                size={14}
                strokeWidth={2.4}
              />
            }
            label={`${atRiskCount} AT RISK`}
            tone="purple"
          />
          <MetricPill
            icon={
              <Check
                color={theme.successForeground}
                size={14}
                strokeWidth={2.6}
              />
            }
            label={`${coveredCount} COVERED`}
            tone="green"
          />
        </View>
      </View>

      {priorityCircle ? (
        <View style={styles.section} testID="tap-in-priority-section">
          <SectionHeader
            count="1 due"
            icon={
              <Zap
                color={theme.warningForeground}
                size={15}
                strokeWidth={2.7}
              />
            }
            title="DO THIS FIRST"
          />
          <PriorityTapCard
            circle={priorityCircle}
            onPress={() => openTapIn(priorityCircle.id)}
            timezone={timezone}
          />
        </View>
      ) : showLoadingState ? (
        <EmptyState
          body="Pulling your live Tap In status from Hoyst."
          title="Loading your circles"
        />
      ) : showDataErrorState ? (
        <EmptyState
          body="Your account is connected, but Hoyst could not load your live circle status."
          title="Could not load Tap In"
        />
      ) : showNoActiveCirclesState ? (
        <EmptyState
          body="Join or create a circle before Tap In has anything to track."
          title="No active circles yet"
        />
      ) : showAllTappedInState ? (
        <EmptyState
          body="Every active Circle has today's Tap In covered. You can still keep Members moving below."
          title="Today is covered"
        />
      ) : null}

      {remainingDueCircles.length > 0 ? (
        <View style={styles.section} testID="tap-in-today-section">
          <SectionHeader
            count={
              remainingDueCircles.length === 1
                ? '1 due'
                : `${remainingDueCircles.length} due`
            }
            title="TAP TODAY"
          />
          {remainingDueCircles.map(circle => (
            <DueTapCard
              circle={circle}
              key={circle.id}
              onPress={() => openTapIn(circle.id)}
            />
          ))}
        </View>
      ) : null}

      <View style={styles.section}>
        <SectionHeader
          count={
            secondaryCircles.length === 1
              ? '1 active'
              : `${secondaryCircles.length} active`
          }
          title="STILL USEFUL TODAY"
        />

        {secondaryCircles.length > 0 ? (
          secondaryCircles.map(circle => {
            const nudgeTargetCount = circle.nudgeTargetCount ?? 0;
            const canNudge = nudgeTargetCount > 0;
            const canShare = !canNudge && Boolean(circle.inviteUrl);
            const isNudged = nudgedCircleIds.has(circle.id);
            const isNudging = nudgingCircleIds.has(circle.id);
            const actionLabel = canNudge
              ? isNudging
                ? 'Nudging...'
                : isNudged
                ? 'Nudged'
                : `Nudge ${nudgeTargetCount}`
              : canShare
              ? 'Share'
              : 'View';
            const statusTone = canNudge
              ? theme.accentSecondaryForeground
              : circle.viewerTodayStatus === 'skip'
              ? theme.warningForeground
              : theme.successForeground;
            const statusLabel = canNudge
              ? getRemainingTapInsLabel(circle, circle.remainingCheckIns)
              : circle.viewerTodayStatus === 'skip'
              ? 'Grace skip used today'
              : 'Covered today';
            const ActionIcon = canShare ? Send : ArrowRight;

            return (
              <GlassPanel key={circle.id} style={styles.secondaryCard}>
                <View style={styles.secondaryRow}>
                  <View style={styles.secondaryCopy}>
                    <View style={styles.secondaryTitleRow}>
                      {circle.state === 'done' ? (
                        <Check
                          color={theme.successForeground}
                          size={16}
                          strokeWidth={2.7}
                        />
                      ) : null}
                      <HoystText
                        numberOfLines={1}
                        style={styles.secondaryTitle}>
                        {circle.title}
                      </HoystText>
                    </View>
                    <HoystText style={styles.secondaryStatusText} tone="muted">
                      {statusLabel}
                    </HoystText>
                  </View>
                  {canNudge ? (
                    <NudgeActionButton
                      isLoading={isNudging}
                      isSent={isNudged}
                      label={actionLabel}
                      onPress={() => nudgeCircle(circle)}
                      size="compact"
                      targetCount={nudgeTargetCount}
                    />
                  ) : (
                    <Pressable
                      onPress={() => {
                        if (canShare) {
                          shareInvite(circle);
                          return;
                        }

                        openCircle(circle.id);
                      }}
                      style={({pressed}) => [
                        styles.secondaryAction,
                        {
                          backgroundColor: theme.actionSurface,
                          borderColor: theme.actionBorder,
                          opacity: pressed ? 0.9 : 1,
                        },
                      ]}>
                      <ActionIcon
                        color={theme.actionForeground}
                        size={15}
                        strokeWidth={2.2}
                      />
                      <HoystText
                        numberOfLines={1}
                        style={[
                          styles.secondaryActionLabel,
                          {color: theme.actionForeground},
                        ]}
                        variant="button">
                        {actionLabel}
                      </HoystText>
                    </Pressable>
                  )}
                </View>
                <View style={styles.secondaryMeta}>
                  <CircleCategoryPill category={circle.category} uppercase />
                  <HoystText style={[styles.cardMetaText, {color: statusTone}]}>
                    {circle.progressPercent}% tapped in
                  </HoystText>
                </View>
              </GlassPanel>
            );
          })
        ) : (
          <StillUsefulEmptyCard />
        )}
      </View>
    </HoystScreen>
  );
}

const styles = StyleSheet.create({
  avatarOffset: {
    borderRadius: radius.pill,
  },
  avatarOverlap: {
    marginLeft: -14,
  },
  avatarRow: {
    alignItems: 'center',
    flex: 1,
    flexDirection: 'row',
    minWidth: 0,
    overflow: 'visible',
  },
  cardCopy: {
    gap: 6,
  },
  cardFooter: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 12,
  },
  cardHeader: {
    alignItems: 'flex-start',
    flexDirection: 'row',
    gap: 12,
    justifyContent: 'space-between',
  },
  cardMetaRow: {
    alignItems: 'center',
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  cardMetaText: {
    fontSize: 12,
    fontWeight: '600',
    letterSpacing: 0,
    lineHeight: 16,
  },
  cardTitle: {
    flexShrink: 1,
    fontSize: 17,
    fontWeight: '800',
    letterSpacing: 0,
    lineHeight: 21,
    minWidth: 0,
  },
  centerText: {
    textAlign: 'center',
  },
  closeButton: {
    alignItems: 'center',
    borderRadius: radius.pill,
    borderWidth: 1,
    height: 48,
    justifyContent: 'center',
    width: 48,
  },
  closeRow: {
    alignItems: 'flex-end',
    paddingBottom: 0,
    paddingTop: 4,
  },
  content: {
    paddingBottom: 168,
  },
  dueCard: {
    minHeight: 210,
  },
  emptyCheckTile: {
    alignItems: 'center',
    borderRadius: 10,
    flexShrink: 0,
    height: 36,
    justifyContent: 'center',
    width: 36,
  },
  emptyPanel: {
    minHeight: 186,
  },
  emptyState: {
    alignItems: 'center',
    gap: 12,
  },
  headerCopy: {
    alignItems: 'center',
    gap: 6,
  },
  heroIconWrap: {
    alignItems: 'center',
  },
  heroPanel: {
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 6,
    paddingTop: 0,
  },
  heroSubtitle: {
    color: '#7A789A',
    fontSize: 13,
    fontWeight: '500',
    letterSpacing: 0,
    lineHeight: 18,
    maxWidth: 270,
    textAlign: 'center',
  },
  heroTitle: {
    fontSize: 28,
    fontWeight: '800',
    letterSpacing: 0,
    lineHeight: 32,
  },
  managementDot: {
    borderRadius: radius.pill,
    height: 3,
    width: 3,
  },
  managementItem: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 5,
  },
  metricPill: {
    alignItems: 'center',
    borderRadius: radius.pill,
    borderWidth: 1,
    flexShrink: 1,
    flexDirection: 'row',
    gap: 5,
    justifyContent: 'center',
    minHeight: 30,
    minWidth: 0,
    paddingHorizontal: 9,
    paddingVertical: 5,
  },
  metricPillLabel: {
    flexShrink: 1,
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.35,
    lineHeight: 13,
  },
  moreCount: {
    fontSize: 14,
    fontWeight: '700',
    letterSpacing: 0,
    lineHeight: 16,
  },
  moreCountBubble: {
    alignItems: 'center',
    backgroundColor: 'rgba(108,116,140,0.12)',
    borderRadius: radius.pill,
    height: 36,
    justifyContent: 'center',
    marginLeft: -14,
    width: 36,
  },
  moreCountBubbleInverse: {
    backgroundColor: 'rgba(255,255,255,0.16)',
  },
  moreCountInverse: {
    color: brandColors.white,
  },
  primaryActionWrap: {
    flexShrink: 0,
    marginLeft: 'auto',
    maxWidth: '58%',
    minWidth: 172,
  },
  pickerTapInFrame: {
    alignItems: 'center',
    alignSelf: 'stretch',
    backgroundColor: '#15171D',
    borderColor: 'rgba(255,255,255,0.12)',
    borderRadius: radius.pill,
    borderWidth: 1.4,
    flexDirection: 'row',
    gap: 9,
    height: 48,
    justifyContent: 'center',
    minHeight: 48,
    overflow: 'hidden',
    paddingHorizontal: 16,
  },
  pickerTapInPressable: {
    alignItems: 'stretch',
    borderRadius: radius.pill,
    elevation: 8,
    flexShrink: 0,
    height: 48,
    justifyContent: 'center',
    minHeight: 48,
    minWidth: 144,
    overflow: 'hidden',
    shadowOffset: {height: 8, width: 0},
    shadowOpacity: 0.22,
    shadowRadius: 18,
  },
  pickerTapInLabel: {
    color: brandColors.white,
    flexShrink: 1,
    fontSize: 14,
    fontWeight: '800',
    letterSpacing: 0,
    lineHeight: 18,
  },
  pickerTapInLogo: {
    flexShrink: 0,
    height: 30,
    width: 30,
  },
  priorityAction: {
    flexShrink: 0,
    marginLeft: 'auto',
    width: 148,
  },
  priorityCard: {
    alignSelf: 'stretch',
    borderRadius: radius.lg,
    overflow: 'hidden',
    shadowColor: 'rgba(47,111,237,0.34)',
    shadowOffset: {height: 16, width: 0},
    shadowOpacity: 0.22,
    shadowRadius: 28,
    width: '100%',
  },
  priorityContent: {
    gap: 11,
    paddingBottom: 16,
    paddingHorizontal: 18,
    paddingTop: 15,
  },
  priorityCopy: {
    gap: 3,
  },
  priorityDeadlinePill: {
    flexShrink: 1,
    justifyContent: 'center',
    marginLeft: 'auto',
    minWidth: 118,
  },
  priorityDescription: {
    color: 'rgba(255,255,255,0.84)',
    fontSize: 13,
    fontWeight: '600',
    letterSpacing: 0,
    lineHeight: 18,
  },
  priorityDot: {
    backgroundColor: 'rgba(255,255,255,0.42)',
    borderRadius: radius.pill,
    flexShrink: 0,
    height: 4,
    width: 4,
  },
  priorityPill: {
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.18)',
    borderRadius: radius.pill,
    flexDirection: 'row',
    flexShrink: 0,
    gap: 7,
    minHeight: 28,
    paddingHorizontal: 12,
  },
  priorityPillText: {
    color: brandColors.white,
    flexShrink: 1,
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.2,
    lineHeight: 14,
  },
  priorityStat: {
    color: brandColors.white,
    flexShrink: 1,
    fontSize: 12,
    fontWeight: '700',
    lineHeight: 16,
  },
  priorityFooter: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 10,
    minHeight: 48,
  },
  priorityStatsRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 8,
    minWidth: 0,
  },
  priorityTitle: {
    color: brandColors.white,
    fontSize: 20,
    fontWeight: '800',
    letterSpacing: 0,
    lineHeight: 24,
  },
  priorityTopRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 8,
    justifyContent: 'space-between',
    minWidth: 0,
    width: '100%',
  },
  progressBadge: {
    alignItems: 'center',
    borderRadius: radius.pill,
    borderWidth: 1,
    flexDirection: 'row',
    flexShrink: 0,
    gap: 5,
    justifyContent: 'center',
    minHeight: 30,
    paddingHorizontal: 10,
  },
  progressBadgeText: {
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 0,
    lineHeight: 16,
  },
  secondaryAction: {
    alignItems: 'center',
    borderRadius: radius.md,
    borderWidth: 1,
    flexDirection: 'row',
    flexShrink: 0,
    gap: 6,
    justifyContent: 'center',
    minHeight: 42,
    minWidth: 96,
    paddingHorizontal: 12,
  },
  secondaryActionLabel: {
    fontSize: 14,
    lineHeight: 18,
  },
  secondaryCard: {
    minHeight: 104,
  },
  secondaryCopy: {
    flex: 1,
    gap: 5,
    minWidth: 0,
  },
  secondaryMeta: {
    alignItems: 'center',
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  secondaryRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 12,
  },
  secondaryTitle: {
    flexShrink: 1,
    fontSize: 17,
    fontWeight: '800',
    letterSpacing: 0,
    lineHeight: 21,
    minWidth: 0,
  },
  secondaryStatusText: {
    fontSize: 12,
    fontWeight: '600',
    letterSpacing: 0,
    lineHeight: 16,
  },
  secondaryTitleRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 6,
    minWidth: 0,
  },
  section: {
    gap: 12,
  },
  sectionHeader: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 2,
  },
  sectionTitleRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 7,
  },
  stillUsefulEmptyCard: {
    minHeight: 84,
  },
  stillUsefulEmptyCopy: {
    flex: 1,
    gap: 4,
    minWidth: 0,
  },
  stillUsefulEmptyTitle: {
    fontSize: 17,
    fontWeight: '800',
    letterSpacing: 0,
    lineHeight: 21,
  },
  stillUsefulEmptyBody: {
    fontSize: 13,
    fontWeight: '600',
    letterSpacing: 0,
    lineHeight: 17,
  },
  stillUsefulEmptyRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 12,
  },
  summaryChips: {
    alignSelf: 'stretch',
    flexDirection: 'row',
    flexWrap: 'nowrap',
    gap: 8,
    justifyContent: 'center',
  },
  taskCopy: {
    flex: 1,
    fontSize: 14,
    fontWeight: '600',
    letterSpacing: 0,
    lineHeight: 18,
    minWidth: 0,
  },
  taskRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 7,
  },
});
