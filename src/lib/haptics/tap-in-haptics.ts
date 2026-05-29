import RNHapticFeedback from 'react-native-haptic-feedback';

const hapticOptions = {
  enableVibrateFallback: true,
  ignoreAndroidSystemSettings: false,
};

function triggerHaptic(
  type: Parameters<typeof RNHapticFeedback.trigger>[0],
): void {
  try {
    RNHapticFeedback.trigger(type, hapticOptions);
  } catch {
    // Haptics should never block Tap In actions.
  }
}

export function triggerTapInPressHaptic(): void {
  triggerHaptic('impactLight');
}

export function triggerTapInSuccessHaptic(): void {
  triggerHaptic('notificationSuccess');
}
