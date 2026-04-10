import React from 'react';
import {StyleSheet, View} from 'react-native';

import {GlassPanel} from '../../../design/components/GlassPanel';
import {HoystButton} from '../../../design/components/HoystButton';
import {HoystInput} from '../../../design/components/HoystInput';
import {HoystScreen} from '../../../design/components/HoystScreen';
import {HoystText} from '../../../design/components/HoystText';

export function SignInScreen(): React.JSX.Element {
  return (
    <HoystScreen>
      <View style={styles.header}>
        <HoystText variant="largeTitle">Welcome back</HoystText>
        <HoystText tone="muted">
          Email and social auth will plug into this shell once Firebase is
          configured.
        </HoystText>
      </View>
      <GlassPanel>
        <HoystInput placeholder="Email" />
        <HoystInput placeholder="Password" secureTextEntry />
        <HoystButton label="Sign In" />
        <HoystButton label="Continue with Apple" variant="ghost" />
        <HoystButton label="Continue with Google" variant="ghost" />
      </GlassPanel>
    </HoystScreen>
  );
}

const styles = StyleSheet.create({
  header: {
    gap: 10,
    paddingTop: 18,
  },
});
