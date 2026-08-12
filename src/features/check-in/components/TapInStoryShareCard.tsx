import React from 'react';
import {Image, StyleSheet, View} from 'react-native';
import LinearGradient from 'react-native-linear-gradient';
import Svg, {
  Circle,
  Defs,
  Pattern,
  RadialGradient,
  Rect,
  Stop,
} from 'react-native-svg';

import {BrandMark} from '../../../design/components/BrandMark';
import {HoystText} from '../../../design/components/HoystText';
import {brandColors, frostedBlobColors} from '../../../design/tokens/colors';
import {radius} from '../../../design/tokens/radius';
import type {
  TapInStoryShareData,
  TapInStoryTemplateId,
} from '../services/tap-in-story-share';

type TapInStoryTemplateCardProps = {
  onPhotoSettled?: () => void;
  showTransparencyGrid?: boolean;
  story: TapInStoryShareData;
  templateId: TapInStoryTemplateId;
};

type TapInStoryShareCardProps = {
  onPhotoSettled?: () => void;
  story: TapInStoryShareData;
};

export const tapInStoryShareCardSize = {
  height: 640,
  width: 360,
} as const;

const homeDarkStoryBlobs = [
  {color: frostedBlobColors.purple, cx: 0.06, cy: 0.16, opacity: 0.34, r: 0.34},
  {color: frostedBlobColors.green, cx: 0.94, cy: 0.4, opacity: 0.28, r: 0.36},
  {color: frostedBlobColors.orange, cx: 0.2, cy: 0.64, opacity: 0.3, r: 0.34},
  {color: frostedBlobColors.blue, cx: 0.96, cy: 0.88, opacity: 0.26, r: 0.34},
] as const;

function formatNumber(value: number) {
  return Number.isFinite(value) ? String(Math.max(0, Math.round(value))) : '0';
}

function formatStreakDays(streakDays: number) {
  const safeDays = Math.max(0, Math.round(streakDays));
  return `${safeDays} ${safeDays === 1 ? 'day' : 'days'}`;
}

function BrandSignature({
  centered = false,
  isDark = true,
  size = 'regular',
}: {
  centered?: boolean;
  isDark?: boolean;
  size?: 'large' | 'medium' | 'regular' | 'small';
}) {
  const height =
    size === 'large' ? 37 : size === 'medium' ? 26 : size === 'small' ? 18 : 21;
  const width = height * (19 / 8);
  const logoStyle =
    size === 'large'
      ? styles.brandLogoLarge
      : size === 'small'
      ? styles.brandLogoSmall
      : styles.brandLogo;

  return (
    <View style={[styles.brandRow, centered ? styles.brandRowCentered : null]}>
      <BrandMark
        isDark={isDark}
        kind="logo"
        style={[logoStyle, {height, width}]}
      />
    </View>
  );
}

function StoryStat({
  label,
  tone,
  value,
}: {
  label: string;
  tone?: string;
  value: string;
}) {
  return (
    <View style={styles.statTile}>
      <HoystText numberOfLines={1} style={[styles.statValue, {color: tone}]}>
        {value}
      </HoystText>
      <HoystText numberOfLines={1} style={styles.statLabel}>
        {label}
      </HoystText>
    </View>
  );
}

function OverlayStat({label, value}: {label: string; value: string}) {
  return (
    <View style={styles.overlayStat}>
      <HoystText numberOfLines={1} style={styles.overlayStatValue}>
        {value}
      </HoystText>
      <HoystText numberOfLines={1} style={styles.overlayStatLabel}>
        {label}
      </HoystText>
    </View>
  );
}

function TransparencyGrid() {
  const patternId = `hoystStoryGrid${React.useId().replace(
    /[^a-zA-Z0-9]/g,
    '',
  )}`;

  return (
    <Svg
      height="100%"
      pointerEvents="none"
      style={StyleSheet.absoluteFill}
      width="100%">
      <Defs>
        <Pattern
          height="18"
          id={patternId}
          patternUnits="userSpaceOnUse"
          width="18">
          <Rect fill="#171821" height="18" width="18" x="0" y="0" />
          <Rect fill="#22232D" height="9" width="9" x="0" y="0" />
          <Rect fill="#22232D" height="9" width="9" x="9" y="9" />
        </Pattern>
      </Defs>
      <Rect
        fill={`url(#${patternId})`}
        height="100%"
        width="100%"
        x="0"
        y="0"
      />
    </Svg>
  );
}

function HomeDarkStoryBackdrop() {
  const gradientPrefix = `hoystStoryDark${React.useId().replace(
    /[^a-zA-Z0-9]/g,
    '',
  )}`;

  return (
    <View pointerEvents="none" style={styles.homeDarkStoryBackdrop}>
      <Svg
        height="100%"
        preserveAspectRatio="xMidYMid slice"
        viewBox="0 0 100 100"
        width="100%">
        <Defs>
          {homeDarkStoryBlobs.map((blob, index) => (
            <RadialGradient
              cx="50%"
              cy="50%"
              id={`${gradientPrefix}-${index}`}
              key={`${gradientPrefix}-${index}`}
              r="50%">
              <Stop
                offset="0"
                stopColor={blob.color}
                stopOpacity={blob.opacity * 0.7}
              />
              <Stop offset="1" stopColor={blob.color} stopOpacity={0} />
            </RadialGradient>
          ))}
        </Defs>
        {homeDarkStoryBlobs.map((blob, index) => (
          <Circle
            cx={blob.cx * 100}
            cy={blob.cy * 100}
            fill={`url(#${gradientPrefix}-${index})`}
            key={`${gradientPrefix}-circle-${index}`}
            r={blob.r * 100}
          />
        ))}
      </Svg>
    </View>
  );
}

function PhotoOverlayStory({
  onPhotoSettled,
  story,
}: Pick<TapInStoryTemplateCardProps, 'onPhotoSettled' | 'story'>) {
  return (
    <View style={styles.card}>
      {story.photoUri ? (
        <Image
          onLoadEnd={onPhotoSettled}
          resizeMode="cover"
          source={{uri: story.photoUri}}
          style={styles.backgroundPhoto}
        />
      ) : null}
      <LinearGradient
        colors={[
          'rgba(9,11,18,0.08)',
          'rgba(9,11,18,0.24)',
          'rgba(9,11,18,0.9)',
        ]}
        locations={[0.12, 0.52, 1]}
        style={StyleSheet.absoluteFill}
      />
      <View style={styles.photoContent}>
        <BrandSignature size="medium" />
        <HoystText style={styles.overlayEyebrow}>CIRCLE</HoystText>
        <HoystText numberOfLines={2} style={styles.overlayTitle}>
          {story.circleTitle}
        </HoystText>
        <View style={styles.overlayStats}>
          <OverlayStat label="STREAK" value={formatNumber(story.streakDays)} />
          <OverlayStat
            label="TAP INS"
            value={formatNumber(story.periodTapInCount)}
          />
          <OverlayStat
            label="MEMBERS"
            value={formatNumber(story.memberCount)}
          />
        </View>
      </View>
    </View>
  );
}

function DesignedPostStory({story}: {story: TapInStoryShareData}) {
  return (
    <View style={[styles.card, styles.designedCard]}>
      <HomeDarkStoryBackdrop />
      <View style={styles.designedContent}>
        <View style={styles.designedCopy}>
          <HoystText numberOfLines={2} style={styles.designedTitle}>
            {story.circleTitle}
          </HoystText>
          <HoystText numberOfLines={2} style={styles.designedSubtitle}>
            {story.commitment}
          </HoystText>
        </View>

        <View style={styles.statRow}>
          <StoryStat
            label="STREAK"
            tone={brandColors.orangeStrong}
            value={formatNumber(story.streakDays)}
          />
          <StoryStat
            label="TAP INS"
            tone={brandColors.blueVivid}
            value={formatNumber(story.periodTapInCount)}
          />
          <StoryStat
            label="MEMBERS"
            tone={brandColors.purpleBright}
            value={formatNumber(story.memberCount)}
          />
        </View>

        <View style={styles.invitePill}>
          <HoystText numberOfLines={1} style={styles.inviteText}>
            {story.inviteUrl ? 'Paste circle share link here' : story.ctaLabel}
          </HoystText>
        </View>

        <BrandMark isDark kind="logo" style={styles.designedHeroLogo} />
      </View>
    </View>
  );
}

function TransparentStatsStory({
  showTransparencyGrid = false,
  story,
}: Pick<TapInStoryTemplateCardProps, 'showTransparencyGrid' | 'story'>) {
  return (
    <View style={[styles.card, styles.transparentCard]}>
      {showTransparencyGrid ? <TransparencyGrid /> : null}
      <View style={styles.transparentBadge}>
        <HoystText style={styles.transparentBadgeText}>TRANSPARENT</HoystText>
      </View>
      <View style={styles.transparentContent}>
        <View style={styles.transparentGroup}>
          <HoystText style={styles.transparentLabel}>CIRCLE</HoystText>
          <HoystText numberOfLines={2} style={styles.transparentTitle}>
            {story.circleTitle}
          </HoystText>
        </View>
        <View style={styles.transparentGroup}>
          <HoystText style={styles.transparentLabel}>STREAK</HoystText>
          <HoystText style={styles.transparentStreak}>
            {formatStreakDays(story.streakDays)}
          </HoystText>
        </View>
        <View style={styles.transparentStatsRow}>
          <View style={styles.transparentStat}>
            <HoystText style={styles.transparentLabel}>TAP INS</HoystText>
            <HoystText style={styles.transparentStatValue}>
              {formatNumber(story.periodTapInCount)}
            </HoystText>
          </View>
          <View style={styles.transparentStat}>
            <HoystText style={styles.transparentLabel}>MEMBERS</HoystText>
            <HoystText style={styles.transparentStatValue}>
              {formatNumber(story.memberCount)}
            </HoystText>
          </View>
        </View>
        <BrandSignature size="large" />
      </View>
    </View>
  );
}

export function TapInStoryTemplateCard({
  onPhotoSettled,
  showTransparencyGrid,
  story,
  templateId,
}: TapInStoryTemplateCardProps): React.JSX.Element {
  if (templateId === 'photoOverlay') {
    return <PhotoOverlayStory onPhotoSettled={onPhotoSettled} story={story} />;
  }

  if (templateId === 'transparentStats') {
    return (
      <TransparentStatsStory
        showTransparencyGrid={showTransparencyGrid}
        story={story}
      />
    );
  }

  return <DesignedPostStory story={story} />;
}

export function TapInStoryShareCard({
  story,
}: TapInStoryShareCardProps): React.JSX.Element {
  return <TapInStoryTemplateCard story={story} templateId="designedPost" />;
}

const styles = StyleSheet.create({
  backgroundPhoto: {
    height: '100%',
    position: 'absolute',
    width: '100%',
  },
  brandRow: {
    alignItems: 'center',
    flexDirection: 'row',
  },
  brandRowCentered: {
    justifyContent: 'center',
  },
  brandLogo: {
    alignSelf: 'center',
  },
  brandLogoLarge: {
    alignSelf: 'center',
  },
  brandLogoSmall: {
    alignSelf: 'center',
  },
  card: {
    backgroundColor: 'transparent',
    height: tapInStoryShareCardSize.height,
    overflow: 'hidden',
    width: tapInStoryShareCardSize.width,
  },
  designedCard: {
    backgroundColor: brandColors.backgroundDark,
  },
  designedContent: {
    alignItems: 'flex-start',
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: 48,
  },
  designedCopy: {
    alignItems: 'flex-start',
    gap: 5,
  },
  designedHeroLogo: {
    height: 34,
    marginTop: 24,
    width: 81,
  },
  designedSubtitle: {
    color: 'rgba(255,255,255,0.58)',
    fontSize: 14,
    fontWeight: '800',
    letterSpacing: 0,
    lineHeight: 18,
    textAlign: 'left',
  },
  designedTitle: {
    color: '#FFFFFF',
    fontSize: 24,
    fontWeight: '900',
    letterSpacing: 0,
    lineHeight: 30,
    textAlign: 'left',
  },
  invitePill: {
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderColor: 'rgba(185,168,255,0.45)',
    borderRadius: radius.pill,
    borderStyle: 'dashed',
    borderWidth: 2,
    flexDirection: 'row',
    gap: 9,
    marginTop: 30,
    maxWidth: 248,
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  inviteText: {
    color: '#C8B8FF',
    flexShrink: 1,
    fontSize: 14,
    fontWeight: '900',
    letterSpacing: 0,
    lineHeight: 18,
  },
  overlayEyebrow: {
    color: 'rgba(255,255,255,0.68)',
    fontSize: 13,
    fontWeight: '900',
    letterSpacing: 1.8,
    lineHeight: 17,
    marginTop: 18,
  },
  overlayStat: {
    minWidth: 52,
  },
  overlayStatLabel: {
    color: 'rgba(255,255,255,0.56)',
    fontSize: 10,
    fontWeight: '900',
    letterSpacing: 1.2,
    lineHeight: 13,
  },
  overlayStats: {
    flexDirection: 'row',
    gap: 28,
    marginTop: 22,
  },
  overlayStatValue: {
    color: '#FFFFFF',
    fontSize: 25,
    fontWeight: '900',
    letterSpacing: 0,
    lineHeight: 30,
  },
  overlayTitle: {
    color: '#FFFFFF',
    fontSize: 25,
    fontWeight: '900',
    letterSpacing: 0,
    lineHeight: 31,
    marginTop: 5,
  },
  photoContent: {
    bottom: 28,
    left: 22,
    position: 'absolute',
    right: 22,
  },
  statLabel: {
    color: 'rgba(255,255,255,0.62)',
    fontSize: 9,
    fontWeight: '900',
    letterSpacing: 1,
    lineHeight: 11,
    textAlign: 'center',
  },
  statRow: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 26,
  },
  statTile: {
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.1)',
    borderColor: 'rgba(255,255,255,0.17)',
    borderRadius: radius.md,
    borderWidth: 1,
    minWidth: 74,
    paddingHorizontal: 10,
    paddingVertical: 14,
  },
  statValue: {
    fontSize: 22,
    fontWeight: '900',
    letterSpacing: 0,
    lineHeight: 26,
    textAlign: 'center',
  },
  transparentBadge: {
    borderColor: 'rgba(255,255,255,0.28)',
    borderRadius: 7,
    borderWidth: 1,
    left: 18,
    paddingHorizontal: 11,
    paddingVertical: 6,
    position: 'absolute',
    top: 18,
  },
  transparentBadgeText: {
    color: 'rgba(255,255,255,0.78)',
    fontSize: 11,
    fontWeight: '900',
    letterSpacing: 1.4,
    lineHeight: 14,
  },
  transparentCard: {
    backgroundColor: 'transparent',
  },
  transparentContent: {
    alignItems: 'flex-start',
    flex: 1,
    gap: 16,
    justifyContent: 'center',
    paddingHorizontal: 66,
  },
  transparentGroup: {
    alignItems: 'flex-start',
    gap: 4,
  },
  transparentLabel: {
    color: 'rgba(255,255,255,0.58)',
    fontSize: 12,
    fontWeight: '900',
    letterSpacing: 1.6,
    lineHeight: 15,
    textAlign: 'left',
  },
  transparentStat: {
    alignItems: 'flex-start',
    minWidth: 72,
  },
  transparentStatsRow: {
    flexDirection: 'row',
    gap: 28,
    marginBottom: 0,
    marginTop: 0,
  },
  transparentStatValue: {
    color: '#FFFFFF',
    fontSize: 24,
    fontWeight: '900',
    letterSpacing: 0,
    lineHeight: 29,
    marginTop: 4,
    textAlign: 'left',
  },
  transparentStreak: {
    color: '#FFFFFF',
    fontSize: 26,
    fontWeight: '900',
    letterSpacing: 0,
    lineHeight: 31,
    textAlign: 'left',
  },
  transparentTitle: {
    color: '#FFFFFF',
    fontSize: 23,
    fontWeight: '900',
    letterSpacing: 0,
    lineHeight: 30,
    textAlign: 'left',
  },
  homeDarkStoryBackdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: brandColors.backgroundDark,
  },
});
