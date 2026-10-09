import React from 'react';
import {StyleSheet, type ViewStyle} from 'react-native';
import {homeTypography} from '../tokens/home';
import {HoystText} from './HoystText';

export const hoyMessageSurface: ViewStyle = {
  flexShrink: 1,
  borderRadius: 18,
  padding: 16,
  minHeight: 80,
  justifyContent: 'center',
  shadowOffset: {width: 0, height: 6},
  shadowOpacity: 0.1,
  shadowRadius: 12,
  elevation: 3,
};

export function getHoyMessageSurfaceColors(isDark: boolean) {
  return {
    backgroundColor: isDark ? '#252527' : '#FFFFFF',
    shadowColor: isDark ? '#000000' : '#92723E',
  };
}

export function getHoyMessageParts(text: string, emphasis: readonly string[]) {
  const spans = emphasis
    .filter(Boolean)
    .flatMap(value => {
      const start = text.indexOf(value);
      return start < 0 ? [] : [{start, end: start + value.length}];
    })
    .sort((a, b) => a.start - b.start);
  const result: {text: string; bold: boolean}[] = [];
  let cursor = 0;
  for (const span of spans) {
    if (span.start < cursor) {
      continue;
    }
    if (span.start > cursor) {
      result.push({text: text.slice(cursor, span.start), bold: false});
    }
    result.push({text: text.slice(span.start, span.end), bold: true});
    cursor = span.end;
  }
  if (cursor < text.length) {
    result.push({text: text.slice(cursor), bold: false});
  }
  return result;
}

export function HoyMessageText({
  message,
  emphasis = [],
}: {
  message: string;
  emphasis?: readonly string[];
}) {
  return (
    <HoystText style={styles.message}>
      {getHoyMessageParts(message, emphasis).map((part, index) => (
        <HoystText
          key={index}
          style={[styles.message, part.bold && styles.bold]}>
          {part.text}
        </HoystText>
      ))}
    </HoystText>
  );
}

const styles = StyleSheet.create({
  message: homeTypography.message,
  bold: {fontWeight: '700'},
});
