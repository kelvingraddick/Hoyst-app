import React from 'react';
import {Modal, ScrollView, StyleSheet, View} from 'react-native';
import {
  DesignSystemProvider,
  DSButton,
  DSText,
  useSystemTheme,
} from '../../../design/system';
import {useSettingsStore} from '../../../store/settings-store';
import {useSessionStore} from '../../../store/session-store';
import {useAcquisitionStore} from '../services/acquisition-store';
import type {AcquisitionSource} from '../../../lib/analytics';

const sources: {source: AcquisitionSource; label: string}[] = [
  {source: 'instagram', label: 'Instagram'},
  {source: 'facebook', label: 'Facebook'},
  {source: 'tiktok', label: 'TikTok'},
  {source: 'threads', label: 'Threads'},
  {source: 'x', label: 'X'},
  {source: 'youtube', label: 'YouTube'},
  {source: 'email', label: 'Email'},
  {source: 'friend', label: 'A friend'},
  {source: 'other', label: 'Somewhere else'},
];
export function AcquisitionQuestion(props: {canShow: boolean}) {
  const appearance = useSettingsStore(state => state.appearance);
  return (
    <DesignSystemProvider scheme={appearance}>
      <AcquisitionQuestionContent {...props} />
    </DesignSystemProvider>
  );
}
function AcquisitionQuestionContent({canShow}: {canShow: boolean}) {
  const theme = useSystemTheme();
  const uid = useSessionStore(state => state.user?.uid);
  const pendingUid = useAcquisitionStore(state => state.pendingUid);
  const hydrated = useAcquisitionStore(state => state.hydrated);
  const answer = useAcquisitionStore(state => state.answer);
  const visible = canShow && hydrated && Boolean(uid) && pendingUid === uid;
  const dismiss = () => {
    if (uid) {
      answer(uid);
    }
  };
  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={dismiss}>
      <View style={styles.backdrop}>
        <View
          accessibilityViewIsModal
          style={[styles.card, {backgroundColor: theme.surface}]}>
          <ScrollView contentContainerStyle={styles.content}>
            <DSText variant="heading" accessibilityRole="header">
              How did you hear about Hoyst?
            </DSText>
            <DSText variant="secondary">
              Optional. Your answer helps us find more people to test the beta.
            </DSText>
            {sources.map(({source, label}) => (
              <DSButton
                key={source}
                label={label}
                variant="outline"
                testID={`beta-source-${source}`}
                onPress={() => {
                  if (uid) {
                    answer(uid, source);
                  }
                }}
              />
            ))}
            <DSButton
              label="Skip"
              variant="quiet"
              testID="beta-source-skip"
              onPress={dismiss}
            />
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}
const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.65)',
    justifyContent: 'center',
    padding: 24,
  },
  card: {borderRadius: 24, maxHeight: '85%', overflow: 'hidden'},
  content: {padding: 24, gap: 12},
});
