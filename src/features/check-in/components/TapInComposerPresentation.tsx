import React, {useEffect, useId, useRef, useState} from 'react';
import {
  AccessibilityInfo,
  ActivityIndicator,
  Animated,
  AppState,
  Easing,
  Image,
  Keyboard,
  TextInput,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  View,
  useWindowDimensions,
} from 'react-native';
import Svg, {Circle, Defs, LinearGradient, Rect, Stop} from 'react-native-svg';
import {
  Camera,
  Check,
  ChevronRight,
  Flame,
  Minus,
  Plus,
  X,
} from 'lucide-react-native';
import type {NativeStackNavigationProp} from '@react-navigation/native-stack';
import {
  initialWindowMetrics,
  useSafeAreaInsets,
} from 'react-native-safe-area-context';
import {
  CircleCategoryIcon,
  getCircleCategoryVisual,
} from '../../../design/components/CircleCategoryIcon';
import {HoystTapInMark} from '../../../design/components/HoystTapInMark';
import {
  DSButton,
  DSIconButton,
  DSText,
  useSystemTheme,
  type CategoryTone,
} from '../../../design/system';
import {getTapInSheetDetents} from '../../../navigation/tap-in-sheet-options';
import type {RootStackParamList} from '../../../navigation/types';
import type {CircleDetailModel} from '../../../types/models';
import {
  getCommitmentType,
  formatQuantityValue,
} from '../../commitments/commitment-logic';
import {getComposerQuantity} from './composer-quantity';

type Navigation = NativeStackNavigationProp<
  RootStackParamList,
  'TapInComposer'
>;

/** Native shell measures natural body and footer heights separately, never its viewport. */
export function ComposerSheet({
  navigation,
  children,
  footer,
  scrollResetKey,
}: {
  navigation: Navigation;
  children: React.ReactNode;
  footer?: React.ReactNode;
  /** Reset only after a local editor transition, never on initial mount. */
  scrollResetKey?: number;
}) {
  const theme = useSystemTheme();
  const insets = useSafeAreaInsets();
  const {height, width, fontScale} = useWindowDimensions();
  const [bodyHeight, setBodyHeight] = useState(0);
  const originRef = useRef<View>(null);
  const scrollRef = useRef<ScrollView>(null);
  const contentRef = useRef<View>(null);
  const [keyboardInset, setKeyboardInset] = useState(0);
  const frameHeightRef = useRef(0);
  const [footerHeight, setFooterHeight] = useState(0);
  const [isExpanded, setIsExpanded] = useState(false);
  const compactRef = useRef(0.3);
  const priorScrollResetKey = useRef(scrollResetKey);
  const maximumHeight = Math.max(
    1,
    height - (initialWindowMetrics?.insets.top ?? insets.top) - 10,
  );
  const bottom = Math.max(
    insets.bottom,
    initialWindowMetrics?.insets.bottom ?? 0,
  );
  // Keep the dock near the lower sheet edge while preserving a reliable
  // clearance above the iOS home indicator.
  const footerBottomInset =
    Platform.OS === 'ios' ? Math.max(20, bottom - 8) : bottom;
  useEffect(() => {
    const show = Keyboard.addListener('keyboardDidShow', event => {
      originRef.current?.measureInWindow((_x, y) => {
        // Screens' Fabric measurement can omit the native modal translation.
        // iOS moves an editing sheet below the top safe area while the keyboard is open.
        const origin = Math.max(y, initialWindowMetrics?.insets.top ?? 0);
        const visibleHeight = Math.min(
          frameHeightRef.current,
          event.endCoordinates.screenY - origin,
        );
        setKeyboardInset(Math.max(0, frameHeightRef.current - visibleHeight));
        requestAnimationFrame(() =>
          requestAnimationFrame(() => {
            const input = TextInput.State.currentlyFocusedInput();
            if (input && contentRef.current) {
              input.measureLayout(
                contentRef.current,
                (_left, top, _width, inputHeight) => {
                  scrollRef.current?.scrollTo({
                    y: Math.max(
                      0,
                      top + inputHeight - (visibleHeight - footerHeight) + 16,
                    ),
                    animated: true,
                  });
                },
                () => undefined,
              );
            }
          }),
        );
      });
    });
    const hide = Keyboard.addListener('keyboardDidHide', () =>
      setKeyboardInset(0),
    );
    return () => {
      show.remove();
      hide.remove();
    };
  }, [footerHeight]);
  useEffect(() => {
    if (scrollResetKey === priorScrollResetKey.current) {
      return;
    }
    priorScrollResetKey.current = scrollResetKey;
    requestAnimationFrame(() =>
      scrollRef.current?.scrollTo({animated: false, y: 0}),
    );
  }, [scrollResetKey]);
  const hasFooter = Boolean(footer);
  const naturalHeight = bodyHeight + (hasFooter ? footerHeight : 0);
  const compact = getTapInSheetDetents(naturalHeight, maximumHeight)[0];
  compactRef.current = compact;
  const frameHeight = Math.round(maximumHeight * (isExpanded ? 0.92 : compact));
  frameHeightRef.current = frameHeight;
  useEffect(
    () =>
      navigation.addListener('sheetDetentChange', event => {
        if (event.data.stable && compactRef.current < 0.92) {
          setIsExpanded(event.data.index > 0);
        }
      }),
    [navigation],
  );
  useEffect(() => {
    if (!bodyHeight || (hasFooter && !footerHeight)) {
      return;
    }
    // Keeping the existing second stop retains a user's expanded selection.
    const detents = getTapInSheetDetents(naturalHeight, maximumHeight);
    navigation.setOptions({
      sheetAllowedDetents: detents,
      sheetInitialDetentIndex: isExpanded ? detents.length - 1 : 0,
      contentStyle: {backgroundColor: theme.canvas},
    });
  }, [
    bodyHeight,
    footerHeight,
    hasFooter,
    naturalHeight,
    maximumHeight,
    compact,
    isExpanded,
    navigation,
    theme.canvas,
    width,
    fontScale,
  ]);
  return (
    <View
      collapsable={false}
      style={[
        styles.sheet,
        {
          backgroundColor: theme.canvas,
          height: frameHeight,
          paddingBottom: Platform.OS === 'ios' ? keyboardInset : 0,
        },
      ]}
      testID="tap-in-composer-sheet-frame">
      {/* Screens 4.10 coerces the first descendant ScrollView to the entire
          sheet frame. Keep a native first sibling so our docked footer and
          keyboard-aware viewport retain their measured layout. */}
      <View
        ref={originRef}
        collapsable={false}
        pointerEvents="none"
        style={{height: 1, marginBottom: -1}}
      />
      <View collapsable={false} style={{flex: 1, overflow: 'hidden'}}>
        <ScrollView
          ref={scrollRef}
          style={{flex: 1, overflow: 'hidden'}}
          bounces={false}
          showsVerticalScrollIndicator={false}
          contentInsetAdjustmentBehavior="never"
          automaticallyAdjustContentInsets={false}
          keyboardDismissMode="interactive"
          keyboardShouldPersistTaps="handled"
          onContentSizeChange={(_, nextHeight) =>
            setBodyHeight(Math.ceil(nextHeight))
          }
          contentContainerStyle={
            !hasFooter ? {paddingBottom: bottom} : undefined
          }>
          <View ref={contentRef} collapsable={false}>
            {children}
          </View>
        </ScrollView>
      </View>
      {hasFooter ? (
        <View
          testID="tap-in-composer-action-footer-position"
          onLayout={event =>
            setFooterHeight(Math.ceil(event.nativeEvent.layout.height))
          }
          style={[
            styles.footer,
            {paddingBottom: footerBottomInset, backgroundColor: theme.canvas},
          ]}>
          {footer}
        </View>
      ) : null}
    </View>
  );
}

export function ComposerHeader({
  detail,
  status,
  onClose,
}: {
  detail?: CircleDetailModel;
  status?: string;
  onClose: () => void;
}) {
  const theme = useSystemTheme();
  const [headerHeight, setHeaderHeight] = useState(0);
  const fadeId = useId().replace(/:/g, '');
  const category = getCircleCategoryVisual(detail?.category ?? 'General');
  return (
    <View
      onLayout={event => setHeaderHeight(event.nativeEvent.layout.height)}
      testID="tap-in-composer-header">
      <View pointerEvents="none" style={StyleSheet.absoluteFill}>
        <Svg
          width="100%"
          height={headerHeight}
          testID="tap-in-composer-category-fade"
          accessible={false}>
          <Defs>
            <LinearGradient id={fadeId} x1="0" y1="0" x2="0" y2="1">
              <Stop
                offset="0"
                stopColor={theme.category[category.tone].surface}
              />
              <Stop offset="1" stopColor={theme.canvas} />
            </LinearGradient>
          </Defs>
          <Rect width="100%" height="100%" fill={`url(#${fadeId})`} />
        </Svg>
      </View>
      <View style={styles.brandRow} testID="tap-in-composer-close-row">
        <HoystTapInMark size={52} testID="tap-in-composer-logo" />
        <View style={styles.close}>
          <DSIconButton
            label="Close Tap In composer"
            onPress={onClose}
            icon={<X color={theme.muted} size={20} />}
          />
        </View>
      </View>
      {detail ? (
        <View style={styles.details}>
          <View style={styles.titleRow}>
            <CircleCategoryIcon
              category={detail.category}
              size={34}
              showBackplate={false}
            />
            <View style={styles.titleCopy}>
              <DSText
                variant="screenTitle"
                testID="tap-in-composer-circle-title">
                {detail.title}
              </DSText>
              <View style={styles.categoryMetadata}>
                <DSText
                  variant="category"
                  testID="tap-in-composer-category-label"
                  style={{color: theme.category[category.tone].foreground}}>
                  {category.label.toUpperCase()}
                </DSText>
                <DSText
                  variant="category"
                  tone="muted"
                  testID="tap-in-composer-commitment-type">
                  {` · ${getCommitmentType(detail).toUpperCase()}`}
                </DSText>
              </View>
            </View>
          </View>
          <DSText
            variant="body"
            tone="muted"
            testID="tap-in-composer-commitment">
            {detail.commitment}
          </DSText>
          <View style={styles.statusRow}>
            <Flame
              size={15}
              color={theme.warning}
              accessibilityElementsHidden
              importantForAccessibility="no"
            />
            <DSText
              variant="secondary"
              style={styles.statusCopy}
              tone={detail.state === 'risk' ? 'warning' : 'muted'}>
              {status}
              {status ? ' · ' : ''}
              {detail.streakLabel ?? `${detail.streakDays ?? 0}d streak`}
            </DSText>
          </View>
        </View>
      ) : null}
    </View>
  );
}

/** Category glow is opt-in to this composer, never a change to Home's button. */
export function ComposerAction({
  category,
  label,
  disabled,
  busy,
  onPress,
  active = true,
}: {
  category: CategoryTone;
  label: string;
  disabled?: boolean;
  busy?: boolean;
  onPress: () => void;
  active?: boolean;
}) {
  const theme = useSystemTheme();
  const progress = useRef(new Animated.Value(0)).current;
  const [reduceMotion, setReduceMotion] = useState(true);
  const [foreground, setForeground] = useState(
    AppState.currentState === 'active',
  );
  const blocked = Boolean(disabled || busy);
  useEffect(() => {
    let mounted = true;
    AccessibilityInfo.isReduceMotionEnabled()
      .then(value => {
        if (mounted) {
          setReduceMotion(value);
        }
      })
      .catch(() => undefined);
    const motion = AccessibilityInfo.addEventListener(
      'reduceMotionChanged',
      setReduceMotion,
    );
    const app = AppState.addEventListener('change', value =>
      setForeground(value === 'active'),
    );
    return () => {
      mounted = false;
      motion.remove();
      app.remove();
    };
  }, []);
  const animate = !blocked && !reduceMotion && active && foreground;
  useEffect(() => {
    progress.setValue(0);
    if (!animate) {
      return;
    }
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(progress, {
          toValue: 1,
          duration: 1550,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: true,
        }),
        Animated.timing(progress, {
          toValue: 0,
          duration: 1550,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: true,
        }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [animate, progress]);
  const color = theme.category[category].foreground;
  return (
    <View style={styles.glowWrap}>
      {!blocked ? (
        <Animated.View
          pointerEvents="none"
          accessible={false}
          testID="tap-in-composer-action-glow"
          style={[
            styles.glow,
            {
              opacity: animate
                ? progress.interpolate({
                    inputRange: [0, 1],
                    outputRange: [0.55, 1],
                  })
                : 0.65,
            },
          ]}>
          {[10, 7, 4].map((spread, index) => (
            <View
              key={spread}
              style={[
                styles.glowLayer,
                {
                  top: -spread,
                  bottom: -spread,
                  left: -spread,
                  right: -spread,
                  backgroundColor: color,
                  opacity: 0.035 + index * 0.02,
                },
              ]}
            />
          ))}
          <View
            style={[
              StyleSheet.absoluteFill,
              styles.glowShadow,
              {backgroundColor: color, shadowColor: color},
            ]}
          />
        </Animated.View>
      ) : null}
      <DSButton
        category={category}
        variant="primary"
        label={label}
        disabled={disabled}
        busy={busy}
        onPress={onPress}
        labelStyle={{fontSize: 16, lineHeight: 21}}
        testID="tap-in-composer-confirm-action"
      />
    </View>
  );
}

export function ComposerQuietAction({
  label,
  disabled,
  onPress,
}: {
  label: string;
  disabled?: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{disabled: Boolean(disabled)}}
      disabled={disabled}
      onPress={onPress}
      style={{
        minHeight: 56,
        alignSelf: 'stretch',
        paddingVertical: 16,
        justifyContent: 'center',
        alignItems: 'center',
        opacity: disabled ? 0.5 : 1,
      }}>
      <DSText
        variant="action"
        tone="muted"
        style={{textAlign: 'center', fontSize: 15, lineHeight: 20}}>
        {label}
      </DSText>
    </Pressable>
  );
}

export function ComposerQuantity({
  detail,
  value,
  onDecrease,
  onIncrease,
  disabled,
  saved,
}: {
  detail: CircleDetailModel;
  value: number;
  onDecrease: () => void;
  onIncrease: () => void;
  disabled?: boolean;
  saved?: boolean;
}) {
  const theme = useSystemTheme();
  const {fontScale, width} = useWindowDimensions();
  const [textWidth, setTextWidth] = useState(0);
  const presentation = getComposerQuantity(detail, value);
  const valueText = formatQuantityValue(value);
  const availableWidth = Math.max(72, width - 44);
  const size = Math.min(
    availableWidth,
    Math.max(
      72 * fontScale,
      valueText.length * 15 * fontScale + 24,
      textWidth + 24,
    ),
  );
  const circumference = 2 * Math.PI * (size / 2 - 3);
  const statusTone =
    presentation.coverage === 'failed'
      ? 'warning'
      : presentation.coverage === 'covered'
      ? 'success'
      : 'muted';
  return (
    <View style={styles.quantity}>
      <DSText variant="action" tone="muted">
        {presentation.isLimit ? "Today's amount" : "Today's progress"}
      </DSText>
      <View
        style={[
          styles.stepper,
          size + 120 > width - 44 ? styles.wrappedStepper : undefined,
        ]}>
        <DSIconButton
          label="Decrease quantity"
          disabled={disabled || value <= 0}
          onPress={onDecrease}
          style={[styles.stepButton, {borderColor: theme.inputBorder}]}
          icon={<Minus size={20} color={theme.muted} />}
        />
        <View
          accessible
          accessibilityRole="text"
          accessibilityLabel={`${formatQuantityValue(value)} ${
            presentation.unit
          }. ${presentation.goal}. ${presentation.status}${
            saved ? '. Saved' : ''
          }`}
          style={{
            width: size,
            height: size,
            alignItems: 'center',
            justifyContent: 'center',
          }}
          testID="tap-in-composer-quantity-ring">
          <Svg
            width={size}
            height={size}
            style={StyleSheet.absoluteFill}
            accessible={false}>
            <Circle
              cx={size / 2}
              cy={size / 2}
              r={size / 2 - 3}
              fill="none"
              stroke={theme.border}
              strokeWidth={presentation.isLimit ? 2 : 3}
            />
            {!presentation.isLimit && presentation.progress > 0 ? (
              <Circle
                testID="tap-in-composer-progress-arc"
                cx={size / 2}
                cy={size / 2}
                r={size / 2 - 3}
                fill="none"
                stroke={theme.progress}
                strokeWidth={3}
                strokeLinecap="round"
                strokeDasharray={`${circumference} ${circumference}`}
                strokeDashoffset={circumference * (1 - presentation.progress)}
                rotation={-90}
                origin={`${size / 2}, ${size / 2}`}
              />
            ) : null}
          </Svg>
          <DSText
            variant="screenTitle"
            style={styles.quantityValue}
            onTextLayout={event =>
              setTextWidth(
                Math.ceil(
                  Math.max(
                    0,
                    ...event.nativeEvent.lines.map(line => line.width),
                  ),
                ),
              )
            }>
            {formatQuantityValue(value)}
          </DSText>
        </View>
        <DSIconButton
          label="Increase quantity"
          disabled={disabled}
          onPress={onIncrease}
          style={[styles.stepButton, {borderColor: theme.inputBorder}]}
          icon={<Plus size={20} color={theme.muted} />}
        />
      </View>
      <View style={styles.quantityCaptions}>
        <DSText variant="secondary" tone="muted" style={styles.center}>
          {presentation.goal}
        </DSText>
        <View style={styles.quantityStatus}>
          {presentation.coverage === 'covered' ? (
            <Check size={16} color={theme.success} />
          ) : null}
          <DSText variant="secondary" tone={statusTone} style={styles.center}>
            {presentation.status}
            {saved ? ' · Saved' : ''}
          </DSText>
        </View>
      </View>
    </View>
  );
}

/** Supporting rows deliberately sit below the commitment title in the hierarchy. */
export function ComposerDisclosure({
  title,
  subtitle,
  leading,
  onPress,
  disabled,
  busy,
  tone = 'text',
  showChevron = true,
  testID,
}: {
  title: string;
  subtitle?: string;
  leading: React.ReactNode;
  onPress?: () => void;
  disabled?: boolean;
  busy?: boolean;
  tone?: 'text' | 'danger';
  showChevron?: boolean;
  testID?: string;
}) {
  const theme = useSystemTheme();
  const foreground = tone === 'danger' ? theme.danger : theme.text;
  return (
    <Pressable
      testID={testID}
      onPress={onPress}
      disabled={disabled || !onPress}
      accessibilityRole="button"
      accessibilityLabel={subtitle ? `${title}. ${subtitle}` : title}
      accessibilityState={{disabled: Boolean(disabled || !onPress), busy}}
      style={{
        minHeight: 48,
        paddingVertical: 10,
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
        borderBottomWidth: StyleSheet.hairlineWidth,
        borderBottomColor: theme.border,
        opacity: disabled ? 0.5 : 1,
      }}>
      {leading}
      <View style={{flex: 1, gap: 4}}>
        <DSText variant="body" style={{color: foreground, fontWeight: '500'}}>
          {title}
        </DSText>
        {subtitle ? (
          <DSText variant="secondary" tone="muted">
            {subtitle}
          </DSText>
        ) : null}
      </View>
      {busy ? (
        <ActivityIndicator size="small" color={foreground} />
      ) : showChevron ? (
        <ChevronRight size={18} color={theme.muted} />
      ) : null}
    </Pressable>
  );
}

export function ComposerPhoto({
  uri,
  onAdd,
  onRemove,
  disabled,
}: {
  uri?: string;
  onAdd: () => void;
  onRemove: () => void;
  disabled?: boolean;
}) {
  const theme = useSystemTheme();
  return (
    <View style={styles.photo}>
      <ComposerDisclosure
        title={uri ? 'Change Photo' : 'Add Photo'}
        onPress={onAdd}
        disabled={disabled}
        testID="photo-picker-add"
        leading={<Camera size={20} color={theme.muted} />}
      />
      <DSText variant="secondary" tone="muted">
        Optional proof for your Circle
      </DSText>
      {uri ? (
        <>
          <Image
            source={{uri}}
            style={styles.photoPreview}
            resizeMode="cover"
            testID="photo-picker-preview"
            accessibilityLabel="Selected Tap In photo"
          />
          <DSButton
            label="Remove photo"
            variant="quiet"
            disabled={disabled}
            onPress={onRemove}
          />
        </>
      ) : null}
    </View>
  );
}

export const composerStyles = StyleSheet.create({
  body: {paddingHorizontal: 22, paddingTop: 16, paddingBottom: 20, gap: 16},
  stack: {gap: 12},
  footerActions: {gap: 8},
  proofImage: {height: 156, width: '100%', borderRadius: 12},
  statusRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: 8,
  },
});
const styles = StyleSheet.create({
  sheet: {flexShrink: 0},
  footer: {flexShrink: 0, paddingHorizontal: 22, paddingTop: 12},
  brandRow: {alignItems: 'center', paddingTop: 32, paddingBottom: 16},
  close: {position: 'absolute', right: 10, top: 12},
  details: {paddingHorizontal: 22, paddingBottom: 4, gap: 10},
  titleRow: {flexDirection: 'row', alignItems: 'flex-start', gap: 10},
  titleCopy: {flex: 1, minWidth: 0, gap: 2},
  categoryMetadata: {flexDirection: 'row', flexWrap: 'wrap'},
  statusRow: {flexDirection: 'row', alignItems: 'center', gap: 6},
  statusCopy: {flex: 1},
  glowWrap: {overflow: 'visible'},
  glow: {...StyleSheet.absoluteFillObject, borderRadius: 30},
  glowLayer: {position: 'absolute', borderRadius: 34},
  glowShadow: {
    borderRadius: 24,
    shadowOffset: {width: 0, height: 0},
    shadowOpacity: 0.4,
    shadowRadius: 10,
    elevation: 5,
  },
  quantity: {gap: 12},
  stepper: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 24,
  },
  wrappedStepper: {flexWrap: 'wrap', gap: 8},
  stepButton: {borderRadius: 24, borderWidth: 1},
  quantityValue: {flexShrink: 0},
  quantityCaptions: {gap: 4},
  quantityStatus: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 4,
  },
  center: {textAlign: 'center', flexShrink: 1},
  photo: {gap: 8},
  photoPreview: {width: '100%', height: 156, borderRadius: 12},
});
