(function () {
  'use strict';

  var root = document.getElementById('pay');
  if (!root) return;

  var token = root.dataset.token;
  var expiresAt = Number(root.dataset.expires);
  var skew = Number(root.dataset.serverNow) - Date.now();
  var countdown = document.getElementById('countdown');
  var statusEl = document.getElementById('pay-status');
  var checkBtn = document.getElementById('check-btn');
  var expiredEl = document.getElementById('pay-expired');
  var finished = false;

  function tick() {
    var left = Math.max(0, expiresAt - (Date.now() + skew));
    var minutes = Math.floor(left / 60000);
    var seconds = Math.floor((left % 60000) / 1000);
    countdown.textContent = minutes + ':' + (seconds < 10 ? '0' : '') + seconds;
    countdown.classList.toggle('is-low', left < 2 * 60000);
  }

  function poll(force) {
    if (finished) return Promise.resolve(null);
    var url = '/api/booking/' + encodeURIComponent(token) + '/status' + (force ? '?force=1' : '');
    return fetch(url, { headers: { Accept: 'application/json' }, cache: 'no-store' })
      .then(function (res) { return res.json(); })
      .then(function (data) {
        if (data.status === 'confirmed') {
          finished = true;
          window.location.replace('/booking/' + encodeURIComponent(token));
        } else if (data.status === 'expired' || data.status === 'cancelled') {
          finished = true;
          root.hidden = true;
          expiredEl.hidden = false;
        }
        return data.status;
      })
      .catch(function () { return null; });
  }

  // Bank logos are hosted by QPay; if one fails to load, show just the name.
  Array.prototype.forEach.call(root.querySelectorAll('.bank img'), function (img) {
    function hide() { img.hidden = true; }
    if (img.complete && img.naturalWidth === 0) hide();
    else img.addEventListener('error', hide);
  });

  tick();
  setInterval(tick, 1000);
  setInterval(function () { poll(false); }, 4000);

  // Coming back from the bank app: check right away.
  document.addEventListener('visibilitychange', function () {
    if (!document.hidden) poll(true);
  });

  checkBtn.addEventListener('click', function () {
    checkBtn.disabled = true;
    checkBtn.textContent = root.dataset.msgChecking;
    poll(true).then(function (status) {
      checkBtn.disabled = false;
      checkBtn.textContent = root.dataset.msgCheck;
      if (status === 'pending') statusEl.textContent = root.dataset.msgNotYet;
    });
  });
})();
