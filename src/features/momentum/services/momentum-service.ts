import type {FirebaseFirestoreTypes} from '@react-native-firebase/firestore';
import {circleDateKey, circleDates, circlePeriodForDate, shiftCircleDate} from '../../../shared/circle-progress';

import {firebaseFirestore} from '../../../lib/firebase/firestore';
import type {HomeData} from '../../home/services/home-data-service';
import type {
  CircleManagementCard,
  CommitmentPace,
  MomentumStatus,
  MomentumSummary,
  RollingMomentumSummary,
} from '../../../types/models';

export type MomentumDisplayModel = {
  displayProgress: number;
  isCalibrating: boolean;
  label: string;
  rawRollingPercentage: number;
  requiredResolvedOpportunityCount: 3;
  resolvedOpportunityCount: number;
  status: MomentumStatus;
};

function asNumber(value: unknown, fallback: number) {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback;
}

function asString(value: unknown, fallback = '') {
  return typeof value === 'string' && value.trim().length > 0
    ? value.trim()
    : fallback;
}

function clampNumber(value: unknown, fallback: number, max: number) {
  return typeof value === 'number' && Number.isFinite(value)
    ? Math.min(max, Math.max(1, Math.round(value)))
    : fallback;
}

function getCirclePace(circle: CircleManagementCard): CommitmentPace {
  if (
    circle.commitmentCadence === 'daily' ||
    circle.commitmentCadence === 'weekly' ||
    circle.commitmentCadence === 'monthly'
  ) {
    return circle.commitmentCadence;
  }

  return clampNumber(circle.commitmentFrequency?.tapInsPerWeek, 7, 7) >= 7
    ? 'daily'
    : 'weekly';
}

function getCircleOpportunityCount(
  circle: CircleManagementCard,
  pace = getCirclePace(circle),
) {
  if (pace === 'daily') {
    return 1;
  }

  if (pace === 'monthly') {
    return clampNumber(
      circle.commitmentFrequency?.opportunitiesPerPeriod ??
        circle.commitmentFrequency?.tapInsPerWeek,
      4,
      31,
    );
  }

  return clampNumber(circle.commitmentFrequency?.tapInsPerWeek, 7, 7);
}

function getAvailableScheduledOpportunityCount(
  circle: CircleManagementCard,
  todayDateKey: string,
) {
  const pace = getCirclePace(circle);

  if (pace === 'daily') {
    return 1;
  }

  const period = circlePeriodForDate(todayDateKey, pace);
  const member = circle.members.find(item => item.id === circle.viewerUid);
  const joined = member?.joinedAt ? circleDateKey(circle.timezone ?? 'UTC', new Date(member.joinedAt)) : period.start;
  const first = member?.opportunityEligibility === 'next_opening' ? shiftCircleDate(joined, 1) : joined;
  const eligibleStart = first > period.start ? first : period.start;
  return eligibleStart > todayDateKey ? 0 : Math.min(getCircleOpportunityCount(circle, pace), circleDates(eligibleStart, period.end).length);
}

function getCoveredOpportunityCount(circle: CircleManagementCard) {
  if (typeof circle.viewerRemainingTapIns !== 'number') {
    return circle.viewerHasCheckedIn ? 1 : 0;
  }

  const requiredOpportunities = getCircleOpportunityCount(circle);
  const remainingOpportunities = Math.max(circle.viewerRemainingTapIns ?? 0, 0);
  const coveredOpportunities = Math.max(
    requiredOpportunities - remainingOpportunities,
    0,
  );
  return coveredOpportunities;
}

export function getMomentumStatus(percentage: number): MomentumStatus {
  if (percentage <= 0) {
    return 'getting_started';
  }

  if (percentage <= 30) {
    return 'building_momentum';
  }

  if (percentage <= 70) {
    return 'strong_momentum';
  }

  return 'peak_momentum';
}

export function getMomentumLabel(status: MomentumStatus) {
  if (status === 'peak_momentum') {
    return 'Peak';
  }

  if (status === 'strong_momentum') {
    return 'Strong';
  }

  if (status === 'building_momentum') {
    return 'Building';
  }

  return 'Getting Started';
}

function getCalibratedMomentumStatus(percentage: number): MomentumStatus {
  if (percentage <= 30) {
    return 'building_momentum';
  }

  if (percentage <= 70) {
    return 'strong_momentum';
  }

  return 'peak_momentum';
}

export function getMomentumDisplayModel(
  summary?: MomentumSummary,
): MomentumDisplayModel {
  const requiredResolvedOpportunityCount = 3 as const;
  const resolvedOpportunityCount = Math.max(
    0,
    Math.round(summary?.rollingMomentum?.resolvedOpportunityCount ?? 0),
  );
  const rawRollingPercentage = Math.max(
    0,
    Math.min(100, summary?.rollingMomentum?.percentage ?? 0),
  );
  const isCalibrating =
    resolvedOpportunityCount < requiredResolvedOpportunityCount;
  const status = isCalibrating
    ? 'getting_started'
    : getCalibratedMomentumStatus(rawRollingPercentage);

  return {
    displayProgress: isCalibrating
      ? Math.round(
          (Math.min(
            resolvedOpportunityCount,
            requiredResolvedOpportunityCount - 1,
          ) /
            requiredResolvedOpportunityCount) *
            100,
        )
      : rawRollingPercentage,
    isCalibrating,
    label: getMomentumLabel(status),
    rawRollingPercentage,
    requiredResolvedOpportunityCount,
    resolvedOpportunityCount,
    status,
  };
}

export function formatOpportunityCount(summary: MomentumSummary) {
  const available = summary.availableOpportunities;
  const credited = summary.creditedOpportunities;
  const noun = available === 1 ? 'Opportunity' : 'Opportunities';

  return `${credited} of ${available} ${noun} covered`;
}

export function buildMomentumSummaryFromHomeData(
  homeData: Pick<HomeData, 'circles' | 'todayDateKey'>,
): MomentumSummary {
  const activeCircles = homeData.circles.filter(
    circle => circle.viewerMembershipStatus !== 'pending',
  );
  const availableOpportunities = activeCircles.reduce(
    (total, circle) =>
      total +
      Math.max(
        getAvailableScheduledOpportunityCount(circle, homeData.todayDateKey),
        getCoveredOpportunityCount(circle),
      ),
    0,
  );
  const creditedOpportunities = activeCircles.reduce(
    (total, circle) => total + getCoveredOpportunityCount(circle),
    0,
  );
  const percentage =
    availableOpportunities > 0
      ? Math.round((creditedOpportunities / availableOpportunities) * 100)
      : 0;
  const status = getMomentumStatus(percentage);

  return {
    availableOpportunities,
    bestStreak: 0,
    creditedOpportunities,
    completedOpportunities: creditedOpportunities,
    currentStreak: creditedOpportunities,
    label: getMomentumLabel(status),
    percentage,
    periodKey: homeData.todayDateKey,
    skippedOpportunities: activeCircles.reduce(
      (total, circle) => total + (circle.viewerTodayStatus === 'skip' ? 1 : 0),
      0,
    ),
    status,
    tapInOpportunities: activeCircles.reduce(
      (total, circle) =>
        total +
        Math.max(
          getCoveredOpportunityCount(circle) -
            (circle.viewerTodayStatus === 'skip' ? 1 : 0),
          0,
        ),
      0,
    ),
  };
}

export function mapMomentumSummarySnapshot(
  snapshot: FirebaseFirestoreTypes.DocumentSnapshot | undefined | null,
): MomentumSummary | undefined {
  const data = snapshot?.data();

  if (!data) {
    return undefined;
  }

  const percentage = asNumber(data.percentage, 0);
  const creditedOpportunities = asNumber(
    data.creditedOpportunities,
    asNumber(data.completedOpportunities, 0),
  );
  const skippedOpportunities = asNumber(data.skippedOpportunities, 0);
  const status =
    data.status === 'building_momentum' ||
    data.status === 'strong_momentum' ||
    data.status === 'peak_momentum' ||
    data.status === 'getting_started'
      ? data.status
      : getMomentumStatus(percentage);
  const rollingMomentumData =
    data.rollingMomentum && typeof data.rollingMomentum === 'object'
      ? (data.rollingMomentum as Record<string, unknown>)
      : undefined;
  const rollingMomentumStatus =
    rollingMomentumData?.status === 'building_momentum' ||
    rollingMomentumData?.status === 'strong_momentum' ||
    rollingMomentumData?.status === 'peak_momentum' ||
    rollingMomentumData?.status === 'getting_started'
      ? rollingMomentumData.status
      : undefined;
  const rollingMomentum: RollingMomentumSummary | undefined =
    rollingMomentumData &&
    rollingMomentumStatus &&
    typeof rollingMomentumData.hasUnrecoveredMiss === 'boolean'
      ? {
          hasUnrecoveredMiss: rollingMomentumData.hasUnrecoveredMiss,
          percentage: asNumber(rollingMomentumData.percentage, 0),
          resolvedOpportunityCount: asNumber(
            rollingMomentumData.resolvedOpportunityCount,
            0,
          ),
          status: rollingMomentumStatus,
          windowDays: asNumber(rollingMomentumData.windowDays, 14),
        }
      : undefined;

  return {
    availableOpportunities: asNumber(data.availableOpportunities, 0),
    bestStreak: asNumber(data.bestStreak, 0),
    creditedOpportunities,
    completedOpportunities: creditedOpportunities,
    currentStreak: asNumber(data.currentStreak, 0),
    label: asString(data.label, getMomentumLabel(status)),
    percentage,
    periodKey: asString(data.periodKey, 'current'),
    ...(rollingMomentum ? {rollingMomentum} : {}),
    skippedOpportunities,
    status,
    tapInOpportunities: asNumber(
      data.tapInOpportunities,
      Math.max(creditedOpportunities - skippedOpportunities, 0),
    ),
  };
}

export function subscribeToMomentumSummary({
  onError,
  onSummary,
  uid,
}: {
  onError?: (error: Error) => void;
  onSummary: (summary?: MomentumSummary) => void;
  uid: string;
}) {
  return firebaseFirestore()
    .collection('userPrivate')
    .doc(uid)
    .collection('momentum')
    .doc('current')
    .onSnapshot(
      snapshot => onSummary(mapMomentumSummarySnapshot(snapshot)),
      error => onError?.(error),
    );
}
