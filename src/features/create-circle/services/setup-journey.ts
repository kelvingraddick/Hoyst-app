import type {CreateCircleDraft, CommitmentType} from '../../../types/models';
import {createInitialCircleDraft} from './create-circle-draft';
import type {DiscoverableCircle} from '../../explore/services/explore-service';

export type CircleSuggestion = DiscoverableCircle &
  Pick<
    CreateCircleDraft,
    | 'commitmentCadence'
    | 'commitmentFrequency'
    | 'commitmentType'
    | 'timezone'
    | 'unitLabel'
  > &
  Partial<
    Pick<
      CreateCircleDraft,
      'buildTrackingMode' | 'targetValue' | 'minimumValue' | 'maximumValue'
    >
  >;
export type SetupStep =
  | 'welcome'
  | 'interests'
  | 'suggestions'
  | 'mode'
  | 'category'
  | 'name'
  | 'pace'
  | 'frequency'
  | 'type'
  | 'goal'
  | 'privacy'
  | 'joining'
  | 'capacity'
  | 'timezone'
  | 'appearance'
  | 'review'
  | 'account'
  | 'profile'
  | 'reminders'
  | 'finish'
  | 'joinPreview'
  | 'saveError'
  | 'full'
  | 'unavailable';
export type SetupSelection =
  | {kind: 'template'; id: string}
  | {kind: 'custom'}
  | {kind: 'circle'; circle: CircleSuggestion; inviteCode?: string};
export type SetupJourney = {
  step: SetupStep;
  draft: CreateCircleDraft;
  interests: string[];
  customText: string;
  selection?: SetupSelection;
  requestId: string;
  status: 'editing' | 'saving' | 'error' | 'saved';
  deferred: boolean;
  completed: boolean;
  needsReminders?: boolean;
  reviewReturn?: boolean;
  submittedDraft?: CreateCircleDraft;
  profileDraft?: {
    name: string;
    handle: string;
    avatarUri?: string;
    avatarUrl?: string;
    avatarRemoved?: boolean;
  };
  ownerUid?: string;
  pendingAction?: import('../../../store/session-store').PendingProtectedAction;
  paceCounts?: {weekly: number; monthly: number};
  goalDrafts?: Partial<
    Record<
      CommitmentType,
      Pick<
        CreateCircleDraft,
        | 'targetValue'
        | 'minimumValue'
        | 'maximumValue'
        | 'unitLabel'
        | 'buildTrackingMode'
      >
    >
  >;
  result?: {
    circleId: string;
    inviteCode?: string;
    membership: 'active' | 'pending';
  };
};

export function createSetupJourney(
  step: SetupStep = 'welcome',
  timezone?: string,
): SetupJourney {
  return {
    step,
    draft: createInitialCircleDraft(timezone),
    interests: [],
    customText: '',
    requestId: `setup-${Date.now().toString(36)}-${Math.random()
      .toString(36)
      .slice(2, 12)}`,
    status: 'editing',
    deferred: false,
    completed: false,
  };
}

export function setupSteps(draft: CreateCircleDraft): SetupStep[] {
  return (
    [
      'suggestions',
      'mode',
      'category',
      'name',
      'pace',
      'frequency',
      'type',
      'goal',
      'privacy',
      'joining',
      'capacity',
      'timezone',
      'appearance',
      'review',
    ] as SetupStep[]
  ).filter(
    step =>
      !(step === 'frequency' && draft.commitmentCadence === 'daily') &&
      !(step === 'goal' && draft.commitmentType === 'avoid') &&
      !(
        draft.circleMode === 'personal' &&
        ['privacy', 'joining', 'capacity'].includes(step)
      ) &&
      !(step === 'joining' && draft.privacyMode !== 'public'),
  );
}

export function validateSetupStep(
  step: SetupStep,
  draft: CreateCircleDraft,
): string | undefined {
  if (step === 'suggestions' && !draft.commitment.trim())
    return 'Choose a starting point or write your commitment.';
  if (
    step === 'name' &&
    (!draft.title.trim() || draft.title.trim().length > 80)
  )
    return 'Enter a name of up to 80 characters.';
  if (
    ['suggestions', 'name'].includes(step) &&
    (!draft.commitment.trim() || draft.commitment.trim().length > 160)
  )
    return 'Enter a commitment of up to 160 characters.';
  if (step === 'goal') {
    if (
      draft.commitmentType === 'build' &&
      draft.buildTrackingMode === 'quantity' &&
      (!Number.isInteger(draft.targetValue) ||
        (draft.targetValue ?? 0) < 1 ||
        (draft.targetValue ?? 0) > 100000)
    )
      return 'Enter a whole-number amount from 1 to 100,000.';
    if (
      draft.commitmentType === 'limit' &&
      (!Number.isInteger(draft.maximumValue) ||
        (draft.maximumValue ?? -1) < 0 ||
        (draft.maximumValue ?? 0) > 100000 ||
        !Number.isInteger(draft.minimumValue ?? 0) ||
        (draft.minimumValue ?? 0) < 0 ||
        (draft.minimumValue ?? 0) > (draft.maximumValue ?? 0))
    )
      return 'Enter a valid range. Minimum cannot exceed maximum.';
    if (
      (draft.commitmentType === 'limit' ||
        draft.buildTrackingMode === 'quantity') &&
      (!draft.unitLabel.trim() || draft.unitLabel.trim().length > 32)
    )
      return 'Enter a unit of up to 32 characters.';
  }
  if (step === 'timezone') {
    try {
      new Intl.DateTimeFormat('en', {timeZone: draft.timezone}).format();
    } catch {
      return 'Choose a valid timezone.';
    }
  }
  return undefined;
}

export function validateSetup(draft: CreateCircleDraft) {
  return setupSteps(draft)
    .map(step => validateSetupStep(step, draft))
    .find(Boolean);
}

export function paceLabel(
  draft: Pick<CreateCircleDraft, 'commitmentCadence' | 'commitmentFrequency'>,
) {
  if (draft.commitmentCadence === 'daily') return '1 Tap In each day';
  return draft.commitmentCadence === 'monthly'
    ? `${
        draft.commitmentFrequency.opportunitiesPerPeriod ??
        draft.commitmentFrequency.tapInsPerWeek
      } Tap Ins per month`
    : `${draft.commitmentFrequency.tapInsPerWeek} Tap Ins per week`;
}

export function goalLabel(
  draft: Pick<
    CreateCircleDraft,
    | 'commitmentType'
    | 'buildTrackingMode'
    | 'targetValue'
    | 'minimumValue'
    | 'maximumValue'
    | 'unitLabel'
  >,
) {
  if (draft.commitmentType === 'avoid') return 'Confirm you stayed clear';
  if (draft.commitmentType === 'limit')
    return `${draft.minimumValue ?? 0} to ${draft.maximumValue ?? 1} ${
      draft.unitLabel
    }`;
  if (draft.buildTrackingMode === 'confirmation') return 'Confirm you did it';
  return `At least ${draft.targetValue ?? 1} ${draft.unitLabel}`;
}

export type Starter = {
  id: string;
  category: string;
  commitment: string;
  type: CommitmentType;
  amount?: number;
  unit?: string;
  keywords: string[];
};
export const starters: Starter[] = [
  {
    id: 'walk',
    category: 'Fitness',
    commitment: 'Walk for 20 minutes',
    type: 'build',
    amount: 20,
    unit: 'minutes',
    keywords: ['walk', 'move', 'fitness', 'exercise'],
  },
  {
    id: 'mindful',
    category: 'Wellness',
    commitment: 'Take 5 mindful minutes',
    type: 'build',
    amount: 5,
    unit: 'minutes',
    keywords: ['mindful', 'meditate', 'wellness', 'rest'],
  },
  {
    id: 'focus',
    category: 'Work',
    commitment: 'Focus for 25 minutes',
    type: 'build',
    amount: 25,
    unit: 'minutes',
    keywords: ['work', 'focus', 'study'],
  },
  {
    id: 'read',
    category: 'Learning',
    commitment: 'Read 10 pages',
    type: 'build',
    amount: 10,
    unit: 'pages',
    keywords: ['read', 'learn', 'book', 'pages'],
  },
  {
    id: 'create',
    category: 'Creating',
    commitment: 'Create for 15 minutes',
    type: 'build',
    amount: 15,
    unit: 'minutes',
    keywords: ['create', 'write', 'draw', 'music'],
  },
  {
    id: 'sober',
    category: 'Sobriety',
    commitment: 'Stay alcohol-free',
    type: 'avoid',
    keywords: ['alcohol', 'sober', 'drink', 'sobriety'],
  },
  {
    id: 'connect',
    category: 'Relationships',
    commitment: 'Reach out to someone I care about',
    type: 'build',
    keywords: ['friend', 'family', 'connect', 'relationship'],
  },
  {
    id: 'tidy',
    category: 'Home & Life',
    commitment: 'Tidy for 10 minutes',
    type: 'build',
    amount: 10,
    unit: 'minutes',
    keywords: ['tidy', 'clean', 'home', 'house'],
  },
  {
    id: 'money',
    category: 'Money',
    commitment: 'Record my spending',
    type: 'build',
    keywords: ['money', 'spend', 'budget'],
  },
  {
    id: 'show-up',
    category: 'General',
    commitment: 'Do one thing that matters to me',
    type: 'build',
    keywords: ['habit', 'show', 'goal'],
  },
  {
    id: 'screen',
    category: 'Wellness',
    commitment: 'Limit recreational screen time',
    type: 'limit',
    amount: 30,
    unit: 'minutes',
    keywords: ['screen', 'phone', 'scroll', 'limit'],
  },
];

export function recommendStarters(query: string, interests: string[]) {
  const words = query.toLowerCase().match(/[a-z]+/g) ?? [];
  return starters
    .map((starter, order) => ({
      starter,
      order,
      score:
        starter.keywords.filter(key =>
          words.some(word => word.startsWith(key) || key.startsWith(word)),
        ).length *
          10 +
        (interests.includes(starter.category) ? 3 : 0),
    }))
    .sort((a, b) => b.score - a.score || a.order - b.order)
    .slice(0, 3)
    .map(item => item.starter);
}

export function applyStarter(
  draft: CreateCircleDraft,
  starter: Starter,
): CreateCircleDraft {
  return {
    ...draft,
    category: starter.category,
    title: starter.commitment.slice(0, 80),
    commitment: starter.commitment,
    commitmentType: starter.type,
    buildTrackingMode: starter.amount ? 'quantity' : 'confirmation',
    targetValue: starter.amount ?? 1,
    minimumValue: 0,
    maximumValue: starter.amount ?? 1,
    unitLabel: starter.unit ?? 'Tap In',
  };
}
