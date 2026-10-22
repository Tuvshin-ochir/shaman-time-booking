(function () {
  'use strict';

  var dataEl = document.getElementById('book-data');
  var form = document.getElementById('book-form');
  if (!dataEl || !form) return;

  var data = JSON.parse(dataEl.textContent);
  var S = data.strings;
  var services = {};
  data.services.forEach(function (s) { services[s.id] = s; });

  function el(id) { return document.getElementById(id); }
  var steps = { time: el('step-time'), contact: el('step-contact'), confirm: el('step-confirm') };
  var daysEl = el('days');
  var timesEl = el('times');
  var dayLabel = el('day-label');
  var fDate = el('f-date');
  var fTime = el('f-time');
  var fName = el('f-name');
  var fPhone = el('f-phone');
  var fAgree = el('f-agree');
  var submitBtn = el('submit-btn');

  var state = { service: null, date: fDate.value || null, time: fTime.value || null, label: '' };
  var requestId = 0;

  function price(n) { return Number(n).toLocaleString('en-US') + '₮'; }

  function getJSON(url) {
    return fetch(url, { headers: { Accept: 'application/json' }, cache: 'no-store' }).then(function (res) {
      if (!res.ok) throw new Error('HTTP ' + res.status);
      return res.json();
    });
  }

  function selectedService() {
    var radio = form.querySelector('input[name="service_id"]:checked');
    return radio ? services[radio.value] : null;
  }

  function scrollTo(node) {
    node.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  function setError(id, message) {
    var node = el(id);
    node.textContent = message || '';
    node.hidden = !message;
  }

  // Mirrors src/lib/phone.js
  function normalizePhone(value) {
    var digits = String(value || '').replace(/[\s\-().]/g, '');
    if (digits.indexOf('+976') === 0) digits = digits.slice(4);
    else if (digits.indexOf('976') === 0 && digits.length === 11) digits = digits.slice(3);
    return /^[5689]\d{7}$/.test(digits) ? digits : null;
  }

  function onServiceChange(initial) {
    state.service = selectedService();
    if (!state.service) return;
    if (!initial) {
      state.date = null;
      state.time = null;
      fDate.value = '';
      fTime.value = '';
    }
    steps.time.hidden = false;
    updateSummary();
    loadDays();
    if (!initial) scrollTo(steps.time);
  }

  function loadDays() {
    var id = ++requestId;
    daysEl.innerHTML = '';
    timesEl.innerHTML = '';
    dayLabel.textContent = S.loading;
    getJSON('/api/days?service=' + state.service.id)
      .then(function (res) {
        if (id !== requestId) return;
        renderDays(res.days);
        var wanted = state.date && res.days.filter(function (d) { return d.date === state.date && d.free > 0; })[0];
        var pick = wanted || res.days.filter(function (d) { return d.free > 0; })[0];
        if (!pick) {
          dayLabel.textContent = S.noDays;
          return;
        }
        selectDay(pick.date, !!wanted);
      })
      .catch(function () {
        if (id === requestId) dayLabel.textContent = S.errGeneric;
      });
  }

  function renderDays(days) {
    daysEl.innerHTML = '';
    days.forEach(function (d) {
      var btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'day';
      btn.dataset.date = d.date;
      btn.setAttribute('role', 'radio');
      btn.setAttribute('aria-checked', 'false');
      btn.disabled = d.closed || d.free === 0;
      ['day-wd', 'day-num', 'day-sub'].forEach(function (cls) {
        var span = document.createElement('span');
        span.className = cls;
        btn.appendChild(span);
      });
      btn.children[0].textContent = d.weekdayShort;
      btn.children[1].textContent = d.day;
      btn.children[2].textContent = d.closed ? S.closed : d.free === 0 ? S.full : d.month;
      btn.addEventListener('click', function () { selectDay(d.date, false); });
      daysEl.appendChild(btn);
    });
  }

  function selectDay(date, keepTime) {
    state.date = date;
    fDate.value = date;
    if (!keepTime) {
      state.time = null;
      fTime.value = '';
    }
    Array.prototype.forEach.call(daysEl.children, function (btn) {
      var on = btn.dataset.date === date;
      btn.classList.toggle('is-selected', on);
      btn.setAttribute('aria-checked', on ? 'true' : 'false');
      if (on) daysEl.scrollLeft = btn.offsetLeft - daysEl.clientWidth / 2 + btn.clientWidth / 2;
    });

    var id = ++requestId;
    timesEl.innerHTML = '';
    dayLabel.textContent = S.loading;
    getJSON('/api/slots?service=' + state.service.id + '&date=' + date)
      .then(function (res) {
        if (id !== requestId) return;
        state.label = res.label;
        dayLabel.textContent = res.times.length ? res.label : res.label + ' — ' + S.noTimes;
        res.times.forEach(function (time) {
          var btn = document.createElement('button');
          btn.type = 'button';
          btn.className = 'time';
          btn.dataset.time = time;
          btn.textContent = time;
          btn.setAttribute('role', 'radio');
          btn.setAttribute('aria-checked', 'false');
          btn.addEventListener('click', function () { selectTime(time, false); });
          timesEl.appendChild(btn);
        });
        if (state.time && res.times.indexOf(state.time) !== -1) selectTime(state.time, true);
        else {
          state.time = null;
          fTime.value = '';
          updateSummary();
        }
      })
      .catch(function () {
        if (id === requestId) dayLabel.textContent = S.errGeneric;
      });
  }

  function selectTime(time, initial) {
    state.time = time;
    fTime.value = time;
    Array.prototype.forEach.call(timesEl.children, function (btn) {
      var on = btn.dataset.time === time;
      btn.classList.toggle('is-selected', on);
      btn.setAttribute('aria-checked', on ? 'true' : 'false');
    });
    var firstReveal = steps.contact.hidden;
    steps.contact.hidden = false;
    steps.confirm.hidden = false;
    setError('form-error', '');
    updateSummary();
    if (firstReveal && (!initial || !fName.value)) scrollTo(steps.contact);
  }

  function updateSummary() {
    var s = state.service;
    if (!s) return;
    el('sum-service').textContent = s.name + ' · ' + S.duration.replace('{n}', s.duration);
    el('sum-when').textContent = state.time ? state.label + ', ' + state.time : '—';
    el('sum-price').textContent = price(s.price);
    el('sum-due').textContent = price(s.amountDue);
    el('sum-balance').hidden = !(s.amountDue < s.price);
    submitBtn.textContent = s.amountDue > 0 ? S.submit : S.submitFree;
  }

  fPhone.addEventListener('blur', function () {
    if (fPhone.value.trim()) setError('phone-error', normalizePhone(fPhone.value) ? '' : S.errPhone);
  });
  fPhone.addEventListener('input', function () {
    if (normalizePhone(fPhone.value)) setError('phone-error', '');
  });
  fName.addEventListener('input', function () {
    if (fName.value.trim().length >= 2) setError('name-error', '');
  });
  fAgree.addEventListener('change', function () {
    if (fAgree.checked) setError('form-error', '');
  });

  form.addEventListener('change', function (e) {
    if (e.target.name === 'service_id') onServiceChange(false);
  });

  form.addEventListener('submit', function (e) {
    var problems = [];
    setError('form-error', '');
    if (!state.time) problems.push(['form-error', S.errTime, steps.time]);
    if (fName.value.trim().length < 2) problems.push(['name-error', S.errName, steps.contact]);
    if (!normalizePhone(fPhone.value)) problems.push(['phone-error', S.errPhone, steps.contact]);
    if (!fAgree.checked && state.time) problems.push(['form-error', S.errAgree, steps.confirm]);
    if (problems.length) {
      e.preventDefault();
      problems.forEach(function (p) { setError(p[0], p[1]); });
      scrollTo(problems[0][2]);
      return;
    }
    submitBtn.disabled = true;
    submitBtn.classList.add('is-loading');
  });

  // Re-enable the button when the user comes back with the browser's Back button.
  window.addEventListener('pageshow', function () {
    submitBtn.disabled = false;
    submitBtn.classList.remove('is-loading');
  });

  var radios = form.querySelectorAll('input[name="service_id"]');
  if (!selectedService() && radios.length === 1) radios[0].checked = true;
  if (selectedService()) onServiceChange(true);
})();
