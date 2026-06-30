import React from 'react';
import {Pressable, StyleSheet, View} from 'react-native';

import {actionMotion} from '../tokens/actions';
import {useHoystTheme} from '../theme/useHoystTheme';
import {GlassPanel} from './GlassPanel';
import {HoystText} from './HoystText';

type OverviewStatCardProps = {
  accessibilityLabel: string;
  color: string;
  label: string;
  onPress: () => void;
  // Render prop so the glyph recolors to white when the card is selected.
  renderIcon: (color: string) => React.ReactNode;
  selected: boolean;
  value: number;
};

// Compact glass stat tile that doubles as a filter toggle on the Circles
// screen: tap to filter the list to that bucket, tap again to clear. Selected
// state fills the icon chip and tints the border/value in the stat's tone.
export function OverviewStatCard({
  accessibilityLabel,
  color,
  label,
  onPress,
  renderIcon,
  selected,
  value,
}: OverviewStatCardProps): React.JSX.Element {
  const theme = useHoystTheme();
  const iconColor = selected ? '#FFFFFF' : color;

  return (
    <Pressable
      accessibilityLabel={accessibilityLabel}
      accessibilityRole="button"
      accessibilityState={{selected}}
      onPress={onPress}
      style={({pressed}) => [
        styles.pressable,
        {
          opacity: pressed ? actionMotion.pressedOpacity : 1,
          transform: [{scale: pressed ? actionMotion.pressedScale : 1}],
        },
      ]}>
      <GlassPanel
        padding="none"
        style={[
          styles.card,
          selected ? {borderColor: color, shadowColor: color} : undefined,
        ]}>
        <View style={styles.content}>
          <View
            style={[
              styles.iconChip,
              {backgroundColor: selected ? color : `${color}1F`},
            ]}>
            {renderIcon(iconColor)}
          </View>
          <HoystText
            style={[styles.value, {color: selected ? color : theme.text}]}>
            {value}
          </HoystText>
          <HoystText numberOfLines={1} style={[styles.label, {color}]}>
            {label}
          </HoystText>
        </View>
      </GlassPanel>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: 18,
    width: '100%',
  },
  content: {
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 6,
    paddingVertical: 13,
  },
  iconChip: {
    alignItems: 'center',
    borderRadius: 9,
    height: 30,
    justifyContent: 'center',
    marginBottom: 3,
    width: 30,
  },
  label: {
    fontSize: 9,
    fontWeight: '800',
    letterSpacing: 0.4,
    lineHeight: 11,
    textAlign: 'center',
    textTransform: 'uppercase',
  },
  pressable: {
    flex: 1,
    flexBasis: 0,
    minWidth: 0,
    width: '100%',
  },
  value: {
    fontSize: 22,
    fontWeight: '800',
    letterSpacing: 0,
    lineHeight: 26,
    textAlign: 'center',
  },
});
