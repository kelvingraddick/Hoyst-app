import React from 'react';
import {Image, StyleSheet, View} from 'react-native';
import LinearGradient from 'react-native-linear-gradient';
import {Sparkles} from 'lucide-react-native';

import {HoystText} from '../../../design/components/HoystText';
import {TapInRingMark} from '../../../design/components/TapInRingMark';
import {radius} from '../../../design/tokens/radius';
import {useHoystTheme} from '../../../design/theme/useHoystTheme';
import type {TapInStoryShareData} from '../services/tap-in-story-share';

type TapInStoryShareCardProps = {
  onPhotoSettled?: () => void;
  story: TapInStoryShareData;
};

export const tapInStoryShareCardSize = {
  height: 640,
  width: 360,
} as const;

export function TapInStoryShareCard({
  onPhotoSettled,
  story,
}: TapInStoryShareCardProps): React.JSX.Element {
  const theme = useHoystTheme();
  const hasPhoto = Boolean(story.photoUri);

  return (
    <View
      collapsable={false}
      style={[styles.card, theme.isDark ? styles.cardDark : styles.cardLight]}>
      {story.photoUri ? (
        <Image
          onLoadEnd={onPhotoSettled}
          source={{uri: story.photoUri}}
          style={styles.backgroundPhoto}
        />
      ) : null}

      <LinearGradient
        colors={
          hasPhoto
            ? ['rgba(14,14,14,0.36)', 'rgba(14,14,14,0.72)', '#0e0e0e']
            : ['#1F2933', '#242047', '#0e0e0e']
        }
        style={styles.overlay}
      />

      <View style={styles.sparkleLayer} pointerEvents="none">
        <Sparkles
          color={theme.success}
          size={22}
          strokeWidth={2.2}
          style={styles.sparkleOne}
        />
        <Sparkles
          color={theme.accentSecondary}
          size={18}
          strokeWidth={2.2}
          style={styles.sparkleTwo}
        />
        <Sparkles
          color={theme.warning}
          size={20}
          strokeWidth={2.2}
          style={styles.sparkleThree}
        />
      </View>

      <View style={styles.content}>
        <View style={styles.topRow}>
          <HoystText style={styles.brand} variant="caption">
            Hoyst
          </HoystText>
          <View style={[styles.statusPill, {borderColor: theme.success}]}>
            <HoystText style={{color: theme.success}} variant="caption">
              Tap In Complete
            </HoystText>
          </View>
        </View>

        <View style={styles.hero}>
          <TapInRingMark innerSize={58} outerSize={104} />
          <View style={styles.heroCopy}>
            <HoystText numberOfLines={2} style={styles.title} variant="display">
              {story.circleTitle}
            </HoystText>
            <HoystText numberOfLines={2} style={styles.subtitle}>
              {story.commitment}
            </HoystText>
          </View>
        </View>

        <View style={styles.noteCard}>
          <HoystText style={styles.noteLabel} variant="label">
            Today's note
          </HoystText>
          <HoystText numberOfLines={5} style={styles.note}>
            {story.note}
          </HoystText>
        </View>

        <View style={styles.footer}>
          <View style={styles.statRow}>
            <View style={styles.stat}>
              <HoystText numberOfLines={1} style={styles.statValue}>
                {story.progressLabel}
              </HoystText>
              <HoystText style={styles.statLabel} variant="caption">
                Circle Progression
              </HoystText>
            </View>
            <View style={styles.stat}>
              <HoystText numberOfLines={1} style={styles.statValue}>
                {story.streakLabel}
              </HoystText>
              <HoystText style={styles.statLabel} variant="caption">
                Rhythm
              </HoystText>
            </View>
          </View>

          <View style={styles.cta}>
            <HoystText numberOfLines={1} style={styles.ctaLabel}>
              {story.ctaLabel}
            </HoystText>
            {story.inviteUrl ? (
              <HoystText numberOfLines={1} style={styles.ctaUrl}>
                {story.inviteUrl}
              </HoystText>
            ) : null}
          </View>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  backgroundPhoto: {
    height: '100%',
    position: 'absolute',
    width: '100%',
  },
  brand: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '900',
    letterSpacing: 0,
    lineHeight: 22,
  },
  card: {
    borderRadius: 0,
    height: tapInStoryShareCardSize.height,
    overflow: 'hidden',
    width: tapInStoryShareCardSize.width,
  },
  cardDark: {
    backgroundColor: '#0e0e0e',
  },
  cardLight: {
    backgroundColor: '#1F2933',
  },
  content: {
    flex: 1,
    justifyContent: 'space-between',
    paddingBottom: 28,
    paddingHorizontal: 22,
    paddingTop: 24,
  },
  cta: {
    backgroundColor: 'rgba(255,255,255,0.12)',
    borderColor: 'rgba(255,255,255,0.18)',
    borderRadius: radius.md,
    borderWidth: 1,
    gap: 4,
    padding: 14,
  },
  ctaLabel: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '800',
    letterSpacing: 0,
    lineHeight: 19,
  },
  ctaUrl: {
    color: 'rgba(255,255,255,0.72)',
    fontSize: 11,
    letterSpacing: 0,
    lineHeight: 15,
  },
  footer: {
    gap: 14,
  },
  hero: {
    alignItems: 'center',
    gap: 18,
    paddingTop: 36,
  },
  heroCopy: {
    alignItems: 'center',
    gap: 10,
  },
  note: {
    color: '#FFFFFF',
    fontSize: 22,
    fontWeight: '800',
    letterSpacing: 0,
    lineHeight: 27,
  },
  noteCard: {
    backgroundColor: 'rgba(255,255,255,0.14)',
    borderColor: 'rgba(255,255,255,0.18)',
    borderRadius: radius.md,
    borderWidth: 1,
    gap: 8,
    padding: 16,
  },
  noteLabel: {
    color: 'rgba(255,255,255,0.68)',
  },
  overlay: {
    height: '100%',
    position: 'absolute',
    width: '100%',
  },
  sparkleLayer: {
    ...StyleSheet.absoluteFillObject,
  },
  sparkleOne: {
    left: 26,
    position: 'absolute',
    top: 92,
    transform: [{rotate: '-18deg'}],
  },
  sparkleThree: {
    bottom: 210,
    position: 'absolute',
    right: 36,
    transform: [{rotate: '24deg'}],
  },
  sparkleTwo: {
    position: 'absolute',
    right: 44,
    top: 146,
    transform: [{rotate: '18deg'}],
  },
  stat: {
    flex: 1,
    gap: 4,
    minWidth: 0,
  },
  statLabel: {
    color: 'rgba(255,255,255,0.58)',
  },
  statRow: {
    flexDirection: 'row',
    gap: 12,
  },
  statValue: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '800',
    letterSpacing: 0,
    lineHeight: 19,
  },
  statusPill: {
    borderRadius: radius.pill,
    borderWidth: 1,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  subtitle: {
    color: 'rgba(255,255,255,0.78)',
    fontSize: 18,
    fontWeight: '700',
    letterSpacing: 0,
    lineHeight: 23,
    textAlign: 'center',
  },
  title: {
    color: '#FFFFFF',
    fontSize: 36,
    letterSpacing: 0,
    lineHeight: 40,
    textAlign: 'center',
  },
  topRow: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
});
