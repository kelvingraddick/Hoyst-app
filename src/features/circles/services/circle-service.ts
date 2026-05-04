import {firebaseFunctions} from '../../../lib/firebase/functions';
import type {CircleJoinMode, CirclePrivacy} from '../../../types/models';

export type CreateCircleInput = {
  category: string;
  dailyTask: string;
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

