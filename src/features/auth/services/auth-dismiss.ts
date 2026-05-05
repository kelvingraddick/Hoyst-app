type ContinueAsGuestFromAuthInput = {
  clearPendingAction: () => void;
  dismissAuth: () => void;
  hasAuthenticatedUser: () => boolean;
  markOnboardingSeen: () => void;
  setGuest: () => void;
  signOut: () => Promise<unknown>;
};

export async function continueAsGuestFromAuth({
  clearPendingAction,
  dismissAuth,
  hasAuthenticatedUser,
  markOnboardingSeen,
  setGuest,
  signOut,
}: ContinueAsGuestFromAuthInput) {
  if (hasAuthenticatedUser()) {
    await signOut();
  }

  clearPendingAction();
  markOnboardingSeen();
  setGuest();
  dismissAuth();
}
