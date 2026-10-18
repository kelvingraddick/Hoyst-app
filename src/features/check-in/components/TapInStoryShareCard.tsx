import React from 'react';
import {Flame} from 'lucide-react-native';
import {Image, StyleSheet, View} from 'react-native';
import LinearGradient from 'react-native-linear-gradient';
import Svg, {Defs, Pattern, Rect} from 'react-native-svg';

import {
  CircleCategoryIcon,
  getCircleCategoryVisual,
} from '../../../design/components/CircleCategoryIcon';
import {BrandMark} from '../../../design/components/BrandMark';
import {HoystText} from '../../../design/components/HoystText';
import {radius} from '../../../design/tokens/radius';
import type {
  TapInStoryShareData,
  TapInStoryTemplateId,
} from '../services/tap-in-story-share';

type TapInStoryTemplateCardProps = {
  onPhotoSettled?: () => void;
  onImageSettled?: (uri: string) => void;
  showTransparencyGrid?: boolean;
  story: TapInStoryShareData;
  templateId: TapInStoryTemplateId;
};

type TapInStoryShareCardProps = {
  onPhotoSettled?: () => void;
  onImageSettled?: (uri: string) => void;
  story: TapInStoryShareData;
};

export const tapInStoryShareCardSize = {
  height: 640,
  width: 360,
} as const;

// Both preview and export use fixed typography within the 1080 x 1920 image.
function StoryText(props: React.ComponentProps<typeof HoystText>) {
  return <HoystText {...props} allowFontScaling={false} />;
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
  onImageSettled,
}: {
  members: TapInStoryShareData['members'];
  memberCount: number;
  textColor: string;
  onImageSettled?: (uri: string) => void;
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
                <Image
                  source={source}
                  style={styles.memberAvatarImage}
                  onLoadEnd={() =>
                    member.avatarUrl && onImageSettled?.(member.avatarUrl)
                  }
                />
              ) : (
                <StoryText style={styles.memberInitials}>
                  {member.initials}
                </StoryText>
              )}
            </View>
          );
        })}
        {remaining > 0 ? (
          <View style={styles.memberRemainder}>
            <StoryText style={[styles.memberRemainderText, {color: textColor}]}>
              +{remaining}
            </StoryText>
          </View>
        ) : null}
      </View>
    </View>
  );
}

function StoryStreak({
  label,
  value,
  textColor,
  mutedColor,
}: {
  label: string;
  value: string;
  textColor: string;
  mutedColor: string;
}) {
  return (
    <View style={styles.stat}>
      <StoryText style={[styles.statLabel, {color: mutedColor}]}>
        {label}
      </StoryText>
      <View style={styles.streakRow}>
        <Flame
          accessible={false}
          color="#FF8A00"
          fill="#FFB638"
          size={17}
          strokeWidth={1.8}
        />
        <StoryText
          adjustsFontSizeToFit
          minimumFontScale={0.8}
          numberOfLines={1}
          style={[styles.streakValue, {color: textColor}]}>
          {value}
        </StoryText>
      </View>
    </View>
  );
}

function StoryProgress({
  story,
  textColor,
  mutedColor,
  transparent,
}: {
  story: TapInStoryShareData;
  textColor: string;
  mutedColor: string;
  transparent: boolean;
}) {
  const dividerStyle = transparent
    ? styles.transparentDivider
    : styles.neutralDivider;
  return (
    <View style={styles.progressBlock}>
      <View style={styles.progressSection} testID="tap-in-story-your-progress">
        <StoryText style={[styles.sectionLabel, {color: textColor}]}>
          {story.personalProgress.label}
        </StoryText>
        <View style={styles.statsRow}>
          <View style={styles.stat} testID="tap-in-story-this-tap-in">
            <StoryText style={[styles.statLabel, {color: mutedColor}]}>
              This Tap In
            </StoryText>
            <StoryText
              numberOfLines={2}
              style={[styles.statValue, {color: textColor}]}>
              {story.result.quantityLabel ?? story.result.statusLabel}
            </StoryText>
            {story.result.quantityLabel ? (
              <StoryText
                numberOfLines={2}
                style={[styles.statDetail, {color: mutedColor}]}>
                {story.result.statusLabel}
              </StoryText>
            ) : null}
          </View>
          <View style={[styles.statDivider, dividerStyle]} />
          <View style={styles.stat}>
            <StoryText
              numberOfLines={2}
              style={[styles.statLabel, {color: mutedColor}]}>
              {story.personalProgress.periodLabel}
            </StoryText>
            <StoryText
              numberOfLines={2}
              style={[styles.statValue, {color: textColor}]}>
              {story.personalProgress.value}
            </StoryText>
            {story.personalProgress.unitLabel ? (
              <StoryText style={[styles.statDetail, {color: mutedColor}]}>
                {story.personalProgress.unitLabel}
              </StoryText>
            ) : null}
          </View>
          <View style={[styles.statDivider, dividerStyle]} />
          <StoryStreak
            label="Your streak"
            value={story.personalProgress.streak}
            textColor={textColor}
            mutedColor={mutedColor}
          />
        </View>
      </View>
      {story.groupProgress ? (
        <View
          style={[styles.progressSection, styles.groupSection, dividerStyle]}
          testID="tap-in-story-group-progress">
          <StoryText style={[styles.sectionLabel, {color: textColor}]}>
            {story.groupProgress.label}
          </StoryText>
          <View style={styles.statsRow}>
            <View style={[styles.stat, styles.groupPeriod]}>
              <StoryText
                numberOfLines={2}
                style={[styles.statLabel, {color: mutedColor}]}>
                {story.groupProgress.periodLabel}
              </StoryText>
              <StoryText
                numberOfLines={2}
                style={[styles.groupValue, {color: textColor}]}>
                {story.groupProgress.value}
              </StoryText>
            </View>
            <View style={[styles.statDivider, dividerStyle]} />
            <StoryStreak
              label="Group streak"
              value={story.groupProgress.streak}
              textColor={textColor}
              mutedColor={mutedColor}
            />
          </View>
        </View>
      ) : null}
    </View>
  );
}

function StoryContent({
  story,
  transparent = false,
  onImageSettled,
}: {
  story: TapInStoryShareData;
  transparent?: boolean;
  onImageSettled?: (uri: string) => void;
}) {
  const textColor = transparent ? '#FFFFFF' : '#070B1A';
  const mutedColor = transparent ? 'rgba(255,255,255,0.86)' : '#4D5873';
  return (
    <View
      style={[
        styles.storyContent,
        transparent ? styles.transparentContent : undefined,
      ]}>
      <View style={styles.contentGroup} testID="tap-in-story-content-group">
        <View style={styles.identityStack}>
          <StoryText
            style={[styles.header, {color: mutedColor}]}
            testID="tap-in-story-header">
            {story.headerLabel.replace(' MY ', ' MY\n')}
          </StoryText>
          <View style={styles.titleGroup} testID="tap-in-story-title-group">
            <View style={styles.identityRow}>
              <StoryText
                numberOfLines={2}
                style={[styles.circleTitle, {color: textColor}]}
                testID="tap-in-story-title">
                {story.circleTitle}
              </StoryText>
              <CircleCategoryIcon
                category={story.category}
                appearance={story.appearance}
                size={26}
                showBackplate={false}
              />
            </View>
            <StoryText
              numberOfLines={2}
              style={[styles.commitment, {color: mutedColor}]}>
              {story.commitment}
            </StoryText>
          </View>
        </View>
        <StoryProgress
          story={story}
          textColor={textColor}
          mutedColor={mutedColor}
          transparent={transparent}
        />
        <View style={styles.footer}>
          {story.circleMode !== 'personal' && story.memberCount > 0 ? (
            <MemberCluster
              members={story.members}
              memberCount={story.memberCount}
              textColor={textColor}
              onImageSettled={onImageSettled}
            />
          ) : null}
          <View
            style={[
              styles.ctaPill,
              transparent ? styles.transparentCta : undefined,
            ]}
            testID="tap-in-story-cta">
            <StoryText style={[styles.ctaText, {color: textColor}]}>
              {story.circleMode === 'personal'
                ? 'Tapped in on '
                : story.hasInviteUrl
                ? 'Join this Circle on '
                : 'Tap in with '}
              <BrandMark
                isDark={transparent}
                kind="logo"
                style={styles.ctaWordmark}
              />
            </StoryText>
          </View>
        </View>
      </View>
    </View>
  );
}

function TapInMomentStory({
  onPhotoSettled,
  onImageSettled,
  story,
}: Pick<
  TapInStoryTemplateCardProps,
  'onPhotoSettled' | 'onImageSettled' | 'story'
>) {
  const hasPhoto = Boolean(story.photoUri);
  const category = getCircleCategoryVisual(story.category, story.appearance);

  return (
    <View
      style={[styles.card, hasPhoto ? styles.photoCard : styles.neutralCard]}>
      {hasPhoto ? (
        <>
          <Image
            onLoadEnd={() => {
              onPhotoSettled?.();
              if (story.photoUri) {
                onImageSettled?.(story.photoUri);
              }
            }}
            resizeMode="cover"
            source={{uri: story.photoUri}}
            style={styles.backgroundPhoto}
          />
          <LinearGradient
            colors={['rgba(8,12,17,0.22)', 'rgba(8,12,17,0.82)']}
            locations={[0.08, 0.88]}
            style={StyleSheet.absoluteFill}
          />
          <StoryContent
            story={story}
            transparent
            onImageSettled={onImageSettled}
          />
        </>
      ) : (
        <>
          <LinearGradient
            colors={[category.backplateColor, '#FAFAF7']}
            locations={[0, 0.66]}
            style={StyleSheet.absoluteFill}
          />
          <StoryContent story={story} onImageSettled={onImageSettled} />
        </>
      )}
    </View>
  );
}

function TransparentOverlayStory({
  showTransparencyGrid = false,
  onImageSettled,
  story,
}: Pick<
  TapInStoryTemplateCardProps,
  'showTransparencyGrid' | 'onImageSettled' | 'story'
>) {
  return (
    <View style={[styles.card, styles.transparentCard]}>
      {showTransparencyGrid ? <TransparencyGrid /> : null}
      <StoryContent story={story} transparent onImageSettled={onImageSettled} />
    </View>
  );
}

export function TapInStoryTemplateCard({
  onPhotoSettled,
  onImageSettled,
  showTransparencyGrid,
  story,
  templateId,
}: TapInStoryTemplateCardProps): React.JSX.Element {
  if (templateId === 'transparentOverlay') {
    return (
      <TransparentOverlayStory
        onImageSettled={onImageSettled}
        showTransparencyGrid={showTransparencyGrid}
        story={story}
      />
    );
  }

  return (
    <TapInMomentStory
      onPhotoSettled={onPhotoSettled}
      onImageSettled={onImageSettled}
      story={story}
    />
  );
}

export function TapInStoryShareCard({
  onPhotoSettled,
  onImageSettled,
  story,
}: TapInStoryShareCardProps): React.JSX.Element {
  return (
    <TapInStoryTemplateCard
      onImageSettled={onImageSettled}
      onPhotoSettled={onPhotoSettled}
      story={story}
      templateId="tapInMoment"
    />
  );
}

const styles = StyleSheet.create({
  backgroundPhoto: {height: '100%', position: 'absolute', width: '100%'},
  card: {
    height: tapInStoryShareCardSize.height,
    width: tapInStoryShareCardSize.width,
    overflow: 'hidden',
  },
  header: {fontSize: 10, fontWeight: '600', letterSpacing: 0.2, lineHeight: 14},
  circleTitle: {fontSize: 20, fontWeight: '700', lineHeight: 24, flex: 1},
  commitment: {fontSize: 12, lineHeight: 16},
  ctaPill: {
    alignSelf: 'flex-start',
    borderColor: 'rgba(7,11,26,0.28)',
    borderRadius: radius.pill,
    borderWidth: 1,
    paddingHorizontal: 10,
    paddingVertical: 7,
  },
  ctaText: {fontSize: 11, fontWeight: '600', lineHeight: 18},
  ctaWordmark: {height: 14, transform: [{translateY: 5.5}], width: 35},
  contentGroup: {gap: 14},
  identityStack: {gap: 8},
  identityRow: {flexDirection: 'row', alignItems: 'center', gap: 8},
  titleGroup: {gap: 5},
  memberAvatar: {
    alignItems: 'center',
    backgroundColor: '#F1F1EE',
    borderColor: '#FFFFFF',
    borderRadius: radius.pill,
    borderWidth: 1.5,
    height: 26,
    justifyContent: 'center',
    overflow: 'hidden',
    width: 26,
  },
  memberAvatarImage: {height: '100%', resizeMode: 'cover', width: '100%'},
  memberAvatarOverlap: {marginLeft: -9},
  memberAvatars: {alignItems: 'center', flexDirection: 'row'},
  memberCluster: {alignItems: 'center', flexDirection: 'row'},
  memberInitials: {
    fontSize: 9,
    fontWeight: '700',
    lineHeight: 12,
    color: '#26324B',
  },
  memberRemainder: {
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.56)',
    borderColor: '#FFFFFF',
    borderRadius: radius.pill,
    borderWidth: 1.5,
    height: 26,
    justifyContent: 'center',
    marginLeft: -9,
    width: 26,
  },
  memberRemainderText: {fontSize: 9, fontWeight: '700', lineHeight: 12},
  neutralCard: {backgroundColor: '#FAFAF7'},
  photoCard: {backgroundColor: '#101218'},
  stat: {flex: 1, gap: 4},
  statLabel: {fontSize: 10, lineHeight: 13},
  sectionLabel: {fontSize: 11, fontWeight: '700', lineHeight: 15},
  statValue: {fontSize: 15, fontWeight: '700', lineHeight: 20},
  statDetail: {fontSize: 10, lineHeight: 13},
  groupValue: {fontSize: 13, fontWeight: '700', lineHeight: 18},
  streakValue: {fontSize: 14, fontWeight: '700', lineHeight: 20, flexShrink: 1},
  streakRow: {flexDirection: 'row', alignItems: 'center', gap: 4},
  statsRow: {flexDirection: 'row', gap: 10, alignItems: 'stretch'},
  progressBlock: {gap: 10},
  progressSection: {gap: 8},
  groupSection: {borderTopWidth: StyleSheet.hairlineWidth, paddingTop: 12},
  groupPeriod: {flex: 2.25},
  statDivider: {
    width: StyleSheet.hairlineWidth,
    borderLeftWidth: StyleSheet.hairlineWidth,
  },
  transparentDivider: {borderColor: 'rgba(255,255,255,0.35)'},
  neutralDivider: {borderColor: 'rgba(7,11,26,0.2)'},
  storyContent: {
    flex: 1,
    justifyContent: 'flex-end',
    paddingHorizontal: 28,
    paddingTop: 28,
    paddingBottom: 40,
  },
  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
    marginTop: 6,
  },
  transparentCard: {backgroundColor: 'transparent'},
  transparentContent: {
    shadowColor: '#000000',
    shadowOffset: {height: 1, width: 0},
    shadowOpacity: 0.54,
    shadowRadius: 3,
  },
  transparentCta: {borderColor: 'rgba(255,255,255,0.64)'},
});
