import {
  activityEpoch,
  canPublishNewTapIn,
  matchesWords,
  publicPreview,
  searchTokens,
  searchWords,
  validCandidate,
} from '../functions/src/discovery/model';
const circle = {
  privacy: 'public',
  circleMode: 'group',
  lifecycleStatus: 'active',
  createdAt: 10,
};
const marker = {eventId: 'new', occurredAt: 120, epoch: 10};
const valid = {
  candidate: {...marker, uid: 'ava', dateKey: '2026-09-26'},
  circle,
  checkIn: {status: 'done', publicTapIn: marker},
  member: {status: 'active', joinedAt: 20},
  profile: {displayName: 'Ava'},
};

it('normalizes words and matches each prefix across title, category and commitment', () => {
  const tokens = searchTokens({
    title: 'Café Builders',
    category: 'Deep Work',
    commitment: 'One focused hour',
  });
  expect(searchWords('CAFÉ, deep')).toEqual(['cafe', 'deep']);
  expect(matchesWords(tokens, ['cafe', 'foc', 'work'])).toBe(true);
  expect(matchesWords(tokens, ['builders', 'sleep'])).toBe(false);
  expect(matchesWords(tokens, ['uild'])).toBe(false);
});
it('publishes only a new successful done transition after activation in a public group', () => {
  const input = {circle, nextStatus: 'done', activatedAt: 100, now: 120};
  expect(canPublishNewTapIn(input)).toBe(true);
  expect(canPublishNewTapIn({...input, before: {status: 'partial'}})).toBe(
    true,
  );
  expect(canPublishNewTapIn({...input, before: {status: 'done'}})).toBe(false);
  expect(canPublishNewTapIn({...input, activatedAt: undefined})).toBe(false);
  expect(canPublishNewTapIn({...input, now: 90})).toBe(false);
  expect(canPublishNewTapIn({...input, nextStatus: 'skip'})).toBe(false);
  expect(
    canPublishNewTapIn({...input, circle: {...circle, privacy: 'private'}}),
  ).toBe(false);
  expect(
    canPublishNewTapIn({
      ...input,
      circle: {...circle, lifecycleStatus: 'archived'},
    }),
  ).toBe(false);
  expect(
    canPublishNewTapIn({...input, circle: {...circle, circleMode: 'personal'}}),
  ).toBe(false);
});
it('withdraws candidates after removal, departure, account deletion or privacy epoch changes', () => {
  expect(validCandidate(valid)).toBe(true);
  expect(validCandidate({...valid, checkIn: undefined})).toBe(false);
  expect(
    validCandidate({
      ...valid,
      checkIn: {...valid.checkIn, deletionReason: 'account'},
    }),
  ).toBe(false);
  expect(validCandidate({...valid, member: {status: 'inactive'}})).toBe(false);
  expect(
    validCandidate({...valid, member: {status: 'active', joinedAt: 130}}),
  ).toBe(false);
  expect(validCandidate({...valid, profile: undefined})).toBe(false);
  expect(
    validCandidate({...valid, circle: {...circle, publicActivityEpoch: 125}}),
  ).toBe(false);
  expect(activityEpoch({...circle, publicActivityEpoch: 125})).toBe(125);
});
it('allows only member identity and timestamp into the public DTO', () => {
  expect(
    publicPreview(
      {...valid.candidate, note: 'secret', photoUrl: 'private'},
      {displayName: 'Ava', avatarUrl: 'profile', bio: 'secret'},
    ),
  ).toEqual({
    eventId: 'new',
    uid: 'ava',
    displayName: 'Ava',
    avatarUrl: 'profile',
    occurredAt: '1970-01-01T00:00:00.120Z',
  });
});
