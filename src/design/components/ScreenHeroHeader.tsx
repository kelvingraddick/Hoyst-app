import React from 'react';
import {Pressable, StyleSheet, View} from 'react-native';
import {useSafeAreaInsets} from 'react-native-safe-area-context';
import {ArrowLeft} from 'lucide-react-native';

import {actionMotion} from '../tokens/actions';
import {useHoystTheme} from '../theme/useHoystTheme';
import {HoystText} from './HoystText';

function clampHeroPercent(value: number) {
  if (!Number.isFinite(value)) {
    return 0;
  }

  return Math.max(0, Math.min(100, Math.round(value)));
}

// Frosted circular action button used for the hero's back control and the
// trailing actions (notifications, invite). Exported so screens render their
// trailing actions with the exact same affordance as the built-in back button.
export function HeroIconButton({
  accessibilityLabel,
  children,
  onPress,
}: {
  accessibilityLabel: string;
  children: React.ReactNode;
  onPress: () => void;
}): React.JSX.Element {
  const theme = useHoystTheme();

  return (
    <Pressable
      accessibilityLabel={accessibilityLabel}
      accessibilityRole="button"
      hitSlop={6}
      onPress={onPress}
      style={({pressed}) => [
        styles.iconButton,
        {
          backgroundColor: theme.isDark
            ? 'rgba(255,255,255,0.08)'
            : '#F8F9FF',
          borderColor: theme.isDark
            ? 'rgba(255,255,255,0.10)'
            : 'rgba(130,124,180,0.24)',
          opacity: pressed ? actionMotion.pressedOpacity : 1,
          shadowColor: theme.isDark ? theme.shadow : 'rgba(68,64,120,0.32)',
          transform: [{scale: pressed ? actionMotion.pressedScale : 1}],
        },
      ]}>
      {children}
    </Pressable>
  );
}

type ScreenHeroHeaderProps = {
  actions?: React.ReactNode;
  backAccessibilityLabel?: string;
  description?: React.ReactNode;
  icon?: React.ReactNode;
  // When the screen already sits inside a SafeAreaView, pass insetTop={false}
  // so the hero doesn't add the top inset a second time.
  insetTop?: boolean;
  meta?: React.ReactNode;
  navTitle?: string;
  onBack: () => void;
  primaryAction?: React.ReactNode;
  progress?: {
    color?: string;
    label: string;
    percent: number;
  };
  statusPill?: React.ReactNode;
  subtitle?: string;
  title: string;
};

// Shared detail-screen hero: a frosted top bar above an open identity area with
// a category glyph, title, supporting content, Progress, and primary action.
export function ScreenHeroHeader({
  actions,
  backAccessibilityLabel = 'Go back',
  description,
  icon,
  insetTop = true,
  meta,
  navTitle,
  onBack,
  primaryAction,
  progress,
  statusPill,
  subtitle,
  title,
}: ScreenHeroHeaderProps): React.JSX.Element {
  const theme = useHoystTheme();
  const insets = useSafeAreaInsets();
  const progressColor = progress?.color ?? theme.accent;
  const progressPercent = progress ? clampHeroPercent(progress.percent) : 0;
  const paddingTop = insetTop ? insets.top + 8 : 8;

  return (
    <View style={[styles.header, {paddingTop}]}>
      <View style={styles.topRow}>
        <View style={styles.topSide}>
          <HeroIconButton
            accessibilityLabel={backAccessibilityLabel}
            onPress={onBack}>
            <ArrowLeft color={theme.text} size={22} strokeWidth={2.3} />
          </HeroIconButton>
        </View>
        {navTitle ? (
          <HoystText numberOfLines={1} style={styles.navTitle}>
            {navTitle}
          </HoystText>
        ) : (
          <View style={styles.navTitleSpacer} />
        )}
        <View style={[styles.topSide, styles.topSideEnd]}>
          {actions ? <View style={styles.actions}>{actions}</View> : null}
        </View>
      </View>

      <View style={styles.identityHero}>
        <View style={styles.identityTopRow}>
          {icon ? <View style={styles.identityIcon}>{icon}</View> : null}
          <View style={styles.identityCopy}>
            <HoystText
              adjustsFontSizeToFit
              minimumFontScale={0.7}
              numberOfLines={2}
              variant="title">
              {title}
            </HoystText>
            {description ? (
              <View style={styles.descriptionSlot}>{description}</View>
            ) : null}
          </View>
        </View>

        {meta || statusPill ? (
          <View style={styles.metaRow}>
            {meta}
            {statusPill}
          </View>
        ) : null}

        {subtitle ? (
          <HoystText style={styles.subtitle} tone="muted">
            {subtitle}
          </HoystText>
        ) : null}

        {primaryAction ? (
          <View style={styles.primaryAction}>{primaryAction}</View>
        ) : null}

        {progress ? (
          <View style={styles.progressBlock}>
            <View style={styles.progressLabelRow}>
              <HoystText tone="muted" variant="caption">
                {progress.label}
              </HoystText>
              <HoystText style={{color: progressColor}} variant="bodyStrong">
                {progressPercent}%
              </HoystText>
            </View>
            <View
              style={[
                styles.progressTrack,
                {backgroundColor: theme.surfaceMuted},
              ]}>
              <View
                style={[
                  styles.progressFill,
                  {
                    backgroundColor: progressColor,
                    width: `${Math.max(progressPercent, 2)}%`,
                  },
                ]}
              />
            </View>
          </View>
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  header: {
    gap: 16,
    paddingBottom: 4,
    paddingHorizontal: 20,
  },
  topRow: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
    minHeight: 44,
  },
  topSide: {
    alignItems: 'flex-start',
    flexShrink: 0,
    width: 98,
  },
  topSideEnd: {
    alignItems: 'flex-end',
  },
  navTitle: {
    flex: 1,
    fontSize: 17,
    fontWeight: '800',
    letterSpacing: 0,
    lineHeight: 21,
    textAlign: 'center',
  },
  navTitleSpacer: {
    flex: 1,
  },
  actions: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 10,
  },
  iconButton: {
    alignItems: 'center',
    borderRadius: 18,
    borderWidth: 1.5,
    elevation: 7,
    height: 44,
    justifyContent: 'center',
    shadowOffset: {height: 8, width: 0},
    shadowOpacity: 0.28,
    shadowRadius: 22,
    width: 44,
  },
  identityHero: {
    gap: 14,
  },
  identityTopRow: {
    alignItems: 'flex-start',
    flexDirection: 'row',
    gap: 12,
  },
  identityIcon: {
    alignItems: 'center',
    flexShrink: 0,
    height: 52,
    justifyContent: 'flex-start',
    width: 52,
  },
  identityCopy: {
    flex: 1,
    gap: 7,
    minWidth: 0,
  },
  descriptionSlot: {
    marginTop: -1,
  },
  metaRow: {
    alignItems: 'center',
    alignSelf: 'stretch',
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  subtitle: {
    marginTop: -2,
  },
  progressBlock: {
    gap: 8,
  },
  progressLabelRow: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  progressTrack: {
    borderRadius: 999,
    height: 10,
    overflow: 'hidden',
  },
  progressFill: {
    borderRadius: 999,
    height: 10,
  },
  primaryAction: {
    marginTop: 6,
  },
});
