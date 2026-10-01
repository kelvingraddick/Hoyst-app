jest.mock('@react-native-firebase/firestore', () => jest.fn());

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
