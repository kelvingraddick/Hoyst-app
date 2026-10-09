import AsyncStorage from '@react-native-async-storage/async-storage';
import {create} from 'zustand';
import {createJSONStorage, persist} from 'zustand/middleware';
import {
  createSetupJourney,
  type SetupJourney,
} from '../features/create-circle/services/setup-journey';

type State = {
  hydrated: boolean;
  records: Record<string, SetupJourney>;
  ensure: (key: string, initial?: SetupJourney) => void;
  update: (
    key: string,
    update: Partial<SetupJourney> | ((current: SetupJourney) => SetupJourney),
  ) => void;
  discard: (key: string) => void;
};

export const useSetupJourneyStore = create<State>()(
  persist(
    (set, get) => ({
      hydrated: false,
      records: {},
      ensure: (key, initial) => {
        if (!get().records[key])
          set(state => ({
            records: {...state.records, [key]: initial ?? createSetupJourney()},
          }));
      },
      update: (key, update) =>
        set(state => {
          const current = state.records[key];
          // Only ensure can create a draft; late updates cannot revive a finished one.
          if (!current) {
            return state;
          }
          return {
            records: {
              ...state.records,
              [key]:
                typeof update === 'function'
                  ? update(current)
                  : {...current, ...update},
            },
          };
        }),
      discard: key =>
        set(state => {
          const records = {...state.records};
          delete records[key];
          return {records};
        }),
    }),
    {
      name: 'hoyst-setup-journeys-v1',
      version: 1,
      storage: createJSONStorage(() => AsyncStorage),
      partialize: state => ({records: state.records}),
      onRehydrateStorage: () => (_state, error) => {
        useSetupJourneyStore.setState(state => ({
          hydrated: true,
          records: error
            ? {}
            : Object.fromEntries(
                Object.entries(state.records)
                  .filter(([, record]) => !record.completed)
                  .map(([key, record]) => [
                    key,
                    {
                      ...record,
                      status:
                        record.status === 'saving' ? 'error' : record.status,
                      step:
                        record.status === 'saving' ? 'saveError' : record.step,
                    },
                  ]),
              ),
        }));
      },
    },
  ),
);
