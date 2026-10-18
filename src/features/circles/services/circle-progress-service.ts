import {firebaseFirestore} from '../../../lib/firebase/firestore';
import {
  readCircleProgress,
  type CircleDayCoverage,
  type CircleProgressResult,
  type CircleProgressSummary,
} from '../../../shared/circle-progress';

export const refreshCircleProgress = async (circleId: string) =>
  (
    await import('../../../lib/firebase/authenticated-callable')
  ).authenticatedCallable<CircleProgressResult>('refreshCircleProgress', {
    circleId,
  });

export function subscribeCircleProgress(
  circleId: string,
  uid: string,
  receive: (value?: CircleProgressSummary) => void,
  error: (error: Error) => void,
) {
  return firebaseFirestore()
    .collection('userPrivate')
    .doc(uid)
    .collection('circleProgress')
    .doc(circleId)
    .onSnapshot(
      snapshot => receive(readCircleProgress(snapshot.data())),
      error,
    );
}

export function subscribeCircleDailyCoverage(
  circleId: string,
  dates: string[],
  receive: (value: Map<string, CircleDayCoverage>) => void,
) {
  const values = new Map<string, CircleDayCoverage>();
  const unsubscribes = dates.map(day =>
    firebaseFirestore()
      .collection('circles')
      .doc(circleId)
      .collection('days')
      .doc(day)
      .onSnapshot(
        snapshot => {
          const coverage = snapshot.data()?.activityCoverage as
            | CircleDayCoverage
            | undefined;
          if (coverage) {
            values.set(day, coverage);
          } else {
            values.delete(day);
          }
          receive(new Map(values));
        },
        () => {
          values.delete(day);
          receive(new Map(values));
        },
      ),
  );
  return () => unsubscribes.forEach(unsubscribe => unsubscribe());
}

export async function loadCircleDayDetails(circleId: string, day: string) {
  const snapshot = await firebaseFirestore()
    .collection('circles')
    .doc(circleId)
    .collection('days')
    .doc(day)
    .collection('checkIns')
    .get();
  return snapshot.docs.map(doc => ({id: doc.id, ...doc.data()})) as Array<{
    id: string;
    displayName?: string;
    status?: string;
    protectionKind?: string;
  }>;
}

export {readCircleProgress} from '../../../shared/circle-progress';
