import {
  legacyCircleActivityEventTypes,
  legacyCircleActivityFeedCategory,
  type InboxEvent,
  type InboxEventType,
} from '../../types/models';

export {legacyCircleActivityEventTypes} from '../../types/models';

export const circleActivityEventTypes: ReadonlySet<InboxEventType> = new Set([
  'circle_complete',
  ...Object.values(legacyCircleActivityEventTypes),
  'member_joined',
  'nudge',
]);

const legacyMemberCopyEventTypes: ReadonlySet<InboxEventType> = new Set([
  ...Object.values(legacyCircleActivityEventTypes),
  'circle_nudge_prompt',
]);

export function isCircleActivityEvent(event: InboxEvent, viewerUid?: string) {
  if (event.actor?.uid && event.actor.uid === viewerUid) {
    return false;
  }

  return (
    event.feedCategory === legacyCircleActivityFeedCategory ||
    circleActivityEventTypes.has(event.type)
  );
}

export function normalizeLegacyMemberCopy(
  value: string,
  type: InboxEventType,
) {
  if (!legacyMemberCopyEventTypes.has(type)) {
    return value;
  }

  return value.replace(/\bcompanions?\b/gi, match => {
    const isPlural = match.toLowerCase().endsWith('s');
    const replacement = isPlural ? 'Members' : 'Member';

    if (match === match.toUpperCase()) {
      return replacement.toUpperCase();
    }

    return replacement;
  });
}
