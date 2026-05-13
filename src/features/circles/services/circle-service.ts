import {firebaseFunctions} from '../../../lib/firebase/functions';
import type {CircleJoinMode, CirclePrivacy, GraceRule} from '../../../types/models';

export type CreateCircleInput = {
  category: string;
  dailyTask: string;
  graceRules: {
    skip: GraceRule;
  };
  joinMode: CircleJoinMode;
  maxSize: number;
  privacy: CirclePrivacy;
  title: string;
  timezone?: string;
};

export async function createCircle(input: CreateCircleInput) {
  const callable = firebaseFunctions().httpsCallable('createCircle');
  const result = await callable(input);
  return result.data as {circleId: string; inviteCode?: string};
}

export async function joinCircle(circleId: string, inviteCode?: string) {
  const callable = firebaseFunctions().httpsCallable('joinCircle');
  const result = await callable({circleId, inviteCode});
  return result.data as {status: 'active' | 'pending'};
}

export async function deleteCircle(circleId: string) {
  const callable = firebaseFunctions().httpsCallable('deleteCircle');
  const result = await callable({circleId});
  return result.data as {deleted: true};
}
