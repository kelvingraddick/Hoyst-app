import type {SetupJourney} from './setup-journey';

/** Keep interrupted setup private to its account while retaining a resumable copy. */
export function claimSetupJourney(
  records: Record<string, SetupJourney>,
  key: string,
  uid: string | undefined,
  initial: SetupJourney,
): Record<string, SetupJourney> {
  const previous = records[key];
  const differentOwner = previous?.ownerUid && previous.ownerUid !== uid;
  const next = {...records};
  if (differentOwner) {
    next[`account:${previous.ownerUid}:${key}`] = {
      ...previous,
      // An old request may have reached the server. Retry its original ID safely.
      ...(previous.status === 'saving'
        ? {status: 'error' as const, step: 'saveError' as const}
        : {}),
    };
  }
  const archivedKey = uid ? `account:${uid}:${key}` : undefined;
  const archived = archivedKey ? next[archivedKey] : undefined;
  const resumable =
    previous && !previous.completed && !differentOwner
      ? previous
      : archived && !archived.completed && archived.ownerUid === uid
      ? archived
      : initial;
  next[key] = {
    ...resumable,
    deferred: false,
    ...(uid ? {ownerUid: uid} : {}),
  };
  if (resumable === archived && archivedKey) delete next[archivedKey];
  return next;
}
