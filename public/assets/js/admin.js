(function () {
  'use strict';

  // Sidebar on small screens
  var navToggle = document.querySelector('[data-nav-toggle]');
  var backdrop = document.querySelector('[data-nav-close]');
  function setNav(open) {
    document.body.classList.toggle('nav-open', open);
    if (navToggle) navToggle.setAttribute('aria-expanded', open ? 'true' : 'false');
    if (backdrop) backdrop.hidden = !open;
  }
  if (navToggle) {
    navToggle.addEventListener('click', function () {
      setNav(!document.body.classList.contains('nav-open'));
    });
    backdrop.addEventListener('click', function () { setNav(false); });
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape') setNav(false);
    });
  }

  // <form data-confirm="..."> asks before submitting.
  document.addEventListener('submit', function (e) {
    var message = e.target.getAttribute('data-confirm');
    if (message && !window.confirm(message)) e.preventDefault();
  });

  var viewSelect = document.querySelector('[data-toggle-date]');
  if (viewSelect) {
    var dateField = document.querySelector('[data-date-field]');
    viewSelect.addEventListener('change', function () {
      dateField.hidden = viewSelect.value !== 'date';
    });
  }

  // Shows free start times under the date/time inputs; clicking one fills the time.
  Array.prototype.forEach.call(document.querySelectorAll('[data-slot-picker]'), function (form) {
    var dateInput = form.querySelector('[data-slot-date]');
    var timeInput = form.querySelector('[data-slot-time]');
    var list = form.querySelector('[data-slot-list]');
    var serviceSelect = form.dataset.serviceSelect ? document.getElementById(form.dataset.serviceSelect) : null;
    var bookingId = form.dataset.booking;
    var requestId = 0;

    function message(text) {
      list.innerHTML = '';
      var p = document.createElement('p');
      p.className = 'slot-hint';
      p.textContent = text;
      list.appendChild(p);
    }

    function load() {
      if (!dateInput.value) {
        list.innerHTML = '';
        return;
      }
      var params = new URLSearchParams({ date: dateInput.value });
      if (bookingId) params.set('booking', bookingId);
      else if (serviceSelect) params.set('service', serviceSelect.value);
      var id = ++requestId;
      message('Сул цаг ачаалж байна…');
      fetch('/admin/api/slots?' + params.toString(), { headers: { Accept: 'application/json' }, cache: 'no-store' })
        .then(function (res) { return res.json(); })
        .then(function (data) {
          if (id !== requestId) return;
          if (data.closed) return message('Энэ өдөр амралтын өдөр. Шаардлагатай бол цагаа гараар оруулна уу.');
          if (!data.times.length) return message('Энэ өдөр сул цаг алга. Шаардлагатай бол цагаа гараар оруулна уу.');
          message('Сул цагууд:');
          data.times.forEach(function (time) {
            var btn = document.createElement('button');
            btn.type = 'button';
            btn.className = 'slot' + (time === timeInput.value ? ' is-selected' : '');
            btn.textContent = time;
            btn.addEventListener('click', function () {
              timeInput.value = time;
              Array.prototype.forEach.call(list.querySelectorAll('.slot'), function (other) {
                other.classList.toggle('is-selected', other === btn);
              });
            });
            list.appendChild(btn);
          });
        })
        .catch(function () {
          if (id === requestId) list.innerHTML = '';
        });
    }

    dateInput.addEventListener('change', load);
    if (serviceSelect) serviceSelect.addEventListener('change', load);
    load();
  });

  // ── Home page editor (views/admin/landing.ejs) ─────────
  var landingForm = document.getElementById('landing-form');
  if (!landingForm) return;

  var csrf = landingForm.querySelector('input[name="_csrf"]').value;
  var toast = document.getElementById('a-toast');
  var dirty = false;

  function markDirty() {
    dirty = true;
    landingForm.classList.add('is-dirty');
  }
  landingForm.addEventListener('input', function (e) {
    if (e.target.type !== 'file') markDirty();
  });

  // Repeatable rows (policy rules and sections): add, remove, move. Row order on
  // screen is the saved order.
  landingForm.addEventListener('click', function (e) {
    var button = e.target.closest('button');
    if (!button) return;
    var box = button.closest('[data-repeat]');
    var row = button.closest('[data-repeat-item]');
    if (button.hasAttribute('data-repeat-add')) {
      var template = box.querySelector('template[data-repeat-template]');
      if (box.querySelectorAll('[data-repeat-item]').length >= Number(box.dataset.max || 99)) {
        return window.alert('Хамгийн ихдээ ' + box.dataset.max + ' байна.');
      }
      template.insertAdjacentHTML('beforebegin', template.innerHTML.replace(/__ID__/g, 'n' + Date.now().toString(36)));
      var added = template.previousElementSibling;
      var input = added.querySelector('input:not([type="hidden"])');
      if (input && input.offsetParent) input.focus();
      markDirty();
    } else if (button.hasAttribute('data-repeat-remove')) {
      if (!window.confirm('Энэ мөрийг устгах уу? (Хадгалах товч дарснаар хадгалагдана.)')) return;
      row.remove();
      markDirty();
    } else if (button.hasAttribute('data-repeat-up')) {
      var prev = row.previousElementSibling;
      if (prev && prev.matches('[data-repeat-item]')) row.parentNode.insertBefore(row, prev);
      markDirty();
    } else if (button.hasAttribute('data-repeat-down')) {
      var next = row.nextElementSibling;
      if (next && next.matches('[data-repeat-item]')) row.parentNode.insertBefore(next, row);
      markDirty();
    }
  });
  landingForm.addEventListener('submit', function () { dirty = false; });
  window.addEventListener('beforeunload', function (e) {
    if (dirty) {
      e.preventDefault();
      e.returnValue = '';
    }
  });

  function say(message, isError) {
    toast.textContent = message;
    toast.classList.toggle('is-error', !!isError);
    toast.hidden = false;
    clearTimeout(say.timer);
    if (isError) say.timer = setTimeout(function () { toast.hidden = true; }, 6000);
  }

  // Image actions reload the page, so unsaved text edits would be lost.
  function okToLeave() {
    return !dirty || window.confirm('Хадгалаагүй текстийн өөрчлөлт алга болно. Үргэлжлүүлэх үү?');
  }

  function reloadAt(node) {
    dirty = false;
    var section = node.closest('.landing-section');
    window.location.href = '/admin/landing?ok=image' + (section ? '#' + section.id : '');
  }

  function post(url, body) {
    return fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-CSRF-Token': csrf },
      body: JSON.stringify(body),
    }).then(function (res) {
      return res.json().catch(function () { return {}; }).then(function (data) {
        if (!res.ok) throw new Error(data.error || 'Алдаа гарлаа (' + res.status + ')');
        return data;
      });
    });
  }

  function loadImage(file) {
    return new Promise(function (resolve, reject) {
      var url = URL.createObjectURL(file);
      var img = new Image();
      img.onload = function () {
        URL.revokeObjectURL(url);
        resolve(img);
      };
      img.onerror = function () {
        URL.revokeObjectURL(url);
        reject(new Error('Зургийг уншиж чадсангүй. JPG эсвэл PNG зураг сонгоно уу.'));
      };
      img.src = url;
    });
  }

  // Scales down (never up) and optionally centre-crops to `ratio` (width / height).
  function encode(img, maxWidth, ratio) {
    var sx = 0, sy = 0, sw = img.naturalWidth, sh = img.naturalHeight;
    if (ratio) {
      if (sw / sh > ratio) {
        var cropW = Math.round(sh * ratio);
        sx = Math.round((sw - cropW) / 2);
        sw = cropW;
      } else {
        var cropH = Math.round(sw / ratio);
        sy = Math.round((sh - cropH) / 2);
        sh = cropH;
      }
    }
    var width = Math.min(maxWidth, sw);
    var height = Math.round((width * sh) / sw);
    var canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    var ctx = canvas.getContext('2d');
    ctx.fillStyle = '#fff';
    ctx.fillRect(0, 0, width, height);
    ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(img, sx, sy, sw, sh, 0, 0, width, height);
    return { dataUrl: canvas.toDataURL('image/jpeg', 0.8), width: width, height: height };
  }

  landingForm.addEventListener('click', function (e) {
    var target = e.target.closest('button');
    if (!target) return;

    if (target.hasAttribute('data-pick')) {
      target.parentElement.querySelector('input[type="file"]').click();
    } else if (target.hasAttribute('data-image-reset')) {
      if (!okToLeave()) return;
      post('/admin/landing/image/reset', { slot: target.getAttribute('data-image-reset') })
        .then(function () { reloadAt(target); })
        .catch(function (err) { say(err.message, true); });
    } else if (target.hasAttribute('data-gallery-delete')) {
      if (!window.confirm('Энэ зургийг цомгоос устгах уу?') || !okToLeave()) return;
      post('/admin/landing/gallery/delete', { index: target.dataset.index })
        .then(function () { reloadAt(target); })
        .catch(function (err) { say(err.message, true); });
    } else if (target.hasAttribute('data-gallery-move')) {
      if (!okToLeave()) return;
      post('/admin/landing/gallery/move', { index: target.dataset.index, direction: target.getAttribute('data-gallery-move') })
        .then(function () { reloadAt(target); })
        .catch(function (err) { say(err.message, true); });
    } else if (target.hasAttribute('data-gallery-reset')) {
      if (!window.confirm('Цомгийг анхны зургууд руу буцаах уу? Таны оруулсан зургууд устна.') || !okToLeave()) return;
      post('/admin/landing/gallery/reset', {})
        .then(function () { reloadAt(target); })
        .catch(function (err) { say(err.message, true); });
    }
  });

  landingForm.addEventListener('change', function (e) {
    var input = e.target;
    if (!input.matches('[data-upload]') || !input.files || !input.files[0]) return;
    var file = input.files[0];
    input.value = '';
    if (!/^image\//.test(file.type)) return say('Зөвхөн зургийн файл сонгоно уу.', true);
    if (!okToLeave()) return;

    say('Зургийг шахаж байна…');
    loadImage(file)
      .then(function (img) {
        var ratio = Number(input.dataset.crop) || null;
        var large = encode(img, Number(input.dataset.large), ratio);
        var small = input.dataset.small ? encode(img, Number(input.dataset.small), ratio) : null;
        var useSmall = small && small.width < large.width;
        say('Хуулж байна…');
        return post('/admin/landing/image', {
          slot: input.dataset.slot,
          index: input.dataset.index === undefined ? '' : input.dataset.index,
          large: large.dataUrl,
          width: large.width,
          height: large.height,
          small: useSmall ? small.dataUrl : undefined,
          smallWidth: useSmall ? small.width : undefined,
        });
      })
      .then(function () { reloadAt(input); })
      .catch(function (err) { say(err.message, true); });
  });
})();
