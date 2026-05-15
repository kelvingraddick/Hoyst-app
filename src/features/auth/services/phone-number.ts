const E164_PHONE_NUMBER = /^\+[1-9]\d{1,14}$/;

export function formatPhoneNumberForFirebase(phoneNumber: string) {
  const trimmedPhoneNumber = phoneNumber.trim();
  const digitsOnly = trimmedPhoneNumber.replace(/\D/g, '');

  if (!trimmedPhoneNumber) {
    return trimmedPhoneNumber;
  }

  if (trimmedPhoneNumber.startsWith('+')) {
    return `+${digitsOnly}`;
  }

  if (digitsOnly.length === 10) {
    return `+1${digitsOnly}`;
  }

  if (digitsOnly.length === 11 && digitsOnly.startsWith('1')) {
    return `+${digitsOnly}`;
  }

  return trimmedPhoneNumber;
}

export function isE164PhoneNumber(phoneNumber: string) {
  return E164_PHONE_NUMBER.test(phoneNumber);
}
