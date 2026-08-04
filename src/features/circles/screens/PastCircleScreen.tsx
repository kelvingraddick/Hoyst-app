import React, {useEffect, useMemo, useState} from 'react';
import {Image, StyleSheet, View} from 'react-native';
import {ArrowLeft, CalendarDays, Check, Minus, X} from 'lucide-react-native';
import type {NativeStackScreenProps} from '@react-navigation/native-stack';

import {FrostedBackdrop} from '../../../design/components/FrostedBackdrop';
import {GlassPanel} from '../../../design/components/GlassPanel';
import {HoystScreen} from '../../../design/components/HoystScreen';
import {HoystText} from '../../../design/components/HoystText';
import {HeroIconButton} from '../../../design/components/ScreenHeroHeader';
import {useHoystTheme} from '../../../design/theme/useHoystTheme';
import type {RootStackParamList} from '../../../navigation/types';
import {useSessionStore} from '../../../store/session-store';
import {
  subscribeToPastCircleMembershipPeriods,
  subscribeToPastCircleTapIns,
  type PastCircleMembershipPeriod,
  type PastCircleTapIn,
} from '../services/past-circle-service';

type Props = NativeStackScreenProps<RootStackParamList, 'PastCircle'>;

function formatDate(date?: Date) {
  return date
    ? new Intl.DateTimeFormat('en-US', {
        day: 'numeric',
        month: 'short',
        year: 'numeric',
      }).format(date)
    : 'Unknown';
}

function formatDateKey(dateKey: string) {
  const date = new Date(`${dateKey}T12:00:00Z`);
  return Number.isNaN(date.getTime()) ? dateKey : formatDate(date);
}

function getOutcome(tapIn: PastCircleTapIn) {
  if (tapIn.status === 'skip') {
    return {label: 'Skipped', tone: 'warning' as const};
  }
  if (tapIn.status === 'partial') {
    return {label: 'Progress logged', tone: 'warning' as const};
  }
  if (tapIn.status === 'failed') {
    return {label: 'Outside target', tone: 'danger' as const};
  }
  return {label: 'Covered', tone: 'success' as const};
}

export function PastCircleScreen({navigation, route}: Props) {
  const theme = useHoystTheme();
  const uid = useSessionStore(state => state.user?.uid);
  const [tapIns, setTapIns] = useState<PastCircleTapIn[]>([]);
  const [membershipPeriods, setMembershipPeriods] = useState<
    PastCircleMembershipPeriod[]
  >([]);
  const summary = route.params.summary;

  useEffect(() => {
    if (!uid) {
      setTapIns([]);
      return undefined;
    }

    return subscribeToPastCircleTapIns({
      circleId: summary.circleId,
      onError: () => undefined,
      onTapIns: setTapIns,
      uid,
    });
  }, [summary.circleId, uid]);

  useEffect(() => {
    if (!uid) {
      setMembershipPeriods([]);
      return undefined;
    }

    return subscribeToPastCircleMembershipPeriods({
      circleId: summary.circleId,
      onError: () => undefined,
      onPeriods: setMembershipPeriods,
      uid,
    });
  }, [summary.circleId, uid]);

  const visibleMembershipPeriods = useMemo(
    () =>
      membershipPeriods.length > 0
        ? membershipPeriods
        : [
            {
              id: 'summary',
              joinedAt: summary.joinedAt,
              leftAt: summary.leftAt,
              role: 'member' as const,
            },
          ],
    [membershipPeriods, summary.joinedAt, summary.leftAt],
  );

  return (
    <HoystScreen
      background={<FrostedBackdrop />}
      contentContainerStyle={styles.content}>
      <View style={styles.navRow}>
        <HeroIconButton
          accessibilityLabel="Go back"
          onPress={() => navigation.goBack()}>
          <ArrowLeft color={theme.text} size={22} strokeWidth={2.3} />
        </HeroIconButton>
        <HoystText style={styles.navTitle}>Past Circle</HoystText>
        <View style={styles.navSpacer} />
      </View>

      <GlassPanel style={styles.heroPanel}>
        <HoystText style={styles.eyebrow}>PAST CIRCLE</HoystText>
        <HoystText style={styles.title}>{summary.title}</HoystText>
        <HoystText tone="muted">{summary.commitment}</HoystText>
        <View
          style={[
            styles.categoryPill,
            {backgroundColor: theme.tabActiveBackground},
          ]}>
          <HoystText style={[styles.categoryLabel, {color: theme.accent}]}>
            {summary.category}
          </HoystText>
        </View>
        <View style={styles.membershipHistory}>
          <HoystText tone="muted" variant="label">
            Membership history
          </HoystText>
          {visibleMembershipPeriods.map((period, index) => (
            <View key={period.id} style={styles.membershipRow}>
              <CalendarDays color={theme.accent} size={17} strokeWidth={2.2} />
              <View style={styles.membershipPeriodCopy}>
                <HoystText style={styles.membershipCopy}>
                  {formatDate(period.joinedAt)} to {formatDate(period.leftAt)}
                </HoystText>
                {visibleMembershipPeriods.length > 1 ? (
                  <HoystText tone="muted" variant="tiny">
                    Membership period {index + 1}
                  </HoystText>
                ) : null}
              </View>
            </View>
          ))}
        </View>
      </GlassPanel>

      <View style={styles.sectionHeader}>
        <HoystText style={styles.sectionTitle}>Your Tap Ins</HoystText>
        <HoystText tone="muted" variant="caption">
          Read-only history from this Circle
        </HoystText>
      </View>

      {tapIns.length > 0 ? (
        tapIns.map(tapIn => {
          const outcome = getOutcome(tapIn);
          const outcomeColor =
            outcome.tone === 'success'
              ? theme.successForeground
              : outcome.tone === 'danger'
              ? theme.dangerForeground
              : theme.warningForeground;
          const OutcomeIcon =
            tapIn.status === 'failed'
              ? X
              : tapIn.status === 'partial' || tapIn.status === 'skip'
              ? Minus
              : Check;

          return (
            <GlassPanel
              key={`${tapIn.dateKey}_${tapIn.id}`}
              style={styles.tapInCard}>
              <View style={styles.tapInHeader}>
                <HoystText style={styles.tapInDate}>
                  {formatDateKey(tapIn.dateKey)}
                </HoystText>
                <View style={styles.outcomeRow}>
                  <OutcomeIcon
                    color={outcomeColor}
                    size={15}
                    strokeWidth={2.6}
                  />
                  <HoystText
                    style={[styles.outcomeLabel, {color: outcomeColor}]}>
                    {outcome.label}
                  </HoystText>
                </View>
              </View>
              {typeof tapIn.currentValue === 'number' ? (
                <HoystText>
                  {tapIn.currentValue} {tapIn.unitLabel ?? 'units'}
                </HoystText>
              ) : null}
              {tapIn.note ? (
                <HoystText tone="muted">{tapIn.note}</HoystText>
              ) : null}
              {tapIn.photoUrl ? (
                <Image
                  source={{uri: tapIn.photoUrl}}
                  style={styles.tapInPhoto}
                />
              ) : null}
            </GlassPanel>
          );
        })
      ) : (
        <GlassPanel style={styles.emptyPanel}>
          <HoystText style={styles.emptyTitle}>No saved Tap Ins</HoystText>
          <HoystText tone="muted" variant="caption">
            There is no retained Tap In history for this Circle.
          </HoystText>
        </GlassPanel>
      )}
    </HoystScreen>
  );
}

const styles = StyleSheet.create({
  categoryLabel: {fontSize: 12, fontWeight: '800', lineHeight: 15},
  categoryPill: {
    alignSelf: 'flex-start',
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  content: {gap: 18, paddingBottom: 48, paddingHorizontal: 20},
  emptyPanel: {gap: 6},
  emptyTitle: {fontSize: 17, fontWeight: '800', lineHeight: 21},
  eyebrow: {
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 1.3,
    lineHeight: 15,
  },
  heroPanel: {gap: 9},
  membershipCopy: {fontSize: 13, fontWeight: '700', lineHeight: 17},
  membershipHistory: {gap: 8, marginTop: 4},
  membershipPeriodCopy: {flex: 1, gap: 1},
  membershipRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 8,
  },
  navRow: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  navSpacer: {height: 44, width: 44},
  navTitle: {fontSize: 17, fontWeight: '800', lineHeight: 21},
  outcomeLabel: {fontSize: 12, fontWeight: '800', lineHeight: 15},
  outcomeRow: {alignItems: 'center', flexDirection: 'row', gap: 5},
  sectionHeader: {gap: 2},
  sectionTitle: {fontSize: 20, fontWeight: '800', lineHeight: 24},
  tapInCard: {gap: 10},
  tapInDate: {fontSize: 15, fontWeight: '800', lineHeight: 19},
  tapInHeader: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  tapInPhoto: {aspectRatio: 1.5, borderRadius: 16, width: '100%'},
  title: {fontSize: 28, fontWeight: '800', letterSpacing: -0.5, lineHeight: 32},
});
