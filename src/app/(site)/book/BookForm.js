'use client';

import { useEffect, useRef, useState, useTransition } from 'react';
import ScrollArea from '@/components/ScrollArea.js';
import { submitBooking } from './actions.js';

const price = (n) => `${Number(n).toLocaleString('en-US')}₮`;

// Mirrors src/lib/phone.js
function normalizePhone(value) {
  let digits = String(value || '').replace(/[\s\-().]/g, '');
  if (digits.startsWith('+976')) digits = digits.slice(4);
  else if (digits.startsWith('976') && digits.length === 11) digits = digits.slice(3);
  return /^[5689]\d{7}$/.test(digits) ? digits : null;
}

async function getJSON(url) {
  const res = await fetch(url, { headers: { Accept: 'application/json' }, cache: 'no-store' });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}

// Step by step: service -> day -> time -> contact -> confirm. Only free times
// are offered (from /api/days and /api/slots); the server checks again.
// A special service (`dayOnly`) skips the time: the customer picks only a day.
export default function BookForm({ services, form, labels: L, strings: S }) {
  const byId = Object.fromEntries(services.map((s) => [String(s.id), s]));
  const initialService = byId[String(form.service_id)] ? String(form.service_id) : services.length === 1 ? String(services[0].id) : '';

  const [serviceId, setServiceId] = useState(initialService);
  const [days, setDays] = useState([]);
  const [times, setTimes] = useState([]);
  const [date, setDate] = useState(form.date || '');
  const [time, setTime] = useState(form.time || '');
  const [label, setLabel] = useState('');
  const [dayLabel, setDayLabel] = useState('');
  const [showTime, setShowTime] = useState(false);
  const [revealed, setRevealed] = useState(false);
  const [meeting, setMeeting] = useState('');
  // The policy has to be read to the end (PolicyDialog) before it can be agreed to.
  const [agreed, setAgreed] = useState(false);
  const [policyRead, setPolicyRead] = useState(false);
  const [errors, setErrors] = useState({ name: '', phone: '', meeting: '', form: '' });
  const [serverError, setServerError] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [, startTransition] = useTransition();

  // Values the async loaders need without waiting for a re-render.
  const current = useRef({ date: form.date || '', time: form.time || '', revealed: false });
  const requestId = useRef(0);
  const refs = { time: useRef(null), contact: useRef(null), confirm: useRef(null), days: useRef(null), name: useRef(null) };

  const service = byId[serviceId] || null;
  const dayOnly = !!(service && service.dayOnly);
  const setError = (key, message) => setErrors((e) => ({ ...e, [key]: message || '' }));
  const scrollTo = (ref) => setTimeout(() => ref.current && ref.current.scrollIntoView({ behavior: 'smooth', block: 'start' }), 0);

  // Shows the contact and confirm steps once the day (and time) is chosen.
  function reveal(initial) {
    const firstReveal = !current.current.revealed;
    current.current.revealed = true;
    setRevealed(true);
    setError('form', '');
    if (firstReveal && (!initial || !refs.name.current.value)) scrollTo(refs.contact);
  }

  function chooseTime(value, initial) {
    current.current.time = value;
    setTime(value);
    reveal(initial);
  }

  async function selectDay(svc, value, keepTime) {
    current.current.date = value;
    setDate(value);
    if (!keepTime) {
      current.current.time = '';
      setTime('');
    }
    const id = ++requestId.current;
    setTimes([]);
    setDayLabel(S.loading);
    try {
      const res = await getJSON(`/api/slots?service=${svc.id}&date=${value}`);
      if (id !== requestId.current) return;
      setLabel(res.label);
      if (svc.dayOnly) {
        setDayLabel(res.label);
        reveal(keepTime);
        return;
      }
      setDayLabel(res.times.length ? res.label : `${res.label} — ${S.noTimes}`);
      setTimes(res.times);
      if (current.current.time && res.times.includes(current.current.time)) chooseTime(current.current.time, true);
      else {
        current.current.time = '';
        setTime('');
      }
    } catch {
      if (id === requestId.current) setDayLabel(S.errGeneric);
    }
  }

  async function loadDays(svc) {
    const id = ++requestId.current;
    setDays([]);
    setTimes([]);
    setDayLabel(S.loading);
    try {
      const res = await getJSON(`/api/days?service=${svc.id}`);
      if (id !== requestId.current) return;
      setDays(res.days);
      const wanted = current.current.date && res.days.find((d) => d.date === current.current.date && d.free > 0);
      const pick = wanted || res.days.find((d) => d.free > 0);
      if (!pick) {
        setDayLabel(svc.dayOnly ? S.noOpenDays : S.noDays);
        return;
      }
      // For a day-only service the day is the whole choice, so it is not picked for the customer.
      if (svc.dayOnly && !wanted) {
        current.current.date = '';
        setDate('');
        setDayLabel(S.dayOnlyHint);
        return;
      }
      selectDay(svc, pick.date, !!wanted);
    } catch {
      if (id === requestId.current) setDayLabel(S.errGeneric);
    }
  }

  function onServiceChange(id, initial) {
    const svc = byId[id];
    if (!svc) return;
    setServiceId(id);
    if (!initial) {
      current.current.date = '';
      current.current.time = '';
      setDate('');
      setTime('');
    }
    setShowTime(true);
    loadDays(svc);
    if (!initial) scrollTo(refs.time);
  }

  useEffect(() => {
    const onAgreed = () => {
      setPolicyRead(true);
      setAgreed(true);
      setError('form', '');
    };
    window.addEventListener('policy:agreed', onAgreed);
    return () => window.removeEventListener('policy:agreed', onAgreed);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (initialService) onServiceChange(initialService, true);
    // Re-enable the button when the user comes back with the browser's Back button.
    const onShow = () => setSubmitting(false);
    window.addEventListener('pageshow', onShow);
    return () => window.removeEventListener('pageshow', onShow);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Keep the chosen day in view in the horizontally scrolling day list.
  useEffect(() => {
    const list = refs.days.current;
    const btn = list && list.querySelector('.day.is-selected');
    if (btn) list.scrollLeft = btn.offsetLeft - list.clientWidth / 2 + btn.clientWidth / 2;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [date, days]);

  function onSubmit(e) {
    e.preventDefault();
    const formEl = e.currentTarget;
    const name = formEl.elements.name.value;
    const phone = formEl.elements.phone.value;
    const agree = formEl.elements.agree.checked;
    const problems = [];
    setError('form', '');
    const chosen = dayOnly ? current.current.date : current.current.time;
    if (!chosen) problems.push(['form', dayOnly ? S.errDay : S.errTime, refs.time]);
    if (name.trim().length < 2) problems.push(['name', S.errName, refs.contact]);
    if (!normalizePhone(phone)) problems.push(['phone', S.errPhone, refs.contact]);
    if (!meeting) problems.push(['meeting', S.errMeeting, refs.contact]);
    if (!agree && chosen) problems.push(['form', S.errAgree, refs.confirm]);
    if (problems.length) {
      problems.forEach(([key, message]) => setError(key, message));
      scrollTo(problems[0][2]);
      return;
    }
    setSubmitting(true);
    const data = new FormData(formEl);
    startTransition(async () => {
      const res = await submitBooking(data);
      if (!res || !res.error) return;
      setSubmitting(false);
      setServerError(res.error);
      window.scrollTo({ top: 0 });
      // Someone else just took this time (or the day was closed): pick another one.
      if ((res.code === 'slot_taken' || res.code === 'day_closed') && service) {
        current.current.time = '';
        current.current.revealed = false;
        setTime('');
        setRevealed(false);
        loadDays(service);
      }
    });
  }

  const submitText = service ? (service.amountDue > 0 ? S.submit : S.submitFree) : L['book.submit'];

  return (
    <>
      {serverError && (
        <div className="alert alert-error" role="alert">
          {serverError}
        </div>
      )}
      <noscript>
        <div className="alert alert-error">{L['book.noscript']}</div>
      </noscript>

      <form className="book-form" id="book-form" action={submitBooking} noValidate onSubmit={onSubmit}>
        <fieldset className="step" id="step-service">
          <legend>
            <span className="step-num">1</span>
            {L['book.step_service']}
          </legend>
          <div className="options">
            {services.map((s) => (
              <label key={s.id} className="option">
                <input
                  type="radio"
                  name="service_id"
                  value={s.id}
                  defaultChecked={String(s.id) === initialService}
                  onChange={() => onServiceChange(String(s.id), false)}
                />
                <span className="option-body">
                  <span className="option-title">{s.name}</span>
                  <span className="option-meta">{s.dayOnly ? S.dayOnly : S.duration.replace('{n}', s.duration)}</span>
                  <span className="option-price">{price(s.price)}</span>
                  {s.description && <span className="option-desc">{s.description}</span>}
                </span>
              </label>
            ))}
          </div>
        </fieldset>

        <fieldset className="step" id="step-time" hidden={!showTime} ref={refs.time}>
          <legend>
            <span className="step-num">2</span>
            {dayOnly ? S.stepDay : S.stepTime}
          </legend>
          <ScrollArea className="days" id="days" role="radiogroup" aria-label={dayOnly ? S.stepDay : S.stepTime} ref={refs.days}>
            {days.map((d) => {
              const on = d.date === date;
              return (
                <button
                  key={d.date}
                  type="button"
                  className={`day${on ? ' is-selected' : ''}`}
                  data-date={d.date}
                  role="radio"
                  aria-checked={on ? 'true' : 'false'}
                  disabled={d.closed || d.free === 0}
                  onClick={() => selectDay(service, d.date, false)}
                >
                  <span className="day-wd">{d.weekdayShort}</span>
                  <span className="day-num">{d.day}</span>
                  <span className="day-sub">{d.closed ? S.closed : d.free === 0 ? S.full : d.month}</span>
                </button>
              );
            })}
          </ScrollArea>
          <p className="day-label" id="day-label" aria-live="polite">
            {dayLabel}
          </p>
          <div className="times" id="times" role="radiogroup" aria-live="polite" hidden={dayOnly}>
            {times.map((value) => {
              const on = value === time;
              return (
                <button
                  key={value}
                  type="button"
                  className={`time${on ? ' is-selected' : ''}`}
                  data-time={value}
                  role="radio"
                  aria-checked={on ? 'true' : 'false'}
                  onClick={() => chooseTime(value, false)}
                >
                  {value}
                </button>
              );
            })}
          </div>
          <input type="hidden" name="date" id="f-date" value={date} />
          <input type="hidden" name="time" id="f-time" value={time} />
        </fieldset>

        <fieldset className="step" id="step-contact" hidden={!revealed} ref={refs.contact}>
          <legend>
            <span className="step-num">3</span>
            {L['book.step_contact']}
          </legend>
          <div className="field">
            <label htmlFor="f-name">{L['book.name']}</label>
            <input
              id="f-name"
              name="name"
              autoComplete="name"
              maxLength={80}
              placeholder={L['book.name_ph']}
              ref={refs.name}
              onInput={(e) => e.currentTarget.value.trim().length >= 2 && setError('name', '')}
            />
            <p className="field-error" id="name-error" hidden={!errors.name}>
              {errors.name}
            </p>
          </div>
          <div className="field">
            <label htmlFor="f-phone">{L['book.phone']}</label>
            <input
              id="f-phone"
              name="phone"
              type="tel"
              inputMode="numeric"
              autoComplete="tel"
              maxLength={16}
              placeholder={L['book.phone_ph']}
              aria-describedby="phone-hint"
              onBlur={(e) => e.currentTarget.value.trim() && setError('phone', normalizePhone(e.currentTarget.value) ? '' : S.errPhone)}
              onInput={(e) => normalizePhone(e.currentTarget.value) && setError('phone', '')}
            />
            <p className="hint" id="phone-hint">
              {L['book.phone_hint']}
            </p>
            <p className="field-error" id="phone-error" hidden={!errors.phone}>
              {errors.phone}
            </p>
          </div>
          <div className="field" role="radiogroup" aria-labelledby="meeting-label">
            <p className="field-label" id="meeting-label">
              {L['book.meeting']}
            </p>
            <div className="options meeting-options">
              {['in_person', 'online'].map((value) => (
                <label key={value} className="option">
                  <input
                    type="radio"
                    name="meeting"
                    value={value}
                    checked={meeting === value}
                    onChange={() => {
                      setMeeting(value);
                      setError('meeting', '');
                    }}
                  />
                  <span className="option-body">
                    <span className="option-title">{L[`book.meeting_${value}`]}</span>
                    <span className="option-desc">{L[`book.meeting_${value}_hint`]}</span>
                  </span>
                </label>
              ))}
            </div>
            <p className="field-error" id="meeting-error" hidden={!errors.meeting}>
              {errors.meeting}
            </p>
          </div>
          <div className="field">
            <label htmlFor="f-note">{L['book.note']}</label>
            <textarea id="f-note" name="note" rows={2} maxLength={500}></textarea>
          </div>
        </fieldset>

        <fieldset className="step" id="step-confirm" hidden={!revealed} ref={refs.confirm}>
          <legend>
            <span className="step-num">4</span>
            {L['book.step_confirm']}
          </legend>
          <dl className="summary">
            <div>
              <dt>{L['book.summary_service']}</dt>
              <dd id="sum-service">
                {!service ? '' : dayOnly ? service.name : `${service.name} · ${S.duration.replace('{n}', service.duration)}`}
              </dd>
            </div>
            <div>
              <dt>{dayOnly ? S.dayLabel : S.whenLabel}</dt>
              <dd id="sum-when">{!service ? '' : dayOnly ? (date ? label : '—') : time ? `${label}, ${time}` : '—'}</dd>
            </div>
            <div>
              <dt>{L['book.summary_meeting']}</dt>
              <dd id="sum-meeting">{meeting ? L[`book.meeting_${meeting}`] : '—'}</dd>
            </div>
            <div>
              <dt>{L['book.summary_price']}</dt>
              <dd id="sum-price">{service ? price(service.price) : ''}</dd>
            </div>
            <div className="summary-total">
              <dt>{L['book.summary_pay_now']}</dt>
              <dd id="sum-due">{service ? price(service.amountDue) : ''}</dd>
            </div>
          </dl>
          <p className="hint" id="sum-balance" hidden={!(service && service.amountDue < service.price)}>
            {L['book.summary_balance']}
          </p>
          <p className="hint">{L['book.hold_note']}</p>
          <div className="check">
            <input
              type="checkbox"
              id="f-agree"
              name="agree"
              value="1"
              checked={agreed}
              aria-describedby="agree-hint"
              onChange={(e) => {
                const on = e.currentTarget.checked;
                // Not read yet: open the policy instead of ticking the box.
                if (on && !policyRead) {
                  window.dispatchEvent(new CustomEvent('policy:open', { detail: { agree: true } }));
                  return;
                }
                setAgreed(on);
                if (on) setError('form', '');
              }}
            />
            <label htmlFor="f-agree">
              {L['book.agree']} ·{' '}
              <a href="/policy" data-policy="agree">
                {L['book.read_policy']}
              </a>
            </label>
          </div>
          <p className="hint" id="agree-hint" hidden={policyRead}>
            {L['book.agree_hint']}
          </p>
          <p className="field-error" id="form-error" role="alert" hidden={!errors.form}>
            {errors.form}
          </p>
          <button
            className={`btn btn-primary btn-block btn-lg${submitting ? ' is-loading' : ''}`}
            type="submit"
            id="submit-btn"
            disabled={submitting}
          >
            {submitText}
          </button>
        </fieldset>
      </form>
    </>
  );
}
