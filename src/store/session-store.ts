import {create} from 'zustand';

type SessionState = {
  isAuthenticated: boolean;
  previewMode: boolean;
  setAuthenticated: (value: boolean) => void;
  setPreviewMode: (value: boolean) => void;
};

// The initial scaffold opens directly into the signed-in shell so the design
// system and tab architecture are easy to review before auth is wired up.
export const useSessionStore = create<SessionState>(set => ({
  isAuthenticated: true,
  previewMode: true,
  setAuthenticated: value => set({isAuthenticated: value}),
  setPreviewMode: value => set({previewMode: value}),
}));
