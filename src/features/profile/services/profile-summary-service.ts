import {firebaseFunctions} from '../../../lib/firebase/functions';

export type ProfileSummary = {
  activeCircleCount: number;
  hasTappedInToday: boolean;
  personalStreakDays: number;
};

export async function getProfileSummary() {
  const callable = firebaseFunctions().httpsCallable('getProfileSummary');
  const result = await callable();

  return result.data as ProfileSummary;
}
