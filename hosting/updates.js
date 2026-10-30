(function () {
  'use strict';
  var form = document.getElementById('updates-form');
  if (!form) {
    return;
  }
  var status = document.getElementById('updates-status');
  var button = form.querySelector('button[type="submit"]');
  form.addEventListener('submit', async function (event) {
    event.preventDefault();
    if (!form.reportValidity() || button.disabled) {
      return;
    }
    button.disabled = true;
    button.textContent = 'Saving…';
    status.hidden = false;
    status.dataset.error = 'false';
    status.textContent = 'Saving your email preferences…';
    try {
      var response = await fetch(form.action, {
        method: 'POST',
        credentials: 'same-origin',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json',
        },
        body: JSON.stringify({
          email: form.elements.email.value.trim(),
          consent: form.elements.consent.checked,
        }),
      });
      var body = await response.json();
      if (!response.ok) {
        throw new Error(body.message || 'Please try again in a moment.');
      }
      status.textContent =
        body.message || 'You’re all set. Your email preferences are saved.';
      form.reset();
    } catch (error) {
      status.dataset.error = 'true';
      status.textContent =
        error.message === 'Failed to fetch'
          ? 'We couldn’t connect. Check your connection and try again.'
          : error.message ||
            'We couldn’t save your email preferences. Please try again.';
    } finally {
      button.disabled = false;
      button.textContent = 'Keep me updated';
    }
  });
})();
