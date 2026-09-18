import type {
  CircleMemberStatus,
  CircleSummary,
  CommitmentPace,
} from '../../types/models';

type CycleProgressPresentationOptions = {
  cadence?: CommitmentPace;
  eligibleMemberCount: number;
  goalMetMemberCount: number;
  isPersonal: boolean;
};

type CircleCycleProgressSource = Pick<
  CircleSummary,
  'circleMode' | 'commitmentCadence' | 'members'
>;

function normalizeCount(value: number) {
  return Number.isFinite(value) ? Math.max(0, Math.round(value)) : 0;
}

function getPeriodSuffix(cadence: CommitmentPace) {
  if (cadence === 'daily') {
    return 'today';
  }
  return cadence === 'monthly' ? 'this month' : 'this week';
}

export function getCycleProgressPresentation(
  options: CycleProgressPresentationOptions,
) {
  const {
    cadence = 'weekly',
    eligibleMemberCount,
    goalMetMemberCount,
    isPersonal,
  } = options;
  const normalizedEligibleMemberCount = normalizeCount(eligibleMemberCount);
  const normalizedGoalMetMemberCount = Math.min(
    normalizeCount(goalMetMemberCount),
    normalizedEligibleMemberCount,
  );
  const percent =
    normalizedEligibleMemberCount > 0
      ? Math.max(
          0,
          Math.min(
            100,
            Math.round(
              (normalizedGoalMetMemberCount / normalizedEligibleMemberCount) *
                100,
            ),
          ),
        )
      : 0;
  const periodSuffix = getPeriodSuffix(cadence);
  const detailLabel = isPersonal
    ? `Goal ${
        normalizedGoalMetMemberCount > 0 ? 'met' : 'not met'
      } ${periodSuffix}`
    : `${normalizedGoalMetMemberCount}/${normalizedEligibleMemberCount} member${
        normalizedEligibleMemberCount === 1 ? '' : 's'
      } met goal ${periodSuffix}`;

  return {
    detailLabel,
    eligibleMemberCount: normalizedEligibleMemberCount,
    goalMetMemberCount: normalizedGoalMetMemberCount,
    listLabel: detailLabel,
    percent,
  };
}

function hasMetCycleGoal(member: CircleMemberStatus, cadence: CommitmentPace) {
  if (member.cycleGoalMet !== undefined) {
    return member.cycleGoalMet;
  }

  if (
    typeof member.cycleCoveredCount === 'number' &&
    typeof member.cycleRequiredCount === 'number' &&
    member.cycleRequiredCount > 0
  ) {
    return member.cycleCoveredCount >= member.cycleRequiredCount;
  }

  return (
    member.state === 'done' ||
    (cadence === 'daily' && member.state === 'skipped')
  );
}

export function getCircleCycleProgressPresentation(
  circle: CircleCycleProgressSource,
) {
  const cadence = circle.commitmentCadence ?? 'weekly';
  const eligibleMembers = circle.members.filter(
    member => member.membershipStatus !== 'pending',
  );

  return getCycleProgressPresentation({
    cadence,
    eligibleMemberCount: eligibleMembers.length,
    goalMetMemberCount: eligibleMembers.filter(member =>
      hasMetCycleGoal(member, cadence),
    ).length,
    isPersonal: circle.circleMode === 'personal',
  });
}
