import React from 'react';
import {Image, StyleSheet, View} from 'react-native';
import LinearGradient from 'react-native-linear-gradient';
import Svg, {Defs, Pattern, Rect} from 'react-native-svg';

import {getCircleCategoryVisual} from '../../../design/components/CircleCategoryIcon';
import {BrandMark} from '../../../design/components/BrandMark';
import {HoystText} from '../../../design/components/HoystText';
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

function formatNumber(value: number) {
  return Number.isFinite(value) ? String(Math.max(0, Math.round(value))) : '0';
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
      <Rect fill={`url(#${patternId})`} height="100%" width="100%" />
    </Svg>
  );
}

function MemberCluster({
  members,
  memberCount,
  textColor,
}: {
  members: TapInStoryShareData['members'];
  memberCount: number;
  textColor: string;
}) {
  const remaining = Math.max(0, memberCount - members.length);

  return (
    <View style={styles.memberCluster} testID="tap-in-story-member-cluster">
      <View style={styles.memberAvatars}>
        {members.map((member, index) => {
          const source =
            member.avatarImage ??
            (member.avatarUrl ? {uri: member.avatarUrl} : undefined);

          return (
            <View
              key={member.id}
              style={[
                styles.memberAvatar,
                index > 0 ? styles.memberAvatarOverlap : undefined,
              ]}>
              {source ? (
                <Image source={source} style={styles.memberAvatarImage} />
              ) : (
                <HoystText style={[styles.memberInitials, {color: textColor}]}>
                  {member.initials}
                </HoystText>
              )}
            </View>
          );
        })}
        {remaining > 0 ? (
          <View style={styles.memberRemainder}>
            <HoystText style={[styles.memberRemainderText, {color: textColor}]}>
              +{remaining}
            </HoystText>
          </View>
        ) : null}
      </View>
    </View>
  );
}

function StoryStats({
  story,
  textColor,
  mutedColor,
}: {
  story: TapInStoryShareData;
  textColor: string;
  mutedColor: string;
}) {
  return (
    <View style={styles.statsRow}>
      {[
        {label: 'STREAK', value: formatNumber(story.streakDays)},
        {label: 'TAP INS', value: formatNumber(story.totalTapIns)},
        {label: 'MEMBERS', value: formatNumber(story.memberCount)},
      ].map(stat => (
        <View key={stat.label} style={styles.stat}>
          <HoystText style={[styles.statValue, {color: textColor}]}>
            {stat.value}
          </HoystText>
          <HoystText style={[styles.statLabel, {color: mutedColor}]}>
            {stat.label}
          </HoystText>
        </View>
      ))}
    </View>
  );
}

function StoryContent({
  story,
  transparent = false,
}: {
  story: TapInStoryShareData;
  transparent?: boolean;
}) {
  const textColor = transparent ? '#FFFFFF' : '#070B1A';
  const mutedColor = transparent ? 'rgba(255,255,255,0.82)' : '#4D5873';

  return (
    <View
      style={[
        styles.storyContent,
        transparent ? styles.transparentContent : undefined,
      ]}>
      <View style={styles.contentGroup} testID="tap-in-story-content-group">
        <View style={styles.identityStack}>
          <View style={styles.titleGroup} testID="tap-in-story-title-group">
            <HoystText
              style={[styles.circleEyebrow, {color: mutedColor}]}
              testID="tap-in-story-eyebrow">
              ACCOUNTABILITY CIRCLE
            </HoystText>
            <HoystText
              style={[styles.circleTitle, {color: textColor}]}
              testID="tap-in-story-title">
              {story.circleTitle}
            </HoystText>
          </View>
          <HoystText
            numberOfLines={3}
            style={[styles.commitment, {color: mutedColor}]}>
            {story.commitment}
          </HoystText>
        </View>

        <View style={styles.supportingStack}>
          <StoryStats
            story={story}
            textColor={textColor}
            mutedColor={mutedColor}
          />
          <MemberCluster
            members={story.members}
            memberCount={story.memberCount}
            textColor={textColor}
          />
        </View>

        <View
          style={[
            styles.ctaPill,
            transparent ? styles.transparentCta : undefined,
          ]}
          testID="tap-in-story-cta">
          <HoystText style={[styles.ctaText, {color: textColor}]}>
            {'Join this Circle on '}
            <BrandMark
              isDark={transparent}
              kind="logo"
              style={styles.ctaWordmark}
            />
          </HoystText>
        </View>
      </View>
    </View>
  );
}

function TapInMomentStory({
  onPhotoSettled,
  story,
}: Pick<TapInStoryTemplateCardProps, 'onPhotoSettled' | 'story'>) {
  const hasPhoto = Boolean(story.photoUri);
  const category = getCircleCategoryVisual(story.category);

  return (
    <View
      style={[styles.card, hasPhoto ? styles.photoCard : styles.neutralCard]}>
      {hasPhoto ? (
        <>
          <Image
            onLoadEnd={onPhotoSettled}
            resizeMode="cover"
            source={{uri: story.photoUri}}
            style={styles.backgroundPhoto}
          />
          <LinearGradient
            colors={['rgba(8,12,17,0.22)', 'rgba(8,12,17,0.82)']}
            locations={[0.08, 0.88]}
            style={StyleSheet.absoluteFill}
          />
          <StoryContent story={story} transparent />
        </>
      ) : (
        <>
          <LinearGradient
            colors={[category.backplateColor, '#FAFAF7']}
            locations={[0, 0.66]}
            style={StyleSheet.absoluteFill}
          />
          <StoryContent story={story} />
        </>
      )}
    </View>
  );
}

function TransparentOverlayStory({
  showTransparencyGrid = false,
  story,
}: Pick<TapInStoryTemplateCardProps, 'showTransparencyGrid' | 'story'>) {
  return (
    <View style={[styles.card, styles.transparentCard]}>
      {showTransparencyGrid ? <TransparencyGrid /> : null}
      <StoryContent story={story} transparent />
    </View>
  );
}

export function TapInStoryTemplateCard({
  onPhotoSettled,
  showTransparencyGrid,
  story,
  templateId,
}: TapInStoryTemplateCardProps): React.JSX.Element {
  if (templateId === 'transparentOverlay') {
    return (
      <TransparentOverlayStory
        showTransparencyGrid={showTransparencyGrid}
        story={story}
      />
    );
  }

  return <TapInMomentStory onPhotoSettled={onPhotoSettled} story={story} />;
}

export function TapInStoryShareCard({
  onPhotoSettled,
  story,
}: TapInStoryShareCardProps): React.JSX.Element {
  return (
    <TapInStoryTemplateCard
      onPhotoSettled={onPhotoSettled}
      story={story}
      templateId="tapInMoment"
    />
  );
}

const styles = StyleSheet.create({
  backgroundPhoto: {
    height: '100%',
    position: 'absolute',
    width: '100%',
  },
  card: {
    height: tapInStoryShareCardSize.height,
    overflow: 'hidden',
    width: tapInStoryShareCardSize.width,
  },
  circleEyebrow: {
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 0.6,
    lineHeight: 14,
  },
  circleTitle: {fontSize: 21, fontWeight: '700', lineHeight: 26},
  commitment: {fontSize: 14, fontWeight: '400', lineHeight: 20},
  ctaPill: {
    alignSelf: 'flex-start',
    borderColor: 'rgba(7,11,26,0.18)',
    borderRadius: radius.pill,
    borderWidth: 1,
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  ctaText: {fontSize: 14, fontWeight: '600', lineHeight: 20},
  ctaWordmark: {
    height: 18,
    transform: [{translateY: 7.75}],
    width: 44,
  },
  contentGroup: {gap: 20},
  identityStack: {gap: 14},
  memberAvatar: {
    alignItems: 'center',
    backgroundColor: '#F1F1EE',
    borderColor: '#FFFFFF',
    borderRadius: radius.pill,
    borderWidth: 2,
    height: 30,
    justifyContent: 'center',
    overflow: 'hidden',
    width: 30,
  },
  memberAvatarImage: {height: '100%', resizeMode: 'cover', width: '100%'},
  memberAvatarOverlap: {marginLeft: -8},
  memberAvatars: {alignItems: 'center', flexDirection: 'row'},
  memberCluster: {alignItems: 'center', flexDirection: 'row'},
  memberInitials: {fontSize: 10, fontWeight: '700', lineHeight: 12},
  memberRemainder: {
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.56)',
    borderColor: '#FFFFFF',
    borderRadius: radius.pill,
    borderWidth: 2,
    height: 30,
    justifyContent: 'center',
    marginLeft: -8,
    width: 30,
  },
  memberRemainderText: {fontSize: 10, fontWeight: '700', lineHeight: 12},
  neutralCard: {backgroundColor: '#FAFAF7'},
  photoCard: {backgroundColor: '#101218'},
  stat: {flex: 1, gap: 2},
  statLabel: {
    fontSize: 9,
    fontWeight: '700',
    letterSpacing: 0.7,
    lineHeight: 12,
  },
  statValue: {fontSize: 22, fontWeight: '700', lineHeight: 27},
  statsRow: {flexDirection: 'row', gap: 12},
  storyContent: {
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: 30,
    paddingVertical: 34,
  },
  supportingStack: {gap: 16},
  titleGroup: {gap: 2},
  transparentCard: {backgroundColor: 'transparent'},
  transparentContent: {
    shadowColor: '#000000',
    shadowOffset: {height: 1, width: 0},
    shadowOpacity: 0.54,
    shadowRadius: 3,
  },
  transparentCta: {borderColor: 'rgba(255,255,255,0.72)'},
});
