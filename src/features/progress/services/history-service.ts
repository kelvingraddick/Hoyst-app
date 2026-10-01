import {authenticatedCallable} from '../../../lib/firebase/authenticated-callable';
import {firebaseFirestore} from '../../../lib/firebase/firestore';
export type ProgressActivity = {
  id: string;
  circleId: string;
  dateKey: string;
  title: string;
  category: string;
  status:
    | 'completed'
    | 'partial'
    | 'failed'
    | 'skipped'
    | 'restored'
    | 'missed';
  description: string;
  note?: string;
  photoUrl?: string;
  cadence?: string;
  periodKey?: string;
  occurredAt?: string;
  sortKey: string;
};
export type ProgressDay = {
  dateKey: string;
  status: 'success' | 'partial' | 'protected' | 'none';
  tapIns: number;
  activityCount: number;
};
export type ProgressMonth = {
  monthKey: string;
  timezone: string;
  todayDateKey: string;
  days: ProgressDay[];
  tapIns: number;
  activeDays: number;
};
export type ProgressActivityPage = {
  dateKey: string;
  timezone: string;
  entries: ProgressActivity[];
  nextCursor: string | null;
};
export const getProgressMonth = (monthKey: string) =>
  authenticatedCallable<ProgressMonth>('getProgressMonth', {monthKey});
export const getProgressDayActivity = (dateKey: string, cursor?: string) =>
  authenticatedCallable<ProgressActivityPage>('getProgressDayActivity', {
    dateKey,
    ...(cursor ? {cursor} : {}),
  });
export function subscribeHistoryChanges(uid: string, changed: () => void) {
  const store = firebaseFirestore();
  const stops = [
    store
      .collection('userPrivate')
      .doc(uid)
      .collection('opportunities')
      .onSnapshot(changed, () => undefined),
    store
      .collection('userPrivate')
      .doc(uid)
      .collection('progress')
      .doc('current')
      .onSnapshot(changed, () => undefined),
  ];
  return () => stops.forEach(stop => stop());
}
