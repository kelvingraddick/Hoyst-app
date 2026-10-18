import React, {type ReactNode} from 'react';
import {Pressable, StyleSheet, View} from 'react-native';
import {Check} from 'lucide-react-native';
import {HoystText} from '../../design/components/HoystText';
import {useHoystTheme} from '../../design/theme/useHoystTheme';
import {openLegalPage} from './policy';

export function LegalAcknowledgment({
  checked,
  onChange,
  disabled = false,
  compact = false,
  action,
}: {
  checked: boolean;
  onChange: (checked: boolean) => void;
  disabled?: boolean;
  compact?: boolean;
  action?: ReactNode;
}) {
  const theme = useHoystTheme();
  return (
    <View style={styles.stack}>
      <Pressable
        testID="legal-acknowledgment"
        accessibilityRole="checkbox"
        accessibilityLabel="I’m 18 or older and agree to the Terms"
        accessibilityState={{checked, disabled}}
        disabled={disabled}
        onPress={() => onChange(!checked)}
        style={[styles.row, compact && styles.compactRow]}>
        <View
          style={[
            styles.box,
            compact && styles.compactBox,
            {
              borderColor: theme.text,
              backgroundColor: checked ? theme.text : 'transparent',
            },
          ]}>
          {checked ? (
            <Check size={compact ? 14 : 18} color={theme.background} />
          ) : null}
        </View>
        <HoystText style={[styles.label, compact && styles.compactLabel]}>
          I’m 18 or older and agree to the Terms
        </HoystText>
      </Pressable>
      <View style={[styles.links, compact && styles.compactLinks]}>
        <Pressable
          accessibilityRole="link"
          onPress={() => void openLegalPage('terms')}
          style={styles.link}
          testID="legal-terms">
          <HoystText
            style={[styles.linkText, compact && styles.compactLinkText]}>
            Terms of Service
          </HoystText>
        </Pressable>
        <Pressable
          accessibilityRole="link"
          onPress={() => void openLegalPage('privacy')}
          style={styles.link}
          testID="legal-privacy">
          <HoystText
            style={[styles.linkText, compact && styles.compactLinkText]}>
            Privacy Policy
          </HoystText>
        </Pressable>
        {action}
      </View>
    </View>
  );
}
const styles = StyleSheet.create({
  stack: {gap: 4},
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    minHeight: 48,
    paddingVertical: 8,
  },
  box: {
    width: 24,
    height: 24,
    borderWidth: 1.5,
    borderRadius: 5,
    alignItems: 'center',
    justifyContent: 'center',
  },
  label: {flex: 1, flexShrink: 1},
  links: {flexDirection: 'row', flexWrap: 'wrap', columnGap: 20},
  link: {minHeight: 44, justifyContent: 'center'},
  linkText: {textDecorationLine: 'underline'},
  compactRow: {gap: 8, minHeight: 44, paddingVertical: 4},
  compactBox: {width: 18, height: 18, borderRadius: 4},
  compactLabel: {fontSize: 14, lineHeight: 20},
  compactLinks: {columnGap: 12, alignItems: 'center'},
  compactLinkText: {fontSize: 12, lineHeight: 18},
});
