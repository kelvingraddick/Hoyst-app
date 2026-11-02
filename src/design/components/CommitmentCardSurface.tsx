import React, {type ReactNode} from 'react';
import {
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
  type ViewProps,
} from 'react-native';
import {ArrowUpRight} from 'lucide-react-native';
import type {CommitmentAppearance} from '../../shared/commitment-appearance';
import {
  CircleCategoryIcon,
  getCircleCategoryVisual,
} from './CircleCategoryIcon';

/** Explicit colors let native Home, setup and opt-in screen themes share one card. */
export function getCommitmentCardColors(
  category: string,
  appearance: CommitmentAppearance | undefined,
  isDark: boolean,
) {
  const visual = getCircleCategoryVisual(category, appearance);
  const surface = isDark ? '#242428' : '#FFFFFF';
  const tint = isDark
    ? '#' +
      [1, 3, 5]
        .map(offset =>
          Math.round(
            parseInt(visual.accentColor.slice(offset, offset + 2), 16) * 0.16 +
              parseInt(surface.slice(offset, offset + 2), 16) * 0.84,
          )
            .toString(16)
            .padStart(2, '0'),
        )
        .join('')
    : visual.backplateColor;
  return {
    surface,
    tint,
    text: isDark ? '#FFFFFF' : '#070B1A',
    muted: isDark ? '#B4BCD1' : '#4D5873',
    category: isDark ? visual.accentLight : visual.foregroundColor,
    border: isDark ? '#46464F' : '#D8D8DD',
    shadow: isDark ? '#000000' : '#92723E',
  };
}
export type CommitmentCardColors = ReturnType<typeof getCommitmentCardColors>;

export function CommitmentCardSurface({
  colors,
  children,
  footer,
  style,
  ...props
}: ViewProps & {
  colors: CommitmentCardColors;
  footer?: ReactNode;
}) {
  return (
    <View
      {...props}
      style={[
        styles.surface,
        {backgroundColor: colors.surface, shadowColor: colors.shadow},
        style,
      ]}>
      {children}
      {footer ? (
        <View style={[styles.footer, {borderTopColor: colors.border}]}>
          {footer}
        </View>
      ) : null}
    </View>
  );
}

export function CommitmentCardHeader({
  title,
  category,
  appearance,
  colors,
  onPress,
  showDetails = Boolean(onPress),
  categorySuffix,
  accessibilityLabel,
  testID,
}: {
  title: string;
  category: string;
  appearance?: CommitmentAppearance;
  colors: CommitmentCardColors;
  onPress?: () => void;
  showDetails?: boolean;
  categorySuffix?: string;
  accessibilityLabel?: string;
  testID?: string;
}) {
  const visual = getCircleCategoryVisual(category, appearance);
  const content = (
    <>
      <View style={[styles.icon, {backgroundColor: colors.tint}]}>
        <CircleCategoryIcon
          category={category}
          appearance={appearance}
          size={32}
          showBackplate={false}
        />
      </View>
      <View style={styles.headingCopy}>
        <Text style={[styles.category, {color: colors.category}]}>
          {visual.label.toUpperCase()}
          {categorySuffix ? (
            <Text style={{color: colors.muted}}>{` · ${categorySuffix}`}</Text>
          ) : null}
        </Text>
        <Text style={[styles.title, {color: colors.text}]}>{title}</Text>
      </View>
      {showDetails ? (
        <ArrowUpRight accessible={false} color={colors.muted} size={20} />
      ) : null}
    </>
  );
  return onPress ? (
    <Pressable
      testID={testID}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? `View details for ${title}`}
      onPress={onPress}
      style={styles.header}>
      {content}
    </Pressable>
  ) : (
    <View testID={testID} style={styles.header}>
      {content}
    </View>
  );
}

const styles = StyleSheet.create({
  surface: {
    position: 'relative',
    borderRadius: 22,
    paddingHorizontal: 18,
    paddingVertical: 16,
    gap: 8,
    shadowOpacity: 0.06,
    shadowRadius: 14,
    shadowOffset: {width: 0, height: 4},
    elevation: 2,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    minHeight: Platform.OS === 'android' ? 48 : 44,
  },
  headingCopy: {flex: 1, minWidth: 0, gap: 2},
  icon: {
    width: 44,
    height: 44,
    padding: 6,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
  category: {
    fontSize: 11,
    lineHeight: 15,
    fontWeight: '600',
    letterSpacing: 0.5,
    includeFontPadding: false,
  },
  title: {fontSize: 18, lineHeight: 24, fontWeight: '600'},
  footer: {paddingTop: 6, borderTopWidth: StyleSheet.hairlineWidth, gap: 8},
});
