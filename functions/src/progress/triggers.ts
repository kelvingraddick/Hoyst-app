import {onDocumentWritten} from 'firebase-functions/v2/firestore';
import {HttpsError} from 'firebase-functions/v2/https';
import {reconcileRestoreEffects} from './restores';
import {reconcileProgress} from './index';
import {recalculateMomentumSummaryForUser} from '../momentum';
import {isCoveredCheckInData} from '../shared/commitments';
async function reconcileEligible(
  uid: string,
  successful = false,
  sourceEventId?: string,
) {
  try {
    return await reconcileProgress(uid, successful, sourceEventId);
  } catch (error) {
    if (
      error instanceof HttpsError &&
      (error.code === 'failed-precondition' || error.code === 'unauthenticated')
    )
      return;
    throw error;
  }
}
export const reconcileProgressTapIn = onDocumentWritten(
  {document: 'circles/{circleId}/days/{dateKey}/checkIns/{uid}', retry: true},
  async event => {
    const before = event.data?.before.data(),
      after = event.data?.after.data();
    if (
      after?.uid !== event.params.uid ||
      after?.status !== 'done' ||
      !isCoveredCheckInData(after) ||
      (before?.status === 'done' && isCoveredCheckInData(before))
    )
      return;
    await recalculateMomentumSummaryForUser(event.params.uid);
    await reconcileEligible(event.params.uid, true, after.progressEventId);
  },
);
export const initializeProgressAccount = onDocumentWritten(
  {document: 'users/{uid}', retry: true},
  async event => {
    if (
      event.data?.after.data()?.onboardingStatus !== 'complete' ||
      event.data?.before.data()?.onboardingStatus === 'complete'
    )
      return;
    await reconcileEligible(event.params.uid);
  },
);
export const reconcileProgressMembership = onDocumentWritten(
  {document: 'circles/{circleId}/members/{uid}', retry: true},
  async event => {
    if (
      event.data?.after.data()?.status !== 'active' ||
      event.data?.before.data()?.status === 'active'
    )
      return;
    await reconcileEligible(event.params.uid);
  },
);
export const reconcileProgressReminders = onDocumentWritten(
  {document: 'userPrivate/{uid}', retry: true},
  async event => {
    const saved = event.data?.after
      .data()
      ?.reminderPreferenceSavedAt?.toMillis?.();
    if (
      !saved ||
      saved ===
        event.data?.before.data()?.reminderPreferenceSavedAt?.toMillis?.()
    )
      return;
    await reconcileEligible(event.params.uid);
  },
);

export const reconcileProgressRestore = onDocumentWritten(
  {document: 'circles/{circleId}/days/{dateKey}/checkIns/{uid}', retry: true},
  async event => {
    const before = event.data?.before.data(),
      after = event.data?.after.data();
    if (
      after?.protectionKind !== 'restore' ||
      before?.protectionKind === 'restore'
    )
      return;
    await reconcileRestoreEffects(
      event.params.uid,
      event.params.circleId,
      event.params.dateKey,
    );
  },
);
