// Version identifiers are independent of the publication/effective date.
export const LEGAL_VERSION = '2026-10-17';

export function hasCurrentLegalAcceptance(value: unknown) {
  const record = value as Record<string, unknown> | undefined;
  return (
    record?.adult === true &&
    record.termsVersion === LEGAL_VERSION &&
    record.privacyVersion === LEGAL_VERSION &&
    Boolean(record.acceptedAt)
  );
}
