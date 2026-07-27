import {getModeAwareSetupCopy} from '../../create-circle/components/CommitmentSetupFields';
import type {OnboardingStep} from './onboarding-options';

export type OnboardingStepCopy = {
  body: string;
  prompt: string;
  title: string;
};

const onboardingStepCopy: Record<
  Exclude<OnboardingStep, 'welcome'>,
  OnboardingStepCopy
> = {
  auth: {
    body: 'Create an account when you are ready to join, Tap In, or keep your rhythm across devices.',
    prompt: 'Pick the sign-in path that feels easiest.',
    title: 'Save your rhythm',
  },
  coach: {
    body: "Let's help you create an account and a Commitment that fits how you want accountability to work.",
    prompt:
      'A Commitment works best when the promise is small, visible, and repeatable.',
    title: "Let's get started",
  },
  circleCommitment: {
    body: 'Make the Commitment specific enough that it is always clear what counts.',
    prompt: 'What is your Commitment?',
    title: 'Define the promise',
  },
  circleMode: {
    body: 'Choose whether this Commitment is yours alone or shared with a Circle.',
    prompt: 'How do you want to commit?',
    title: 'Choose your setup',
  },
  circleCategory: {
    body: 'Choose the category that best describes this Commitment.',
    prompt: 'What kind of Circle is this?',
    title: 'Choose a category',
  },
  circleRules: {
    body: 'Choose what counts for a Tap In and how often it is due.',
    prompt: 'Set the Commitment rules',
    title: 'Rules and rhythm',
  },
  circleGrace: {
    body: 'Choose how many skips can protect Circle Progression.',
    prompt: 'How should skips work?',
    title: 'Set the skip allowance',
  },
  circlePrivacy: {
    body: 'Choose who can discover it and how new members enter.',
    prompt: 'Who can find and join it?',
    title: 'Set the doors',
  },
  circleCapacity: {
    body: 'Choose how many people can participate in this Circle.',
    prompt: 'How many members can join?',
    title: 'Set the capacity',
  },
  circleTimezone: {
    body: 'This controls when each Tap In day resets for this Circle.',
    prompt: 'Which timezone should this Circle use?',
    title: 'Set the timezone',
  },
  circleReview: {
    body: 'After account creation, Hoyst will save your profile and this Commitment.',
    prompt: 'Ready to save your setup?',
    title: 'Review your setup',
  },
  notifications: {
    body: 'Hoyst can nudge you before Progression slips and warn you when today is almost closed.',
    prompt: 'Keep your first Circle moving with timely reminders.',
    title: 'Protect your Progression',
  },
  circleTitle: {
    body: 'Give the circle a name people can recognize and rally around.',
    prompt: 'What should this circle be called?',
    title: 'Name the circle',
  },
  finishProfile: {
    body: 'Add the profile details people will see. Handles are locked once saved.',
    prompt: 'Finish your profile',
    title: 'Last step',
  },
};

export function getOnboardingStepCopy(
  currentStep: Exclude<OnboardingStep, 'welcome'>,
  isPersonal: boolean,
  isInvite = false,
): OnboardingStepCopy {
  const copy = onboardingStepCopy[currentStep];
  const modeCopy = getModeAwareSetupCopy(isPersonal ? 'personal' : 'group');

  if (isInvite && currentStep === 'notifications') {
    return {
      body: 'Hoyst can remind you before this Circle’s Tap In window closes.',
      prompt: 'Stay in rhythm with your Circle',
      title: 'Protect your Progression',
    };
  }

  if (isInvite && currentStep === 'auth') {
    return {
      body: 'Create an account so Hoyst can add you to the invited Circle and keep your Progression across devices.',
      prompt: 'Choose how you want to continue',
      title: 'Join your Circle',
    };
  }

  if (isInvite && currentStep === 'finishProfile') {
    return {
      body: 'Add the profile details your Circle companions will see. Handles are locked once saved.',
      prompt: 'Finish your profile to join',
      title: 'Last step',
    };
  }

  if (currentStep === 'circleCategory') {
    return {...copy, prompt: modeCopy.categoryPrompt};
  }

  if (currentStep === 'circleRules') {
    return {
      ...copy,
      body: `Choose what counts for a Tap In and how often it is due. ${
        isPersonal
          ? 'You Tap In on the rhythm you choose.'
          : 'Each member taps in on the same rhythm.'
      }`,
    };
  }

  if (currentStep === 'circleGrace') {
    return {
      ...copy,
      body: `Choose how many skips can protect ${modeCopy.progressionLabel}.`,
    };
  }

  if (currentStep === 'circleTimezone') {
    return {
      ...copy,
      body: `This controls when each Tap In day resets for this ${modeCopy.containerLabel}.`,
      prompt: `Which timezone should this ${modeCopy.containerLabel} use?`,
    };
  }

  if (currentStep === 'circleReview') {
    return {
      ...copy,
      body: `After account creation, Hoyst will save your profile and create this ${
        isPersonal ? 'Personal commitment' : 'Circle'
      }.`,
    };
  }

  if (currentStep === 'notifications') {
    return {
      ...copy,
      prompt: isPersonal
        ? 'Keep this Commitment moving with timely reminders.'
        : 'Keep your Circle moving with Circle and companion updates.',
    };
  }

  return copy;
}
