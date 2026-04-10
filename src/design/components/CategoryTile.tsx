import React from 'react';
import {Pressable, StyleSheet, View} from 'react-native';
import type {LucideIcon} from 'lucide-react-native';

import {useHoystTheme} from '../theme/useHoystTheme';
import {radius} from '../tokens/radius';
import {HoystText} from './HoystText';

type CategoryTileProps = {
  icon: LucideIcon;
  isSelected: boolean;
  label: string;
  onPress: () => void;
};

export function CategoryTile({
  icon: Icon,
  isSelected,
  label,
  onPress,
}: CategoryTileProps): React.JSX.Element {
  const theme = useHoystTheme();

  return (
    <Pressable
      onPress={onPress}
      style={({pressed}) => [
        styles.base,
        {
          backgroundColor: isSelected ? theme.surfaceHigh : theme.surfaceSoft,
          borderColor: isSelected ? theme.accentSecondary : theme.border,
          opacity: pressed ? 0.92 : 1,
        },
      ]}>
      <View style={styles.iconWrap}>
        <Icon
          color={isSelected ? theme.accentSecondary : theme.textSubtle}
          size={18}
          strokeWidth={2.3}
        />
      </View>
      <HoystText style={isSelected ? {color: theme.text} : {color: theme.textMuted}}>
        {label}
      </HoystText>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    borderRadius: radius.md,
    borderWidth: 1,
    gap: 18,
    minHeight: 92,
    padding: 14,
  },
  iconWrap: {
    alignItems: 'flex-start',
  },
});
