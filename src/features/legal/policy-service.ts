import {firebaseAuth} from '../../lib/firebase/auth';
import {firebaseFirestore} from '../../lib/firebase/firestore';
import {authenticatedCallable} from '../../lib/firebase/authenticated-callable';
import {legalAcknowledgment, hasCurrentLegalAcceptance} from './policy';

export function acceptLegalTerms(expectedUid?: string) {
  if (expectedUid && firebaseAuth().currentUser?.uid !== expectedUid)
    return Promise.reject(new Error('Your account changed. Please try again.'));
  return authenticatedCallable<{accepted: true}>(
    'acceptLegalTerms',
    legalAcknowledgment,
  );
}
export function subscribeToLegalAcceptance(
  uid: string,
  onValue: (accepted: boolean) => void,
  onError: (error: Error) => void,
) {
  return firebaseFirestore()
    .collection('userPrivate')
    .doc(uid)
    .onSnapshot(
      snapshot =>
        onValue(hasCurrentLegalAcceptance(snapshot.data()?.legalAcceptance)),
      onError,
    );
}
