import AsyncStorage from '@react-native-async-storage/async-storage';
import {create} from 'zustand';
import {createJSONStorage, persist} from 'zustand/middleware';

type SessionState = {
  isAuthenticated: boolean;
  previewMode: boolean;
  enterPreview: () => void;
  signIn: () => void;
  signOut: () => void;
  setAuthenticated: (value: boolean) => void;
  setPreviewMode: (value: boolean) => void;
};

// The initial scaffold opens directly into the signed-in shell so the design
// system and tab architecture are easy to review before auth is wired up.
export const useSessionStore = create<SessionState>()(
  persist(
    set => ({
      isAuthenticated: true,
      previewMode: true,
      enterPreview: () => set({isAuthenticated: false, previewMode: true}),
      signIn: () => set({isAuthenticated: true, previewMode: false}),
      signOut: () => set({isAuthenticated: false, previewMode: false}),
      setAuthenticated: value =>
        set(state => ({
          isAuthenticated: value,
          previewMode: value ? false : state.previewMode,
        })),
      setPreviewMode: value =>
        set(state => ({
          previewMode: value,
          isAuthenticated: value ? false : state.isAuthenticated,
        })),
    }),
    {
      name: 'hoyst-session',
      partialize: state => ({
        isAuthenticated: state.isAuthenticated,
        previewMode: state.previewMode,
      }),
      storage: createJSONStorage(() => AsyncStorage),
    },
  ),
);
