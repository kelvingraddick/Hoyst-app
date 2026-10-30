import {onRequest, type Request} from 'firebase-functions/v2/https';
import {defineSecret, defineString} from 'firebase-functions/params';
import type {Response} from 'express';
import {db} from '../firebase';
import {escapeHtml, websiteHeaders, websitePage} from '../website/page';
import {
  confirmUpdates,
  subscribeUpdates,
  UpdatesError,
  type UpdatesDependencies,
} from './service';
import {createResendProvider} from './resend';

const resendKey = defineSecret('HOYST_RESEND_API_KEY');
const tokenSecret = defineSecret('UPDATES_TOKEN_SECRET');
const enabled = defineString('UPDATES_ENABLED', {default: 'false'});
const from = defineString('UPDATES_FROM', {
  default: 'Hoyst <updates@hoyst.app>',
});
const domainId = defineString('RESEND_DOMAIN_ID', {default: ''});
const segmentId = defineString('RESEND_SEGMENT_ID', {default: ''});
const topicId = defineString('RESEND_TOPIC_ID', {default: ''});
const origin = defineString('UPDATES_ORIGIN', {default: 'https://hoyst.app'});
const options = {
  secrets: [resendKey, tokenSecret],
  maxInstances: 3,
  concurrency: 20,
};
function dependencies(): UpdatesDependencies {
  return {
    db,
    secret: tokenSecret.value(),
    origin: origin.value(),
    available: enabled.value() === 'true',
    provider: createResendProvider({
      apiKey: resendKey.value(),
      from: from.value(),
      domainId: domainId.value(),
      segmentId: segmentId.value(),
      topicId: topicId.value(),
      enabled: enabled.value() === 'true',
    }),
  };
}
function page(title: string, message: string, token?: string) {
  return websitePage({
    title,
    description: message,
    content: `<main id="main" tabindex="-1" class="confirmation-panel"><img src="/assets/hoy-golden.webp" width="384" height="343" alt="Hoy"><h1>${escapeHtml(
      title,
    )}</h1><p>${escapeHtml(message)}</p>${
      typeof token === 'string'
        ? `<form method="post" action="/updates/confirm"><input id="confirmation-token" type="hidden" name="token" value="${escapeHtml(
            token,
          )}"><button id="confirmation-button" class="button" type="submit" ${
            token ? '' : 'disabled'
          }>Confirm my email</button></form><p id="confirmation-hint" class="signup-note">Occasional Hoyst updates. Unsubscribe anytime. <a href="/privacy#updates">Privacy</a></p><noscript><p>Enable JavaScript to read the private confirmation link, then press Confirm my email.</p></noscript><script src="/updates-confirmation.js?v=checkbox-20261022" defer></script>`
        : '<a class="button" href="/#updates-title">Back to Hoyst</a>'
    }</main>`,
  });
}
function isCrossOrigin(request: Request, allowedOrigin: string) {
  const header = request.get('origin');
  return (
    request.get('sec-fetch-site') === 'cross-site' ||
    (header && header !== allowedOrigin)
  );
}
function errorResponse(error: unknown) {
  return error instanceof UpdatesError
    ? error
    : new UpdatesError(
        503,
        'Email updates are temporarily unavailable. Please try again soon.',
      );
}
export async function handleLaunchSignup(
  request: Request,
  response: Response,
  deps: UpdatesDependencies,
) {
  response.set(websiteHeaders);
  const json = request.get('accept')?.includes('application/json');
  const finish = (status: number, message: string) => {
    response.status(status);
    if (json) {
      response.set('Content-Type', 'application/json; charset=utf-8');
      response.json({message});
    } else {
      response.send(
        page(
          status === 202 ? 'You’re all set.' : 'Let’s try that again.',
          message,
        ),
      );
    }
  };
  if (request.method !== 'POST') {
    response.set('Allow', 'POST');
    finish(405, 'Use the email signup form on the homepage.');
    return;
  }
  if (isCrossOrigin(request, deps.origin)) {
    finish(403, 'Please use the signup form on the Hoyst website.');
    return;
  }
  if (
    Number(request.get('content-length') || 0) > 2048 ||
    (request.rawBody?.length || 0) > 2048
  ) {
    finish(413, 'This request is too large.');
    return;
  }
  try {
    const consent =
      request.body?.consent === true ||
      (request
        .get('content-type')
        ?.includes('application/x-www-form-urlencoded') &&
        request.body?.consent === 'yes');
    await subscribeUpdates(
      request.body?.email,
      consent,
      request.ip || 'unknown',
      deps,
    );
    finish(202, 'You’re all set. Your email preferences are saved.');
  } catch (error) {
    const failure = errorResponse(error);
    if (failure.status === 429) {
      response.set('Retry-After', '3600');
    }
    finish(failure.status, failure.message);
  }
}
export async function handleUpdatesConfirmation(
  request: Request,
  response: Response,
  deps: UpdatesDependencies,
) {
  response.set(websiteHeaders);
  if (request.method === 'GET' || request.method === 'HEAD') {
    const token = request.query.token;
    if (
      token !== undefined &&
      (typeof token !== 'string' || !/^[A-Za-z0-9_-]{43}$/.test(token))
    ) {
      response
        .status(400)
        .send(
          page(
            'This link needs a fresh start.',
            'Join the updates list using the checkbox on the homepage.',
          ),
        );
      return;
    }
    // GET is deliberately read-only, including when email security scanners open the link.
    response.send(
      page(
        'One quick step to stay in the loop.',
        'Confirm you’d like Hoyst news, new features, and launch updates, including Android.',
        typeof token === 'string' ? token : '',
      ),
    );
    return;
  }
  if (request.method !== 'POST') {
    response.set('Allow', 'GET, HEAD, POST');
    response
      .status(405)
      .send(
        page(
          'Let’s head back.',
          'Open the confirmation link from your Hoyst email.',
        ),
      );
    return;
  }
  if (isCrossOrigin(request, deps.origin)) {
    response
      .status(403)
      .send(page('Let’s head back.', 'Please confirm from the Hoyst website.'));
    return;
  }
  try {
    const result = await confirmUpdates(request.body?.token, deps);
    const title =
      result === 'confirmed'
        ? 'You’re in the loop.'
        : result === 'already'
        ? 'This link has already been used.'
        : 'Your email preferences are unchanged.';
    const message =
      result === 'confirmed'
        ? 'Thanks for joining us. We’ll share occasional Hoyst news, new features, and launch updates. You can unsubscribe at any time.'
        : result === 'already'
        ? 'No need to confirm again. This link won’t change your current subscription preferences.'
        : 'This address has opted out of Hoyst updates. To change your preferences, use the link in an earlier Hoyst email or contact development@wavelinkllc.com.';
    response.send(page(title, message));
  } catch (error) {
    const failure = errorResponse(error);
    const retryToken =
      failure.status >= 500 &&
      typeof request.body?.token === 'string' &&
      /^[A-Za-z0-9_-]{43}$/.test(request.body.token)
        ? request.body.token
        : undefined;
    response
      .status(failure.status)
      .send(page('Let’s try that again.', failure.message, retryToken));
  }
}
export const launchSignup = onRequest(options, (request, response) =>
  handleLaunchSignup(request, response, dependencies()),
);
export const updatesConfirmation = onRequest(options, (request, response) =>
  handleUpdatesConfirmation(request, response, dependencies()),
);
