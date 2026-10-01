import React from 'react';
import {Image, Pressable, StyleSheet, View} from 'react-native';
import {ChevronRight} from 'lucide-react-native';
import {
  HomeSectionTitle,
  HomeSurface,
} from '../../home/components/HomeSurfaces';
import {HoystText} from '../../../design/components/HoystText';
import {useHoystTheme} from '../../../design/theme/useHoystTheme';
import {homeTypography} from '../../../design/tokens/home';
import {actionMotion} from '../../../design/tokens/actions';

/** Matches Home's guest starter panel without changing the frozen Home screen. */
export function ProgressGuestStart({
  onGetStarted,
  onSignIn,
}: {
  onGetStarted: () => void;
  onSignIn: () => void;
}) {
  const theme = useHoystTheme();
  return (
    <View style={styles.section}>
      <Image
        accessible={false}
        resizeMode="contain"
        source={require('../../../assets/hoy/progress-rewards-get-started.png')}
        style={styles.artwork}
        testID="progress-guest-get-started-artwork"
      />
      <View style={styles.panelContainer}>
        <HomeSurface style={styles.panel}>
          <View style={styles.copy}>
            <HomeSectionTitle>GET STARTED</HomeSectionTitle>
            <HoystText style={homeTypography.body} tone="muted">
              Create a Circle. Invite your people.
            </HoystText>
          </View>
          <Pressable
            accessibilityLabel="Start your commitment"
            accessibilityRole="button"
            onPress={onGetStarted}
            style={({pressed}) => [
              styles.action,
              {opacity: pressed ? actionMotion.pressedOpacity : 1},
            ]}>
            <View
              style={[
                styles.actionFill,
                {backgroundColor: theme.actionSurface},
              ]}>
              <HoystText
                style={[
                  homeTypography.action,
                  {color: theme.actionForeground},
                ]}>
                Start your commitment
              </HoystText>
              <ChevronRight color={theme.actionForeground} size={18} />
            </View>
          </Pressable>
          <Pressable
            accessibilityLabel="Already a member? Log in"
            accessibilityRole="button"
            hitSlop={8}
            onPress={onSignIn}
            style={({pressed}) => ({
              opacity: pressed ? actionMotion.pressedOpacity : 1,
            })}>
            <View
              style={[
                styles.returningMember,
                {borderColor: theme.borderStrong},
              ]}>
              <HoystText style={[homeTypography.action, {color: theme.text}]}>
                Already a member?{' '}
                <HoystText style={homeTypography.action}>Log in</HoystText>
              </HoystText>
              <ChevronRight color={theme.text} size={16} />
            </View>
          </Pressable>
        </HomeSurface>
      </View>
    </View>
  );
}
const styles = StyleSheet.create({
  section: {gap: 4, marginHorizontal: -22},
  artwork: {height: 190, width: '100%'},
  panelContainer: {paddingHorizontal: 22},
  panel: {gap: 12},
  copy: {gap: 4},
  action: {width: '100%'},
  actionFill: {
    alignItems: 'center',
    borderRadius: 18,
    flexDirection: 'row',
    gap: 4,
    justifyContent: 'center',
    minHeight: 44,
    paddingHorizontal: 18,
  },
  returningMember: {
    alignItems: 'center',
    borderRadius: 18,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 4,
    minHeight: 44,
    justifyContent: 'center',
    paddingHorizontal: 12,
  },
});
