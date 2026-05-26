import React from 'react';
import {StyleSheet, View, type StyleProp, type ViewStyle} from 'react-native';

import {useHoystTheme} from '../theme/useHoystTheme';
import {radius} from '../tokens/radius';
import {GlassPanel} from './GlassPanel';
import {HoystText} from './HoystText';

type MetricPanelProps = {
  detail?: string;
  framed?: boolean;
  icon?: React.ReactNode;
  label: string;
  style?: StyleProp<ViewStyle>;
  tone?: 'green' | 'orange' | 'purple' | 'red' | 'blue';
  value: string;
};

export function MetricPanel({
  detail,
  framed = true,
  icon,
  label,
  style,
  tone = 'purple',
  value,
}: MetricPanelProps): React.JSX.Element {
  const theme = useHoystTheme();
  const color =
    tone === 'green'
      ? theme.successForeground
      : tone === 'orange'
      ? theme.warningForeground
      : tone === 'red'
      ? theme.dangerForeground
      : tone === 'blue'
      ? theme.accentTertiaryForeground
      : theme.accentForeground;

  const content = (
    <>
      {icon ? (
        <View style={[styles.iconWrap, {backgroundColor: `${color}14`}]}>
          {icon}
        </View>
      ) : null}
      <HoystText style={styles.value}>{value}</HoystText>
      <HoystText style={{color}} variant="bodyStrong">
        {label}
      </HoystText>
      {detail ? (
        <HoystText tone="muted" variant="caption">
          {detail}
        </HoystText>
      ) : null}
    </>
  );

  return framed ? (
    <GlassPanel padding="compact" style={[styles.panel, style]}>
      {content}
    </GlassPanel>
  ) : (
    <View style={[styles.panel, style]}>{content}</View>
  );
}

const styles = StyleSheet.create({
  iconWrap: {
    alignItems: 'center',
    borderRadius: radius.pill,
    height: 54,
    justifyContent: 'center',
    width: 54,
  },
  panel: {
    alignItems: 'center',
    flex: 1,
    minHeight: 132,
  },
  value: {
    fontSize: 42,
    fontWeight: '800',
    lineHeight: 46,
    textAlign: 'center',
  },
});
