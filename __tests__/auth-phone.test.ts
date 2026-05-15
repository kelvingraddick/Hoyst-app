import {
  formatPhoneNumberForFirebase,
  isE164PhoneNumber,
} from '../src/features/auth/services/phone-number';

describe('phone auth formatting', () => {
  it('formats a plain US phone number for Firebase auth', () => {
    expect(formatPhoneNumberForFirebase('7067736354')).toBe('+17067736354');
  });

  it('formats US phone numbers with punctuation', () => {
    expect(formatPhoneNumberForFirebase('(706) 773-6354')).toBe(
      '+17067736354',
    );
  });

  it('preserves an international E.164 country code', () => {
    expect(formatPhoneNumberForFirebase('+44 20 7946 0958')).toBe(
      '+442079460958',
    );
  });

  it('detects E.164 phone numbers', () => {
    expect(isE164PhoneNumber(formatPhoneNumberForFirebase('7067736354'))).toBe(
      true,
    );
  });
});
