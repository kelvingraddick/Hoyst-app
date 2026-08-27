import React, {type ReactNode} from 'react';
import {
  Pressable,
  StyleSheet,
  View,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import {ChevronRight, Search} from 'lucide-react-native';

import {HoystText} from '../../../design/components/HoystText';
import {actionMotion} from '../../../design/tokens/actions';
import {useHoystTheme} from '../../../design/theme/useHoystTheme';

const actionCardColors = {
  dark: {
    background: 'rgba(255,255,255,0.06)',
    border: 'rgba(200,194,255,0.36)',
    chevron: '#B4BCD1',
    icon: '#C8C2FF',
    iconBackground: 'rgba(122,85,255,0.22)',
    subtitle: '#B4BCD1',
  },
  light: {
    background: 'rgba(255,255,255,0.42)',
    border: 'rgba(200,194,255,0.86)',
    chevron: '#918CAE',
    icon: '#6B3CFF',
    iconBackground: 'rgba(200,194,255,0.34)',
    subtitle: '#8D88A8',
  },
} as const;

type CircleActionCardProps = {
  accessibilityLabel: string;
  onPress: () => void;
  renderIcon?: (color: string) => ReactNode;
  subtitle: string;
  style?: StyleProp<ViewStyle>;
  testID?: string;
  title: string;
};

export function CircleActionCard({
  accessibilityLabel,
  onPress,
  renderIcon,
  style,
  subtitle,
  testID,
  title,
}: CircleActionCardProps): React.JSX.Element {
  const theme = useHoystTheme();
  const cardColors = theme.isDark
    ? actionCardColors.dark
    : actionCardColors.light;

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
              backgroundColor: cardColors.background,
              borderColor: cardColors.border,
              opacity: pressed ? actionMotion.pressedOpacity : 1,
            },
            style,
          ]}
          testID={testID}>
          <View
            style={[styles.icon, {backgroundColor: cardColors.iconBackground}]}>
            {renderIcon ? (
              renderIcon(cardColors.icon)
            ) : (
              <Search color={cardColors.icon} size={24} strokeWidth={2.4} />
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
              style={[styles.subtitle, {color: cardColors.subtitle}]}>
              {subtitle}
            </HoystText>
          </View>
          <ChevronRight
            color={cardColors.chevron}
            size={22}
            strokeWidth={2.4}
          />
        </View>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    alignItems: 'center',
    borderRadius: 24,
    borderStyle: 'dashed',
    borderWidth: 1.25,
    flexDirection: 'row',
    gap: 14,
    minHeight: 78,
    paddingHorizontal: 18,
    paddingVertical: 12,
  },
  copy: {
    flex: 1,
    gap: 0,
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
    lineHeight: 17,
  },
  title: {
    fontSize: 15,
    fontWeight: '800',
    letterSpacing: 0,
    lineHeight: 18,
  },
});
