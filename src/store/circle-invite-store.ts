import AsyncStorage from '@react-native-async-storage/async-storage';
import {create} from 'zustand';
import {createJSONStorage, persist} from 'zustand/middleware';

import type {
  CircleInviteJoinStatus,
  CircleInvitePreview,
  CircleInviteResolutionStatus,
} from '../features/circle-invites/types';

type CircleInviteState = {
  consented: boolean;
  errorMessage?: string;
  hasCheckedInitialUrl: boolean;
  hasHydrated: boolean;
  inviteCode?: string;
  joinStatus: CircleInviteJoinStatus;
  preview?: CircleInvitePreview;
  resolutionStatus: CircleInviteResolutionStatus;
  clearInvite: () => void;
  consentToJoin: () => void;
  finishHydration: () => void;
  markInitialUrlChecked: () => void;
  retryJoin: () => void;
  retryResolution: () => void;
  setInviteCode: (inviteCode: string) => void;
  setJoinError: (message: string) => void;
  setJoining: () => void;
  setPreviewFull: () => void;
  setResolutionError: (message: string) => void;
  setResolutionLoading: () => void;
  setResolutionUnavailable: () => void;
  setResolvedPreview: (
    inviteCode: string,
    preview: CircleInvitePreview,
  ) => void;
};

const initialInviteState = {
  consented: false,
  errorMessage: undefined as string | undefined,
  inviteCode: undefined as string | undefined,
  joinStatus: 'idle' as CircleInviteJoinStatus,
  preview: undefined as CircleInvitePreview | undefined,
  resolutionStatus: 'idle' as CircleInviteResolutionStatus,
};

export const useCircleInviteStore = create<CircleInviteState>()(
  persist(
    (set, get) => ({
      ...initialInviteState,
      hasCheckedInitialUrl: false,
      hasHydrated: false,
      clearInvite: () => set(initialInviteState),
      consentToJoin: () =>
        set({
          consented: true,
          errorMessage: undefined,
          joinStatus: 'idle',
        }),
      finishHydration: () =>
        set(state => ({
          hasHydrated: true,
          joinStatus: 'idle',
          resolutionStatus: state.preview ? 'ready' : 'idle',
        })),
      markInitialUrlChecked: () => set({hasCheckedInitialUrl: true}),
      retryJoin: () =>
        set({
          errorMessage: undefined,
          joinStatus: 'idle',
        }),
      retryResolution: () =>
        set({
          errorMessage: undefined,
          resolutionStatus: 'idle',
        }),
      setInviteCode: inviteCode => {
        if (get().inviteCode === inviteCode) {
          return;
        }

        set({
          ...initialInviteState,
          inviteCode,
        });
      },
      setJoinError: errorMessage =>
        set({
          errorMessage,
          joinStatus: 'error',
        }),
      setJoining: () =>
        set({
          errorMessage: undefined,
          joinStatus: 'joining',
        }),
      setPreviewFull: () =>
        set(state => ({
          errorMessage: 'This Circle is full.',
          joinStatus: 'error',
          preview: state.preview ? {...state.preview, isFull: true} : undefined,
        })),
      setResolutionError: errorMessage =>
        set({
          errorMessage,
          resolutionStatus: 'error',
        }),
      setResolutionLoading: () =>
        set({
          errorMessage: undefined,
          resolutionStatus: 'loading',
        }),
      setResolutionUnavailable: () =>
        set({
          errorMessage: undefined,
          preview: undefined,
          resolutionStatus: 'unavailable',
        }),
      setResolvedPreview: (inviteCode, preview) => {
        if (get().inviteCode !== inviteCode) {
          return;
        }

        set({
          errorMessage: undefined,
          preview,
          resolutionStatus: 'ready',
        });
      },
    }),
    {
      name: 'hoyst-circle-invite-v1',
      onRehydrateStorage: () => state => {
        state?.finishHydration();
      },
      partialize: state => ({
        consented: state.consented,
        inviteCode: state.inviteCode,
        preview: state.preview,
      }),
      storage: createJSONStorage(() => AsyncStorage),
      version: 1,
    },
  ),
);
