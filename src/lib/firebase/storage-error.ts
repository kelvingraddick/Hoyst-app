type FirebaseStorageError = {
  code?: unknown;
  message?: unknown;
};

function getStorageErrorCode(error: unknown) {
  const storageError = error as FirebaseStorageError;

  if (typeof storageError?.code === 'string') {
    return storageError.code.toLowerCase();
  }

  if (typeof storageError?.message !== 'string') {
    return undefined;
  }

  return storageError.message
    .match(/\[(storage\/[^\]]+)\]/i)?.[1]
    ?.toLowerCase();
}

export function getPhotoUploadErrorMessage(
  error: unknown,
  fallback = "We couldn't upload this photo. Try again in a moment.",
) {
  const code = getStorageErrorCode(error);

  if (code === 'storage/canceled') {
    return 'The photo upload was canceled. Try again when you are ready.';
  }

  if (code === 'storage/retry-limit-exceeded' || code === 'storage/unknown') {
    return "We couldn't upload this photo. Check your connection and try again.";
  }

  if (code?.startsWith('storage/')) {
    return "We couldn't upload this photo. Try again in a moment.";
  }

  return fallback;
}
