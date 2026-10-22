// Light/dark toggle. The choice is stored in a cookie so the server can render
// <html data-theme> directly (no flash on the next page load).
(function () {
  'use strict';

  var button = document.querySelector('[data-theme-toggle]');
  if (!button) return;
  var root = document.documentElement;
  var systemDark = window.matchMedia('(prefers-color-scheme: dark)');

  function current() {
    return root.getAttribute('data-theme') || (systemDark.matches ? 'dark' : 'light');
  }

  button.addEventListener('click', function () {
    var next = current() === 'dark' ? 'light' : 'dark';
    root.setAttribute('data-theme', next);
    document.cookie = 'theme=' + next + '; path=/; max-age=31536000; samesite=lax';
  });
})();
