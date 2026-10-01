import {useCallback, useEffect, useState} from 'react';
import {useFocusEffect} from '@react-navigation/native';
import {useQuery} from '@tanstack/react-query';
import {useSessionStore} from '../../../store/session-store';
import {useUserProfileStore} from '../../../store/profile-store';
import {useProgress} from '../../progress/hooks/useProgress';
import {
  getMomentumDisplayModel,
  subscribeToMomentumSummary,
} from '../../momentum/services/momentum-service';
import {getProfileSummary} from '../services/profile-summary-service';
import {subscribeToHomeData} from '../../home/services/home-data-service';
import {useProfilePreview} from '../components/ProfilePreviewContext';

export function useProfileOverview() {
  const preview = useProfilePreview();
  const status = useSessionStore(state => state.status);
  const accountUid = useSessionStore(state => state.user?.uid);
  const stored = useUserProfileStore(state => state.profile);
  const ready =
    status === 'authenticatedReady' && Boolean(stored?.id === accountUid);
  const uid = !preview && ready ? accountUid : undefined;
  const profile = preview ? preview.profile : ready ? stored : undefined;
  const liveProgress = useProgress(Boolean(uid));
  const stats = useQuery({
    queryKey: ['profileSummary', uid],
    queryFn: getProfileSummary,
    enabled: Boolean(uid),
    refetchOnMount: 'always',
  });
  const refetchStats = stats.refetch;
  const refreshProgress = liveProgress.refresh;
  const [retry, setRetry] = useState(0);
  const refresh = useCallback(() => {
    if (uid) {
      void refetchStats();
      void refreshProgress();
      setRetry(value => value + 1);
    }
  }, [uid, refetchStats, refreshProgress]);
  useFocusEffect(refresh);
  const [auxiliary, setAuxiliary] = useState<{
    uid?: string;
    momentumLabel?: string;
    momentumError?: boolean;
    categories?: string[];
  }>({});
  useEffect(() => {
    setAuxiliary({uid});
    if (!uid) return;
    let current = true;
    const unsubscribeMomentum = subscribeToMomentumSummary({
      uid,
      onSummary: summary => {
        if (!current) return;
        const model = getMomentumDisplayModel(summary);
        setAuxiliary(value => ({
          ...value,
          uid,
          momentumError: false,
          momentumLabel: model.isCalibrating
            ? `${model.resolvedOpportunityCount} of 3`
            : `${model.rawRollingPercentage}%`,
        }));
      },
      onError: () => {
        if (current)
          setAuxiliary(value => ({
            ...value,
            uid,
            momentumLabel: undefined,
            momentumError: true,
          }));
      },
    });
    const unsubscribeHome = subscribeToHomeData({
      uid,
      timezone: profile?.timezone ?? 'UTC',
      onData: home => {
        if (current && home.hasLoadedMemberships)
          setAuxiliary(value => ({
            ...value,
            uid,
            categories: [
              ...new Set(home.circles.map(circle => circle.category)),
            ].slice(0, 3),
          }));
      },
      onError: () => undefined,
    });
    return () => {
      current = false;
      unsubscribeMomentum();
      unsubscribeHome();
    };
  }, [uid, profile?.timezone, retry]);
  const visible = auxiliary.uid === uid ? auxiliary : {};
  return {
    profile,
    status:
      preview?.status ??
      (ready
        ? 'ready'
        : status === 'authenticatedIncompleteProfile'
        ? 'incomplete'
        : status === 'initializing' ||
          status === 'authenticating' ||
          status === 'authenticatedReady'
        ? 'loading'
        : 'guest'),
    stats: preview ? preview.stats : stats.data,
    progress: preview ? preview.progress : liveProgress.summary,
    refreshing: preview ? false : stats.isFetching || liveProgress.loading,
    loading: preview
      ? preview.status === 'loading'
      : stats.isPending || liveProgress.loading,
    error:
      preview?.status === 'error'
        ? 'Your profile progress could not be loaded.'
        : preview
        ? undefined
        : stats.error?.message || liveProgress.error,
    momentumLabel: preview ? preview.momentumLabel : visible.momentumLabel,
    momentumError: preview ? false : visible.momentumError,
    categories: preview ? preview.categories : visible.categories,
    refresh,
  };
}
