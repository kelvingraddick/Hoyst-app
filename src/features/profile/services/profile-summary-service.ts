import {firebaseFunctions} from '../../../lib/firebase/functions';

export type ProfileSummary = {
  activeCircleCount: number;
  activePersonalCommitmentCount: number;
  hasTappedInToday: boolean;
  longestStreakDays: number;
  personalStreakDays: number;
  totalTapIns: number;
};

export async function getProfileSummary() {
  const callable = firebaseFunctions().httpsCallable('getProfileSummary');
  const result = await callable();

  return result.data as ProfileSummary;
}
