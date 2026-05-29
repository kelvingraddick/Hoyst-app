import RNHapticFeedback from 'react-native-haptic-feedback';

import {
  triggerTapInPressHaptic,
  triggerTapInSuccessHaptic,
} from '../src/lib/haptics/tap-in-haptics';

jest.mock('react-native-haptic-feedback', () => ({
  trigger: jest.fn(),
}));

describe('Tap In haptics', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('uses light impact feedback for Tap In press interactions', () => {
    triggerTapInPressHaptic();

    expect(RNHapticFeedback.trigger).toHaveBeenCalledWith('impactLight', {
      enableVibrateFallback: true,
      ignoreAndroidSystemSettings: false,
    });
  });

  it('uses success feedback after a confirmed Tap In', () => {
    triggerTapInSuccessHaptic();

    expect(RNHapticFeedback.trigger).toHaveBeenCalledWith(
      'notificationSuccess',
      {
        enableVibrateFallback: true,
        ignoreAndroidSystemSettings: false,
      },
    );
  });
});
