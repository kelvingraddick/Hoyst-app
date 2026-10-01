import {isDeepStrictEqual} from 'node:util';
import type {DocumentData} from 'firebase-admin/firestore';

/** Public discovery migrations must not replay ordinary Tap In side effects. */
export function isPublicationOnlyUpdate(
  before: DocumentData | undefined,
  after: DocumentData | undefined,
) {
  if (!before || !after) {
    return false;
  }
  const {publicTapIn: previousMarker, ...previousFields} = before;
  const {publicTapIn: nextMarker, ...nextFields} = after;
  return (
    !isDeepStrictEqual(previousMarker, nextMarker) &&
    isDeepStrictEqual(previousFields, nextFields)
  );
}
