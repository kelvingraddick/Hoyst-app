import React, {useEffect, useState} from 'react';
import {DevSettings, Modal, View} from 'react-native';
import {
  initialWindowMetrics,
  SafeAreaProvider,
} from 'react-native-safe-area-context';
import {DesignSystemGallery} from './DesignSystemGallery';

/** No routes, stores, subscriptions or network clients. Hidden host renders nothing. */
export function DesignSystemDevHost() {
  const [visible, setVisible] = useState(false);
  const [tapInVisible, setTapInVisible] = useState(false);
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
    return () => {
      mounted = false;
    };
  }, []);
  if (!__DEV__ || (!visible && !tapInVisible)) {
    return null;
  }
  if (tapInVisible) {
    const {GestureHandlerRootView} = require('react-native-gesture-handler');
    const {
      TapInComposerPreview,
    } = require('../../features/check-in/components/TapInComposerPreview');
    return (
      <View
        accessibilityViewIsModal
        style={{position: 'absolute', top: 0, right: 0, bottom: 0, left: 0}}>
        <GestureHandlerRootView style={{flex: 1}}>
          <SafeAreaProvider initialMetrics={initialWindowMetrics}>
            <TapInComposerPreview onClose={() => setTapInVisible(false)} />
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
