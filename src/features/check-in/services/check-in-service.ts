import {firebaseFunctions} from '../../../lib/firebase/functions';

export type SubmitTapInInput = {
  circleId: string;
  note?: string;
  photoUrl?: string;
};

export async function submitTapIn(input: SubmitTapInInput) {
  const callable = firebaseFunctions().httpsCallable('submitTapIn');
  const result = await callable(input);
  return result.data as {checkInId: string; dateKey: string};
}

