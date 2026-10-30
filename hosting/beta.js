/* Minimal explicit PostHog events. No third-party script, replay, cookies or URL capture. */
(function () {
  'use strict';
  var config = window.HOYST_BETA_CONFIG || {};
  var page = location.pathname.indexOf('/join/') === 0 ? 'invite' : 'home';
  var enabled =
    /^phc_[a-zA-Z0-9]+$/.test(config.posthogProjectKey || '') &&
    ['https://us.i.posthog.com', 'https://eu.i.posthog.com'].indexOf(
      config.posthogHost,
    ) !== -1;
  var session;
  var newSession = false;
  var sourceValues = [
    'instagram',
    'facebook',
    'tiktok',
    'threads',
    'x',
    'youtube',
    'mailchimp',
    'resend',
  ];
  var mediumValues = ['organic_social', 'email'];
  var tags = {};
  var privacyBlocked =
    navigator.doNotTrack === '1' || navigator.globalPrivacyControl === true;
  function optedOut() {
    try {
      return (
        privacyBlocked ||
        localStorage.getItem('hoyst-analytics-opt-out') === 'true'
      );
    } catch (_) {
      return true;
    }
  }
  try {
    if (enabled && !optedOut()) {
      session = JSON.parse(
        sessionStorage.getItem('hoyst-beta-session') || 'null',
      );
      if (
        !session ||
        typeof session.id !== 'string' ||
        Date.now() - session.at > 1800000
      ) {
        var query = new URLSearchParams(location.search);
        var source = query.get('utm_source');
        var medium = query.get('utm_medium');
        var campaign = query.get('utm_campaign');
        var content = query.get('utm_content');
        if (sourceValues.indexOf(source) !== -1) tags.utm_source = source;
        if (mediumValues.indexOf(medium) !== -1) tags.utm_medium = medium;
        if (campaign === 'ios_beta_20261101') tags.utm_campaign = campaign;
        if (
          /^(kgcodes|wavelink)_(demo|teaser|launch|reminder|story|bio|update|invite|usecase)(_[0-9]{1,2})?$/.test(
            content || '',
          )
        )
          tags.utm_content = content;
        session = {id: crypto.randomUUID(), at: Date.now(), tags: tags};
        newSession = true;
      }
      tags = session.tags;
      session.at = Date.now();
      sessionStorage.setItem('hoyst-beta-session', JSON.stringify(session));
    }
  } catch (_) {
    session = undefined;
  }
  function capture(event, properties) {
    if (!enabled || !session || optedOut()) return;
    // Build properties explicitly. Never spread location, DOM content, referrers or config.
    var safe = {
      distinct_id: session.id,
      $session_id: session.id,
      $geoip_disable: true,
      $process_person_profile: false,
      platform: 'web',
      page_type: page,
      environment: 'production',
      is_internal: ['hoyst.app', 'www.hoyst.app'].indexOf(location.hostname) === -1,
    };
    ['utm_source', 'utm_medium', 'utm_campaign', 'utm_content'].forEach(
      function (key) {
        if (tags[key]) safe[key] = tags[key];
      },
    );
    ['intent', 'channel'].forEach(function (key) {
      if (properties && properties[key]) safe[key] = properties[key];
    });
    try {
      fetch(config.posthogHost + '/capture/', {
        method: 'POST',
        mode: 'cors',
        credentials: 'omit',
        referrerPolicy: 'no-referrer',
        keepalive: true,
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify({
          api_key: config.posthogProjectKey,
          event: event,
          properties: safe,
        }),
      }).catch(function () {});
    } catch (_) {
      /* Navigation must work even when tracking is blocked. */
    }
  }
  if (newSession) capture('website_session_started');
  capture('website_page_viewed');
  document.addEventListener('click', function (event) {
    var link =
      event.target.closest && event.target.closest('[data-beta-action]');
    if (!link) return;
    var action = link.getAttribute('data-beta-action');
    if (action === 'testflight') capture('testflight_clicked');
    if (action === 'open_app') capture('open_app_clicked');
    if (action === 'support' || action === 'feature')
      capture('feedback_contact_opened', {
        intent: action,
        channel:
          link.getAttribute('data-channel') === 'instagram'
            ? 'instagram'
            : 'email',
      });
  });
  var toggle = document.querySelector('[data-analytics-toggle]');
  function labelToggle() {
    if (toggle)
      toggle.textContent = optedOut() ? 'Analytics off' : 'Turn off analytics';
  }
  if (toggle) {
    labelToggle();
    toggle.addEventListener('click', function () {
      try {
        var disable = !optedOut();
        localStorage.setItem('hoyst-analytics-opt-out', String(disable));
        if (disable) {
          sessionStorage.removeItem('hoyst-beta-session');
          session = undefined;
        }
        labelToggle();
      } catch (_) {
        toggle.textContent = 'Analytics unavailable';
      }
    });
  }
  var updates = document.querySelector('[data-beta-updates]');
  if (updates && /^https:\/\//.test(config.updatesUrl || '')) {
    updates.href = config.updatesUrl;
    updates.hidden = false;
  }
  var launchStatus = document.querySelector('[data-launch-status]');
  if (launchStatus && Date.now() >= Date.parse('2026-11-01T15:00:00Z'))
    launchStatus.textContent = 'The free public iPhone beta is open.';
})();
