import React, {useState, type ReactNode} from 'react';
import {
  ActivityIndicator,
  Image,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
  type ImageSourcePropType,
  type PressableProps,
  type ScrollViewProps,
  type StyleProp,
  type TextInputProps,
  type TextProps,
  type TextStyle,
  type ViewProps,
  type ViewStyle,
} from 'react-native';
import {SafeAreaView} from 'react-native-safe-area-context';
import {ChevronRight} from 'lucide-react-native';
import {
  layout,
  minimumTarget,
  nativeFont,
  radii,
  softShadow,
  space,
  typography,
  type CategoryTone,
  type SemanticTone,
  type TextVariant,
} from './tokens';
import {useSystemTheme} from './theme';

// Explicit style arrays also work through the app's NativeWind interop layer.
function usePressFeedback(
  props: Pick<PressableProps, 'onPressIn' | 'onPressOut'> = {},
) {
  const [pressed, setPressed] = useState(false);
  return {
    pressedStyle: pressed ? styles.pressed : undefined,
    onPressIn: (
      event: Parameters<NonNullable<PressableProps['onPressIn']>>[0],
    ) => {
      setPressed(true);
      props.onPressIn?.(event);
    },
    onPressOut: (
      event: Parameters<NonNullable<PressableProps['onPressOut']>>[0],
    ) => {
      setPressed(false);
      props.onPressOut?.(event);
    },
  };
}

export function DSText({
  variant = 'body',
  tone = 'text',
  style,
  ...props
}: TextProps & {variant?: TextVariant; tone?: SemanticTone}) {
  const theme = useSystemTheme();
  return (
    <Text
      {...props}
      style={[styles.text, typography[variant], {color: theme[tone]}, style]}
    />
  );
}

export function DSScreen({
  children,
  bottomClearance = 0,
  contentContainerStyle,
  ...props
}: ScrollViewProps & {bottomClearance?: number}) {
  const theme = useSystemTheme();
  return (
    <SafeAreaView style={[styles.flex, {backgroundColor: theme.canvas}]}>
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="on-drag"
          {...props}
          contentContainerStyle={[
            styles.screenContent,
            {paddingBottom: space.xxl + bottomClearance},
            contentContainerStyle,
          ]}>
          {children}
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

export function DSSectionHeading({
  title,
  subtitle,
  action,
}: {
  title: string;
  subtitle?: string;
  action?: ReactNode;
}) {
  return (
    <View style={styles.sectionHeading}>
      <View style={styles.grow}>
        <DSText accessibilityRole="header" variant="heading">
          {title}
        </DSText>
        {subtitle ? (
          <DSText variant="secondary" tone="muted">
            {subtitle}
          </DSText>
        ) : null}
      </View>
      {action}
    </View>
  );
}

export function DSSurface({
  kind = 'card',
  category,
  raised = false,
  style,
  ...props
}: ViewProps & {
  kind?: 'card' | 'message' | 'statistics' | 'quiet';
  category?: CategoryTone;
  raised?: boolean;
}) {
  const theme = useSystemTheme();
  const fill = category
    ? theme.category[category].surface
    : kind === 'statistics'
    ? theme.canvas
    : kind === 'quiet'
    ? theme.mutedSurface
    : theme.surface;
  return (
    <View
      {...props}
      style={[
        styles.surface,
        {
          backgroundColor: fill,
          borderRadius: kind === 'quiet' ? radii.card : radii[kind],
        },
        kind === 'message' && styles.message,
        kind === 'statistics' && styles.statistics,
        raised && [softShadow, {shadowColor: theme.shadow}],
        style,
      ]}
    />
  );
}

type ButtonProps = Omit<PressableProps, 'children' | 'style'> & {
  label: string;
  variant?: 'primary' | 'outline' | 'quiet' | 'danger';
  labelStyle?: StyleProp<TextStyle>;
  busy?: boolean;
  compact?: boolean;
  category?: CategoryTone;
  style?: StyleProp<ViewStyle>;
};
export function DSButton({
  label,
  labelStyle,
  variant = 'primary',
  busy = false,
  disabled,
  compact = false,
  category,
  style,
  accessibilityState,
  ...props
}: ButtonProps) {
  const theme = useSystemTheme();
  const feedback = usePressFeedback(props);
  const blocked = disabled || busy;
  const actionColor = category
    ? theme.category[category].foreground
    : theme.action;
  const primaryFill = category ? actionColor : theme.actionFill;
  const faceBackground = variant === 'primary' ? primaryFill : 'transparent';
  const foreground =
    variant === 'primary'
      ? category && theme.isDark
        ? theme.canvas
        : theme.onAction
      : variant === 'danger'
      ? theme.danger
      : actionColor;
  return (
    <Pressable
      {...props}
      disabled={blocked}
      accessibilityRole="button"
      accessibilityLabel={props.accessibilityLabel ?? label}
      accessibilityState={{
        ...accessibilityState,
        disabled: Boolean(blocked),
        busy,
      }}
      onPressIn={feedback.onPressIn}
      onPressOut={feedback.onPressOut}
      style={[
        styles.buttonTarget,
        {minHeight: minimumTarget(), minWidth: minimumTarget()},
        blocked && styles.disabled,
        feedback.pressedStyle,
        style,
      ]}>
      <View
        style={[
          styles.buttonFace,
          {
            minHeight: compact
              ? layout.buttonVisualHeight
              : layout.controlHeight,
            backgroundColor: faceBackground,
            borderColor: foreground,
          },
          (variant === 'outline' || variant === 'danger') &&
            styles.buttonOutline,
        ]}>
        {busy ? <ActivityIndicator size="small" color={foreground} /> : null}
        <DSText
          variant="action"
          style={[styles.buttonLabel, {color: foreground}, labelStyle]}>
          {label}
        </DSText>
      </View>
    </Pressable>
  );
}

export function DSIconButton({
  icon,
  label,
  disabled,
  style,
  ...props
}: Omit<PressableProps, 'children' | 'style'> & {
  icon: ReactNode;
  label: string;
  style?: StyleProp<ViewStyle>;
}) {
  const feedback = usePressFeedback(props);
  return (
    <Pressable
      {...props}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{
        ...props.accessibilityState,
        disabled: Boolean(disabled),
      }}
      onPressIn={feedback.onPressIn}
      onPressOut={feedback.onPressOut}
      style={[
        styles.iconButton,
        {minWidth: minimumTarget(), minHeight: minimumTarget()},
        disabled && styles.disabled,
        feedback.pressedStyle,
        style,
      ]}>
      {icon}
    </Pressable>
  );
}

export function DSInput({
  label,
  hint,
  error,
  style,
  onFocus,
  onBlur,
  ...props
}: TextInputProps & {label: string; hint?: string; error?: string}) {
  const theme = useSystemTheme();
  const [focused, setFocused] = useState(false);
  return (
    <View style={styles.inputGroup}>
      <DSText variant="action">{label}</DSText>
      <TextInput
        {...props}
        accessibilityLabel={props.accessibilityLabel ?? label}
        accessibilityHint={[props.accessibilityHint, error || hint]
          .filter(Boolean)
          .join('. ')}
        accessibilityState={{
          ...props.accessibilityState,
          disabled: props.editable === false,
        }}
        placeholderTextColor={theme.muted}
        selectionColor={theme.action}
        onFocus={event => {
          setFocused(true);
          onFocus?.(event);
        }}
        onBlur={event => {
          setFocused(false);
          onBlur?.(event);
        }}
        style={[
          styles.input,
          {
            backgroundColor: theme.surface,
            color: theme.text,
            borderColor: error
              ? theme.danger
              : focused
              ? theme.action
              : theme.inputBorder,
          },
          props.multiline && styles.multiline,
          props.editable === false && styles.disabled,
          style,
        ]}
      />
      {error || hint ? (
        <DSText
          variant="secondary"
          tone={error ? 'danger' : 'muted'}
          accessibilityLiveRegion="polite">
          {error || hint}
        </DSText>
      ) : null}
    </View>
  );
}

/** The action is a sibling, never a descendant, of the row press target. */
export function DSListRow({
  title,
  titleVariant = 'title',
  titleTone = 'text',
  subtitle,
  leading,
  action,
  onPress,
  accessibilityLabel,
  chevronTone = 'muted',
  testID,
  style,
}: {
  title: string;
  titleVariant?: TextVariant;
  titleTone?: SemanticTone;
  subtitle?: string;
  leading?: ReactNode;
  action?: ReactNode;
  onPress?: () => void;
  accessibilityLabel?: string;
  chevronTone?: SemanticTone;
  testID?: string;
  style?: StyleProp<ViewStyle>;
}) {
  const theme = useSystemTheme();
  const feedback = usePressFeedback();
  const content = (
    <>
      {leading ? <View style={styles.leading}>{leading}</View> : null}
      <View style={styles.rowText}>
        <DSText tone={titleTone} variant={titleVariant}>
          {title}
        </DSText>
        {subtitle ? (
          <DSText variant="secondary" tone="muted">
            {subtitle}
          </DSText>
        ) : null}
      </View>
    </>
  );
  return (
    <View style={[styles.listRow, {borderBottomColor: theme.border}, style]}>
      {onPress ? (
        <Pressable
          testID={testID}
          onPress={onPress}
          accessibilityRole="button"
          accessibilityLabel={
            accessibilityLabel ?? [title, subtitle].filter(Boolean).join('. ')
          }
          onPressIn={feedback.onPressIn}
          onPressOut={feedback.onPressOut}
          style={[
            styles.rowMain,
            {minHeight: minimumTarget()},
            feedback.pressedStyle,
          ]}>
          {content}
        </Pressable>
      ) : (
        <View style={[styles.rowMain, {minHeight: minimumTarget()}]}>
          {content}
        </View>
      )}
      {action ? <View style={styles.rowAction}>{action}</View> : null}
      {onPress ? (
        <DSIconButton
          label={accessibilityLabel ?? `Open ${title}`}
          onPress={onPress}
          testID={testID ? `${testID}-chevron` : undefined}
          icon={
            <ChevronRight
              size={layout.controlIcon}
              color={theme[chevronTone]}
            />
          }
        />
      ) : null}
    </View>
  );
}

export function DSAvatar({
  source,
  name,
  size = layout.avatar,
  accessibilityLabel,
}: {
  source?: ImageSourcePropType;
  name: string;
  size?: number;
  accessibilityLabel?: string;
}) {
  const theme = useSystemTheme();
  const [failed, setFailed] = useState(false);
  // Reset only when the caller changes the source, allowing a new image to load.
  const [previousSource, setPreviousSource] = useState(source);
  if (previousSource !== source) {
    setPreviousSource(source);
    setFailed(false);
  }
  return (
    <View
      accessible={Boolean(accessibilityLabel)}
      accessibilityLabel={accessibilityLabel}
      style={[
        styles.avatar,
        {
          width: size,
          height: size,
          borderRadius: size / 2,
          backgroundColor: theme.mutedSurface,
        },
      ]}>
      {source && !failed ? (
        <Image
          source={source}
          onError={() => setFailed(true)}
          resizeMode="cover"
          accessible={false}
          style={{width: size, height: size}}
        />
      ) : (
        <DSText variant="category" maxFontSizeMultiplier={1.2}>
          {name.trim().slice(0, 1).toUpperCase() || '?'}
        </DSText>
      )}
    </View>
  );
}

export function DSStatus({
  label,
  tone = 'muted',
  icon,
}: {
  label: string;
  tone?: SemanticTone;
  icon?: ReactNode;
}) {
  return (
    <View accessible accessibilityLabel={label} style={styles.status}>
      {icon}
      <DSText variant="secondary" tone={tone}>
        {label}
      </DSText>
    </View>
  );
}

export function DSProgress({
  completed,
  total,
  label,
}: {
  completed: number;
  total: number;
  label: string;
}) {
  const theme = useSystemTheme();
  const safeTotal = Number.isFinite(total) ? Math.max(0, total) : 0;
  const safeCompleted = Number.isFinite(completed)
    ? Math.max(0, Math.min(completed, safeTotal))
    : 0;
  return (
    <View
      accessible
      accessibilityRole="progressbar"
      accessibilityLabel={label}
      accessibilityValue={{
        min: 0,
        max: safeTotal || 1,
        now: safeCompleted,
        text: label,
      }}
      style={styles.progress}>
      <DSText variant="secondary" tone="muted">
        {label}
      </DSText>
      <View style={[styles.track, {backgroundColor: theme.track}]}>
        <View
          style={[
            styles.fill,
            {
              backgroundColor: theme.progress,
              width: `${safeTotal ? (safeCompleted / safeTotal) * 100 : 0}%`,
            },
          ]}
        />
      </View>
    </View>
  );
}

export function DSStatistics({
  items,
  onPress,
  accessibilityLabel,
}: {
  items: readonly [
    {value: string; label: string; icon: ReactNode; tone?: SemanticTone},
    {value: string; label: string; icon: ReactNode; tone?: SemanticTone},
  ];
  onPress?: () => void;
  accessibilityLabel?: string;
}) {
  const theme = useSystemTheme();
  const contents = (
    <DSSurface kind="statistics" raised style={styles.statsRow}>
      {items.map((item, index) => (
        <React.Fragment key={item.label}>
          {index > 0 ? (
            <View style={[styles.divider, {backgroundColor: theme.border}]} />
          ) : null}
          <View style={styles.statColumn}>
            <View style={styles.statValue}>
              <View accessible={false}>{item.icon}</View>
              <DSText
                variant="statistic"
                tone={item.tone}
                style={styles.shrink}>
                {item.value}
              </DSText>
            </View>
            <DSText
              variant="statCaption"
              tone="muted"
              style={styles.statCaption}>
              {item.label}
            </DSText>
          </View>
        </React.Fragment>
      ))}
    </DSSurface>
  );
  return onPress ? (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={
        accessibilityLabel ??
        items.map(item => `${item.label}: ${item.value}`).join('. ')
      }>
      {contents}
    </Pressable>
  ) : (
    contents
  );
}

export function DSFeedback({
  title,
  message,
  kind = 'empty',
  action,
}: {
  title: string;
  message?: string;
  kind?: 'empty' | 'error' | 'loading' | 'success';
  action?: ReactNode;
}) {
  const theme = useSystemTheme();
  return (
    <View
      style={styles.feedback}
      accessibilityLiveRegion="polite"
      accessibilityState={{busy: kind === 'loading'}}>
      {kind === 'loading' ? (
        <ActivityIndicator accessibilityLabel="Loading" color={theme.muted} />
      ) : null}
      <DSText
        variant="title"
        tone={
          kind === 'error' ? 'danger' : kind === 'success' ? 'success' : 'text'
        }>
        {title}
      </DSText>
      {message ? <DSText tone="muted">{message}</DSText> : null}
      {action}
    </View>
  );
}

const styles = StyleSheet.create({
  flex: {flex: 1},
  grow: {flex: 1, gap: space.xs},
  shrink: {flexShrink: 1},
  text: {fontFamily: nativeFont, includeFontPadding: false},
  screenContent: {
    paddingHorizontal: layout.gutter,
    paddingTop: space.xs,
    gap: layout.sectionGap,
    flexGrow: 1,
  },
  sectionHeading: {flexDirection: 'row', alignItems: 'center', gap: space.md},
  surface: {padding: layout.cardPadding, gap: space.md},
  message: {padding: space.lg},
  statistics: {paddingHorizontal: space.md, paddingVertical: 6, minHeight: 56},
  buttonTarget: {justifyContent: 'center'},
  buttonLabel: {flexShrink: 1, textAlign: 'center'},
  buttonOutline: {borderWidth: 1},
  buttonFace: {
    borderRadius: radii.pill,
    paddingHorizontal: space.md,
    paddingVertical: 6,
    flexDirection: 'row',
    gap: space.sm,
    alignItems: 'center',
    justifyContent: 'center',
  },
  disabled: {opacity: 0.5},
  pressed: {opacity: 0.7},
  iconButton: {alignItems: 'center', justifyContent: 'center'},
  inputGroup: {gap: space.xs},
  input: {
    ...typography.body,
    fontFamily: nativeFont,
    includeFontPadding: false,
    minHeight: layout.controlHeight,
    borderWidth: 1,
    borderRadius: radii.input,
    paddingHorizontal: space.md,
    paddingVertical: space.md,
  },
  multiline: {minHeight: 96, textAlignVertical: 'top'},
  listRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    columnGap: space.xs,
    paddingVertical: space.sm,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  rowMain: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md,
    flexGrow: 1,
    flexShrink: 1,
    flexBasis: 140,
  },
  rowText: {flex: 1, gap: space.xs},
  leading: {width: layout.iconBackplate, alignItems: 'center'},
  rowAction: {flexShrink: 1},
  avatar: {overflow: 'hidden', alignItems: 'center', justifyContent: 'center'},
  status: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.xs,
    flexWrap: 'wrap',
  },
  progress: {gap: space.sm},
  track: {height: 5, borderRadius: 3, overflow: 'hidden'},
  fill: {height: '100%', borderRadius: 3},
  statsRow: {flexDirection: 'row', alignItems: 'center', gap: space.md},
  statColumn: {flex: 1, gap: space.xs},
  statValue: {flexDirection: 'row', alignItems: 'center', gap: space.sm},
  statCaption: {marginLeft: layout.statIcon + space.sm},
  divider: {width: 1, height: 32},
  feedback: {gap: space.sm, paddingVertical: space.md},
});
