type ContinueAsGuestFromAuthInput = {
  clearPendingAction: () => void;
  hasAuthenticatedUser: () => boolean;
  markOnboardingSeen: () => void;
  navigateToMainTabs: () => void;
  setGuest: () => void;
  signOut: () => Promise<unknown>;
};

export async function continueAsGuestFromAuth({
  clearPendingAction,
  hasAuthenticatedUser,
  markOnboardingSeen,
  navigateToMainTabs,
  setGuest,
  signOut,
}: ContinueAsGuestFromAuthInput) {
  if (hasAuthenticatedUser()) {
    await signOut();
  }

  clearPendingAction();
  markOnboardingSeen();
  setGuest();
  navigateToMainTabs();
}
