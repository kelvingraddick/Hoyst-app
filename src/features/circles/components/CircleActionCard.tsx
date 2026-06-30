import React, {type ReactNode} from 'react';
import {Pressable, StyleSheet, View} from 'react-native';
import {ChevronRight, Search} from 'lucide-react-native';

import {HoystText} from '../../../design/components/HoystText';
import {actionMotion} from '../../../design/tokens/actions';
import {useHoystTheme} from '../../../design/theme/useHoystTheme';

type CircleActionCardProps = {
  accessibilityLabel: string;
  onPress: () => void;
  renderIcon?: (color: string) => ReactNode;
  subtitle: string;
  testID?: string;
  title: string;
};

export function CircleActionCard({
  accessibilityLabel,
  onPress,
  renderIcon,
  subtitle,
  testID,
  title,
}: CircleActionCardProps): React.JSX.Element {
  const theme = useHoystTheme();
  const iconColor = theme.accentForeground;

  return (
    <Pressable
      accessibilityLabel={accessibilityLabel}
      accessibilityRole="button"
      onPress={onPress}
      style={styles.pressable}>
      {({pressed}) => (
        <View
          style={[
            styles.card,
            {
              backgroundColor: theme.isDark
                ? 'rgba(255,255,255,0.04)'
                : 'rgba(255,255,255,0.35)',
              borderColor: theme.isDark
                ? 'rgba(255,255,255,0.18)'
                : 'rgba(124,111,240,0.34)',
              opacity: pressed ? actionMotion.pressedOpacity : 1,
            },
          ]}
          testID={testID}>
          <View
            style={[
              styles.icon,
              {
                backgroundColor: theme.isDark
                  ? 'rgba(122,85,255,0.16)'
                  : 'rgba(122,85,255,0.12)',
              },
            ]}>
            {renderIcon ? (
              renderIcon(iconColor)
            ) : (
              <Search color={iconColor} size={24} strokeWidth={2.3} />
            )}
          </View>
          <View style={styles.copy}>
            <HoystText
              adjustsFontSizeToFit
              minimumFontScale={0.92}
              numberOfLines={1}
              style={styles.title}>
              {title}
            </HoystText>
            <HoystText
              adjustsFontSizeToFit
              minimumFontScale={0.9}
              numberOfLines={1}
              style={[styles.subtitle, {color: theme.textMuted}]}>
              {subtitle}
            </HoystText>
          </View>
          <ChevronRight color={theme.textMuted} size={24} strokeWidth={2.5} />
        </View>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    alignItems: 'center',
    borderRadius: 22,
    borderStyle: 'dashed',
    borderWidth: 2,
    flexDirection: 'row',
    gap: 14,
    minHeight: 88,
    paddingHorizontal: 18,
    paddingVertical: 18,
  },
  copy: {
    flex: 1,
    gap: 3,
    minWidth: 0,
  },
  icon: {
    alignItems: 'center',
    borderRadius: 15,
    flexShrink: 0,
    height: 48,
    justifyContent: 'center',
    width: 48,
  },
  pressable: {
    width: '100%',
  },
  subtitle: {
    fontSize: 14,
    fontWeight: '700',
    letterSpacing: 0,
    lineHeight: 18,
  },
  title: {
    fontSize: 17,
    fontWeight: '800',
    letterSpacing: 0,
    lineHeight: 21,
  },
});
