import {create} from 'zustand';

export type PendingHoyTapInCelebration = {
  circleId: string;
  dateKey: string;
  uid: string;
};

type HoyFeedbackScope = Pick<PendingHoyTapInCelebration, 'dateKey' | 'uid'>;

type HoyFeedbackState = {
  pendingTapInCelebration?: PendingHoyTapInCelebration;
  clearStaleTapInCelebration: (scope: HoyFeedbackScope) => void;
  consumeTapInCelebration: (
    scope: HoyFeedbackScope,
  ) => PendingHoyTapInCelebration | undefined;
  queueTapInCelebration: (feedback: PendingHoyTapInCelebration) => void;
};

function matchesScope(
  feedback: PendingHoyTapInCelebration,
  scope: HoyFeedbackScope,
) {
  return feedback.dateKey === scope.dateKey && feedback.uid === scope.uid;
}

export const useHoyFeedbackStore = create<HoyFeedbackState>((set, get) => ({
  pendingTapInCelebration: undefined,
  clearStaleTapInCelebration: scope =>
    set(state => {
      if (
        !state.pendingTapInCelebration ||
        matchesScope(state.pendingTapInCelebration, scope)
      ) {
        return state;
      }

      return {pendingTapInCelebration: undefined};
    }),
  consumeTapInCelebration: scope => {
    const feedback = get().pendingTapInCelebration;

    if (!feedback || !matchesScope(feedback, scope)) {
      return undefined;
    }

    set({pendingTapInCelebration: undefined});
    return feedback;
  },
  queueTapInCelebration: feedback =>
    set({pendingTapInCelebration: feedback}),
}));
