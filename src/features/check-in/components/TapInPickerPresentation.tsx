import {
  CommitmentCardHeader,
  CommitmentCardSurface,
  getCommitmentCardColors,
} from '../../../design/components/CommitmentCardSurface';
import React, {useState} from 'react';
import {
  Pressable,
  ScrollView,
  StyleSheet,
  useWindowDimensions,
  View,
} from 'react-native';
import {Check, Flame, Plus, Target, X} from 'lucide-react-native';
import {getCircleCategoryVisual} from '../../../design/components/CircleCategoryIcon';
import {HoystTapInMark} from '../../../design/components/HoystTapInMark';
import {
  DSButton,
  DSIconButton,
  DSSurface,
  DSText,
  minimumTarget,
  useSystemTheme,
} from '../../../design/system';
import {
  SafeAreaView,
  useSafeAreaFrame,
  useSafeAreaInsets,
} from 'react-native-safe-area-context';
import {TAP_IN_EXPANDED_DETENT} from '../../../navigation/tap-in-sheet-options';
import {triggerTapInPressHaptic} from '../../../lib/haptics/tap-in-haptics';
import type {CircleManagementCard} from '../../../types/models';
import {
  formatCommitmentQuantity,
  getCommitmentGoalLabel,
  getCommitmentGoalPresentation,
} from '../../commitments/commitment-goal-label';
import {
  getCommitmentType,
  getCoverageStatusForValue,
  getQuantityConfig,
} from '../../commitments/commitment-logic';
import {getCircleCycleProgressPresentation} from '../../commitments/cycle-progress-presentation';

export type PickerUtility = {
  circle: CircleManagementCard;
  label: string;
  progress: string;
  status: string;
  kind: 'nudge' | 'share' | 'view';
  busy?: boolean;
  disabled?: boolean;
  onPress: () => void;
};

function savedQuantityStatus(circle: CircleManagementCard) {
  if (!getCommitmentGoalLabel(circle) || !circle.viewerHasTappedInToday) {
    return undefined;
  }
  if (
    typeof circle.currentValue !== 'number' ||
    !Number.isFinite(circle.currentValue)
  ) {
    return 'Progress saved';
  }
  const value = circle.currentValue;
  const config = getQuantityConfig(circle);
  const covered =
    getCoverageStatusForValue({circle, currentValue: value}) === 'covered';
  if (getCommitmentType(circle) === 'limit') {
    const hasRange = typeof config.minimumValue === 'number';
    const compliance = covered
      ? hasRange
        ? 'Within range'
        : 'Within limit'
      : hasRange
      ? value < config.minimumValue!
        ? 'Below range'
        : 'Above range'
      : 'Above limit';
    return `${formatCommitmentQuantity(
      value,
      config.unitLabel,
    )} logged · ${compliance}`;
  }
  return covered
    ? 'Progress saved · Goal covered'
    : `Progress saved · ${formatCommitmentQuantity(
        Math.max(0, (config.targetValue ?? 1) - value),
        config.unitLabel,
      )} remaining`;
}

function Commitment({
  circle,
  featured = false,
  deadline,
  onPress,
}: {
  circle: CircleManagementCard;
  featured?: boolean;
  deadline?: string;
  onPress: () => void;
}) {
  const theme = useSystemTheme();
  const {fontScale, width} = useWindowDimensions();
  const visual = getCircleCategoryVisual(circle.category, circle.appearance);
  const colors = getCommitmentCardColors(
    circle.category,
    circle.appearance,
    theme.isDark,
  );
  const goal = getCommitmentGoalPresentation(circle);
  const update = circle.viewerCanUpdateTapIn && circle.viewerHasTappedInToday;
  const label = update ? 'Update Tap In' : 'Tap In';
  const stackAction = fontScale >= 1.5 || width < 375;
  const cycleProgress = getCircleCycleProgressPresentation(circle);
  const status =
    savedQuantityStatus(circle) ??
    (circle.viewerHasTappedInToday
      ? 'Saved today'
      : circle.state === 'risk'
      ? 'Streak at risk'
      : 'Ready today');
  const action = (
    <DSButton
      category={visual.tone}
      compact
      variant="primary"
      label={label}
      accessibilityLabel={`${label} for ${circle.title}`}
      onPress={onPress}
      onPressIn={triggerTapInPressHaptic}
      testID={`tap-in-picker-${featured ? 'priority' : 'due'}-action-${
        circle.id
      }`}
    />
  );
  const footer = (
    <View style={[styles.footer, stackAction && styles.stackedFooter]}>
      <View style={styles.status}>
        <View
          style={status === 'Streak at risk' ? styles.riskStatus : undefined}>
          {status === 'Streak at risk' ? (
            <Flame
              accessible={false}
              color={theme.warning}
              size={14}
              strokeWidth={2.4}
            />
          ) : null}
          <DSText
            variant="secondary"
            tone={status === 'Streak at risk' ? 'warning' : 'muted'}>
            {status}
            {featured && deadline ? (
              <DSText variant="secondary" tone="muted">
                {` · ${deadline}`}
              </DSText>
            ) : null}
          </DSText>
        </View>
        <DSText variant="secondary" tone="muted">
          {cycleProgress.listLabel}
        </DSText>
        {circle.circleMode === 'personal' ? (
          <DSText variant="secondary" tone="muted">
            Personal commitment
          </DSText>
        ) : null}
      </View>
      {action}
    </View>
  );
  const content = (
    <>
      <CommitmentCardHeader
        title={circle.title}
        category={circle.category}
        appearance={circle.appearance}
        colors={colors}
        categorySuffix={getCommitmentType(circle).toUpperCase()}
      />
      <View style={styles.description}>
        <DSText tone="muted">{circle.commitment}</DSText>
        {goal ? (
          <View
            style={styles.goalLine}
            testID={`tap-in-picker-goal-${circle.id}`}>
            <Target
              accessible={false}
              color={theme.muted}
              size={14}
              strokeWidth={2.2}
              style={styles.goalIcon}
            />
            <DSText variant="secondary" tone="muted" style={styles.goalText}>
              {goal.label}
            </DSText>
            <DSText variant="secondary" tone="muted" style={styles.goalText}>
              {goal.label === 'Goal' ? ': ' : ' · '}
            </DSText>
            <DSText
              variant="secondary"
              tone="muted"
              style={[styles.goalText, styles.goalValue]}>
              {goal.value}
            </DSText>
          </View>
        ) : null}
      </View>
    </>
  );
  return (
    <CommitmentCardSurface
      colors={colors}
      footer={footer}
      testID={`tap-in-${featured ? 'priority' : 'due'}-card-${circle.id}`}>
      {content}
    </CommitmentCardSurface>
  );
}

export function TapInPickerPresentation({
  coveredCount,
  totalCount,
  dueCircles,
  utilities,
  deadline,
  message,
  active = true,
  onClose,
  onCreateCircle,
  onTapIn,
}: {
  coveredCount: number;
  totalCount: number;
  dueCircles: CircleManagementCard[];
  utilities: PickerUtility[];
  deadline?: string;
  message?: {title: string; body: string; success?: boolean};
  active?: boolean;
  onClose: () => void;
  onCreateCircle: () => void;
  onTapIn: (circleId: string) => void;
}) {
  const theme = useSystemTheme();
  const [createPressed, setCreatePressed] = useState(false);
  const insets = useSafeAreaInsets();
  const {fontScale} = useWindowDimensions();
  const {height} = useSafeAreaFrame();
  const maximumSheetHeight = Math.max(1, height - insets.top - 10);
  const initialSheetHeight = Math.round(
    maximumSheetHeight * TAP_IN_EXPANDED_DETENT,
  );
  return (
    <SafeAreaView
      edges={['left', 'right']}
      collapsable={false}
      style={[
        styles.sheet,
        {backgroundColor: theme.canvas, height: initialSheetHeight},
      ]}
      testID="tap-in-picker-sheet-frame">
      {/* Keep this native sibling before ScrollView. Screens may otherwise
          promote the first descendant scroll view into the sheet gesture tree. */}
      <View
        collapsable={false}
        pointerEvents="none"
        style={styles.scrollOrigin}
      />
      <ScrollView
        bounces={false}
        contentInsetAdjustmentBehavior="never"
        automaticallyAdjustContentInsets={false}
        keyboardDismissMode="interactive"
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
        style={styles.scroll}
        contentContainerStyle={[
          styles.content,
          {paddingBottom: 24 + insets.bottom},
        ]}>
        <View style={styles.hero}>
          <View
            accessible={false}
            accessibilityElementsHidden
            importantForAccessibility="no-hide-descendants"
            style={styles.mark}>
            <HoystTapInMark
              size={52}
              animated={active}
              testID="tap-in-picker-logo"
            />
          </View>
          <DSIconButton
            label="Close Tap In picker"
            onPress={onClose}
            icon={<X color={theme.muted} size={22} />}
            style={styles.close}
          />
          <View key={fontScale} style={styles.headingRow}>
            <View style={styles.heading}>
              <DSText variant="screenTitle" accessibilityRole="header">
                Tap In
              </DSText>
              <DSText tone="muted">
                {coveredCount} of {totalCount} tapped in
              </DSText>
            </View>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Create a circle"
              onPress={onCreateCircle}
              onPressIn={() => setCreatePressed(true)}
              onPressOut={() => setCreatePressed(false)}
              style={[
                styles.create,
                {backgroundColor: theme.surface, borderColor: theme.border},
                createPressed && styles.createPressed,
              ]}>
              <Plus color={theme.text} size={16} />
              <DSText variant="action">Create</DSText>
            </Pressable>
          </View>
        </View>
        {dueCircles.length ? (
          <View style={styles.dueStack} testID="tap-in-picker-due-stack">
            {dueCircles.map((circle, index) => (
              <Commitment
                key={circle.id}
                circle={circle}
                featured={index === 0}
                deadline={index === 0 ? deadline : undefined}
                onPress={() => onTapIn(circle.id)}
              />
            ))}
          </View>
        ) : message ? (
          <DSSurface
            kind="message"
            category={message.success ? 'green' : undefined}
            style={styles.message}>
            {message.success ? <Check size={24} color={theme.success} /> : null}
            <View style={styles.copy}>
              <DSText variant="title">{message.title}</DSText>
              <DSText tone="muted">{message.body}</DSText>
            </View>
          </DSSurface>
        ) : null}
        {totalCount > 0 ? (
          <View style={styles.utilities}>
            <DSText variant="secondary" tone="muted">
              Also today
            </DSText>
            {utilities.length ? (
              utilities.map(utility => {
                const circle = utility.circle;
                const colors = getCommitmentCardColors(
                  circle.category,
                  circle.appearance,
                  theme.isDark,
                );
                const visual = getCircleCategoryVisual(
                  circle.category,
                  circle.appearance,
                );
                const goal = getCommitmentGoalPresentation(circle);
                return (
                  <CommitmentCardSurface
                    key={circle.id}
                    colors={colors}
                    testID={`tap-in-utility-card-${circle.id}`}
                    footer={
                      <View style={styles.footer}>
                        <View style={styles.copy}>
                          <DSText variant="secondary" tone="muted">
                            {utility.status}
                          </DSText>
                          <DSText variant="secondary" tone="muted">
                            {utility.progress}
                          </DSText>
                        </View>
                        <DSButton
                          label={utility.label}
                          category={visual.tone}
                          compact
                          busy={utility.busy}
                          disabled={utility.disabled}
                          accessibilityLabel={`${utility.label} for ${circle.title}`}
                          testID={`tap-in-picker-utility-${circle.id}`}
                          onPress={utility.onPress}
                        />
                      </View>
                    }>
                    <CommitmentCardHeader
                      title={circle.title}
                      category={circle.category}
                      appearance={circle.appearance}
                      colors={colors}
                    />
                    <DSText tone="muted">{circle.commitment}</DSText>
                    {goal ? (
                      <DSText variant="secondary" tone="muted">
                        {goal.label}
                        {goal.label === 'Goal' ? ': ' : ' · '}
                        {goal.value}
                      </DSText>
                    ) : null}
                  </CommitmentCardSurface>
                );
              })
            ) : (
              <DSText variant="secondary" tone="muted">
                Nothing else needs you
              </DSText>
            )}
          </View>
        ) : null}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  sheet: {flex: 1},
  scroll: {flex: 1},
  scrollOrigin: {height: 1, marginBottom: -1},
  content: {paddingTop: 0, paddingHorizontal: 22, gap: 16, paddingBottom: 24},
  hero: {gap: 16, paddingTop: 32},
  mark: {alignItems: 'center'},
  close: {position: 'absolute', top: 16, right: -6},
  headingRow: {flexDirection: 'row', alignItems: 'center', gap: 12},
  heading: {flex: 1, minWidth: 0, gap: 4},
  create: {
    flexDirection: 'row',
    flexShrink: 0,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    paddingHorizontal: 12,
    minHeight: minimumTarget(),
    minWidth: minimumTarget(),
    borderWidth: 1,
    borderRadius: 999,
  },
  createPressed: {opacity: 0.7},
  dueStack: {gap: 16},
  copy: {flex: 1, minWidth: 0, gap: 4},
  description: {gap: 4},
  goalLine: {alignItems: 'center', flexDirection: 'row', flexWrap: 'wrap'},
  goalIcon: {marginRight: 3},
  goalText: {fontWeight: '600'},
  // The native italic face is too subtle at 12 points on the selector.
  goalValue: {
    fontStyle: 'italic',
    transform: [{skewX: '-8deg'}],
  },
  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    flexWrap: 'wrap',
  },
  stackedFooter: {alignItems: 'flex-start', flexDirection: 'column'},
  status: {flexGrow: 1, flexShrink: 1, minWidth: 120, gap: 4},
  // Match the goal row's 14-point icon plus its 3-point text offset.
  riskStatus: {alignItems: 'center', flexDirection: 'row', gap: 3},
  message: {flexDirection: 'row', gap: 12, alignItems: 'center'},
  utilities: {gap: 4},
});
