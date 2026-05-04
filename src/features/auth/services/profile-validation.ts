export type HandleValidationResult =
  | {isValid: true; normalizedHandle: string}
  | {isValid: false; message: string; normalizedHandle: string};

export function normalizeHandle(handle: string): string {
  return handle.trim().replace(/^@+/, '').toLowerCase();
}

export function validateHandle(handle: string): HandleValidationResult {
  const normalizedHandle = normalizeHandle(handle);

  if (normalizedHandle.length < 3 || normalizedHandle.length > 20) {
    return {
      isValid: false,
      message: 'Handle must be 3 to 20 characters.',
      normalizedHandle,
    };
  }

  if (!/^[a-z0-9_]+$/.test(normalizedHandle)) {
    return {
      isValid: false,
      message: 'Use letters, numbers, and underscores only.',
      normalizedHandle,
    };
  }

  return {isValid: true, normalizedHandle};
}

