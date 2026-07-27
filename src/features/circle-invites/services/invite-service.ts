import {firebaseFirestore} from '../../../lib/firebase/firestore';
import {firebaseFunctions} from '../../../lib/firebase/functions';
import {collections} from '../../../types/firestore';
import type {CircleMembershipStatus} from '../../../types/models';
import type {CircleInvitePreview} from '../types';

export async function resolveCircleInvite(inviteCode: string) {
  const callable = firebaseFunctions().httpsCallable('resolveCircleInvite');
  const result = await callable({inviteCode});
  return result.data as CircleInvitePreview;
}

export async function rotateCircleInvite(circleId: string) {
  const callable = firebaseFunctions().httpsCallable('rotateCircleInvite');
  const result = await callable({circleId});
  return result.data as {inviteCode: string; inviteUrl: string};
}

export function subscribeToInviteMembership({
  circleId,
  onStatus,
  uid,
}: {
  circleId: string;
  onStatus: (status?: CircleMembershipStatus) => void;
  uid: string;
}) {
  return firebaseFirestore()
    .collection(collections.circles)
    .doc(circleId)
    .collection('members')
    .doc(uid)
    .onSnapshot(
      snapshot => {
        const value = snapshot.data()?.status;
        onStatus(value === 'active' || value === 'pending' ? value : undefined);
      },
      () => onStatus(undefined),
    );
}
