import {createHmac, timingSafeEqual} from 'node:crypto';
export function verifyWebhook(
  raw: Buffer,
  header: string,
  secret: string,
  now = Date.now(),
) {
  const timestamp = header.match(/(?:^|,)\s*t=(\d+)/)?.[1];
  const signatures = Array.from(
    header.matchAll(/(?:^|,)\s*v1=([a-f0-9]{64})/gi),
    match => match[1],
  );
  if (!timestamp || Math.abs(now / 1000 - Number(timestamp)) > 300 || !secret) {
    return false;
  }
  const expected = createHmac('sha256', secret)
    .update(timestamp + '.')
    .update(raw)
    .digest();
  return signatures.some(signature =>
    timingSafeEqual(Buffer.from(signature, 'hex'), expected),
  );
}
