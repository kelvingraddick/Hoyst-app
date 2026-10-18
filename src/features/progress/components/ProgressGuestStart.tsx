import React from 'react';
import {GuestStart} from '../../../design/components/GuestStart';

export function ProgressGuestStart({
  onGetStarted,
  onSignIn,
}: {
  onGetStarted: () => void;
  onSignIn: () => void;
}) {
  return (
    <GuestStart
      artwork={require('../../../assets/hoy/progress-rewards-get-started.png')}
      artworkTestID="progress-guest-get-started-artwork"
      compact
      description="Create a Circle, start tapping in, and watch your progress grow."
      primaryLabel="Start your commitment"
      onGetStarted={onGetStarted}
      onSignIn={onSignIn}
    />
  );
}
