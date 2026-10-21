import React from 'react';
import {Pressable, StyleSheet, useWindowDimensions, View} from 'react-native';
import {ChevronRight} from 'lucide-react-native';
import {HoystText} from '../../../design/components/HoystText';
import {LayeredAvatar} from '../../../design/components/LayeredAvatar';
import {useHoystTheme} from '../../../design/theme/useHoystTheme';
import {getSystemTheme} from '../../../design/system/tokens';
import {homeTypography} from '../../../design/tokens/home';
import type {CircleMemberStatus} from '../../../types/models';
import {joinRequestCountLabel} from '../services/join-request-selectors';

export function CircleJoinRequestPrompt({
  requests,
  circleTitle,
  variant = 'circle',
  onPress,
}: {
  requests: readonly CircleMemberStatus[];
  circleTitle?: string;
  variant?: 'home' | 'circle';
  onPress: () => void;
}) {
  const theme = useHoystTheme();
  const palette = getSystemTheme(theme.isDark ? 'dark' : 'light');
  const {fontScale} = useWindowDimensions();
  if (requests.length === 0) {
    return null;
  }
  const countLabel = joinRequestCountLabel(requests.length);
  const single = requests.length === 1;
  const names = requests
    .slice(0, 2)
    .map(member => member.name)
    .join(', ');
  const preview = single
    ? `${requests[0].name} wants to join`
    : `${names}${requests.length > 2 ? ` +${requests.length - 2} more` : ''}`;
  const visibleAvatars = requests.slice(0, 2);
  const largeType = fontScale >= 1.5;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`Review ${countLabel}${
        circleTitle ? ` for ${circleTitle}` : ''
      }`}
      accessibilityHint={preview}
      onPress={onPress}
      style={[
        styles.prompt,
        largeType && styles.largePrompt,
        {backgroundColor: palette.surface, shadowColor: palette.shadow},
      ]}>
      <View style={styles.identity}>
        <View
          style={styles.avatars}
          accessible={false}
          accessibilityElementsHidden
          importantForAccessibility="no-hide-descendants">
          {visibleAvatars.map((member, index) => (
            <View
              key={member.id}
              style={[styles.avatar, index > 0 && styles.overlap]}>
              <LayeredAvatar
                chrome="minimal"
                initials={member.initials}
                imageSource={member.avatarImage}
                imageUrl={member.avatarUrl}
                size={40}
                state="pending"
              />
            </View>
          ))}
          {requests.length > 2 ? (
            <View
              style={[
                styles.overflow,
                styles.overlap,
                {
                  backgroundColor: palette.mutedSurface,
                  borderColor: palette.surface,
                },
              ]}>
              <HoystText style={styles.overflowText}>
                +{requests.length - 2}
              </HoystText>
            </View>
          ) : null}
          <View
            style={[
              styles.dot,
              {backgroundColor: theme.warning, borderColor: palette.surface},
            ]}
          />
        </View>
        <View style={styles.copy}>
          <HoystText style={styles.title}>
            {variant === 'home' && single ? preview : countLabel}
          </HoystText>
          <HoystText tone="muted" style={styles.supporting}>
            {variant === 'home' ? circleTitle : preview}
          </HoystText>
        </View>
      </View>
      <View
        style={[
          styles.reviewPill,
          largeType && styles.largeReview,
          {backgroundColor: `${palette.action}12`},
        ]}>
        <HoystText style={[styles.review, {color: palette.action}]}>
          Review
        </HoystText>
        <ChevronRight color={palette.action} size={16} />
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  prompt: {
    alignItems: 'center',
    borderRadius: 20,
    flexDirection: 'row',
    gap: 12,
    minHeight: 76,
    padding: 12,
    shadowOffset: {width: 0, height: 4},
    shadowOpacity: 0.04,
    shadowRadius: 10,
    elevation: 1,
  },
  largePrompt: {alignItems: 'stretch', flexDirection: 'column'},
  identity: {alignItems: 'center', flex: 1, flexDirection: 'row', gap: 12},
  avatars: {alignItems: 'center', flexDirection: 'row'},
  avatar: {zIndex: 1},
  overlap: {marginLeft: -16},
  overflow: {
    alignItems: 'center',
    borderRadius: 20,
    borderWidth: 2,
    height: 40,
    justifyContent: 'center',
    minWidth: 40,
    paddingHorizontal: 4,
    zIndex: 2,
  },
  overflowText: {...homeTypography.secondary, fontWeight: '600'},
  dot: {
    borderRadius: 6,
    borderWidth: 2,
    height: 12,
    position: 'absolute',
    right: 0,
    top: 0,
    width: 12,
    zIndex: 3,
  },
  copy: {flex: 1, gap: 3, minWidth: 0},
  title: homeTypography.title,
  supporting: homeTypography.secondary,
  reviewPill: {
    alignItems: 'center',
    borderRadius: 24,
    flexDirection: 'row',
    gap: 3,
    minHeight: 44,
    paddingHorizontal: 12,
  },
  largeReview: {alignSelf: 'flex-end'},
  review: homeTypography.action,
});
