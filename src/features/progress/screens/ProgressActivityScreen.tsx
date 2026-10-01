import React from 'react';
import {
  ActivityIndicator,
  Image,
  Pressable,
  StyleSheet,
  View,
} from 'react-native';
import {DateTime} from 'luxon';
import {ArrowLeft} from 'lucide-react-native';
import {useInfiniteQuery, useQuery} from '@tanstack/react-query';
import {useFocusEffect} from '@react-navigation/native';
import type {NativeStackScreenProps} from '@react-navigation/native-stack';
import type {RootStackParamList} from '../../../navigation/types';
import {
  DSButton,
  DSScreen,
  DSSurface,
  DSText,
  minimumTarget,
  useSystemTheme,
} from '../../../design/system';
import {useUserProfileStore} from '../../../store/profile-store';
import {useSessionStore} from '../../../store/session-store';
import {getProgressDayActivity} from '../services/history-service';
import {ProgressActivityRow} from '../components/ProgressActivityRow';
import {navigateToAuthSignIn} from '../../../navigation/auth-modal-navigation';
export function ProgressActivityScreen({
  navigation,
  route,
}: NativeStackScreenProps<RootStackParamList, 'ProgressDetails'>) {
  const theme = useSystemTheme();
  const timezone =
    useUserProfileStore(state => state.profile?.timezone) || 'UTC';
  const [photoFailed, setPhotoFailed] = React.useState(false);
  const uid = useSessionStore(state =>
    state.status === 'authenticatedReady' ? state.user?.uid : undefined,
  );
  const {dateKey = '', activityId, ownerUid, section} = route.params;
  const enabled = Boolean(uid && dateKey && (!ownerUid || ownerUid === uid));
  const history = useInfiniteQuery({
    queryKey: ['progressHistory', uid, timezone, 'fullDay', dateKey],
    enabled: enabled && section === 'dayActivity',
    initialPageParam: undefined as string | undefined,
    queryFn: ({pageParam}) => getProgressDayActivity(dateKey, pageParam),
    getNextPageParam: page => page.nextCursor || undefined,
  });
  const activity = useQuery({
    queryKey: [
      'progressHistory',
      uid,
      timezone,
      'activity',
      dateKey,
      activityId,
    ],
    enabled: enabled && section === 'activity',
    queryFn: async () => {
      let cursor: string | undefined;
      do {
        const page = await getProgressDayActivity(dateKey, cursor);
        const found = page.entries.find(entry => entry.id === activityId);
        if (found) {
          return found;
        }
        cursor = page.nextCursor || undefined;
      } while (cursor);
      return null;
    },
  });
  const refreshActivity = activity.refetch;
  const refreshHistory = history.refetch;
  useFocusEffect(
    React.useCallback(() => {
      if (enabled) {
        if (section === 'activity') {
          refreshActivity();
        } else {
          refreshHistory();
        }
      }
    }, [enabled, section, refreshActivity, refreshHistory]),
  );
  const entries = history.data?.pages.flatMap(page => page.entries) || [];
  const detail = activity.data;
  const pending =
    section === 'activity' ? activity.isPending : history.isPending;
  const failed =
    section === 'activity'
      ? activity.isError
      : history.isError && !history.data;
  return (
    <DSScreen contentContainerStyle={styles.content}>
      <View style={styles.header}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Back"
          onPress={() => navigation.goBack()}
          style={styles.back}>
          <ArrowLeft color={theme.action} size={22} />
        </Pressable>
        <DSText variant="heading" style={styles.copy}>
          {section === 'activity' ? 'Activity details' : 'Day activity'}
        </DSText>
      </View>
      <DSText tone="muted">
        {DateTime.fromISO(dateKey).toFormat('cccc, LLLL d, yyyy')}
      </DSText>
      {!uid ? (
        <DSButton
          label="Sign in to view your history"
          onPress={() => navigateToAuthSignIn(navigation)}
        />
      ) : !enabled ? (
        <DSText tone="muted">
          This activity is unavailable for the current account.
        </DSText>
      ) : pending ? (
        <ActivityIndicator
          accessibilityLabel="Loading activity"
          color={theme.action}
        />
      ) : failed ? (
        <View>
          <DSText tone="muted">
            Activity is unavailable. Please try again.
          </DSText>
          <DSButton
            label="Retry activity"
            onPress={() =>
              section === 'activity' ? activity.refetch() : history.refetch()
            }
          />
        </View>
      ) : section === 'activity' ? (
        detail ? (
          <DSSurface style={styles.surface}>
            <DSText variant="heading">{detail.title}</DSText>
            <DSText>{detail.description}</DSText>
            {detail.cadence ? (
              <DSText tone="muted">
                {detail.cadence.charAt(0).toUpperCase() +
                  detail.cadence.slice(1)}{' '}
                commitment
                {detail.periodKey ? ` · Period ${detail.periodKey}` : ''}
              </DSText>
            ) : null}
            {detail.status === 'restored' ? (
              <DSText tone="muted">
                Protected coverage on the original missed day. This does not
                count as an actual Tap In.
              </DSText>
            ) : null}
            {detail.note ? (
              <View>
                <DSText variant="title">Note</DSText>
                <DSText>{detail.note}</DSText>
              </View>
            ) : null}
            {detail.photoUrl && !photoFailed ? (
              <Image
                source={{uri: detail.photoUrl}}
                onError={() => setPhotoFailed(true)}
                accessibilityLabel={`Photo for ${detail.title}`}
                resizeMode="contain"
                style={styles.photo}
              />
            ) : null}
            {photoFailed ? (
              <DSText tone="muted">Photo is unavailable.</DSText>
            ) : null}
            {!detail.note && !detail.photoUrl ? (
              <DSText tone="muted">No note or photo attached.</DSText>
            ) : null}
          </DSSurface>
        ) : (
          <DSText tone="muted">This activity is no longer available.</DSText>
        )
      ) : entries.length ? (
        <DSSurface style={styles.surface}>
          {entries.map(entry => (
            <ProgressActivityRow
              key={entry.id}
              entry={entry}
              onPress={() =>
                navigation.push('ProgressDetails', {
                  section: 'activity',
                  dateKey,
                  activityId: entry.id,
                  ownerUid: uid,
                })
              }
            />
          ))}
          {history.hasNextPage ? (
            <DSButton
              label={
                history.isFetchingNextPage
                  ? 'Loading more…'
                  : history.isFetchNextPageError
                  ? 'Retry more activity'
                  : 'Load more activity'
              }
              disabled={history.isFetchingNextPage}
              onPress={() => history.fetchNextPage()}
            />
          ) : null}
        </DSSurface>
      ) : (
        <DSText tone="muted">No recorded activity on this day.</DSText>
      )}
    </DSScreen>
  );
}
const styles = StyleSheet.create({
  content: {gap: 16, paddingBottom: 48},
  header: {flexDirection: 'row', alignItems: 'center', gap: 12},
  back: {
    minWidth: minimumTarget(),
    minHeight: minimumTarget(),
    alignItems: 'center',
    justifyContent: 'center',
  },
  copy: {flex: 1},
  surface: {padding: 12, gap: 12},
  photo: {width: '100%', height: 260, borderRadius: 12},
});
