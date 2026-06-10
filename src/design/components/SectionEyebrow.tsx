import React from 'react';
import {StyleSheet, type StyleProp, type TextStyle} from 'react-native';

import {HoystText} from './HoystText';

type SectionEyebrowProps = {
  children: React.ReactNode;
  style?: StyleProp<TextStyle>;
};

/**
 * Small uppercase muted label used as a lightweight section header
 * (e.g. "Recent activity and streak", "Needs your attention").
 */
export function SectionEyebrow({
  children,
  style,
}: SectionEyebrowProps): React.JSX.Element {
  return (
    <HoystText style={[styles.label, style]} tone="muted" variant="label">
      {children}
    </HoystText>
  );
}

const styles = StyleSheet.create({
  label: {
    fontSize: 12,
    letterSpacing: 0.4,
  },
});
