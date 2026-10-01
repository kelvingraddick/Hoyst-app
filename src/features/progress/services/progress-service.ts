import {Share, Platform, NativeModules, type ShareContent} from 'react-native';
import {DateTime} from 'luxon';
import {authenticatedCallable} from '../../../lib/firebase/authenticated-callable';
import {firebaseAuth} from '../../../lib/firebase/auth';
import {firebaseFirestore} from '../../../lib/firebase/firestore';
export type ProgressTaskId =
  | 'profile'
  | 'commitment'
  | 'first_tap_in'
  | 'second_day'
  | 'circle'
  | 'share_invite'
  | 'reminders';
export type ProgressSummary = {
  totalXP: number;
  level: number;
  levelXP: number;
  requiredXP: number;
  remainingXP: number;
  inventory: {skips: number; restores: number};
  tasks: Partial<Record<ProgressTaskId, boolean>>;
  awardedTasks?: Partial<Record<ProgressTaskId, boolean>>;
  milestones: Record<string, boolean>;
  routineRemainingXP: number;
  window?: {closesAt: number; earned: number};
  flags: {
    earning: boolean;
    inventory: boolean;
    buying: boolean;
    restoring: boolean;
  };
};
export type RewardHistoryEntry = {
  id: string;
  reason: string;
  kind: string;
  xp: number;
  skips: number;
  restores: number;
  createdAt?: {toDate: () => Date};
};
export type RestoreOption = {
  slot: {
    id: string;
    circleId: string;
    expiresDateKey: string;
    periodKey: string;
    slotIndex: number;
  };
  title: string;
  currentStreak: number;
  resultingStreak: number;
  personalStreakBefore: number;
  personalStreakAfter: number;
};
const call = authenticatedCallable;
export const ensureProgress = () => call<ProgressSummary>('ensureProgress');
export const getRestoreOptions = () =>
  call<{options: RestoreOption[]; enabled: boolean; inventory: number}>(
    'getRestoreOptions',
  );
export const restoreStreak = (opportunityId: string, requestId: string) =>
  call<{restored: boolean}>('restoreStreak', {opportunityId, requestId});
export const syncProgressPurchases = () =>
  call<{
    delivered: number;
    verifiedTransactionIds: string[];
    summary: ProgressSummary;
  }>('syncProgressPurchases');
export function subscribeProgress(
  uid: string,
  receive: (data: Partial<ProgressSummary>) => void,
  error: (error: Error) => void,
) {
  return firebaseFirestore()
    .collection('userPrivate')
    .doc(uid)
    .collection('progress')
    .doc('current')
    .onSnapshot(snapshot => {
      if (snapshot.exists()) {
        const data = snapshot.data() as Partial<ProgressSummary> & {
          provenTasks?: ProgressSummary['tasks'];
        };
        receive({
          ...data,
          tasks: {...data.provenTasks, ...data.tasks},
          awardedTasks: data.tasks,
        });
      }
    }, error);
}
export function subscribeRewardHistory(
  uid: string,
  receive: (data: RewardHistoryEntry[]) => void,
  error: (error: Error) => void,
  limit = 100,
) {
  return firebaseFirestore()
    .collection('userPrivate')
    .doc(uid)
    .collection('progressLedger')
    .orderBy('createdAt', 'desc')
    .limit(limit)
    .onSnapshot(
      snapshot =>
        receive(
          snapshot.docs.map(
            doc => ({...doc.data(), id: doc.id} as RewardHistoryEntry),
          ),
        ),
      error,
    );
}
export async function shareCircleInvitation(
  circleId: string,
  content: ShareContent,
) {
  const sharingUid = firebaseAuth().currentUser?.uid;
  const nativeShare = NativeModules.HoystShareCompletion;
  const result =
    Platform.OS === 'android' && nativeShare
      ? ((await nativeShare.share(
          [content.message, 'url' in content ? content.url : undefined]
            .filter(Boolean)
            .join('\n'),
          content.title || 'Share Circle invitation',
        )) as {action: string})
      : await Share.share(content);
  // RN Android Share resolves when the sheet opens, so an older binary cannot prove completion.
  if (
    sharingUid &&
    firebaseAuth().currentUser?.uid === sharingUid &&
    result.action === Share.sharedAction &&
    (Platform.OS !== 'android' || nativeShare)
  ) {
    await call('completeProgressTask', {task: 'share_invite', circleId}).catch(
      () => undefined,
    );
  }
  return result;
}
export const PROGRESS_TASKS: Array<{
  id: ProgressTaskId;
  title: string;
  description: string;
  action: string;
}> = [
  {
    id: 'profile',
    title: 'Complete your profile',
    description: 'Make Hoyst feel like you.',
    action: 'Edit profile',
  },
  {
    id: 'commitment',
    title: 'Start a commitment',
    description: 'Create a commitment or join one.',
    action: 'Get started',
  },
  {
    id: 'first_tap_in',
    title: 'Complete your first Tap In',
    description: 'Show up for one open opportunity.',
    action: 'Tap In',
  },
  {
    id: 'second_day',
    title: 'Show up on a second day',
    description: 'Complete a successful Tap In on another day.',
    action: 'Tap In',
  },
  {
    id: 'circle',
    title: 'Join a Circle',
    description: 'Find a Circle that fits your goals.',
    action: 'Explore circles',
  },
  {
    id: 'share_invite',
    title: 'Invite someone to your Circle',
    description: 'Share a valid Circle invitation.',
    action: 'Your circles',
  },
  {
    id: 'reminders',
    title: 'Choose your reminders',
    description: 'Save your preference. Reminders off counts too.',
    action: 'Choose reminders',
  },
];

export function subscribeOpenRewardOpportunities(
  uid: string,
  receive: (ids: Set<string>) => void,
  error: (error: Error) => void,
) {
  return firebaseFirestore()
    .collection('userPrivate')
    .doc(uid)
    .collection('opportunities')
    .onSnapshot(snapshot => {
      const ids = new Set<string>();
      snapshot.docs.forEach(doc => {
        const slot = doc.data();
        const today = DateTime.now()
          .setZone(slot.timezone || 'UTC')
          .toISODate()!;
        if (
          slot.expectedForCircle !== false &&
          ['available', 'upcoming'].includes(slot.status) &&
          slot.availableDateKey <= today &&
          slot.expiresDateKey >= today
        )
          ids.add(slot.circleId);
      });
      receive(ids);
    }, error);
}
