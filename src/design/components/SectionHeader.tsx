import React from 'react';
import {
  StyleSheet,
  type StyleProp,
  type TextProps,
  type ViewStyle,
  View,
} from 'react-native';

import {HoystText} from './HoystText';

type SectionHeaderProps = {
  description?: React.ReactNode;
  descriptionProps?: TextProps;
  style?: StyleProp<ViewStyle>;
  title: React.ReactNode;
  trailing?: React.ReactNode;
};

export function SectionHeader({
  description,
  descriptionProps,
  style,
  title,
  trailing,
}: SectionHeaderProps): React.JSX.Element {
  return (
    <View style={[styles.container, style]}>
      <View style={styles.copy}>
        <HoystText variant="subtitle">{title}</HoystText>
        {description ? (
          <HoystText
            {...descriptionProps}
            style={[styles.description, descriptionProps?.style]}
            tone="muted">
            {description}
          </HoystText>
        ) : null}
      </View>
      {trailing ? <View style={styles.trailing}>{trailing}</View> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'flex-start',
    flexDirection: 'row',
    gap: 12,
    justifyContent: 'space-between',
  },
  copy: {
    flex: 1,
    gap: 4,
    minWidth: 0,
  },
  description: {
    fontSize: 15,
    fontWeight: '600',
    letterSpacing: 0,
    lineHeight: 20,
  },
  trailing: {
    flexShrink: 0,
  },
});
