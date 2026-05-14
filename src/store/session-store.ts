import {create} from 'zustand';

import type {TapInSource} from '../navigation/types';

export type AuthSessionStatus =
  | 'initializing'
  | 'guest'
  | 'authenticating'
  | 'authenticatedIncompleteProfile'
  | 'authenticatedReady';

export type AuthSessionUser = {
  uid: string;
  displayName?: string;
  email?: string;
  phoneNumber?: string;
  photoURL?: string;
  providerIds: string[];
};

export type PendingProtectedAction =
  | {type: 'createCircle'}
  | {type: 'joinCircle'; circleId: string}
  | {type: 'settings'}
  | {type: 'tapIn'; circleId: string; source: TapInSource}
  | {type: 'tapInPicker'};

type SessionState = {
  pendingAction?: PendingProtectedAction;
  status: AuthSessionStatus;
  user?: AuthSessionUser;
  beginAuthFlow: (pendingAction?: PendingProtectedAction) => void;
  clearPendingAction: () => void;
  consumePendingAction: () => PendingProtectedAction | undefined;
  setAuthenticatedIncompleteProfile: (user: AuthSessionUser) => void;
  setAuthenticatedReady: (user: AuthSessionUser) => void;
  setGuest: () => void;
  setInitializing: () => void;
  setPendingAction: (pendingAction?: PendingProtectedAction) => void;
};

export const useSessionStore = create<SessionState>((set, get) => ({
  pendingAction: undefined,
  status: 'initializing',
  user: undefined,
  beginAuthFlow: pendingAction =>
    set({
      pendingAction,
      status: 'authenticating',
    }),
  clearPendingAction: () => set({pendingAction: undefined}),
  consumePendingAction: () => {
    const pendingAction = get().pendingAction;
    set({pendingAction: undefined});
    return pendingAction;
  },
  setAuthenticatedIncompleteProfile: user =>
    set({status: 'authenticatedIncompleteProfile', user}),
  setAuthenticatedReady: user => set({status: 'authenticatedReady', user}),
  setGuest: () => set({status: 'guest', user: undefined}),
  setInitializing: () => set({status: 'initializing', user: undefined}),
  setPendingAction: pendingAction => set({pendingAction}),
}));
