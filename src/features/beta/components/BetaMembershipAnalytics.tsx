import {useEffect} from 'react';
import {useSessionStore} from '../../../store/session-store';
import {firebaseFirestore} from '../../../lib/firebase/firestore';
import {trackEventOnce} from '../../../lib/analytics';

// Observe the requester's actual active membership, including approvals while offline.
// Existing memberships from before instrumentation are not reported as new joins.
export function BetaMembershipAnalytics(): null {
  const uid = useSessionStore(state => state.user?.uid);
  const status = useSessionStore(state => state.status);
  useEffect(() => {
    if (!uid || status !== 'authenticatedReady') {
      return;
    }
    return firebaseFirestore()
      .collectionGroup('members')
      .where('uid', '==', uid)
      .onSnapshot(
        snapshot => {
          snapshot.docs.forEach(doc => {
            const data = doc.data();
            const joinedAt = data?.joinedAt?.toDate?.();
            const circleId = doc.ref.parent.parent?.id;
            if (
              circleId &&
              data?.status === 'active' &&
              data?.role !== 'owner' &&
              joinedAt instanceof Date &&
              joinedAt >= new Date('2026-10-21T00:00:00Z')
            ) {
              void trackEventOnce(
                'circle_joined',
                {mode: 'group'},
                `join:${uid}:${circleId}:active`,
                joinedAt,
              );
            }
          });
        },
        () => undefined,
      );
  }, [uid, status]);
  return null;
}
