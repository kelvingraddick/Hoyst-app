import {firebaseFunctions} from '../../../lib/firebase/functions';

export type PublicTapInPreview = {
  eventId: string;
  uid: string;
  displayName: string;
  avatarUrl?: string;
  occurredAt: string;
};
export type DiscoverableCircle = {
  id: string;
  title: string;
  category: string;
  commitment: string;
  memberCount: number;
  maxSize: number;
  groupStreakDays: number;
  joinMode: 'open' | 'request_to_join' | 'invite_only';
  latestPublicTapIn?: PublicTapInPreview;
};
export type ExplorePage = {
  circles: DiscoverableCircle[];
  total: number;
  categories: string[];
  nextCursor?: string;
};
export type ExploreSearch = {query: string; category: string; cursor?: string};

export async function searchPublicCircles(
  input: ExploreSearch,
): Promise<ExplorePage> {
  const result = await firebaseFunctions().httpsCallable('searchPublicCircles')(
    input,
  );
  return result.data as ExplorePage;
}

export function formatPublicTapInTime(iso: string, now = Date.now()) {
  const occurredAt = new Date(iso).getTime();
  if (!Number.isFinite(occurredAt)) {
    return '';
  }
  const seconds = Math.max(0, Math.floor((now - occurredAt) / 1000));
  if (seconds < 60) {
    return 'Just now';
  }
  const units: readonly [string, number][] = [
    ['year', 365 * 24 * 60 * 60],
    ['month', 30 * 24 * 60 * 60],
    ['week', 7 * 24 * 60 * 60],
    ['day', 24 * 60 * 60],
    ['hour', 60 * 60],
    ['minute', 60],
  ];
  const [unit, duration] = units.find(([, value]) => seconds >= value)!;
  const count = Math.floor(seconds / duration);
  return `${count} ${unit}${count === 1 ? '' : 's'} ago`;
}

export function getExploreSearchError(error: unknown): string {
  const code =
    error && typeof error === 'object' && 'code' in error
      ? String(error.code)
      : '';
  if (code.includes('invalid-argument')) {
    return 'Use up to eight search words, each at most 40 characters.';
  }
  if (code.includes('not-found')) {
    return 'Search is unavailable right now. Please try again later.';
  }
  return 'Check your connection and try again.';
}
