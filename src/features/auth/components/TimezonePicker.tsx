import React, {useMemo, useState} from 'react';
import {
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  View,
} from 'react-native';
import {Check, ChevronRight, Globe2} from 'lucide-react-native';

import {HoystButton} from '../../../design/components/HoystButton';
import {HoystInput} from '../../../design/components/HoystInput';
import {HoystText} from '../../../design/components/HoystText';
import {useHoystTheme} from '../../../design/theme/useHoystTheme';
import {
  filterTimezonePickerOptions,
  getLocalTimezone,
  getTimezonePickerOptions,
  type TimezonePickerOption,
} from '../services/timezone-options';

type TimezonePickerProps = {
  helperText?: string;
  label?: string;
  modalTitle?: string;
  onChange: (timezone: string) => void;
  value: string;
};

function TimezoneOptionCard({
  isSelected,
  onPress,
  option,
}: {
  isSelected: boolean;
  onPress: () => void;
  option: TimezonePickerOption;
}) {
  const theme = useHoystTheme();
  const accentColor = option.isDetected
    ? theme.successForeground
    : theme.accentTertiaryForeground;

  return (
    <Pressable
      accessibilityRole="radio"
      accessibilityState={{selected: isSelected}}
      onPress={onPress}
      style={({pressed}) => [
        styles.optionPressable,
        {opacity: pressed ? 0.9 : 1, transform: [{scale: pressed ? 0.985 : 1}]},
      ]}>
      <View
        style={[
          styles.optionCard,
          {
            backgroundColor: isSelected ? `${accentColor}20` : theme.surface,
            borderColor: isSelected ? accentColor : theme.border,
          },
        ]}>
        <View
          style={[
            styles.optionIcon,
            {
              backgroundColor: isSelected
                ? `${accentColor}24`
                : theme.surfaceSoft,
              borderColor: isSelected ? accentColor : theme.border,
            },
          ]}>
          <Globe2 color={accentColor} size={20} strokeWidth={2.3} />
        </View>
        <View style={styles.optionCopy}>
          <HoystText
            numberOfLines={1}
            style={styles.optionTitle}
            variant="bodyStrong">
            {option.label}
          </HoystText>
          <HoystText
            numberOfLines={2}
            style={styles.optionDescription}
            tone="muted">
            {option.description}
          </HoystText>
        </View>
        <View
          style={[
            styles.optionCheck,
            {
              backgroundColor: isSelected ? accentColor : undefined,
              borderColor: isSelected ? accentColor : theme.borderStrong,
            },
          ]}>
          {isSelected ? (
            <Check color={theme.onBrightAccent} size={16} strokeWidth={3} />
          ) : null}
        </View>
      </View>
    </Pressable>
  );
}

export function TimezonePicker({
  helperText,
  label = 'Timezone',
  modalTitle = 'Timezone',
  onChange,
  value,
}: TimezonePickerProps): React.JSX.Element {
  const theme = useHoystTheme();
  const [isOpen, setIsOpen] = useState(false);
  const [search, setSearch] = useState('');
  const localTimezone = getLocalTimezone();
  const options = useMemo(
    () =>
      getTimezonePickerOptions({
        currentTimezone: value,
        localTimezone,
      }),
    [localTimezone, value],
  );
  const selectedOption = options.find(option => option.id === value);
  const visibleOptions = useMemo(
    () => filterTimezonePickerOptions(options, search),
    [options, search],
  );

  const closePicker = () => {
    setIsOpen(false);
    setSearch('');
  };

  const selectTimezone = (timezone: string) => {
    onChange(timezone);
    closePicker();
  };

  return (
    <View style={styles.fieldBlock}>
      <HoystText tone="muted" variant="label">
        {label}
      </HoystText>
      <Pressable
        accessibilityRole="button"
        onPress={() => setIsOpen(true)}
        style={({pressed}) => [
          styles.timezoneDropdown,
          {
            backgroundColor: theme.surface,
            borderColor: theme.border,
            opacity: pressed ? 0.92 : 1,
          },
        ]}>
        <View style={styles.timezoneRow}>
          <View
            style={[
              styles.timezoneIcon,
              {
                backgroundColor: theme.surfaceSoft,
                borderColor: theme.border,
              },
            ]}>
            <Globe2
              color={theme.accentSecondaryForeground}
              size={20}
              strokeWidth={2.3}
            />
          </View>
          <View style={styles.timezoneCopy}>
            <HoystText numberOfLines={1} variant="bodyStrong">
              {selectedOption?.label ?? 'Select timezone'}
            </HoystText>
            <HoystText numberOfLines={1} tone="muted">
              {selectedOption?.description ?? value}
            </HoystText>
          </View>
          <ChevronRight
            color={theme.textSubtle}
            size={20}
            strokeWidth={2.3}
            style={styles.timezoneArrow}
          />
        </View>
      </Pressable>
      {helperText ? (
        <HoystText tone="muted" variant="caption">
          {helperText}
        </HoystText>
      ) : null}
      <Modal
        animationType="fade"
        onRequestClose={closePicker}
        transparent
        visible={isOpen}>
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          style={styles.modalKeyboard}>
          <View style={styles.modalOverlay}>
            <View
              style={[
                styles.timezoneModalPanel,
                {
                  backgroundColor: theme.backgroundElevated,
                  borderColor: theme.borderStrong,
                },
              ]}>
              <View style={styles.modalHeader}>
                <View
                  style={[
                    styles.modalHeaderIcon,
                    {
                      backgroundColor: theme.surfaceSoft,
                      borderColor: theme.border,
                    },
                  ]}>
                  <Globe2
                    color={theme.accentSecondaryForeground}
                    size={19}
                    strokeWidth={2.3}
                  />
                </View>
                <View style={styles.modalHeaderCopy}>
                  <HoystText variant="title">{modalTitle}</HoystText>
                  <HoystText tone="muted" variant="caption">
                    Search by region, city, UTC offset, or timezone ID.
                  </HoystText>
                </View>
              </View>
              <HoystInput
                autoCapitalize="none"
                autoCorrect={false}
                onChangeText={setSearch}
                placeholder="Search timezones"
                value={search}
              />
              <ScrollView
                contentContainerStyle={styles.timezoneModalListContent}
                keyboardShouldPersistTaps="handled"
                style={styles.timezoneModalList}>
                {visibleOptions.length > 0 ? (
                  visibleOptions.map(option => (
                    <TimezoneOptionCard
                      isSelected={value === option.id}
                      key={option.id}
                      onPress={() => selectTimezone(option.id)}
                      option={option}
                    />
                  ))
                ) : (
                  <View
                    style={[
                      styles.timezoneEmptyState,
                      {
                        backgroundColor: theme.surfaceSoft,
                        borderColor: theme.border,
                      },
                    ]}>
                    <HoystText variant="bodyStrong">
                      No timezone found
                    </HoystText>
                    <HoystText tone="muted">
                      Try searching by a city, region, offset, or ID.
                    </HoystText>
                  </View>
                )}
              </ScrollView>
              <HoystButton
                label="Cancel"
                onPress={closePicker}
                variant="outline"
              />
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  fieldBlock: {
    gap: 8,
  },
  timezoneDropdown: {
    borderRadius: 18,
    borderWidth: 1,
    minHeight: 72,
    paddingHorizontal: 13,
    paddingVertical: 11,
    width: '100%',
  },
  timezoneRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 10,
    minWidth: 0,
    width: '100%',
  },
  timezoneIcon: {
    alignItems: 'center',
    borderRadius: 16,
    borderWidth: 1,
    flexShrink: 0,
    height: 42,
    justifyContent: 'center',
    width: 42,
  },
  timezoneCopy: {
    flexBasis: 0,
    flex: 1,
    flexShrink: 1,
    gap: 3,
    minWidth: 0,
  },
  timezoneArrow: {
    flexShrink: 0,
  },
  modalKeyboard: {
    flex: 1,
  },
  modalOverlay: {
    alignItems: 'stretch',
    backgroundColor: 'rgba(0,0,0,0.52)',
    flex: 1,
    justifyContent: 'center',
    padding: 18,
  },
  timezoneModalPanel: {
    alignSelf: 'stretch',
    borderRadius: 24,
    borderWidth: 1,
    gap: 14,
    maxHeight: '86%',
    padding: 16,
  },
  modalHeader: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 10,
  },
  modalHeaderIcon: {
    alignItems: 'center',
    borderRadius: 15,
    borderWidth: 1,
    height: 38,
    justifyContent: 'center',
    width: 38,
  },
  modalHeaderCopy: {
    flex: 1,
    gap: 3,
    minWidth: 0,
  },
  timezoneModalList: {
    flexGrow: 0,
  },
  timezoneModalListContent: {
    gap: 8,
    paddingBottom: 2,
  },
  timezoneEmptyState: {
    borderRadius: 18,
    borderWidth: 1,
    gap: 4,
    padding: 14,
  },
  optionPressable: {
    width: '100%',
  },
  optionCard: {
    alignItems: 'center',
    borderRadius: 18,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 10,
    minHeight: 78,
    paddingHorizontal: 13,
    paddingVertical: 11,
  },
  optionIcon: {
    alignItems: 'center',
    borderRadius: 16,
    borderWidth: 1,
    flexShrink: 0,
    height: 42,
    justifyContent: 'center',
    width: 42,
  },
  optionCopy: {
    flexBasis: 0,
    flex: 1,
    gap: 3,
    justifyContent: 'center',
    minWidth: 0,
  },
  optionTitle: {
    lineHeight: 20,
  },
  optionDescription: {
    lineHeight: 19,
  },
  optionCheck: {
    alignItems: 'center',
    borderRadius: 12,
    borderWidth: 1,
    flexShrink: 0,
    height: 24,
    justifyContent: 'center',
    width: 24,
  },
});
