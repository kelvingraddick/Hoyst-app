import React from 'react';
import {
  Text,
  View,
  StyleSheet,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import {
  resolveAppearance,
  emojiAccessibilityLabel,
  normalizeCategory,
  type CommitmentAppearance,
} from '../../shared/commitment-appearance';
import {useHoystTheme} from '../theme/useHoystTheme';
import type {HoystTheme} from '../tokens/colors';
import {radius} from '../tokens/radius';
import {typography} from '../tokens/typography';
import {HoystText} from './HoystText';
export type CircleCategoryTone =
  | 'blue'
  | 'green'
  | 'neutral'
  | 'orange'
  | 'purple'
  | 'teal'
  | 'gold'
  | 'pink'
  | 'red';
export function getCircleCategoryVisual(
  category: string,
  appearance?: CommitmentAppearance,
) {
  const resolved = resolveAppearance(category, appearance);
  const tone: CircleCategoryTone =
    resolved.palette === 'gray' ? 'neutral' : resolved.palette;
  return {
    ...resolved,
    accentColor: resolved.accent,
    accentDark: resolved.foreground,
    accentLight: resolved.darkForeground,
    backplateColor: resolved.background,
    foregroundColor: resolved.foreground,
    key: normalizeCategory(category),
    isFallback:
      normalizeCategory(category) === 'General' &&
      category !== 'General' &&
      category !== 'Custom',
    tone,
  };
}
export type CircleCategoryVisual = ReturnType<typeof getCircleCategoryVisual>;
export function getCircleCategoryForegroundColor(
  category: string,
  theme: HoystTheme,
  appearance?: CommitmentAppearance,
) {
  const visual = getCircleCategoryVisual(category, appearance);
  return theme.isDark ? visual.accentLight : visual.foregroundColor;
}
type IconProps = {
  category: string;
  appearance?: CommitmentAppearance;
  shape?: 'circle' | 'roundedSquare';
  showBackplate?: boolean;
  size?: number;
  style?: StyleProp<ViewStyle>;
};
export function CircleCategoryIcon({
  category,
  appearance,
  shape = 'circle',
  showBackplate = true,
  size = 38,
  style,
}: IconProps) {
  const theme = useHoystTheme();
  const visual = getCircleCategoryVisual(category, appearance);
  const fontSize = size * (showBackplate ? 0.68 : 0.86);
  return (
    <View
      accessible
      accessibilityRole="image"
      accessibilityLabel={
        visual.label + ': ' + emojiAccessibilityLabel(visual.emoji)
      }
      style={[
        styles.iconWrap,
        {
          width: size,
          height: size,
          borderRadius:
            shape === 'circle'
              ? size / 2
              : Math.min(14, Math.round(size * 0.3)),
          backgroundColor: showBackplate
            ? theme.isDark
              ? visual.darkBackground
              : visual.backplateColor
            : 'transparent',
        },
        style,
      ]}>
      <Text
        accessible={false}
        allowFontScaling={false}
        style={{
          fontSize,
          lineHeight: size,
          textAlign: 'center',
          includeFontPadding: false,
        }}>
        {visual.emoji}
      </Text>
    </View>
  );
}
const chipVerticalPadding = 7;
const categoryPillHeight = typography.tiny.lineHeight + chipVerticalPadding * 2;
export function CircleCategoryPill({
  category,
  appearance,
  iconSize = 16,
  label,
  style,
  uppercase = false,
}: {
  category: string;
  appearance?: CommitmentAppearance;
  iconSize?: number;
  label?: string;
  style?: StyleProp<ViewStyle>;
  uppercase?: boolean;
}) {
  const theme = useHoystTheme();
  const visual = getCircleCategoryVisual(category, appearance);
  const displayLabel = label ?? visual.label;
  return (
    <View
      style={[
        styles.pill,
        {
          backgroundColor: theme.isDark
            ? visual.darkBackground
            : visual.backplateColor,
        },
        styles.pillDefaultBorder,
        style,
      ]}>
      <CircleCategoryIcon
        category={category}
        appearance={appearance}
        size={iconSize}
        showBackplate={false}
      />
      <HoystText
        numberOfLines={1}
        variant="tiny"
        style={[
          styles.pillLabel,
          {
            color: getCircleCategoryForegroundColor(
              category,
              theme,
              appearance,
            ),
          },
        ]}>
        {uppercase ? displayLabel.toUpperCase() : displayLabel}
      </HoystText>
    </View>
  );
}
const styles = StyleSheet.create({
  iconWrap: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  pill: {
    alignItems: 'center',
    alignSelf: 'flex-start',
    borderRadius: radius.pill,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 6,
    height: categoryPillHeight,
    maxWidth: '100%',
    minHeight: categoryPillHeight,
    paddingHorizontal: 8,
    paddingVertical: 0,
  },
  pillDefaultBorder: {
    borderColor: 'transparent',
  },
  pillLabel: {
    flexShrink: 1,
  },
});
