import { formatPrice } from '@/i18n/index.js';

// Read-only details of a service (the "Харах" dialog of the services list).
export default function ServiceView({ s, upcomingCount }) {
  let online = `${formatPrice(s.price)} (бүтэн үнэ)`;
  if (s.deposit === 0) online = 'Онлайн төлбөргүй, шууд баталгаажна';
  else if (s.deposit !== null) online = `${formatPrice(s.deposit)} урьдчилгаа, үлдэгдлийг газар дээр нь`;
  return (
    <dl className="a-dl a-view">
      <dt>Нэр</dt>
      <dd>
        <strong>{s.name}</strong>
      </dd>
      <dt>Тайлбар</dt>
      <dd className="pre-line">{s.description || <span className="muted">—</span>}</dd>
      <dt>Төрөл</dt>
      <dd>
        {s.kind === 'special' ? (
          <>
            <span className="badge badge-special">Тусгай</span> Үйлчлүүлэгч зөвхөн өдөр сонгоно, цаг сонгохгүй
          </>
        ) : (
          'Энгийн — өдөр, цаг сонгоно'
        )}
      </dd>
      {s.kind !== 'special' && (
        <>
          <dt>Хугацаа</dt>
          <dd>{s.duration_min} минут</dd>
        </>
      )}
      <dt>Үнэ</dt>
      <dd>{formatPrice(s.price)}</dd>
      <dt>Онлайн төлөх</dt>
      <dd>{online}</dd>
      <dt>Төлөв</dt>
      <dd>
        <span className={`badge ${s.active ? 'badge-confirmed' : 'badge-muted'}`}>{s.active ? 'Идэвхтэй, сайтад харагдана' : 'Нуусан'}</span>
      </dd>
      <dt>Эрэмбэ</dt>
      <dd>{s.sort}</dd>
      <dt>Ирээдүйн захиалга</dt>
      <dd>{upcomingCount}</dd>
    </dl>
  );
}
