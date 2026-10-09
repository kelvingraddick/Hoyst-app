import React, {useState} from 'react';
import {
  Modal,
  Pressable,
  ScrollView,
  Text,
  View,
  StyleSheet,
} from 'react-native';
import {
  emojiGroups,
  emojiAccessibilityLabel,
  palettes,
  resolveAppearance,
  type CommitmentAppearance,
  type PaletteId,
} from '../../shared/commitment-appearance';
import {useHoystTheme} from '../theme/useHoystTheme';
import {HoystText} from './HoystText';
import {CircleCategoryIcon, CircleCategoryPill} from './CircleCategoryIcon';

/** Changes stay inside the sheet until Done; persistence belongs to the parent form. */
export function CommitmentAppearanceControl({
  category,
  title,
  appearance,
  onChange,
  emojiOnly = false,
}: {
  emojiOnly?: boolean;
  category: string;
  title?: string;
  appearance?: CommitmentAppearance;
  onChange: (value: CommitmentAppearance) => void;
}) {
  const theme = useHoystTheme();
  const [open, setOpen] = useState(false);
  const [pending, setPending] = useState<CommitmentAppearance>({});
  const resolved = resolveAppearance(category, pending);
  const action = (label: string, onPress: () => void) => (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={onPress}
      style={styles.action}>
      <HoystText>{label}</HoystText>
    </Pressable>
  );
  return (
    <View>
      <View style={styles.header}>
        {emojiOnly ? <CircleCategoryIcon category={category} appearance={appearance} size={36}/> : <CircleCategoryPill category={category} appearance={appearance} />}
        {action(emojiOnly ? 'Choose emoji' : 'Customize', () => {
          setPending({...appearance});
          setOpen(true);
        })}
      </View>
      <Modal
        animationType="slide"
        visible={open}
        onRequestClose={() => setOpen(false)}
        presentationStyle="pageSheet">
        <View style={[styles.sheet, {backgroundColor: theme.background}]}>
          <View style={styles.header}>
            {action('Cancel', () => setOpen(false))}
            <HoystText variant="title">{emojiOnly ? 'Choose emoji' : 'Appearance'}</HoystText>
            {action('Done', () => {
              onChange(pending);
              setOpen(false);
            })}
          </View>
          <ScrollView contentContainerStyle={styles.content}>
            <View
              style={[
                styles.preview,
                {
                  backgroundColor: theme.isDark
                    ? resolved.darkBackground
                    : resolved.background,
                },
              ]}>
              <CircleCategoryIcon
                category={category}
                appearance={pending}
                size={40}
              />
              <HoystText
                style={{
                  color: theme.isDark
                    ? resolved.darkForeground
                    : resolved.foreground,
                }}>
                {title?.trim() || `${resolved.label} Commitment`}
              </HoystText>
            </View>
            {action('Reset to default', () => setPending(emojiOnly ? {...pending,emoji:undefined} : {}))}
            {!emojiOnly && <>
            <HoystText variant="title">Color</HoystText>
            <View style={styles.grid}>
              {(Object.keys(palettes) as PaletteId[]).map(id => (
                <Pressable
                  key={id}
                  accessibilityRole="button"
                  accessibilityLabel={palettes[id].label}
                  accessibilityState={{selected: resolved.palette === id}}
                  onPress={() => setPending(value => ({...value, palette: id}))}
                  style={[
                    styles.swatch,
                    {
                      backgroundColor: theme.isDark
                        ? palettes[id].accent + '20'
                        : palettes[id].background,
                      borderColor:
                        resolved.palette === id ? theme.text : 'transparent',
                    },
                  ]}>
                  <View
                    style={[styles.dot, {backgroundColor: palettes[id].accent}]}
                  />
                  <HoystText
                    style={{
                      color: theme.isDark
                        ? palettes[id].darkForeground
                        : palettes[id].foreground,
                    }}>
                    {palettes[id].label}
                  </HoystText>
                </Pressable>
              ))}
            </View>
            </>}
            {emojiGroups.map(group => (
              <View key={group.label}>
                <HoystText variant="label">{group.label}</HoystText>
                <View style={styles.grid}>
                  {group.emojis.map(emoji => (
                    <Pressable
                      key={emoji}
                      accessibilityRole="button"
                      accessibilityLabel={emojiAccessibilityLabel(emoji)}
                      accessibilityState={{selected: resolved.emoji === emoji}}
                      onPress={() => setPending(value => ({...value, emoji}))}
                      style={[
                        styles.choice,
                        {
                          borderColor:
                            resolved.emoji === emoji
                              ? theme.text
                              : 'transparent',
                          backgroundColor: theme.surfaceHigh,
                        },
                      ]}>
                      <Text allowFontScaling={false} style={styles.emoji}>
                        {emoji}
                      </Text>
                    </Pressable>
                  ))}
                </View>
              </View>
            ))}
          </ScrollView>
        </View>
      </Modal>
    </View>
  );
}
const styles = StyleSheet.create({
  sheet: {flex: 1, paddingTop: 20},
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 12,
  },
  action: {padding: 14, minHeight: 44},
  content: {padding: 20, gap: 16, paddingBottom: 40},
  preview: {
    borderRadius: 20,
    padding: 20,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  grid: {flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 8},
  choice: {
    width: 48,
    height: 48,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 12,
    borderWidth: 2,
  },
  emoji: {fontSize: 28, lineHeight: 36, includeFontPadding: false},
  swatch: {
    borderRadius: 14,
    padding: 10,
    borderWidth: 2,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  dot: {width: 20, height: 20, borderRadius: 10},
});
