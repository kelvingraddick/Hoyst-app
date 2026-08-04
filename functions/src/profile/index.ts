import {HttpsError, onCall} from 'firebase-functions/v2/https';

import {db} from '../firebase';
import {calculatePersonalMetricsForUser, type PersonalMetrics} from './summary';

export type ProfileSummary = PersonalMetrics;
export {
  calculatePersonalMetricsForUser,
  getPersonalStreakTransition,
  summarizeActiveCircleModes,
  summarizeProfileCheckIns,
} from './summary';

async function requireCompletedProfile(uid?: string) {
  if (!uid) {
    throw new HttpsError('unauthenticated', 'Sign in is required.');
  }

  const snapshot = await db.collection('users').doc(uid).get();
  const profile = snapshot.data();

  if (!profile || profile.onboardingStatus !== 'complete') {
    throw new HttpsError('failed-precondition', 'Complete your profile first.');
  }

  return {profile, uid};
}

export const getProfileSummary = onCall(async request => {
  const {profile, uid} = await requireCompletedProfile(request.auth?.uid);

  return calculatePersonalMetricsForUser({profile, uid});
});
