import config from '@/config.js';
import * as settings from '@/lib/settings.js';
import { requireAdmin, adminMetadata } from '@/lib/admin.js';
import ActionForm from '@/components/admin/ActionForm.js';
import { saveBusiness, saveContent, saveSms, sendTestSms, changePassword } from './actions.js';

export const dynamic = 'force-dynamic';

export function generateMetadata() {
  return adminMetadata('Тохиргоо');
}

const TEMPLATES = [
  ['customer_confirm', 'Үйлчлүүлэгчид — баталгаажсан'],
  ['staff_new', 'Бөөд — шинэ захиалга'],
  ['reminder', 'Үйлчлүүлэгчид — сануулга'],
  ['reschedule', 'Үйлчлүүлэгчид — цаг шилжсэн'],
  ['cancel', 'Үйлчлүүлэгчид — цуцлагдсан'],
];

export default async function SettingsPage() {
  await requireAdmin();
  const business = settings.get('business');
  const content = settings.get('content');
  const smsSettings = settings.get('sms');

  return (
    <>
      <h1>Тохиргоо</h1>
      <nav className="quick-filters">
        <a href="#business">Байгууллага</a>
        <a href="#content">Сайтын текст</a>
        <a href="#sms">SMS</a>
        <a href="#password">Нууц үг</a>
        <a href="#system">Систем, нөөц</a>
      </nav>

      <ActionForm action={saveBusiness} className="a-card a-form" id="business">
        <h2>Байгууллагын мэдээлэл</h2>
        <label>
          Нэр <input name="name" defaultValue={business.name} required maxLength={100} />
        </label>
        <label>
          Уриа / товч тайлбар <input name="tagline" defaultValue={business.tagline} maxLength={200} />
        </label>
        <p className="muted small">Уриа нь Facebook-д линк хуваалцахад гарах тайлбар болно.</p>
        <div className="a-row">
          <label>
            Холбоо барих утас <input name="phone" defaultValue={business.phone} maxLength={40} />
          </label>
          <label>
            И-мэйл <input name="email" type="email" defaultValue={business.email} maxLength={100} />
          </label>
        </div>
        <label>
          Хаяг <input name="address" defaultValue={business.address} maxLength={300} />
        </label>
        <div className="a-row">
          <label>
            Газрын зургийн холбоос (Google Maps г.м) <input name="map_url" type="url" defaultValue={business.map_url} placeholder="https://maps.app.goo.gl/..." />
          </label>
          <label>
            Facebook хуудас <input name="facebook_url" type="url" defaultValue={business.facebook_url} placeholder="https://facebook.com/..." />
          </label>
        </div>
        <button className="a-btn a-btn-primary" type="submit">
          Хадгалах
        </button>
      </ActionForm>

      <ActionForm action={saveContent} className="a-card a-form" id="content">
        <h2>Сайтын текст</h2>
        <p className="muted small">
          Нүүр хуудасны бүх текст, зураг болон цуцлах нөхцөлийг <a href="/admin/landing">Нүүр хуудас</a> цэснээс засна. Догол мөр тусгаарлахдаа хоосон мөр үлдээнэ.
        </p>
        <label>
          Бидний тухай <textarea name="about_mn" rows={8} defaultValue={content.about_mn}></textarea>
        </label>
        <button className="a-btn a-btn-primary" type="submit">
          Хадгалах
        </button>
      </ActionForm>

      <ActionForm action={saveSms} className="a-card a-form" id="sms">
        <h2>SMS</h2>
        <label>
          Бөөгийн утас (шинэ захиалга бүрт SMS очно)
          <input name="staff_phones" defaultValue={smsSettings.staff_phones} placeholder="99112233, 88112233" />
          <small>Олон дугаар бол таслалаар тусгаарлана.</small>
        </label>
        <label className="a-check">
          <input type="checkbox" name="reminders" defaultChecked={smsSettings.reminders} /> Захиалгын цагаас 1 өдрийн өмнө сануулга илгээх
        </label>
        <label className="a-check">
          <input type="checkbox" name="transliterate" defaultChecked={smsSettings.transliterate} /> Кирилл үсгийг латинаар илгээх (SMS хямд, бүх утсанд зөв харагдана)
        </label>

        <h3>SMS загвар</h3>
        <p className="muted small">Орлуулагдах үгс: {'{business} {name} {phone} {date} {time} {service} {address} {contact} {code}'}</p>
        {TEMPLATES.map(([key, label]) => (
          <label key={key}>
            {label} <textarea name={`tpl_${key}`} rows={2} maxLength={500} defaultValue={smsSettings.templates[key]}></textarea>
          </label>
        ))}
        <button className="a-btn a-btn-primary" type="submit">
          Хадгалах
        </button>
      </ActionForm>

      <form action={sendTestSms} className="a-card a-form a-inline">
        <label className="grow">
          Туршилтын SMS илгээх дугаар <input name="phone" type="tel" inputMode="numeric" placeholder="99112233" required />
        </label>
        <button className="a-btn" type="submit">
          Туршилт илгээх
        </button>
      </form>

      <ActionForm action={changePassword} className="a-card a-form narrow" id="password">
        <h2>Нууц үг солих</h2>
        <label>
          Одоогийн нууц үг <input type="password" name="current" autoComplete="current-password" required />
        </label>
        <label>
          Шинэ нууц үг (10+ тэмдэгт) <input type="password" name="new_password" autoComplete="new-password" minLength={10} required />
        </label>
        <label>
          Шинэ нууц үг давтах <input type="password" name="confirm" autoComplete="new-password" minLength={10} required />
        </label>
        <button className="a-btn a-btn-primary" type="submit">
          Солих
        </button>
      </ActionForm>

      <section className="a-card" id="system">
        <h2>Систем, нөөц хуулбар</h2>
        <dl className="a-dl">
          <dt>Сайтын хаяг</dt>
          <dd>{config.baseUrl}</dd>
          <dt>QPay горим</dt>
          <dd>{config.qpay.mode}</dd>
          <dt>SMS</dt>
          <dd>
            {config.sms.provider}
            {config.sms.sender ? ` · илгээгч: ${config.sms.sender}` : ''}
          </dd>
          <dt>Өгөгдлийн хавтас</dt>
          <dd className="mono small">{config.dataDir}</dd>
          <dt>Автомат нөөц</dt>
          <dd>Өдөр бүр, сүүлийн {config.backupKeep} хоногийнх хадгалагдана (data/backups)</dd>
        </dl>
        <p className="muted small">QPay, SMS-ийн нууц түлхүүрүүдийг серверийн .env файлд тохируулна (docs/QPAY_SETUP.md, docs/SMS_SETUP.md).</p>
        <a className="a-btn" href="/admin/backup">
          Өгөгдлийн сангийн хуулбар татах
        </a>
      </section>
    </>
  );
}
