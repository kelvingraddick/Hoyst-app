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
    body: 'Create an account when you are ready to join, Tap In, or keep your Progress across devices.',
    prompt: 'Pick the sign-in path that feels easiest.',
    title: 'Save your Progress',
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
    body: 'Choose the Goal for a Tap In and the Pace at which it is due.',
    prompt: 'Set the Goal and Pace',
    title: 'Goal and Pace',
  },
  circleGrace: {
    body: 'Choose how many Skips can protect Circle Progress.',
    prompt: 'How should skips work?',
    title: 'Set the skip allowance',
  },
  circlePrivacy: {
    body: 'Choose who can discover it and how new Members enter.',
    prompt: 'Who can find and join it?',
    title: 'Set the doors',
  },
  circleCapacity: {
    body: 'Choose how many people can participate in this Circle.',
    prompt: 'How many Members can join?',
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
    body: 'Hoyst can nudge you before Progress slips and warn you when an Opportunity is almost closed.',
    prompt: 'Keep your first Circle moving with timely reminders.',
    title: 'Protect your Progress',
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
      body: 'Hoyst can remind you before this Circle’s Opportunity closes.',
      prompt: 'Keep Pace with your Circle',
      title: 'Protect your Progress',
    };
  }

  if (isInvite && currentStep === 'auth') {
    return {
      body: 'Create an account so Hoyst can add you to the invited Circle and keep your Progress across devices.',
      prompt: 'Choose how you want to continue',
      title: 'Join your Circle',
    };
  }

  if (isInvite && currentStep === 'finishProfile') {
    return {
      body: 'Add the profile details your Circle Members will see. Handles are locked once saved.',
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
      body: `Choose the Goal for a Tap In and the Pace at which it is due. ${
        isPersonal
          ? 'You Tap In at the Pace you choose.'
          : 'Each Member taps in at the same Pace.'
      }`,
    };
  }

  if (currentStep === 'circleGrace') {
    return {
      ...copy,
      body: `Choose how many Skips can protect ${modeCopy.progressLabel}.`,
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
        : 'Keep your Circle moving with timely Circle activity updates.',
    };
  }

  return copy;
}
