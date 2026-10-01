import {useCallback, useEffect} from 'react';
import {AppState} from 'react-native';
import {useFocusEffect} from '@react-navigation/native';
import {useQuery, useQueryClient} from '@tanstack/react-query';
import {
  getProgressDayActivity,
  getProgressMonth,
  subscribeHistoryChanges,
} from '../services/history-service';
export function useProgressHistory(
  uid: string | undefined,
  timezone: string,
  monthKey: string,
  dateKey: string,
  preview = false,
) {
  const client = useQueryClient();
  const enabled = Boolean(uid) && !preview;
  const month = useQuery({
    queryKey: ['progressHistory', uid, timezone, 'month', monthKey],
    queryFn: () => getProgressMonth(monthKey),
    enabled,
    staleTime: 30000,
  });
  const day = useQuery({
    queryKey: ['progressHistory', uid, timezone, 'day', dateKey],
    queryFn: () => getProgressDayActivity(dateKey),
    enabled,
    staleTime: 30000,
  });
  const refresh = useCallback(() => {
    if (enabled) {
      client.invalidateQueries({queryKey: ['progressHistory', uid]});
      client.invalidateQueries({queryKey: ['progressStats', uid]});
    }
  }, [client, enabled, uid]);
  useFocusEffect(
    useCallback(() => {
      refresh();
    }, [refresh]),
  );
  useEffect(() => {
    if (!enabled || !uid) {
      return;
    }
    let timer: ReturnType<typeof setTimeout> | undefined;
    const unsubscribe = subscribeHistoryChanges(uid, () => {
      clearTimeout(timer);
      timer = setTimeout(refresh, 400);
    });
    const app = AppState.addEventListener('change', state => {
      if (state === 'active') {
        refresh();
      }
    });
    return () => {
      clearTimeout(timer);
      unsubscribe();
      app.remove();
      client.cancelQueries({queryKey: ['progressHistory', uid]});
      client.removeQueries({queryKey: ['progressHistory', uid]});
    };
  }, [client, enabled, refresh, uid]);
  return {month, day, refresh};
}
