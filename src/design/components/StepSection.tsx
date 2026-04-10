import React from 'react';
import type {PropsWithChildren} from 'react';
import {StyleSheet, View} from 'react-native';

import {HoystText} from './HoystText';

type StepSectionProps = PropsWithChildren<{
  description: string;
  title: string;
}>;

export function StepSection({
  children,
  description,
  title,
}: StepSectionProps): React.JSX.Element {
  return (
    <View style={styles.section}>
      <View style={styles.copy}>
        <HoystText variant="title">{title}</HoystText>
        <HoystText tone="muted">{description}</HoystText>
      </View>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  section: {
    gap: 14,
  },
  copy: {
    gap: 6,
  },
});
