import React, {useEffect, useRef, useState} from 'react';
import {Alert, Share} from 'react-native';
import {DateTime} from 'luxon';
import type {NativeStackScreenProps} from '@react-navigation/native-stack';
import {DesignSystemProvider} from '../../../design/system';
import type {RootStackParamList} from '../../../navigation/types';
import type {CircleManagementCard} from '../../../types/models';
import {useUserProfileStore} from '../../../store/profile-store';
import {useSessionStore} from '../../../store/session-store';
import {useSettingsStore} from '../../../store/settings-store';
import {
  canTapInToday,
  createEmptyHomeData,
  sortHomeCircles,
  subscribeToHomeData,
  type HomeData,
} from '../../home/services/home-data-service';
import {nudgeCircleMembers} from '../../circles/services/circle-service';
import {
  TapInPickerPresentation,
  type PickerUtility,
} from '../components/TapInPickerPresentation';

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

export function TapInPickerScreen(props: Props): React.JSX.Element {
  const appearance = useSettingsStore(state => state.appearance);
  return (
    <DesignSystemProvider scheme={appearance}>
      <TapInPickerController {...props} />
    </DesignSystemProvider>
  );
}

function TapInPickerController({navigation}: Props): React.JSX.Element {
  const nudgeLocks = useRef(new Set<string>());
  const [active, setActive] = useState(navigation.isFocused?.() ?? true);
  useEffect(() => {
    const focus = navigation.addListener?.('focus', () => setActive(true));
    const blur = navigation.addListener?.('blur', () => setActive(false));
    return () => {
      focus?.();
      blur?.();
    };
  }, [navigation]);
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
  const secondaryCircles = sortHomeCircles(
    activeCircles.filter(circle => !canTapInToday(circle)),
  );
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
    navigation.navigate('TapInComposer', {
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

    if (nudgedCircleIds.has(circle.id) || nudgeLocks.current.has(circle.id)) {
      return;
    }

    nudgeLocks.current.add(circle.id);
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
            ? `${result.nudged} ${
                result.nudged === 1 ? 'Member' : 'Members'
              } nudged.`
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
        nudgeLocks.current.delete(circle.id);
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

  const utilities: PickerUtility[] = secondaryCircles.map(circle => {
    const count = circle.nudgeTargetCount ?? 0;
    const canNudge = count > 0;
    const canShare = !canNudge && Boolean(circle.inviteUrl);
    const busy = nudgingCircleIds.has(circle.id);
    const sent = nudgedCircleIds.has(circle.id);
    return {
      circle,
      kind: canNudge ? 'nudge' : canShare ? 'share' : 'view',
      label: canNudge
        ? busy
          ? 'Nudging...'
          : sent
          ? 'Nudged'
          : `Nudge ${count}`
        : canShare
        ? 'Share'
        : 'View',
      status: canNudge
        ? getRemainingTapInsLabel(circle, circle.remainingCheckIns)
        : circle.viewerTodayStatus === 'skip'
        ? 'Grace skip used today'
        : 'Covered today',
      busy,
      disabled: canNudge && sent,
      onPress: () =>
        canNudge
          ? nudgeCircle(circle)
          : canShare
          ? shareInvite(circle)
          : openCircle(circle.id),
    };
  });
  const message = showLoadingState
    ? {
        title: 'Loading your commitments',
        body: 'Getting your latest Tap In status.',
      }
    : showDataErrorState
    ? {
        title: 'Could not load Tap In',
        body: 'Your commitment status is unavailable right now.',
      }
    : showNoActiveCirclesState
    ? {
        title: 'No active commitments yet',
        body: 'Create or join a commitment to get started.',
      }
    : showAllTappedInState
    ? {
        title: 'Today is covered',
        body: 'No Tap Ins due right now.',
        success: true,
      }
    : undefined;
  return (
    <TapInPickerPresentation
      active={active}
      coveredCount={coveredCount}
      totalCount={activeCircles.length}
      dueCircles={dueCircles}
      utilities={utilities}
      deadline={
        priorityCircle
          ? getPriorityDeadlineLabel(priorityCircle, timezone)
          : undefined
      }
      message={message}
      onClose={() => navigation.goBack()}
      onTapIn={openTapIn}
    />
  );
}
