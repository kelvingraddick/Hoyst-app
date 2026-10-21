import {Alert, Linking} from 'react-native';
import {getInstalledAppInfo} from '../../settings/services/app-info';
import {trackEvent} from '../../../lib/analytics';

export type FeedbackIntent = 'support' | 'feature';
export const supportEmail = 'development@wavelinkllc.com';
export const instagramUrl = 'https://www.instagram.com/kg.codes/';
export function feedbackEmailUrl(intent: FeedbackIntent) {
  const {version, build} = getInstalledAppInfo();
  const subject = `Hoyst ${
    intent === 'support' ? 'support' : 'feature request'
  } | ${version ?? 'unknown'} (${build ?? 'unknown'})`;
  const body =
    intent === 'support'
      ? 'What happened?\n\nWhat did you expect?\n\nSteps to reproduce:\n\nPlease attach a screenshot if it helps. Avoid sharing passwords or private information.'
      : 'What would you like to do?\n\nHow would this help you?\n';
  return `mailto:${supportEmail}?subject=${encodeURIComponent(
    subject,
  )}&body=${encodeURIComponent(body)}`;
}
export async function openFeedbackContact(
  intent: FeedbackIntent,
  channel: 'instagram' | 'email',
) {
  try {
    await Linking.openURL(
      channel === 'email' ? feedbackEmailUrl(intent) : instagramUrl,
    );
    trackEvent('feedback_contact_opened', {intent, channel});
  } catch {
    Alert.alert(
      'Contact Hoyst',
      `Email ${supportEmail} or message @kg.codes on Instagram.`,
      [
        {
          text: 'Copy email address',
          onPress: () => {
            try {
              require('@react-native-clipboard/clipboard').default.setString(
                supportEmail,
              );
            } catch {
              Alert.alert('Email Hoyst', supportEmail);
            }
          },
        },
        {text: 'Close', style: 'cancel'},
      ],
    );
  }
}
export function chooseFeedbackContact(intent: FeedbackIntent) {
  Alert.alert(
    intent === 'support' ? 'Get help / Report a problem' : 'Request a feature',
    'Choose how to contact Kelvin. For Instagram, open @kg.codes and send a DM. You can also send screenshots and feedback through TestFlight.',
    [
      {
        text: 'Message @kg.codes on Instagram',
        onPress: () => {
          void openFeedbackContact(intent, 'instagram');
        },
      },
      {
        text: 'Email Hoyst',
        onPress: () => {
          void openFeedbackContact(intent, 'email');
        },
      },
      {text: 'Cancel', style: 'cancel'},
    ],
  );
}
