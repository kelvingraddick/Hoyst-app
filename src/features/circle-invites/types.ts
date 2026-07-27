export type CircleInviteJoinMode = 'invite_only' | 'open' | 'request_to_join';

export type CircleInvitePreview = {
  cadenceLabel: string;
  circleId: string;
  commitment: string;
  isFull: boolean;
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
