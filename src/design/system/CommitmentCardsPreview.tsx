/** Debug-only local fixtures. Actions never submit account data. */
import React, {useEffect, useRef, useState} from 'react';
import {ScrollView, StyleSheet, View} from 'react-native';
import {SafeAreaView} from 'react-native-safe-area-context';
import type {CircleManagementCard} from '../../types/models';
import type {CircleProgressSummary} from '../../shared/circle-progress';
import {useSettingsStore} from '../../store/settings-store';
import {HomeCommitmentStack} from '../../features/home/components/HomeCommitmentStack';
import {CircleCardStreaks} from '../../features/circles/components/CircleCardStreaks';
import {SetupChoice} from '../../features/create-circle/components/SetupStepContent';
import {DesignSystemProvider} from './theme';
import {getSystemTheme} from './tokens';
import {DSButton, DSProgress, DSText} from './primitives';
import {DSCommitmentPreview} from './recipes';

function progress(count: number): CircleProgressSummary {
  return {
    version: 2,
    revision: 'preview',
    asOfDateKey: '2026-11-01',
    cadence: 'daily',
    period: {key: '2026-11-01', start: '2026-11-01', end: '2026-11-02'},
    streak: {count, unit: 'day', availability: 'ready'},
    progress: {covered: 0, required: 1, outcome: 'open'},
  };
}
function examples(): CircleManagementCard[] {
  const base: CircleManagementCard = {
    id: 'move',
    title: 'Move a little every day',
    category: 'Fitness',
    appearance: {palette: 'green', emoji: '🏋️'},
    commitment: 'Make time for 30 minutes of movement.',
    circleMode: 'group',
    commitmentType: 'build',
    commitmentCadence: 'daily',
    commitmentFrequency: {tapInsPerWeek: 7},
    targetValue: 30,
    unitLabel: 'minutes',
    state: 'active',
    progressPercent: 50,
    remainingCheckIns: 2,
    viewerHasCheckedIn: false,
    viewerHasTappedInToday: false,
    viewerMembershipStatus: 'active',
    viewerRole: 'member',
    viewerRemainingTapIns: 1,
    cycleCoveredCount: 2,
    cycleRequiredCount: 4,
    streakDays: 4,
    streakLabel: '4 days',
    viewerCircleProgress: progress(4),
    groupStreak: progress(6),
    privacy: 'private',
    joinMode: 'open',
    memberCount: 4,
    maxSize: 4,
    members: [
      {
        id: 'one',
        name: 'Alex',
        initials: 'AL',
        state: 'done',
        cycleGoalMet: true,
      },
      {
        id: 'two',
        name: 'Sam',
        initials: 'SA',
        state: 'done',
        cycleGoalMet: true,
      },
      {
        id: 'three',
        name: 'Taylor',
        initials: 'TA',
        state: 'pending',
        cycleGoalMet: false,
      },
      {
        id: 'four',
        name: 'Drew',
        initials: 'DR',
        state: 'pending',
        cycleGoalMet: false,
      },
    ],
  };
  return [
    base,
    {
      ...base,
      id: 'sleep',
      title: 'Sleep 7 Hours',
      category: 'Wellness',
      appearance: {palette: 'purple', emoji: '😴'},
      commitment: 'Protect a little time to recharge.',
      targetValue: 7,
      unitLabel: 'hours',
      viewerHasTappedInToday: true,
      nudgeTargetCount: 1,
      memberCount: 3,
      maxSize: 3,
      members: base.members.slice(0, 3),
      viewerCircleProgress: progress(3),
      groupStreak: progress(2),
    },
    {
      ...base,
      id: 'read',
      title: 'Read before bed',
      category: 'Learning',
      appearance: {palette: 'blue', emoji: '📚'},
      commitment: 'A few pages to end the day.',
      circleMode: 'personal',
      targetValue: 10,
      unitLabel: 'pages',
      currentValue: 10,
      viewerHasTappedInToday: true,
      viewerTodayStatus: 'done',
      viewerCycleCoveredCount: 1,
      viewerCycleRequiredCount: 1,
      memberCount: 1,
      maxSize: 1,
      members: [
        {
          id: 'viewer',
          name: 'You',
          initials: 'YO',
          state: 'done',
          cycleGoalMet: true,
        },
      ],
      viewerCircleProgress: progress(8),
      groupStreak: undefined,
    },
  ];
}
export function CommitmentCardsPreview({
  mode,
  onClose,
}: {
  mode: string;
  onClose: () => void;
}) {
  const dark = mode.includes('dark');
  const theme = getSystemTheme(dark ? 'dark' : 'light');
  const scroll = useRef<ScrollView>(null);
  const [cards, setCards] = useState(() => {
    const initial = examples();
    if (mode.includes('pending')) {
      return initial.map((card, index) =>
        index === 0
          ? {...card, viewerMembershipStatus: 'pending' as const}
          : card,
      );
    }
    return mode.includes('complete')
      ? initial.map((card, index) =>
          index === 0
            ? {
                ...card,
                viewerHasTappedInToday: true,
                viewerHasNudgedToday: true,
              }
            : card,
        )
      : initial;
  });
  const [notice, setNotice] = useState('Local preview. No account writes.');
  const [selected, setSelected] = useState(false);
  useEffect(() => {
    const previous = useSettingsStore.getState().appearance;
    useSettingsStore
      .getState()
      .setAppearancePreference(dark ? 'dark' : 'light');
    return () => useSettingsStore.getState().setAppearancePreference(previous);
  }, [dark]);
  return (
    <DesignSystemProvider scheme={dark ? 'dark' : 'light'}>
      <SafeAreaView style={[styles.screen, {backgroundColor: theme.canvas}]}>
        <ScrollView
          ref={scroll}
          style={mode.includes('narrow') ? styles.narrow : undefined}
          contentContainerStyle={styles.content}
          onContentSizeChange={() => {
            if (mode.includes('bottom')) {
              scroll.current?.scrollToEnd({animated: false});
            }
          }}>
          <View style={styles.controls}>
            <DSText variant="secondary" tone="muted" style={styles.grow}>
              {notice}
            </DSText>
            <DSButton
              compact
              variant="quiet"
              label="Close preview"
              onPress={onClose}
            />
          </View>
          <DSText variant="screenTitle">Your commitments</DSText>
          <DSProgress completed={1} total={3} label="2 actions needed today" />
          {mode.includes('other') ? (
            <>
              <DSCommitmentPreview
                title={cards[0].title}
                category={cards[0].category}
                appearance={cards[0].appearance}
                description={cards[0].commitment}
                context="2/4 members tapped in"
                status="Needs your Tap In"
                goal={{label: 'Goal', value: '30 minutes daily'}}
                members={cards[0].members.map(m => ({id: m.id, name: m.name}))}
                streaks={<CircleCardStreaks circle={cards[0]} />}
                onDetails={() => setNotice('Details preview')}
                action={{
                  label: 'Tap In',
                  onPress: () => setNotice('Tap In preview'),
                }}
              />
              <DSCommitmentPreview
                title="Membership pending"
                category="Wellness"
                description="Protect time for rest."
                context="Awaiting approval"
                status="Pending approval"
                onDetails={() => setNotice('Pending details')}
              />
              <SetupChoice
                title="Read 10 pages"
                body="A little time with a book, every day."
                tag="Create your own"
                commitmentCategory="Learning"
                selected={selected}
                onPress={() => setSelected(!selected)}
              />
            </>
          ) : (
            <HomeCommitmentStack
              cards={
                mode.includes('long')
                  ? cards.map(c => ({
                      ...c,
                      title:
                        'Make time for movement even on the busiest working days',
                    }))
                  : cards
              }
              isNudged={() => false}
              isNudging={() => false}
              onViewDetails={id => setNotice(`Details preview: ${id}`)}
              onActionPress={card => {
                setCards(current =>
                  current.map(c =>
                    c.id === card.id
                      ? {
                          ...c,
                          viewerHasTappedInToday: true,
                          viewerHasNudgedToday: true,
                        }
                      : c,
                  ),
                );
                setNotice(`Local action complete: ${card.title}`);
              }}
            />
          )}
          <DSButton
            label="Reset local actions"
            variant="quiet"
            onPress={() => setCards(examples())}
          />
        </ScrollView>
      </SafeAreaView>
    </DesignSystemProvider>
  );
}
const styles = StyleSheet.create({
  screen: {flex: 1},
  content: {padding: 22, gap: 16, paddingBottom: 40},
  controls: {flexDirection: 'row', alignItems: 'center', gap: 12},
  grow: {flex: 1},
  narrow: {width: 360, maxWidth: '100%', alignSelf: 'center'},
});
