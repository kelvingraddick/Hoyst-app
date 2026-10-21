jest.mock('@react-native-firebase/firestore', () => jest.fn());

import {getPendingCircleJoinRequests} from '../src/features/circles/services/join-request-selectors';
import {firebaseFirestore} from '../src/lib/firebase/firestore';
import {subscribeToMemberCircleDetail} from '../src/features/home/services/home-data-service';

function setup() {
  let circleSnapshot: (snapshot: unknown) => void = () => undefined;
  let memberSnapshot: (snapshot: unknown) => void = () => undefined;
  const unsubscribe = jest.fn();
  const memberRef = {
    onSnapshot: jest.fn(callback => {
      memberSnapshot = callback;
      return unsubscribe;
    }),
  };
  const circleRef = {
    onSnapshot: jest.fn(callback => {
      circleSnapshot = callback;
      return unsubscribe;
    }),
    collection: jest.fn(() => ({doc: jest.fn(() => memberRef)})),
  };
  jest.mocked(firebaseFirestore).mockReturnValue({
    collection: (name: string) => ({
      doc: () =>
        name === 'circles' ? circleRef : {onSnapshot: () => jest.fn()},
    }),
  } as never);
  const onDetail = jest.fn();
  const stop = subscribeToMemberCircleDetail({
    circleId: 'circle-1',
    uid: 'user-1',
    timezone: 'UTC',
    onDetail,
    onError: jest.fn(),
  });
  const circle = (exists = true) =>
    circleSnapshot({
      data: () =>
        exists
          ? {
              title: 'Test circle',
              category: 'Fitness',
              commitment: 'Move',
              privacy: 'private',
            }
          : undefined,
    });
  const membership = (exists = true) =>
    memberSnapshot({
      data: () =>
        exists ? {uid: 'user-1', status: 'pending', role: 'member'} : undefined,
    });
  return {onDetail, circle, membership, stop, unsubscribe};
}

describe('Circle Detail initial snapshot resolution', () => {
  it('waits for membership when the circle arrives first', () => {
    const {circle, membership, onDetail, stop} = setup();
    circle();
    expect(onDetail).not.toHaveBeenCalled();
    membership();
    expect(onDetail).toHaveBeenCalledWith(
      expect.objectContaining({id: 'circle-1'}),
    );
    stop();
  });

  it('waits for the circle when membership arrives first', () => {
    const {circle, membership, onDetail, stop} = setup();
    membership();
    expect(onDetail).not.toHaveBeenCalled();
    circle();
    expect(onDetail).toHaveBeenCalledWith(
      expect.objectContaining({id: 'circle-1'}),
    );
    stop();
  });

  it('resolves a missing circle after both snapshots', () => {
    const {circle, membership, onDetail, stop} = setup();
    circle(false);
    expect(onDetail).not.toHaveBeenCalled();
    membership();
    expect(onDetail).toHaveBeenCalledWith(undefined);
    stop();
  });

  it('resolves missing membership only after both snapshots', () => {
    const {circle, membership, onDetail, stop, unsubscribe} = setup();
    membership(false);
    expect(onDetail).not.toHaveBeenCalled();
    circle();
    expect(onDetail).toHaveBeenCalledWith(undefined);
    stop();
    expect(unsubscribe).toHaveBeenCalledTimes(2);
  });
});

it.each(['user-1', 'user-2'])(
  'keeps joined Circle data when profile %s is unreadable',
  failedUid => {
    let circleSnapshot: (snapshot: unknown) => void = () => undefined;
    let membershipSnapshot: (snapshot: unknown) => void = () => undefined;
    let membersSnapshot: (snapshot: unknown) => void = () => undefined;
    const profileErrors = new Map<string, (error: Error) => void>();
    const auxiliaryRef: {
      collection: () => typeof auxiliaryRef;
      doc: () => typeof auxiliaryRef;
      onSnapshot: () => () => void;
    } = {
      collection: jest.fn(() => auxiliaryRef),
      doc: jest.fn(() => auxiliaryRef),
      onSnapshot: jest.fn(() => jest.fn()),
    };
    const membersRef = {
      onSnapshot: (next: typeof membersSnapshot) => {
        membersSnapshot = next;
        return jest.fn();
      },
      doc: jest.fn(() => ({
        onSnapshot: (next: typeof membershipSnapshot) => {
          membershipSnapshot = next;
          return jest.fn();
        },
      })),
    };
    const circleRef = {
      onSnapshot: (next: typeof circleSnapshot) => {
        circleSnapshot = next;
        return jest.fn();
      },
      collection: (name: string) =>
        name === 'members' ? membersRef : auxiliaryRef,
    };
    jest.mocked(firebaseFirestore).mockReturnValue({
      collection: (name: string) => ({
        doc: (id: string) =>
          name === 'circles'
            ? circleRef
            : {
                onSnapshot: (_next: unknown, error: (error: Error) => void) => {
                  profileErrors.set(id, error);
                  return jest.fn();
                },
              },
      }),
    } as never);
    const onDetail = jest.fn();
    const onError = jest.fn();
    const stop = subscribeToMemberCircleDetail({
      circleId: 'circle-1',
      uid: 'user-1',
      timezone: 'UTC',
      onDetail,
      onError,
    });
    circleSnapshot({
      data: () => ({
        title: 'Joined Circle',
        commitment: 'Move',
        commitmentCadence: 'daily',
      }),
    });
    membershipSnapshot({
      data: () => ({
        uid: 'user-1',
        status: 'active',
        role: 'owner',
        displayName: 'Alex',
      }),
    });
    membersSnapshot({
      docs: [
        {
          id: 'user-1',
          data: () => ({
            uid: 'user-1',
            status: 'active',
            role: 'member',
            displayName: 'Alex',
          }),
        },
        {
          id: 'user-2',
          data: () => ({
            uid: 'user-2',
            status: 'active',
            role: 'member',
            displayName: 'Sam',
          }),
        },
      ],
    });
    expect(onDetail).toHaveBeenLastCalledWith(
      expect.objectContaining({viewerMembershipStatus: 'active'}),
    );

    profileErrors.get(failedUid)!(
      new Error('Missing or insufficient permissions'),
    );

    expect(onError).not.toHaveBeenCalled();
    expect(onDetail).toHaveBeenLastCalledWith(
      expect.objectContaining({
        viewerMembershipStatus: 'active',
        members: [
          expect.objectContaining({id: 'user-1', name: 'Alex'}),
          expect.objectContaining({id: 'user-2', name: 'Sam'}),
        ],
      }),
    );
    const owner = {uid: 'user-1', status: 'active', role: 'owner', displayName: 'Alex'};
    const pending = {uid: 'requester', status: 'pending', role: 'member', displayName: 'Jordan'};
    membersSnapshot({docs: [owner, pending].map(data => ({id: data.uid, data: () => data}))});
    expect(getPendingCircleJoinRequests(onDetail.mock.calls.at(-1)?.[0])).toHaveLength(1);
    membersSnapshot({docs: [owner, {...pending, status: 'active'}].map(data => ({id: data.uid, data: () => data}))});
    expect(getPendingCircleJoinRequests(onDetail.mock.calls.at(-1)?.[0])).toHaveLength(0);
    stop();
  },
);
