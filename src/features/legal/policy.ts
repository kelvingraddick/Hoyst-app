import {Alert, Linking} from 'react-native';

// Version identifiers do not assert an effective/publication date.
export const LEGAL_VERSION = '2026-10-17';
export const legalUrls = {
  privacy: 'https://hoyst.app/privacy',
  terms: 'https://hoyst.app/terms',
} as const;
export const legalAcknowledgment = {
  adult: true,
  termsVersion: LEGAL_VERSION,
  privacyVersion: LEGAL_VERSION,
} as const;
export function hasCurrentLegalAcceptance(value: unknown) {
  const record = value as Record<string, unknown> | undefined;
  return (
    record?.adult === true &&
    record.termsVersion === LEGAL_VERSION &&
    record.privacyVersion === LEGAL_VERSION &&
    Boolean(record.acceptedAt)
  );
}
export async function openLegalPage(page: keyof typeof legalUrls) {
  try {
    await Linking.openURL(legalUrls[page]);
  } catch {
    Alert.alert(
      'Could not open page',
      `Please visit ${legalUrls[page]} in your browser or contact support@hoyst.app.`,
    );
  }
}
