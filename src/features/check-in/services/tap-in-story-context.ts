import {firebaseFirestore} from '../../../lib/firebase/firestore';
import {
  circleDateKey,
  circlePeriodForDate,
  type CircleProgressResult,
  type CircleProgressSummary,
} from '../../../shared/circle-progress';
import type {RootStackParamList} from '../../../navigation/types';
import type {CheckInCoverageStatus, CheckInStatus} from '../../../types/models';
import {refreshCircleProgress} from '../../circles/services/circle-progress-service';

export type TapInStoryMoment = {
  dateKey: string;
  status?: Exclude<CheckInStatus, 'rest'>;
  coverageStatus?: CheckInCoverageStatus;
  currentValue?: number;
  minimumValue?: number;
  maximumValue?: number;
  targetValue?: number;
  unitLabel?: string;
};

export type TapInStoryContext = {
  progress?: CircleProgressResult;
  tapIn: TapInStoryMoment;
};

type StoryParams = RootStackParamList['TapInStoryShare'];
type Entry = Partial<TapInStoryMoment>;

// Reads must finish even if the device goes offline while the preview opens.
async function bounded<T>(request: Promise<T>): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      request,
      new Promise<never>((_, reject) => {
        timer = setTimeout(
          () => reject(new Error('Share context timed out')),
          10000,
        );
      }),
    ]);
  } finally {
    clearTimeout(timer);
  }
}

function currentSummary(
  value: CircleProgressSummary | undefined,
  today: string,
  cadence?: StoryParams['commitmentCadence'],
) {
  if (!value || (cadence && value.cadence !== cadence)) {
    return undefined;
  }
  const period = circlePeriodForDate(today, value.cadence);
  return value.asOfDateKey === today &&
    value.period.key === period.key &&
    value.period.start === period.start &&
    value.period.end === period.end
    ? value
    : undefined;
}

function progressSnapshot(
  params: StoryParams,
  fresh?: CircleProgressResult,
  now = new Date(),
) {
  const today = circleDateKey(params.timezone ?? 'UTC', now);
  const pick = (kind: 'viewer' | 'group') =>
    currentSummary(fresh?.[kind], today, params.commitmentCadence) ??
    currentSummary(
      params.circleProgress?.[kind],
      today,
      params.commitmentCadence,
    );
  return {viewer: pick('viewer'), group: pick('group')};
}

export function unavailableTapInStoryContext(
  params: StoryParams,
  now = new Date(),
): TapInStoryContext {
  return {
    progress: progressSnapshot(params, undefined, now),
    tapIn: params,
  };
}

export async function loadTapInStoryContext(
  params: StoryParams,
  uid?: string,
  now = new Date(),
): Promise<TapInStoryContext> {
  const fallback = unavailableTapInStoryContext(params, now);
  if (!uid) {
    return fallback;
  }
  const ref = firebaseFirestore().collection('circles').doc(params.circleId);
  const [progress, entry] = await Promise.all([
    bounded(refreshCircleProgress(params.circleId)).catch(() => undefined),
    bounded(
      ref
        .collection('days')
        .doc(params.dateKey)
        .collection('checkIns')
        .doc(uid)
        .get({source: 'server'}),
    )
      .then(snapshot => ({data: snapshot.data() as Entry | undefined}))
      .catch(() => undefined),
  ]);
  const tapIn: TapInStoryMoment = entry
    ? {
        // A deleted entry must not reappear from the navigation fallback.
        ...(entry.data
          ? {
              ...params,
              ...entry.data,
              status: entry.data.status,
              coverageStatus: entry.data.coverageStatus,
              currentValue: entry.data.currentValue,
            }
          : {}),
        dateKey: params.dateKey,
      }
    : params;
  return {progress: progressSnapshot(params, progress, now), tapIn};
}
