import React from 'react';
import {StyleSheet, useWindowDimensions} from 'react-native';
import {HoystText} from '../../../design/components/HoystText';
import {typography} from '../../../design/tokens/typography';

// Keep scaled text and its measured line box in sync when the OS text size
// changes while the wizard is open. Legacy Home typography stays untouched.
export function SetupText(props: React.ComponentProps<typeof HoystText>) {
  const {fontScale} = useWindowDimensions();
  const base = typography[props.variant ?? 'body'];
  const style = StyleSheet.flatten(props.style);
  return (
    <HoystText
      {...props}
      allowFontScaling={false}
      style={[
        props.style,
        {
          fontSize: (style?.fontSize ?? base.fontSize) * fontScale,
          lineHeight: (style?.lineHeight ?? base.lineHeight) * fontScale,
          flexShrink: 0,
        },
      ]}
    />
  );
}
