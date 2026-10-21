import AsyncStorage from '@react-native-async-storage/async-storage';
import {create} from 'zustand';
import {createJSONStorage, persist} from 'zustand/middleware';
import {trackEventOnce, type AcquisitionSource} from '../../../lib/analytics';

type State = {
  hydrated: boolean;
  pendingUid?: string;
  answers: Record<string, AcquisitionSource | 'skipped'>;
  queue: (uid: string) => void;
  answer: (uid: string, source?: AcquisitionSource) => void;
};
export const useAcquisitionStore = create<State>()(
  persist(
    (set, get) => ({
      hydrated: false,
      answers: {},
      queue: uid => {
        if (!get().answers[uid]) {
          set({pendingUid: uid});
        }
      },
      answer: (uid, source) => {
        set(state => ({
          pendingUid: undefined,
          answers: {...state.answers, [uid]: source ?? 'skipped'},
        }));
        if (source) {
          void trackEventOnce(
            'acquisition_source_selected',
            {source},
            `source:${uid}`,
          );
        } else {
          void trackEventOnce(
            'acquisition_source_skipped',
            {},
            `source:${uid}`,
          );
        }
      },
    }),
    {
      name: 'hoyst-beta-acquisition-v1',
      storage: createJSONStorage(() => AsyncStorage),
      partialize: state => ({
        answers: state.answers,
        pendingUid: state.pendingUid,
      }),
      onRehydrateStorage: () => () =>
        useAcquisitionStore.setState({hydrated: true}),
    },
  ),
);
