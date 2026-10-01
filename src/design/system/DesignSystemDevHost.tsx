import React, {useEffect, useState} from 'react';
import {DevSettings, Linking, Modal, View} from 'react-native';
import {
  initialWindowMetrics,
  SafeAreaProvider,
} from 'react-native-safe-area-context';
import type {ProgressPreviewMode} from '../../features/progress/components/ProgressPreview';
import {DesignSystemGallery} from './DesignSystemGallery';

/** Debug-only visual fixtures. Hidden host renders nothing. */
export function DesignSystemDevHost() {
  const [profileMode, setProfileMode] = useState<string>();
  const [progressMode, setProgressMode] = useState<ProgressPreviewMode>();
  const [visible, setVisible] = useState(false);
  const [tapInVisible, setTapInVisible] = useState(false);
  const [pickerVisible, setPickerVisible] = useState(false);
  useEffect(() => {
    if (!__DEV__) {
      return;
    }
    let mounted = true;
    // React Native replaces handlers by title, including after Fast Refresh.
    DevSettings.addMenuItem('Hoyst Design System', () => {
      if (mounted) {
        setVisible(true);
      }
    });
    DevSettings.addMenuItem('Tap In previews', () => {
      if (mounted) {
        setTapInVisible(true);
      }
    });
    DevSettings.addMenuItem('Tap In selector previews', () => {
      if (mounted) {
        setPickerVisible(true);
      }
    });
    (
      [
        'home-light',
        'home-dark',
        'home-light-bottom',
        'home-dark-bottom',
        'home-light-narrow',
        'home-dark-narrow',
        'level-one',
        'level-four',
        'light-stats',
        'light-stats-details',
        'dark-stats-details',
        'dark-stats',
        'light-stats-narrow',
        'dark-stats-narrow',
        'light',
        'dark',
        'guest',
        'loading',
        'error',
        'zero',
      ] as ProgressPreviewMode[]
    ).forEach(mode => {
      DevSettings.addMenuItem(`Progress preview: ${mode}`, () => {
        if (mounted) setProgressMode(mode);
      });
    });
    DevSettings.addMenuItem('Close Progress preview', () => {
      if (mounted) setProgressMode(undefined);
    });
    const openPreview = (url: string | null) => {
      if (url === 'hoyst://profile-preview/close') {
        if (mounted) setProfileMode(undefined);
        return;
      }
      const profileMatch = url?.match(/^hoyst:\/\/profile-preview\/([a-z-]+)$/);
      if (mounted && profileMatch) {
        setProgressMode(undefined);
        setProfileMode(profileMatch[1]);
        return;
      }
      if (url === 'hoyst://progress-preview/close') {
        if (mounted) setProgressMode(undefined);
        return;
      }
      const match = url?.match(
        /^hoyst:\/\/progress-preview\/((?:light|dark)(?:-bottom|-middle|-narrow|-narrow-middle|-stats|-stats-narrow|-stats-details)?|guest|loading|error|zero|zero-bottom|home-(?:light|dark)(?:-bottom|-narrow)?|level-one|level-four)$/,
      );
      if (mounted && match) setProgressMode(match[1] as ProgressPreviewMode);
    };
    Linking.getInitialURL()
      .then(openPreview)
      .catch(() => undefined);
    const previewLinks = Linking.addEventListener('url', event =>
      openPreview(event.url),
    );
    return () => {
      mounted = false;
      previewLinks.remove();
    };
  }, []);
  if (
    !__DEV__ ||
    (!visible &&
      !tapInVisible &&
      !pickerVisible &&
      !progressMode &&
      !profileMode)
  ) {
    return null;
  }
  if (profileMode) {
    const {GestureHandlerRootView} = require('react-native-gesture-handler');
    const {
      ProfilePreview,
    } = require('../../features/profile/components/ProfilePreview');
    return (
      <View
        accessibilityViewIsModal
        style={{position: 'absolute', top: 0, right: 0, bottom: 0, left: 0}}>
        <GestureHandlerRootView style={{flex: 1}}>
          <SafeAreaProvider initialMetrics={initialWindowMetrics}>
            <ProfilePreview key={profileMode} mode={profileMode} />
          </SafeAreaProvider>
        </GestureHandlerRootView>
      </View>
    );
  }
  if (progressMode) {
    const {GestureHandlerRootView} = require('react-native-gesture-handler');
    const {
      ProgressPreview,
    } = require('../../features/progress/components/ProgressPreview');
    return (
      <View
        accessibilityViewIsModal
        style={{position: 'absolute', top: 0, right: 0, bottom: 0, left: 0}}>
        <GestureHandlerRootView style={{flex: 1}}>
          <SafeAreaProvider initialMetrics={initialWindowMetrics}>
            <ProgressPreview
              key={progressMode}
              mode={progressMode}
              onClose={() => setProgressMode(undefined)}
            />
          </SafeAreaProvider>
        </GestureHandlerRootView>
      </View>
    );
  }
  if (tapInVisible || pickerVisible) {
    const {GestureHandlerRootView} = require('react-native-gesture-handler');
    const {
      TapInComposerPreview,
    } = require('../../features/check-in/components/TapInComposerPreview');
    const {
      TapInPickerPreview,
    } = require('../../features/check-in/components/TapInPickerPreview');
    return (
      <View
        accessibilityViewIsModal
        style={{position: 'absolute', top: 0, right: 0, bottom: 0, left: 0}}>
        <GestureHandlerRootView style={{flex: 1}}>
          <SafeAreaProvider initialMetrics={initialWindowMetrics}>
            {pickerVisible ? (
              <TapInPickerPreview onClose={() => setPickerVisible(false)} />
            ) : (
              <TapInComposerPreview onClose={() => setTapInVisible(false)} />
            )}
          </SafeAreaProvider>
        </GestureHandlerRootView>
      </View>
    );
  }
  return (
    <Modal
      visible
      presentationStyle="fullScreen"
      animationType="none"
      onRequestClose={() => setVisible(false)}>
      <SafeAreaProvider initialMetrics={initialWindowMetrics}>
        <DesignSystemGallery onClose={() => setVisible(false)} />
      </SafeAreaProvider>
    </Modal>
  );
}
