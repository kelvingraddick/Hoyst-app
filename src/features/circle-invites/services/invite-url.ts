const inviteCodePattern = /^[a-z0-9]{6,32}$/;

export function normalizeCircleInviteCode(value: unknown) {
  if (typeof value !== 'string') {
    return undefined;
  }

  const normalized = value.trim().toLowerCase();
  return inviteCodePattern.test(normalized) ? normalized : undefined;
}

export function parseCircleInviteUrl(value: string | null | undefined) {
  if (!value) {
    return undefined;
  }

  try {
    const normalizedUrl = value.trim().split(/[?#]/, 1)[0];
    const webMatch = normalizedUrl.match(
      /^https:\/\/hoyst\.app\/join\/([^/]+)/i,
    );
    const appMatch = normalizedUrl.match(
      /^hoyst:(?:\/\/join|\/+join)\/([^/]+)/i,
    );
    const candidate = webMatch?.[1] ?? appMatch?.[1];

    if (!candidate) {
      return undefined;
    }

    return normalizeCircleInviteCode(
      decodeURIComponent(candidate),
    );
  } catch {
    return undefined;
  }
}
