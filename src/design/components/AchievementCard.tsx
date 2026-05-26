import React from 'react';
import {StyleSheet, View} from 'react-native';

import {useHoystTheme} from '../theme/useHoystTheme';
import {radius} from '../tokens/radius';
import {GlassPanel} from './GlassPanel';
import {HoystText} from './HoystText';
import {
  MomentumLockIllustration,
  MomentumSmallCheckIllustration,
} from './MomentumIllustrations';

type AchievementCardProps = {
  detail: string;
  icon: React.ReactNode;
  isLocked?: boolean;
  isUnlocked?: boolean;
  title: string;
};

export function AchievementCard({
  detail,
  icon,
  isLocked = false,
  isUnlocked = false,
  title,
}: AchievementCardProps): React.JSX.Element {
  const theme = useHoystTheme();

  return (
    <GlassPanel padding="none" style={styles.card}>
      <View style={styles.cardContent}>
        <View
          style={[
            styles.iconWrap,
            {
              backgroundColor: isLocked
                ? theme.surfaceHigh
                : `${theme.accentWarm}12`,
            },
          ]}>
          <View style={isLocked ? styles.lockedIcon : undefined}>{icon}</View>
          {isLocked ? (
            <View style={[styles.lock, {backgroundColor: theme.text}]}>
              <MomentumLockIllustration color={theme.surfaceStrong} size={13} />
            </View>
          ) : null}
          {isUnlocked ? (
            <View style={[styles.check, {backgroundColor: theme.success}]}>
              <MomentumSmallCheckIllustration size={12} />
            </View>
          ) : null}
        </View>
        <View style={styles.copyStack}>
          <HoystText numberOfLines={2} style={styles.title}>
            {title}
          </HoystText>
          <HoystText
            numberOfLines={2}
            style={styles.detail}
            tone="muted"
            variant="caption">
            {detail}
          </HoystText>
        </View>
      </View>
    </GlassPanel>
  );
}

const styles = StyleSheet.create({
  card: {
    width: 140,
  },
  cardContent: {
    alignItems: 'center',
    gap: 9,
    minHeight: 160,
    paddingBottom: 16,
    paddingHorizontal: 12,
    paddingTop: 14,
  },
  check: {
    alignItems: 'center',
    borderRadius: radius.pill,
    height: 21,
    justifyContent: 'center',
    position: 'absolute',
    right: -1,
    top: -1,
    width: 21,
  },
  copyStack: {
    alignSelf: 'stretch',
    gap: 5,
  },
  detail: {
    fontSize: 12,
    lineHeight: 16,
    textAlign: 'center',
  },
  iconWrap: {
    alignItems: 'center',
    borderRadius: radius.pill,
    height: 82,
    justifyContent: 'center',
    width: 82,
  },
  lock: {
    alignItems: 'center',
    borderRadius: radius.pill,
    bottom: 3,
    height: 23,
    justifyContent: 'center',
    position: 'absolute',
    right: 2,
    width: 23,
  },
  lockedIcon: {
    opacity: 0.42,
  },
  title: {
    fontSize: 14,
    fontWeight: '800',
    lineHeight: 17,
    textAlign: 'center',
  },
});
