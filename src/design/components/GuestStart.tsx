import React from 'react';
import {
  Image,
  Pressable,
  StyleSheet,
  View,
  type ImageSourcePropType,
} from 'react-native';
import {ChevronRight} from 'lucide-react-native';
import {
  HomeSectionTitle,
  HomeSurface,
} from '../../features/home/components/HomeSurfaces';
import {HoystText} from './HoystText';
import {useHoystTheme} from '../theme/useHoystTheme';
import {homeTypography} from '../tokens/home';
import {actionMotion} from '../tokens/actions';

type GuestStartProps = {
  artwork: ImageSourcePropType;
  description: string;
  primaryLabel: string;
  onGetStarted: () => void;
  onSignIn: () => void;
  artworkTestID?: string;
  primaryTestID?: string;
  signInTestID?: string;
  compact?: boolean;
};

/** Shared illustrated starter layout, matching Home's guest panel. */
export function GuestStart({
  artwork,
  description,
  primaryLabel,
  artworkTestID,
  primaryTestID,
  signInTestID,
  compact = false,
  onGetStarted,
  onSignIn,
}: GuestStartProps) {
  const theme = useHoystTheme();
  return (
    <View style={styles.section}>
      {!compact ? (
        <Image
          accessible={false}
          resizeMode="contain"
          source={artwork}
          style={styles.artwork}
          testID={artworkTestID}
        />
      ) : null}
      <View style={styles.panelContainer}>
        <HomeSurface style={styles.panel}>
          <View style={styles.copy}>
            <HomeSectionTitle>GET STARTED</HomeSectionTitle>
            <HoystText style={homeTypography.body} tone="muted">
              {description}
            </HoystText>
          </View>
          <Pressable
            accessibilityLabel={primaryLabel}
            accessibilityRole="button"
            onPress={onGetStarted}
            testID={primaryTestID}
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
                  compact && styles.compactActionLabel,
                ]}>
                {primaryLabel}
              </HoystText>
              <ChevronRight color={theme.actionForeground} size={18} />
            </View>
          </Pressable>
          <Pressable
            accessibilityLabel="Already a member? Log in"
            accessibilityRole="button"
            hitSlop={8}
            onPress={onSignIn}
            testID={signInTestID}
            style={({pressed}) => ({
              opacity: pressed ? actionMotion.pressedOpacity : 1,
            })}>
            <View
              style={[
                styles.returningMember,
                {borderColor: theme.borderStrong},
              ]}>
              <HoystText
                style={[
                  homeTypography.action,
                  {color: theme.text},
                  compact && styles.compactActionLabel,
                ]}>
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
  compactActionLabel: {flexShrink: 1},
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
