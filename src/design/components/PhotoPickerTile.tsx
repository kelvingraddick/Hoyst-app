import React from 'react';
import {
  Image,
  Pressable,
  StyleSheet,
  View,
} from 'react-native';
import {Camera, X} from 'lucide-react-native';

import {useHoystTheme} from '../theme/useHoystTheme';
import {radius} from '../tokens/radius';
import {HoystText} from './HoystText';

type PhotoPickerTileProps = {
  onAddPhoto: () => void;
  onRemovePhoto: () => void;
  photoUri?: string;
};

export function PhotoPickerTile({
  onAddPhoto,
  onRemovePhoto,
  photoUri,
}: PhotoPickerTileProps): React.JSX.Element {
  const theme = useHoystTheme();

  return (
    <View style={styles.row}>
      <Pressable
        onPress={onAddPhoto}
        style={({pressed}) => [
          styles.addTile,
          {
            backgroundColor: theme.surfaceSoft,
            borderColor: theme.border,
            opacity: pressed ? 0.92 : 1,
          },
        ]}>
        <Camera color={theme.textSubtle} size={22} strokeWidth={2.1} />
        <HoystText tone="muted" variant="tiny">
          Add Photo
        </HoystText>
      </Pressable>
      <View
        style={[
          styles.previewTile,
          {
            backgroundColor: theme.surfaceSoft,
            borderColor: theme.border,
          },
        ]}>
        {photoUri ? (
          <>
            <Image source={{uri: photoUri}} style={styles.previewImage} />
            <Pressable
              onPress={onRemovePhoto}
              style={styles.removeButton}>
              <X color={theme.text} size={14} strokeWidth={2.2} />
            </Pressable>
          </>
        ) : (
          <View style={styles.emptyPreview}>
            <HoystText tone="muted" variant="caption">
              Photo preview
            </HoystText>
          </View>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    gap: 14,
  },
  addTile: {
    alignItems: 'center',
    borderRadius: radius.md,
    borderWidth: 1,
    flex: 1,
    gap: 10,
    justifyContent: 'center',
    minHeight: 118,
  },
  previewTile: {
    borderRadius: radius.md,
    borderWidth: 1,
    flex: 1,
    minHeight: 118,
    overflow: 'hidden',
  },
  previewImage: {
    height: '100%',
    width: '100%',
  },
  removeButton: {
    alignItems: 'center',
    backgroundColor: 'rgba(47, 35, 22, 0.9)',
    borderRadius: 999,
    height: 24,
    justifyContent: 'center',
    position: 'absolute',
    right: 8,
    top: 8,
    width: 24,
  },
  emptyPreview: {
    alignItems: 'center',
    flex: 1,
    justifyContent: 'center',
  },
});
