(function () {
  'use strict';
  var field = document.getElementById('confirmation-token');
  var button = document.getElementById('confirmation-button');
  if (!field || !button) {
    return;
  }
  var token = window.location.hash.slice(1);
  // The fragment never reaches Hosting or Function request logs. Clear it from history.
  if (window.location.hash) {
    window.history.replaceState(null, '', window.location.pathname);
  }
  if (/^[A-Za-z0-9_-]{43}$/.test(token)) {
    field.value = token;
    button.disabled = false;
  } else if (!field.value) {
    document.getElementById('confirmation-hint').textContent =
      'This confirmation link is missing or invalid. Use the signup form on the Hoyst homepage.';
  }
})();
