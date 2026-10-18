import React, {useRef, useState} from 'react';
import {
  AccessibilityInfo,
  findNodeHandle,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  View,
} from 'react-native';
import {useSafeAreaInsets} from 'react-native-safe-area-context';
import {DSButton, DSText, useSystemTheme} from '../../../design/system';
import type {ProgressSummary} from '../services/progress-service';
import {ProgressGuestStart} from './ProgressGuestStart';
import {ProgressLadder} from './ProgressLadder';
import {ProgressStatCard, ProgressStatsRow} from './ProgressStatsRow';
import {ProgressXPCard} from './ProgressXPCard';

// Presentation only. This is never written to a wallet or merged with account data.
const startingProgress: ProgressSummary = {
  level: 1,
  totalXP: 0,
  levelXP: 0,
  requiredXP: 70,
  remainingXP: 70,
  inventory: {skips: 0, restores: 0},
  tasks: {},
  milestones: {},
  routineRemainingXP: 0,
  flags: {earning: false, inventory: false, restoring: false, buying: false},
};

const explanations = {
  xp: {
    title: 'XP and level rewards',
    paragraphs: [
      'Your journey starts at Level 1 with 0 XP. Earn 70 XP to reach the next level.',
      'A successful covered Tap In earns 10 XP, up to 30 routine XP a day. Get-started tasks and milestones earn bonus XP.',
      'Every level-up earns 1 skip. Levels 4, 7, 10, and every third level after that also earn 1 restore.',
      'A skip protects your streak when you skip a Tap In. A restore repairs an eligible missed streak. Using these rewards does not earn or spend XP.',
    ],
  },
  streak: {
    title: 'Daily Tap In streak',
    paragraphs: [
      'Your Daily Tap In streak tracks consecutive covered days across your active commitments. A completed goal or valid protection covers a day. Circle streaks separately follow each Circle’s daily, weekly, or monthly cadence.',
      'Complete your Tap Ins to build your streak. You can track your current streak and personal best once you get started.',
    ],
  },
  momentum: {
    title: '14-day momentum',
    paragraphs: [
      'Momentum reflects how consistently you show up over the last 14 days. Recent progress counts more.',
      'Your momentum starts as Not started. Resolve 3 Tap In opportunities to establish your first momentum level.',
    ],
  },
  tapIns: {
    title: 'Lifetime Tap Ins',
    paragraphs: [
      'Your lifetime total counts successful Tap Ins across your commitments. It starts at 0 and grows as you show up.',
      'Skips and restores protect your streak without adding successful Tap Ins to your total.',
    ],
  },
} as const;
type Topic = keyof typeof explanations;

export function ProgressGuestPreview({
  width,
  onGetStarted,
  onSignIn,
}: {
  width: number;
  onGetStarted: () => void;
  onSignIn: () => void;
}) {
  const theme = useSystemTheme();
  const insets = useSafeAreaInsets();
  const [topic, setTopic] = useState<Topic>();
  const sheetHeading = useRef<View>(null);
  const explanation = topic ? explanations[topic] : undefined;
  const close = () => setTopic(undefined);
  return (
    <>
      <ProgressXPCard
        summary={startingProgress}
        guest
        onPress={() => setTopic('xp')}
      />
      <ProgressLadder
        summary={startingProgress}
        onDetails={() => setTopic('xp')}
      />
      <View style={styles.stats} testID="progress-guest-stats">
        <DSText accessibilityRole="header" variant="heading">
          Your stats
        </DSText>
        <ProgressStatsRow
          viewportWidth={width}
          streak="0 days"
          momentum="Not started"
          onStreakPress={() => setTopic('streak')}
          onMomentumPress={() => setTopic('momentum')}
        />
        <ProgressStatCard
          title="Lifetime Tap Ins"
          value="0"
          tone="blue"
          kind="tapIns"
          onPress={() => setTopic('tapIns')}
          targetTestID="progress-tap-ins-card"
        />
      </View>
      <ProgressGuestStart onGetStarted={onGetStarted} onSignIn={onSignIn} />
      {explanation ? (
        <Modal
          transparent
          visible
          animationType="fade"
          presentationStyle="overFullScreen"
          onRequestClose={close}
          onShow={() => {
            const heading = findNodeHandle(sheetHeading.current);
            if (heading != null) {
              AccessibilityInfo.setAccessibilityFocus(heading);
            }
          }}>
          <View style={styles.modalRoot}>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Close explanation"
              onPress={close}
              style={styles.backdrop}
              testID="progress-explanation-backdrop"
            />
            <View
              accessibilityViewIsModal
              onAccessibilityEscape={close}
              importantForAccessibility="yes"
              testID="progress-explanation-sheet"
              style={[
                styles.sheet,
                {
                  backgroundColor: theme.surface,
                  marginTop: insets.top + 16,
                  paddingBottom: Math.max(insets.bottom, 16),
                  paddingLeft: 22 + insets.left,
                  paddingRight: 22 + insets.right,
                },
              ]}>
              <View
                ref={sheetHeading}
                accessible
                accessibilityRole="header"
                accessibilityLabel={explanation.title}>
                <DSText variant="heading">{explanation.title}</DSText>
              </View>
              <ScrollView
                style={styles.sheetScroll}
                contentContainerStyle={styles.sheetContent}>
                {explanation.paragraphs.map(paragraph => (
                  <DSText key={paragraph}>{paragraph}</DSText>
                ))}
              </ScrollView>
              <DSButton label="Close" onPress={close} />
            </View>
          </View>
        </Modal>
      ) : null}
    </>
  );
}

const styles = StyleSheet.create({
  stats: {gap: 12},
  modalRoot: {flex: 1, justifyContent: 'flex-end'},
  backdrop: {...StyleSheet.absoluteFillObject, backgroundColor: '#00000066'},
  sheet: {
    flexShrink: 1,
    maxHeight: '80%',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingTop: 22,
    gap: 16,
  },
  sheetScroll: {flexGrow: 0, flexShrink: 1},
  sheetContent: {gap: 12, paddingBottom: 4},
});
