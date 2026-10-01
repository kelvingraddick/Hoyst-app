import React, {useEffect, useState} from 'react';
import {
  ActivityIndicator,
  Alert,
  Pressable,
  StyleSheet,
  View,
} from 'react-native';
import {
  ArrowLeft,
  Check,
  ChevronRight,
  FastForward,
  RotateCcw,
} from 'lucide-react-native';
import type {NativeStackScreenProps} from '@react-navigation/native-stack';
import type {PurchasesStoreProduct} from 'react-native-purchases';
import {
  DesignSystemProvider,
  DSButton,
  DSScreen,
  DSSurface,
  DSText,
  useSystemTheme,
} from '../../../design/system';
import type {RootStackParamList} from '../../../navigation/types';
import {useSettingsStore} from '../../../store/settings-store';
import {useSessionStore} from '../../../store/session-store';
import {useUserProfileStore} from '../../../store/profile-store';
import {useProgress} from '../hooks/useProgress';
import {
  getRestoreOptions,
  PROGRESS_TASKS,
  restoreStreak,
  subscribeRewardHistory,
  subscribeOpenRewardOpportunities,
  syncProgressPurchases,
  type ProgressTaskId,
  type RestoreOption,
  type RewardHistoryEntry,
} from '../services/progress-service';
import {
  buyRewardProduct,
  getRewardProducts,
  PACKS,
} from '../services/purchase-service';
import {ProgressRow} from './ProgressScreen';
import {ProgressActivityScreen} from './ProgressActivityScreen';
import {MomentumScreen} from '../../momentum/screens/MomentumScreen';
import {
  subscribeToHomeData,
  canTapInToday,
  type HomeData,
} from '../../home/services/home-data-service';
import {updateNotificationSettings} from '../../settings/services/notification-settings-service';
type Props = NativeStackScreenProps<RootStackParamList, 'ProgressDetails'>;
const titles = {
  xp: 'XP and level details',
  streak: 'Progress details',
  momentum: 'Progress details',
  history: 'Reward history',
  checklist: 'Get started',
  skips: 'Use a skip',
  restores: 'Restore a streak',
  packs: 'Reward packs',
  achievements: 'Achievements',
  dayActivity: 'Day activity',
  activity: 'Activity details',
};
const requestId = () =>
  'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, part => {
    const value = Math.floor(Math.random() * 16);
    return (part === 'x' ? value : (value & 3) | 8).toString(16);
  });
export function ProgressDetailsScreen(props: Props) {
  const appearance = useSettingsStore(state => state.appearance);
  const account = useSessionStore(state => state.user?.uid);
  return (
    <DesignSystemProvider scheme={appearance}>
      {props.route.params.section === 'dayActivity' ||
      props.route.params.section === 'activity' ? (
        <ProgressActivityScreen key={account || 'guest'} {...props} />
      ) : (
        <Content key={account || 'guest'} {...props} />
      )}
    </DesignSystemProvider>
  );
}
function Content({navigation, route}: Props) {
  const theme = useSystemTheme();
  const {section, packType} = route.params;
  const {uid, summary, loading, error: progressError, refresh} = useProgress();
  const profile = useUserProfileStore(state => state.profile);
  const [historyLimit, setHistoryLimit] = useState(100);
  const [history, setHistory] = useState<RewardHistoryEntry[]>();
  const [home, setHome] = useState<HomeData>();
  const [openCircles, setOpenCircles] = useState<Set<string>>();
  const [options, setOptions] = useState<RestoreOption[]>();
  const [choice, setChoice] = useState<{
    option: RestoreOption;
    requestId: string;
  }>();
  const [products, setProducts] = useState<PurchasesStoreProduct[]>();
  const [error, setError] = useState<string>();
  const [busy, setBusy] = useState(false);
  const [purchaseState, setPurchaseState] = useState<string>();
  const loadRestores = () => {
    setOptions(undefined);
    setError(undefined);
    getRestoreOptions()
      .then(result => {
        setOptions(result.options);
        if (!result.enabled) {
          setError('Streak restores are not available yet.');
        }
      })
      .catch(reason => setError(reason.message));
  };
  useEffect(() => {
    setHistory(undefined);
    setHome(undefined);
    setOpenCircles(undefined);
    setOptions(undefined);
    setChoice(undefined);
    setProducts(undefined);
    setError(undefined);
    setPurchaseState(undefined);
    if (!uid) {
      return;
    }
    if (section === 'history') {
      return subscribeRewardHistory(
        uid,
        setHistory,
        reason => setError(reason.message),
        historyLimit,
      );
    }
    if (section === 'skips') {
      const stopOpportunities = subscribeOpenRewardOpportunities(
        uid,
        setOpenCircles,
        reason => setError(reason.message),
      );
      const stopHome = subscribeToHomeData({
        uid,
        timezone: profile?.timezone || 'UTC',
        onData: setHome,
        onError: reason => setError(reason.message),
      });
      return () => {
        stopOpportunities();
        stopHome();
      };
    }
    if (section === 'restores') {
      loadRestores();
    }
    if (section === 'packs') {
      getRewardProducts(uid)
        .then(setProducts)
        .catch(reason => setError(reason.message));
    }
  }, [uid, section, profile?.timezone, historyLimit]);
  const taskAction = (id: ProgressTaskId) => {
    if (id === 'reminders') {
      Alert.alert(
        'Tap In reminders',
        'Choose your preference. You can change it anytime in Profile. Notification permission is optional.',
        [
          {text: 'Reminders off', onPress: () => saveReminders(false)},
          {text: 'Enable reminders', onPress: () => saveReminders(true)},
          {text: 'Cancel', style: 'cancel'},
        ],
      );
    } else if (id === 'profile') {
      navigation.navigate('EditProfile');
    } else if (id === 'commitment') {
      navigation.navigate('CreateCircle');
    } else if (id === 'circle') {
      navigation.navigate('MainTabs', {screen: 'Explore'});
    } else if (id === 'share_invite') {
      navigation.navigate('Circles');
    } else {
      navigation.navigate('TapInPicker');
    }
  };
  const saveReminders = async (enabled: boolean) => {
    setBusy(true);
    try {
      await updateNotificationSettings({tapInReminders: enabled});
      useSettingsStore
        .getState()
        .setNotificationPreference('tapInReminders', enabled);
      await refresh();
    } catch (reason) {
      setError(
        reason instanceof Error ? reason.message : 'Could not save reminders.',
      );
    } finally {
      setBusy(false);
    }
  };
  const confirmRestore = async () => {
    if (!choice || busy) {
      return;
    }
    setBusy(true);
    setError(undefined);
    try {
      await restoreStreak(choice.option.slot.id, choice.requestId);
      setChoice(undefined);
      await refresh();
      loadRestores();
      Alert.alert(
        'Streak restored',
        'Your missed opportunity is now protected. Your actual Tap In total and XP stay the same.',
      );
    } catch (reason) {
      setError(
        reason instanceof Error
          ? reason.message
          : 'Could not restore this streak.',
      );
    } finally {
      setBusy(false);
    }
  };
  const buy = async (product: PurchasesStoreProduct) => {
    if (!uid || busy || !summary?.flags.buying) {
      return;
    }
    setBusy(true);
    setError(undefined);
    setPurchaseState('Opening the store…');
    try {
      const result = await buyRewardProduct(uid, product);
      setPurchaseState(
        result === 'complete'
          ? 'Rewards delivered to your inventory.'
          : result === 'cancelled'
          ? 'Purchase cancelled. You were not charged.'
          : result === 'pending'
          ? 'Payment is pending. Rewards arrive after the store approves it.'
          : 'Your purchase is being delivered. Refresh to check its status.',
      );
      await refresh();
    } catch (reason) {
      setError(
        reason instanceof Error
          ? reason.message
          : 'Could not complete the purchase.',
      );
      setPurchaseState('Delivery can be retried safely.');
    } finally {
      setBusy(false);
    }
  };
  const retry = async () => {
    setBusy(true);
    try {
      await syncProgressPurchases();
      await refresh();
      setPurchaseState('Verified purchases synced.');
      setError(undefined);
    } catch (reason) {
      setError(
        reason instanceof Error
          ? reason.message
          : 'Purchase recovery is unavailable.',
      );
    } finally {
      setBusy(false);
    }
  };
  const back = (
    <View style={styles.header}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Back"
        onPress={() => navigation.goBack()}
        style={styles.back}>
        <ArrowLeft size={22} color={theme.action} />
      </Pressable>
      <DSText variant="heading" style={styles.grow}>
        {titles[section]}
      </DSText>
    </View>
  );
  if (
    section === 'streak' ||
    section === 'momentum' ||
    section === 'achievements'
  ) {
    return (
      <View style={[styles.flex, {backgroundColor: theme.canvas}]}>
        <View style={{paddingTop: 58, paddingHorizontal: 22}}>{back}</View>
        <MomentumScreen initialSection={section} />
      </View>
    );
  }
  return (
    <DSScreen contentContainerStyle={styles.content}>
      {back}
      {!uid ? (
        <DSText>Sign in to view your saved rewards.</DSText>
      ) : loading ? (
        <ActivityIndicator color={theme.action} />
      ) : !summary ? (
        <DSSurface>
          <DSText tone="danger">
            {progressError || 'Progress is unavailable.'}
          </DSText>
          <DSButton label="Try again" onPress={refresh} />
        </DSSurface>
      ) : (
        <>
          {error || progressError ? (
            <DSSurface>
              <DSText tone="danger">{error || progressError}</DSText>
            </DSSurface>
          ) : null}
          {section === 'xp' ? (
            <>
              <DSSurface style={styles.stack}>
                <DSText variant="heading">
                  Level {summary.level} · {summary.totalXP} lifetime XP
                </DSText>
                <DSText>
                  {summary.levelXP} of 70 XP in this level.{' '}
                  {summary.remainingXP} XP to level up.
                </DSText>
                <DSText>
                  Every level-up earns 1 skip. Levels 4, 7, 10, and every third
                  level after that also earn 1 restore.
                </DSText>
              </DSSurface>
              <DSSurface style={styles.stack}>
                <DSText variant="heading">Ways to earn XP</DSText>
                {[
                  'Successful covered Tap In: 10 XP, up to 30 routine XP daily',
                  'Each get-started task: 10 XP once',
                  '3 / 7 / 14 / 30-day personal streak: 10 / 20 / 30 / 50 XP once',
                  'Strong / Peak momentum: 20 / 30 XP once',
                  '50 successful lifetime Tap Ins: 50 XP once',
                ].map(text => (
                  <DSText key={text}>{text}</DSText>
                ))}
                <DSText tone="muted">
                  Partial entries, failures, skips, restores, and edits earn no
                  routine XP. Buying or using protection never changes your XP.
                  Your saved timezone controls the daily limit; timezone changes
                  take effect after the current window closes.
                </DSText>
              </DSSurface>
              <DSSurface>
                {Array.from(
                  {length: 10},
                  (_, offset) => summary.level + offset,
                ).map(level => (
                  <View key={level} style={styles.line}>
                    <DSText variant="title">Level {level}</DSText>
                    <DSText tone="muted">
                      {level === 1
                        ? 'Start at 0 XP'
                        : `${(level - 1) * 70} lifetime XP · 1 skip${
                            (level - 1) % 3 === 0 ? ' + 1 restore' : ''
                          }`}
                    </DSText>
                  </View>
                ))}
              </DSSurface>
            </>
          ) : null}
          {section === 'checklist' ? (
            <>
              <DSText>
                Earn 10 XP for each task, once per account. Previous completion
                is credited when we can verify it.
              </DSText>
              <DSSurface>
                {PROGRESS_TASKS.map(task => (
                  <ProgressRow
                    key={task.id}
                    title={task.title}
                    subtitle={
                      summary.tasks[task.id]
                        ? summary.awardedTasks?.[task.id]
                          ? 'Complete · 10 XP earned'
                          : 'Complete · XP awaiting activation'
                        : '+10 XP · ' + task.description
                    }
                    icon={summary.tasks[task.id] ? Check : ChevronRight}
                    onPress={() => taskAction(task.id)}
                  />
                ))}
              </DSSurface>
              {busy ? <ActivityIndicator /> : null}
            </>
          ) : null}
          {section === 'history' ? (
            history === undefined && !error ? (
              <ActivityIndicator />
            ) : history?.length ? (
              <View style={styles.stack}>
                {history.map(entry => (
                  <DSSurface key={entry.id} style={styles.stack}>
                    <DSText variant="title">{entry.reason}</DSText>
                    <DSText tone="muted">
                      {entry.createdAt?.toDate().toLocaleString() || 'Pending'}{' '}
                      ·{' '}
                      {entry.xp
                        ? `${entry.xp > 0 ? '+' : ''}${entry.xp} XP`
                        : ''}{' '}
                      {entry.skips
                        ? `${entry.skips > 0 ? '+' : ''}${entry.skips} skips`
                        : ''}{' '}
                      {entry.restores
                        ? `${entry.restores > 0 ? '+' : ''}${
                            entry.restores
                          } restores`
                        : ''}
                    </DSText>
                  </DSSurface>
                ))}
                {history.length >= historyLimit ? (
                  <DSButton
                    label="Show older records"
                    onPress={() => setHistoryLimit(value => value + 100)}
                  />
                ) : null}
              </View>
            ) : (
              <DSText>
                No reward history yet. Your starter rewards will appear here
                when initialized.
              </DSText>
            )
          ) : null}
          {section === 'skips' ? (
            <>
              <DSText>
                {summary.inventory.skips} skips owned. Select an open
                commitment, then choose Use Skip in its Tap In flow.
              </DSText>
              {summary.inventory.skips === 0 ? (
                <DSButton
                  category="green"
                  label="Buy skips"
                  onPress={() =>
                    navigation.setParams({section: 'packs', packType: 'skips'})
                  }
                />
              ) : (!home?.hasResolvedGreetingContext || !openCircles) &&
                !error ? (
                <ActivityIndicator />
              ) : home?.circles.filter(
                  circle =>
                    canTapInToday(circle) &&
                    openCircles?.has(circle.id) &&
                    circle.viewerMembershipStatus === 'active',
                ).length ? (
                <DSSurface>
                  {home.circles
                    .filter(
                      circle =>
                        canTapInToday(circle) &&
                        openCircles?.has(circle.id) &&
                        circle.viewerMembershipStatus === 'active',
                    )
                    .map(circle => (
                      <ProgressRow
                        key={circle.id}
                        title={circle.title}
                        subtitle={circle.commitment}
                        icon={FastForward}
                        onPress={() =>
                          navigation.navigate('TapInComposer', {
                            circleId: circle.id,
                            source: 'tap_in',
                          })
                        }
                      />
                    ))}
                </DSSurface>
              ) : (
                <DSText>
                  No eligible opportunities are open right now. Your skips stay
                  available for later.
                </DSText>
              )}
            </>
          ) : null}
          {section === 'restores' ? (
            <>
              <DSText>
                {summary.inventory.restores} restores owned. One restore
                reconnects one eligible streak gap. Restores never expire.
              </DSText>
              {choice ? (
                <DSSurface style={styles.stack}>
                  <DSText variant="heading">{choice.option.title}</DSText>
                  <DSText>
                    Protect the missed opportunity ending{' '}
                    {choice.option.slot.expiresDateKey}.
                  </DSText>
                  <DSText>
                    Commitment streak: {choice.option.currentStreak} →{' '}
                    {choice.option.resultingStreak} opportunities.
                  </DSText>
                  <DSText>
                    Personal streak: {choice.option.personalStreakBefore} →{' '}
                    {choice.option.personalStreakAfter} days.
                  </DSText>
                  <DSButton
                    label="Use 1 restore"
                    category="orange"
                    busy={busy}
                    disabled={summary.inventory.restores === 0}
                    onPress={confirmRestore}
                  />
                  <DSButton
                    label="Cancel"
                    variant="quiet"
                    disabled={busy}
                    onPress={() => setChoice(undefined)}
                  />
                </DSSurface>
              ) : options === undefined && !error ? (
                <ActivityIndicator />
              ) : options?.length ? (
                <DSSurface>
                  {options.map(option => (
                    <ProgressRow
                      key={option.slot.id}
                      title={option.title}
                      subtitle={`${option.slot.expiresDateKey} · Reconnect ${option.resultingStreak} opportunities`}
                      icon={RotateCcw}
                      onPress={() =>
                        setChoice({option, requestId: requestId()})
                      }
                    />
                  ))}
                </DSSurface>
              ) : (
                <DSText>
                  No eligible streak gaps. A restore needs an existing streak
                  and a single missed opportunity that can reconnect it.
                </DSText>
              )}
              {summary.inventory.restores === 0 ? (
                <DSButton
                  label="Buy restores"
                  category="orange"
                  onPress={() =>
                    navigation.setParams({
                      section: 'packs',
                      packType: 'restores',
                    })
                  }
                />
              ) : null}
              <DSButton
                label="Refresh options"
                variant="quiet"
                disabled={busy}
                onPress={loadRestores}
              />
            </>
          ) : null}
          {section === 'packs' ? (
            <>
              <DSText>
                Rewards belong to your Hoyst account. Purchases add protection
                items and leave XP unchanged.
              </DSText>
              {!summary.flags.buying ? (
                <DSText tone="muted">
                  Reward purchases are not available yet.
                </DSText>
              ) : null}
              {products === undefined && !error ? (
                <ActivityIndicator />
              ) : (
                PACKS.filter(
                  pack =>
                    !packType ||
                    pack.id === 'hoyst_protection_pack' ||
                    pack.id ===
                      (packType === 'skips'
                        ? 'hoyst_skips_3'
                        : 'hoyst_restore_1'),
                ).map(pack => {
                  const product = products?.find(
                    item => item.identifier === pack.id,
                  );
                  return (
                    <DSSurface key={pack.id} style={styles.stack}>
                      <DSText variant="heading">{pack.title}</DSText>
                      <DSText tone="muted">{pack.description}</DSText>
                      <DSButton
                        label={
                          product
                            ? `Buy · ${product.priceString}`
                            : 'Unavailable in this store'
                        }
                        disabled={!product || !summary.flags.buying || busy}
                        category={packType === 'restores' ? 'orange' : 'green'}
                        onPress={() => product && buy(product)}
                      />
                    </DSSurface>
                  );
                })
              )}
              {purchaseState ? (
                <DSText accessibilityLiveRegion="polite">
                  {purchaseState}
                </DSText>
              ) : null}
              <DSButton
                label="Sync purchases"
                variant="quiet"
                busy={busy}
                onPress={retry}
              />
            </>
          ) : null}
        </>
      )}
    </DSScreen>
  );
}
const styles = StyleSheet.create({
  flex: {flex: 1},
  grow: {flex: 1},
  content: {gap: 16},
  header: {flexDirection: 'row', alignItems: 'center', gap: 8},
  back: {width: 44, height: 44, justifyContent: 'center'},
  stack: {gap: 12},
  line: {paddingVertical: 12, gap: 4},
});
