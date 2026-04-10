import React, {useState} from 'react';
import {Pressable, StyleSheet, View} from 'react-native';
import {Check, X} from 'lucide-react-native';
import {launchImageLibrary} from 'react-native-image-picker';
import type {NativeStackScreenProps} from '@react-navigation/native-stack';

import {GlassPanel} from '../../../design/components/GlassPanel';
import {HoystButton} from '../../../design/components/HoystButton';
import {HoystInput} from '../../../design/components/HoystInput';
import {HoystScreen} from '../../../design/components/HoystScreen';
import {HoystText} from '../../../design/components/HoystText';
import {PhotoPickerTile} from '../../../design/components/PhotoPickerTile';
import {useHoystTheme} from '../../../design/theme/useHoystTheme';
import {getCircleDetail, initialCheckInDraft} from '../../circles/mockData';
import type {CheckInDraft} from '../../../types/models';
import type {RootStackParamList} from '../../../navigation/types';

type Props = NativeStackScreenProps<RootStackParamList, 'CheckInModal'>;

export function CheckInModalScreen({
  navigation,
  route,
}: Props): React.JSX.Element {
  const theme = useHoystTheme();
  const [draft, setDraft] = useState<CheckInDraft>(initialCheckInDraft);
  const detail = getCircleDetail(route.params.circleId);

  const resetAndClose = () => {
    setDraft(initialCheckInDraft);
    navigation.goBack();
  };

  const handlePickPhoto = async () => {
    const response = await launchImageLibrary({
      mediaType: 'photo',
      quality: 0.8,
      selectionLimit: 1,
    });

    const uri = response.assets?.[0]?.uri;
    if (uri) {
      setDraft(current => ({...current, photoUri: uri}));
    }
  };

  return (
    <HoystScreen contentContainerStyle={styles.content}>
      <View style={styles.closeRow}>
        <Pressable
          onPress={resetAndClose}
          style={({pressed}) => [
            styles.closeButton,
            {
              backgroundColor: theme.surfaceSoft,
              borderColor: theme.border,
              opacity: pressed ? 0.92 : 1,
            },
          ]}>
          <X color={theme.text} size={18} strokeWidth={2.4} />
        </Pressable>
      </View>

      <GlassPanel style={styles.panel}>
        <View style={styles.iconWrap}>
          <View style={[styles.iconCircle, styles.iconCircleSuccess]}>
            <Check color={theme.success} size={32} strokeWidth={2.8} />
          </View>
        </View>

        <View style={styles.titleBlock}>
          <HoystText style={styles.centerText} variant="display">
            Check-in Complete
          </HoystText>
          <HoystText style={[styles.centerText, {color: theme.success}]} variant="bodyStrong">
            Logged: {detail.dailyGoal.replace('Daily goal: ', '')}
          </HoystText>
        </View>

        <View style={styles.fieldBlock}>
          <HoystText tone="muted" variant="label">
            Add a Note
          </HoystText>
          <HoystInput
            multiline
            numberOfLines={5}
            onChangeText={value => setDraft(current => ({...current, note: value}))}
            placeholder="Add context, effort, mood, or any proof you want your circle to see."
            style={styles.noteInput}
            textAlignVertical="top"
            value={draft.note}
          />
          <Pressable
            onPress={() =>
              setDraft(current => ({
                ...current,
                note:
                  current.note.length > 0
                    ? ''
                    : 'Finished strong and pushed through the last set.',
              }))
            }>
            <HoystText style={{color: theme.accentSecondary}} variant="caption">
              {draft.note ? 'Clear sample note' : 'Insert sample note'}
            </HoystText>
          </Pressable>
        </View>

        <PhotoPickerTile
          onAddPhoto={handlePickPhoto}
          onRemovePhoto={() => setDraft(current => ({...current, photoUri: undefined}))}
          photoUri={draft.photoUri}
        />

        <HoystButton
          label="Confirm Check-in"
          onPress={resetAndClose}
          variant="secondary"
        />
        <Pressable onPress={resetAndClose}>
          <HoystText style={styles.centerText} tone="muted" variant="bodyStrong">
            Discard
          </HoystText>
        </Pressable>
      </GlassPanel>
    </HoystScreen>
  );
}

const styles = StyleSheet.create({
  content: {
    justifyContent: 'center',
    minHeight: '100%',
    paddingBottom: 32,
    paddingTop: 18,
  },
  closeRow: {
    alignItems: 'flex-end',
  },
  closeButton: {
    alignItems: 'center',
    borderRadius: 16,
    borderWidth: 1,
    height: 34,
    justifyContent: 'center',
    width: 34,
  },
  panel: {
    borderRadius: 36,
  },
  iconWrap: {
    alignItems: 'center',
  },
  iconCircle: {
    alignItems: 'center',
    borderRadius: 999,
    height: 84,
    justifyContent: 'center',
    width: 84,
  },
  iconCircleSuccess: {
    backgroundColor: 'rgba(68,216,92,0.12)',
  },
  titleBlock: {
    gap: 10,
  },
  centerText: {
    textAlign: 'center',
  },
  fieldBlock: {
    gap: 10,
  },
  noteField: {
    minHeight: 124,
  },
  noteInput: {
    minHeight: 136,
    paddingTop: 16,
  },
});
