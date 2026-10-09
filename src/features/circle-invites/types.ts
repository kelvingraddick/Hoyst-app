import type {CommitmentAppearance} from '../../shared/commitment-appearance';
export type CircleInviteJoinMode = 'invite_only' | 'open' | 'request_to_join';

export type CircleInvitePreview = {
  cadenceLabel: string;
  commitmentCadence?: 'daily' | 'weekly' | 'monthly';
  commitmentFrequency?: {tapInsPerWeek: number; opportunitiesPerPeriod?: number};
  commitmentType?: 'build' | 'limit' | 'avoid';
  buildTrackingMode?: 'confirmation' | 'quantity';
  targetValue?: number;
  minimumValue?: number;
  maximumValue?: number;
  unitLabel?: string;
  timezone?: string;
  category?: string;
  appearance?: CommitmentAppearance;
  circleId: string;
  commitment: string;
  isFull: boolean;
  viewerMembershipStatus?: 'active' | 'pending';
  viewerUid?: string;
  joinMode: CircleInviteJoinMode;
  maxSize: number;
  memberCount: number;
  title: string;
};

export type CircleInviteResolutionStatus =
  | 'error'
  | 'idle'
  | 'loading'
  | 'ready'
  | 'unavailable';

export type CircleInviteJoinStatus = 'error' | 'idle' | 'joining';
