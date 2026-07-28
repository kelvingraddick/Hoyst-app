import {useHoyFeedbackStore} from '../src/store/hoy-feedback-store';

const feedback = {
  circleId: 'circle-1',
  dateKey: '2026-07-28',
  uid: 'user-1',
};

describe('Hoy feedback store', () => {
  beforeEach(() => {
    useHoyFeedbackStore.setState({pendingTapInCelebration: undefined});
  });

  it('queues only the latest unconsumed celebration', () => {
    const {queueTapInCelebration} = useHoyFeedbackStore.getState();

    queueTapInCelebration(feedback);
    queueTapInCelebration({...feedback, circleId: 'circle-2'});

    expect(
      useHoyFeedbackStore.getState().pendingTapInCelebration,
    ).toEqual({...feedback, circleId: 'circle-2'});
  });

  it('consumes a matching celebration exactly once', () => {
    const {consumeTapInCelebration, queueTapInCelebration} =
      useHoyFeedbackStore.getState();

    queueTapInCelebration(feedback);

    expect(
      consumeTapInCelebration({
        dateKey: feedback.dateKey,
        uid: feedback.uid,
      }),
    ).toEqual(feedback);
    expect(
      consumeTapInCelebration({
        dateKey: feedback.dateKey,
        uid: feedback.uid,
      }),
    ).toBeUndefined();
  });

  it('clears feedback from another user or date', () => {
    const {clearStaleTapInCelebration, queueTapInCelebration} =
      useHoyFeedbackStore.getState();

    queueTapInCelebration(feedback);
    clearStaleTapInCelebration({
      dateKey: feedback.dateKey,
      uid: 'user-2',
    });

    expect(
      useHoyFeedbackStore.getState().pendingTapInCelebration,
    ).toBeUndefined();

    queueTapInCelebration(feedback);
    clearStaleTapInCelebration({
      dateKey: '2026-07-29',
      uid: feedback.uid,
    });

    expect(
      useHoyFeedbackStore.getState().pendingTapInCelebration,
    ).toBeUndefined();
  });
});
