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

export function formatPublicTapInTime(iso: string) {
  const date = new Date(iso);
  if (!Number.isFinite(date.getTime())) {
    return '';
  }
  return date.toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
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
