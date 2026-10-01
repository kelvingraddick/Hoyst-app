import {useCallback, useEffect, useState} from 'react';
import {useFocusEffect} from '@react-navigation/native';
import {AppState} from 'react-native';
import {useSessionStore} from '../../../store/session-store';
import {
  ensureProgress,
  subscribeProgress,
  type ProgressSummary,
} from '../services/progress-service';
export function useProgress(enabled = true) {
  const uid = useSessionStore(state =>
    enabled && state.status === 'authenticatedReady'
      ? state.user?.uid
      : undefined,
  );
  const [state, setState] = useState<{
    uid?: string;
    summary?: ProgressSummary;
    error?: string;
    loading: boolean;
  }>({loading: true});
  const refresh = useCallback(async () => {
    if (!uid) {
      return;
    }
    setState(current =>
      current.uid === uid
        ? {...current, loading: !current.summary, error: undefined}
        : {uid, loading: true},
    );
    try {
      const summary = await ensureProgress();
      if (useSessionStore.getState().user?.uid === uid) {
        setState({uid, summary, loading: false});
      }
    } catch (reason) {
      const message =
        reason instanceof Error
          ? reason.message
          : 'Progress is unavailable. Try again.';
      if (useSessionStore.getState().user?.uid === uid) {
        setState(current => ({
          ...current,
          uid,
          loading: false,
          error: message,
        }));
      }
    }
  }, [uid]);
  useFocusEffect(
    useCallback(() => {
      refresh();
    }, [refresh]),
  );
  useEffect(() => {
    setState({uid, loading: Boolean(uid)});
    if (!uid) {
      return;
    }
    const unsubscribe = subscribeProgress(
      uid,
      data =>
        setState(current =>
          current.uid === uid && current.summary
            ? {
                ...current,
                summary: {
                  ...current.summary,
                  ...data,
                  routineRemainingXP:
                    data.flags?.earning ?? current.summary.flags.earning
                      ? Math.max(
                          0,
                          30 -
                            (data.window?.earned ??
                              current.summary.window?.earned ??
                              0),
                        )
                      : 0,
                },
              }
            : current,
        ),
      error =>
        setState(current =>
          current.uid === uid
            ? {...current, error: error.message, loading: false}
            : current,
        ),
    );
    const foreground = AppState.addEventListener('change', next => {
      if (next === 'active') {
        refresh();
      }
    });
    return () => {
      unsubscribe();
      foreground.remove();
    };
  }, [uid, refresh]);
  useEffect(() => {
    const closesAt =
      state.uid === uid ? state.summary?.window?.closesAt : undefined;
    if (!uid || !closesAt) return;
    const timer = setTimeout(
      refresh,
      Math.max(1000, closesAt - Date.now() + 1000),
    );
    return () => clearTimeout(timer);
  }, [uid, state.uid, state.summary?.window?.closesAt, refresh]);
  const visible = state.uid === uid ? state : {loading: Boolean(uid)};
  return {...visible, uid, refresh};
}
