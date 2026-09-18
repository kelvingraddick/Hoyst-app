import React from 'react';
import {ScrollView, StyleSheet, useWindowDimensions, View} from 'react-native';
import {
  ArrowUpRight,
  Bell,
  Check,
  Flame,
  Share2,
  Target,
  X,
} from 'lucide-react-native';
import {
  CircleCategoryIcon,
  getCircleCategoryVisual,
} from '../../../design/components/CircleCategoryIcon';
import {HoystTapInMark} from '../../../design/components/HoystTapInMark';
import {
  DSButton,
  DSIconButton,
  DSListRow,
  DSSurface,
  DSText,
  useSystemTheme,
} from '../../../design/system';
import {
  initialWindowMetrics,
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
  showDivider = false,
  deadline,
  onPress,
}: {
  circle: CircleManagementCard;
  featured?: boolean;
  showDivider?: boolean;
  deadline?: string;
  onPress: () => void;
}) {
  const theme = useSystemTheme();
  const {fontScale, width} = useWindowDimensions();
  const visual = getCircleCategoryVisual(circle.category);
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
  const content = (
    <>
      <View style={styles.identity}>
        <CircleCategoryIcon
          category={circle.category}
          size={32}
          showBackplate={false}
        />
        <View style={styles.copy}>
          <DSText variant="title">{circle.title}</DSText>
          <DSText
            variant="category"
            style={{color: theme.category[visual.tone].foreground}}>
            {visual.label.toUpperCase()}
            <DSText variant="category" tone="muted">{` · ${getCommitmentType(
              circle,
            ).toUpperCase()}`}</DSText>
          </DSText>
        </View>
      </View>
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
    </>
  );
  return (
    <DSSurface
      category={visual.tone}
      style={[
        styles.featured,
        styles.stackedCard,
        showDivider && {
          borderBottomColor: theme.border,
          borderBottomWidth: StyleSheet.hairlineWidth,
        },
      ]}
      testID={`tap-in-${featured ? 'priority' : 'due'}-card-${circle.id}`}>
      {content}
    </DSSurface>
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
  onTapIn: (circleId: string) => void;
}) {
  const theme = useSystemTheme();
  const insets = useSafeAreaInsets();
  const {height} = useWindowDimensions();
  const maximumSheetHeight = Math.max(
    1,
    height - (initialWindowMetrics?.insets.top ?? insets.top) - 10,
  );
  const initialSheetHeight = Math.round(
    maximumSheetHeight * TAP_IN_EXPANDED_DETENT,
  );
  return (
    <View
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
          <View style={styles.heading}>
            <DSText variant="screenTitle" accessibilityRole="header">
              Tap In
            </DSText>
            <DSText tone="muted">
              {coveredCount} of {totalCount} tapped in
            </DSText>
          </View>
        </View>
        {dueCircles.length ? (
          <View style={styles.dueStack} testID="tap-in-picker-due-stack">
            {dueCircles.map((circle, index) => (
              <Commitment
                key={circle.id}
                circle={circle}
                featured={index === 0}
                showDivider={index < dueCircles.length - 1}
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
                const Icon =
                  utility.kind === 'nudge'
                    ? Bell
                    : utility.kind === 'share'
                    ? Share2
                    : ArrowUpRight;
                return (
                  <DSListRow
                    key={utility.circle.id}
                    title={utility.circle.title}
                    subtitle={`${utility.status}\n${utility.progress}`}
                    leading={<Icon color={theme.muted} size={22} />}
                    action={
                      <DSButton
                        label={utility.label}
                        variant="quiet"
                        compact
                        labelStyle={[styles.utilityLabel, {color: theme.muted}]}
                        busy={utility.busy}
                        disabled={utility.disabled}
                        accessibilityLabel={`${utility.label} for ${utility.circle.title}`}
                        testID={`tap-in-picker-utility-${utility.circle.id}`}
                        onPress={utility.onPress}
                      />
                    }
                  />
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
    </View>
  );
}

const styles = StyleSheet.create({
  sheet: {flex: 1},
  scroll: {flex: 1},
  scrollOrigin: {height: 1, marginBottom: -1},
  utilityLabel: {fontWeight: '400'},
  content: {paddingTop: 0, paddingHorizontal: 22, gap: 16, paddingBottom: 24},
  hero: {gap: 16, paddingTop: 32},
  mark: {alignItems: 'center'},
  close: {position: 'absolute', top: 16, right: -6},
  heading: {gap: 4},
  featured: {
    paddingHorizontal: 18,
    paddingVertical: 12,
    borderRadius: 18,
    gap: 12,
  },
  dueStack: {borderRadius: 18, gap: 0, overflow: 'hidden'},
  stackedCard: {borderRadius: 0},
  identity: {flexDirection: 'row', alignItems: 'center', gap: 12},
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
