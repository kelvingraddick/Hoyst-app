import React from 'react';
import {
  Image,
  Pressable,
  StyleSheet,
  View,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import {ChevronRight} from 'lucide-react-native';
import {useHoystTheme} from '../../../design/theme/useHoystTheme';
import {HoystText} from '../../../design/components/HoystText';
import {homeTypography} from '../../../design/tokens/home';
import type {CircleActivityItem} from '../../../types/models';

export function HomeSurface({
  children,
  style,
}: {
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
  padding?: string;
  variant?: string;
}) {
  const theme = useHoystTheme();
  const surfaceColor = theme.isDark ? '#1D1D20' : '#F1F1EE';
  return (
    <View style={[styles.surface, {backgroundColor: surfaceColor}, style]}>
      {children}
    </View>
  );
}
export function HomeButton({
  label,
  onPress,
  variant = 'primary',
}: {
  label: string;
  onPress: () => void;
  variant?: 'primary' | 'outline';
}) {
  const theme = useHoystTheme();
  const backgroundColor =
    variant === 'primary' ? theme.actionSurface : 'transparent';
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      style={[
        styles.button,
        {
          backgroundColor,
          borderColor:
            variant === 'primary' ? theme.actionBorder : theme.borderStrong,
        },
      ]}>
      <HoystText
        style={[
          homeTypography.action,
          {color: variant === 'primary' ? theme.actionForeground : theme.text},
        ]}>
        {label}
      </HoystText>
    </Pressable>
  );
}
export function HomeSectionTitle({children}: {children: React.ReactNode}) {
  const label =
    typeof children === 'string' && children === children.toUpperCase()
      ? children.slice(0, 1).toUpperCase() + children.slice(1).toLowerCase()
      : children;
  return (
    <HoystText accessibilityRole="header" style={styles.heading}>
      {label}
    </HoystText>
  );
}
export function HomeStateCopy({
  title,
  description,
}: {
  title: string;
  description?: string;
}) {
  return (
    <View style={styles.state}>
      <HoystText accessibilityRole="header" style={styles.heading}>
        {title}
      </HoystText>
      {description ? (
        <HoystText style={styles.body} tone="muted">
          {description}
        </HoystText>
      ) : null}
    </View>
  );
}
export function HomeActivityRow({
  item,
  onPress,
}: {
  item: CircleActivityItem;
  onPress: () => void;
}) {
  const theme = useHoystTheme();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${item.actorName} ${item.message} ${item.timestamp}`}
      onPress={onPress}
      style={[styles.activity, {borderBottomColor: theme.border}]}>
      {item.actorAvatarImage || item.actorAvatarUrl ? (
        <Image
          source={item.actorAvatarImage ?? {uri: item.actorAvatarUrl!}}
          resizeMode="cover"
          style={styles.activityAvatar}
          accessibilityIgnoresInvertColors
          testID="home-activity-avatar"
        />
      ) : (
        <View
          style={[
            styles.activityAvatar,
            styles.avatarFallback,
            {backgroundColor: theme.surfaceStrong},
          ]}
          testID="home-activity-avatar">
          <HoystText allowFontScaling={false} style={styles.avatarInitials}>
            {item.actorInitials}
          </HoystText>
        </View>
      )}
      <View style={styles.activityCopy}>
        <HoystText style={styles.activityText}>
          {item.actorName}{' '}
          <HoystText
            style={[
              styles.activityText,
              {
                color:
                  item.tone === 'success'
                    ? theme.successForeground
                    : theme.text,
              },
            ]}>
            {item.message}
          </HoystText>
        </HoystText>
        <HoystText style={styles.caption} tone="muted">
          {item.timestamp}
        </HoystText>
      </View>
      {item.mediaImageUrl ? (
        <Image
          source={{uri: item.mediaImageUrl}}
          style={styles.thumbnail}
          accessibilityLabel="Activity photo"
        />
      ) : null}
      <ChevronRight size={18} color={theme.textMuted} />
    </Pressable>
  );
}
const styles = StyleSheet.create({
  button: {
    minHeight: 44,
    borderRadius: 16,
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  surface: {padding: 12, borderRadius: 18},
  heading: homeTypography.heading,
  state: {gap: 8},
  body: homeTypography.body,
  activity: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 8,
    minHeight: 56,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  activityAvatar: {
    alignSelf: 'flex-start',
    width: 28,
    height: 28,
    borderRadius: 14,
  },
  avatarFallback: {alignItems: 'center', justifyContent: 'center'},
  avatarInitials: {fontSize: 11, lineHeight: 15, fontWeight: '600'},
  activityCopy: {flex: 1, gap: 4},
  activityText: {fontSize: 14, lineHeight: 20, fontWeight: '400'},
  caption: homeTypography.secondary,
  thumbnail: {width: 32, height: 32, borderRadius: 8},
});
