import { db } from '@/db.js';
import * as settings from '@/lib/settings.js';
import * as i18n from '@/i18n/index.js';
import { BLOCKING_SQL } from '@/lib/slots.js';
import { nowLocal, addDays, fromMin } from '@/lib/time.js';
import { requireAdmin, adminMetadata } from '@/lib/admin.js';
import ActionForm from '@/components/admin/ActionForm.js';
import { saveSchedule, addHoliday, deleteHoliday, addTimeBlock, deleteTimeBlock } from './actions.js';

export const dynamic = 'force-dynamic';

export function generateMetadata() {
  return adminMetadata('Хуваарь');
}

const WEEK_ORDER = [1, 2, 3, 4, 5, 6, 0];
const RULES = [
  ['slot_minutes', 'Цагийн алхам', 'мин', 5, 240, 'Цагуудын зай. 30 → 09:00, 09:30'],
  ['lead_minutes', 'Урьдчилах хугацаа', 'мин', 0, 10080, 'Одооноос хойш хамгийн багадаа'],
  ['window_days', 'Захиалах хугацаа', 'хоног', 1, 365, 'Хэдэн хоногийн өмнөөс захиалах'],
  ['hold_minutes', 'Төлбөр хүлээх', 'мин', 5, 60, 'Төлөөгүй бол цаг суллагдана'],
  ['capacity', 'Зэрэг үйлчлэх', 'хүн', 1, 50, '1 = давхар захиалга авахгүй'],
];

export default async function SchedulePage() {
  await requireAdmin();
  const schedule = settings.get('schedule');
  const names = i18n.DAY_NAMES;
  const today = nowLocal().date;
  const holidays = db().prepare('SELECT * FROM holidays WHERE date >= ? ORDER BY date').all(addDays(today, -30));
  // Bookings made before the hours were closed stay; the list points them out.
  const blocks = db()
    .prepare(
      `SELECT t.*, (SELECT COUNT(*) FROM bookings b
                    WHERE b.date = t.date AND b.start_min < t.end_min AND b.end_min > t.start_min AND ${BLOCKING_SQL}) AS bookings
       FROM time_blocks t WHERE t.date >= ? ORDER BY t.date, t.start_min`
    )
    .all(Date.now(), addDays(today, -30));

  return (
    <>
      <h1>Цагийн хуваарь</h1>

      <ActionForm action={saveSchedule} className="a-card a-form">
        <h2>Долоо хоногийн ажлын цаг</h2>
        <div className="week">
          <div className="week-head" aria-hidden="true">
            <span>Өдөр</span>
            <span>Нээх</span>
            <span>Хаах</span>
            <span>Цайны цаг</span>
          </div>
          {WEEK_ORDER.map((wd) => {
            const d = schedule.weekly[wd];
            return (
              <div key={wd} className="week-row">
                <label className="a-check week-day">
                  <input type="checkbox" name={`open_${wd}`} defaultChecked={d.open} /> {names[wd]}
                </label>
                <input type="time" name={`start_${wd}`} defaultValue={d.start} aria-label={`${names[wd]} нээх`} step="300" />
                <input type="time" name={`end_${wd}`} defaultValue={d.end} aria-label={`${names[wd]} хаах`} step="300" />
                <span className="week-break">
                  <input type="time" name={`break_start_${wd}`} defaultValue={d.break_start} aria-label={`${names[wd]} цайны цаг эхлэх`} step="300" />
                  <span>–</span>
                  <input type="time" name={`break_end_${wd}`} defaultValue={d.break_end} aria-label={`${names[wd]} цайны цаг дуусах`} step="300" />
                </span>
              </div>
            );
          })}
        </div>
        <p className="muted small">Цайны цаггүй бол хоосон үлдээнэ.</p>

        <h2>Захиалгын дүрэм</h2>
        <div className="rules">
          {RULES.map(([name, label, unit, min, max, hint]) => (
            <label key={name} className="rule">
              <span className="rule-label">{label}</span>
              <span className="unit-input">
                <input type="number" name={name} min={min} max={max} defaultValue={schedule[name]} required />
                <span className="unit" aria-hidden="true">
                  {unit}
                </span>
              </span>
              <small>{hint}</small>
            </label>
          ))}
        </div>
        <button className="a-btn a-btn-primary" type="submit">
          Хадгалах
        </button>
      </ActionForm>

      <section className="a-card">
        <h2>Амралтын өдрүүд</h2>
        <p className="muted small">Эдгээр өдөр онлайн захиалга авахгүй. Олон хоног бол «хүртэл» огноог оруулна (жишээ: Цагаан сар, Наадам).</p>
        <form action={addHoliday} className="a-form a-inline">
          <label>
            Эхлэх <input type="date" name="date_from" min={today} required />
          </label>
          <label>
            Хүртэл <input type="date" name="date_to" min={today} />
          </label>
          <label className="grow">
            Тайлбар <input name="note" maxLength={100} placeholder="Жишээ: Наадам" />
          </label>
          <button className="a-btn a-btn-primary" type="submit">
            Нэмэх
          </button>
        </form>

        {holidays.length ? (
          <ul className="holiday-list">
            {holidays.map((h) => (
              <li key={h.date} className={h.date < today ? 'is-past' : ''}>
                <span>
                  <strong>{i18n.formatDate(h.date)}</strong>
                  {h.note ? ` · ${h.note}` : ''}
                </span>
                <ActionForm
                  action={deleteHoliday.bind(null, h.date)}
                  confirm={`${i18n.formatDate(h.date)}-ийг амралтын өдрөөс хасах уу? Тэр өдөр онлайн захиалга авч эхэлнэ.`}
                  confirmLabel="Хасах"
                  confirmDanger
                >
                  <button className="a-link a-link-danger" type="submit">
                    Устгах
                  </button>
                </ActionForm>
              </li>
            ))}
          </ul>
        ) : (
          <p className="a-empty">Амралтын өдөр бүртгэгдээгүй.</p>
        )}
      </section>

      <section className="a-card" id="blocks">
        <h2>Цаг хаах</h2>
        <p className="muted small">
          Тухайн өдрийн сонгосон цагт онлайн захиалга авахгүй (жишээ: гадуур ажилтай, 14:00–16:00). Өдрийн бусад цаг нээлттэй хэвээр. Өмнө нь орсон захиалга
          цуцлагдахгүй.
        </p>
        <ActionForm action={addTimeBlock} className="a-form a-inline">
          <label>
            Өдөр <input type="date" name="date" min={today} required />
          </label>
          <label>
            Эхлэх <input type="time" name="start" step="300" required />
          </label>
          <label>
            Дуусах <input type="time" name="end" step="300" required />
          </label>
          <label className="grow">
            Тайлбар <input name="note" maxLength={100} placeholder="Жишээ: Гадуур ажилтай" />
          </label>
          <button className="a-btn a-btn-primary" type="submit">
            Хаах
          </button>
        </ActionForm>

        {blocks.length ? (
          <ul className="holiday-list">
            {blocks.map((b) => (
              <li key={b.id} className={b.date < today ? 'is-past' : ''}>
                <span>
                  <strong>{i18n.formatDate(b.date)}</strong> · {fromMin(b.start_min)}–{fromMin(b.end_min)}
                  {b.note ? ` · ${b.note}` : ''}
                  {b.bookings > 0 && (
                    <>
                      {' · '}
                      <a className="block-warn" href={`/admin/bookings?view=date&date=${b.date}`}>
                        энэ хугацаанд {b.bookings} захиалга байна
                      </a>
                    </>
                  )}
                </span>
                <ActionForm
                  action={deleteTimeBlock.bind(null, b.id)}
                  confirm={`${i18n.formatDate(b.date)}, ${fromMin(b.start_min)}–${fromMin(b.end_min)} цагийг нээх үү? Энэ хугацаанд дахин онлайн захиалга авна.`}
                  confirmLabel="Нээх"
                >
                  <button className="a-link a-link-danger" type="submit">
                    Нээх
                  </button>
                </ActionForm>
              </li>
            ))}
          </ul>
        ) : (
          <p className="a-empty">Хаасан цаг алга.</p>
        )}
      </section>
    </>
  );
}
