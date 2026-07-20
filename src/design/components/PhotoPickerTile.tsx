import React from 'react';
import {Image, Pressable, StyleSheet, View} from 'react-native';
import {ImagePlus, X} from 'lucide-react-native';

import {useHoystTheme} from '../theme/useHoystTheme';
import {radius} from '../tokens/radius';
import {HoystText} from './HoystText';
import {TapInActionButton} from './TapInActionButton';

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
    <View style={styles.stack}>
      {photoUri ? (
        <View
          style={[
            styles.previewTile,
            {
              backgroundColor: theme.surfaceSoft,
              borderColor: theme.border,
            },
          ]}
          testID="photo-picker-preview">
          <Image source={{uri: photoUri}} style={styles.previewImage} />
          <Pressable
            accessibilityLabel="Remove selected photo"
            accessibilityRole="button"
            hitSlop={8}
            onPress={onRemovePhoto}
            style={styles.removeButton}
            testID="photo-picker-remove">
            <X color="#FFFFFF" size={14} strokeWidth={2.4} />
          </Pressable>
        </View>
      ) : null}
      <TapInActionButton
        icon={
          <ImagePlus
            color={theme.textSubtle}
            size={19}
            strokeWidth={2.2}
          />
        }
        label={photoUri ? 'Change Photo' : 'Add Photo'}
        onPress={onAddPhoto}
        testID={photoUri ? 'photo-picker-change' : 'photo-picker-add'}
        variant="surface"
      />
      {!photoUri ? (
        <HoystText style={styles.helperText} tone="muted" variant="caption">
          Optional proof for your Circle
        </HoystText>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  helperText: {
    textAlign: 'center',
  },
  previewTile: {
    borderRadius: radius.md,
    borderWidth: 1,
    flex: 1,
    minHeight: 112,
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
  stack: {
    alignSelf: 'stretch',
    gap: 7,
  },
});
