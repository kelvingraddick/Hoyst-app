import {UpdatesError, type UpdatesProvider} from './service';

type Config = {
  apiKey: string;
  from: string;
  domainId: string;
  segmentId: string;
  topicId: string;
  enabled: boolean;
};
type Fetcher = typeof fetch;
type Timing = {
  sleep: (milliseconds: number) => Promise<void>;
  random: () => number;
};
export function createResendProvider(
  config: Config,
  request: Fetcher = fetch,
  timing: Timing = {
    sleep: milliseconds =>
      new Promise(resolve => setTimeout(resolve, milliseconds)),
    random: Math.random,
  },
): UpdatesProvider {
  async function api(
    path: string,
    method = 'GET',
    body?: unknown,
    idempotencyKey?: string,
  ) {
    const options = {
      method,
      signal: AbortSignal.timeout(12000),
      headers: {
        Authorization: `Bearer ${config.apiKey}`,
        'Content-Type': 'application/json',
        ...(idempotencyKey ? {'Idempotency-Key': idempotencyKey} : {}),
      },
      ...(body ? {body: JSON.stringify(body)} : {}),
    };
    let response: Response | undefined;
    for (let attempt = 0; attempt < 4; attempt++) {
      response = await request(`https://api.resend.com${path}`, {
        ...options,
        signal: AbortSignal.timeout(12000),
      });
      if (response.status !== 429 || attempt === 3) {
        break;
      }
      const retryAfter = Number(response.headers.get('retry-after'));
      await timing.sleep(
        Math.min(
          5000,
          Math.max(
            600 * 2 ** attempt,
            Number.isFinite(retryAfter) ? retryAfter * 1000 : 0,
          ),
        ) +
          timing.random() * 250,
      );
    }
    if (!response) {
      throw new UpdatesError(503, 'Email updates are temporarily unavailable.');
    }
    if (response.status === 404 && method === 'GET') {
      return null;
    }
    if (!response.ok) {
      throw new UpdatesError(
        503,
        'Email updates are temporarily unavailable. Please try again soon.',
      );
    }
    return response.json() as Promise<Record<string, any>>;
  }
  return {
    async ready() {
      if (
        !config.enabled ||
        !config.apiKey ||
        !config.domainId ||
        !config.segmentId ||
        !config.topicId
      ) {
        throw new UpdatesError(
          503,
          'Email updates aren’t available just yet. Please try again soon.',
        );
      }
      const address = config.from.match(/<?([^<>\s]+@([^<>\s]+))>?$/);
      const domain = await api(
        `/domains/${encodeURIComponent(config.domainId)}`,
      );
      if (
        !domain ||
        domain.status !== 'verified' ||
        !address ||
        address[2].toLowerCase() !== String(domain.name).toLowerCase()
      ) {
        throw new UpdatesError(
          503,
          'Email updates aren’t available just yet. Please try again soon.',
        );
      }
    },
    async sendConfirmation(email, url, key) {
      const escapedUrl = url.replaceAll('&', '&amp;').replaceAll('"', '&quot;');
      await api(
        '/emails',
        'POST',
        {
          from: config.from,
          to: [email],
          reply_to: 'development@wavelinkllc.com',
          subject: 'Confirm your Hoyst updates',
          text: `A little progress, together.\n\nConfirm that you want occasional Hoyst news, new features, and launch updates, including Android:\n${url}\n\nThis link expires in 24 hours. If you didn’t request this email, you can ignore it. You won’t be subscribed.`,
          html: `<div style="font-family:system-ui,sans-serif;max-width:520px;margin:auto;padding:32px;color:#101116"><h1>Your goals deserve good company.</h1><p>One quick step to stay in the loop with Hoyst news, new features, and launch updates, including Android.</p><p><a style="display:inline-block;background:#0866e8;color:white;border-radius:24px;padding:14px 24px;text-decoration:none" href="${escapedUrl}">Confirm my email</a></p><p>This link expires in 24 hours. If you didn’t request this email, ignore it and you won’t be subscribed.</p><p>Hoyst · <a href="https://hoyst.app/privacy#updates">Privacy</a> · development@wavelinkllc.com</p></div>`,
        },
        key,
      );
    },
    async subscribe(email) {
      const path = `/contacts/${encodeURIComponent(email)}`;
      const contact = await api(path);
      if (!contact) {
        // The current Contacts API can attach a segment and opt-in topic atomically.
        await api('/contacts', 'POST', {
          email,
          segments: [{id: config.segmentId}],
          topics: [{id: config.topicId, subscription: 'opt_in'}],
        });
        return 'subscribed';
      }
      if (contact.unsubscribed === true) {
        return 'unsubscribed';
      }
      const topics = await api(`${path}/topics`);
      // Fail safely if a preference could be on a later page.
      if (!topics || topics.has_more) {
        throw new UpdatesError(
          503,
          'We couldn’t verify your email preferences. Please try again soon.',
        );
      }
      const preference = (topics?.data || []).find(
        (topic: {id: string}) => topic.id === config.topicId,
      );
      if (preference?.subscription === 'opt_out') {
        // Resend also reports the topic's inherited opt-out default here.
        // Membership is retained after a real Hoyst unsubscribe, so distinguish
        // prior Hoyst enrollment from a new, explicitly confirmed brand signup.
        const segments = await api(`${path}/segments`);
        if (!segments || !Array.isArray(segments.data)) {
          throw new UpdatesError(
            503,
            'We couldn’t verify your email preferences. Please try again soon.',
          );
        }
        if (
          segments.data.some(
            (segment: {id: string}) => segment.id === config.segmentId,
          )
        ) {
          return 'unsubscribed';
        }
        if (segments.has_more) {
          throw new UpdatesError(
            503,
            'We couldn’t verify your email preferences. Please try again soon.',
          );
        }
      }
      if (preference?.subscription !== 'opt_in') {
        // The REST endpoint takes the array directly, unlike the SDK's topics wrapper.
        await api(`${path}/topics`, 'PATCH', [
          {id: config.topicId, subscription: 'opt_in'},
        ]);
      }
      await api(
        `${path}/segments/${encodeURIComponent(config.segmentId)}`,
        'POST',
      );
      return 'subscribed';
    },
  };
}
