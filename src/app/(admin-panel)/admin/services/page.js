import { db } from '@/db.js';
import { formatPrice } from '@/i18n/index.js';
import { requireAdmin, adminMetadata } from '@/lib/admin.js';
import ModalLink from '@/components/admin/ModalLink.js';
import ScrollArea from '@/components/ScrollArea.js';
import DeleteService from './DeleteService.js';
import ServiceForm from './ServiceForm.js';
import ServiceView from './ServiceView.js';
import { createService, updateService } from './actions.js';
import { upcomingCounts } from './upcoming.js';

export const dynamic = 'force-dynamic';

export function generateMetadata() {
  return adminMetadata('Үйлчилгээ');
}

export default async function ServicesPage() {
  await requireAdmin();
  const services = db().prepare('SELECT * FROM services WHERE deleted_at IS NULL ORDER BY active DESC, sort, id').all();
  const upcoming = upcomingCounts();
  // Keys that change on every render: after a save the dialogs start closed and fresh (ModalLink.js).
  const stamp = Date.now();
  return (
    <>
      <div className="a-head">
        <h1>Үйлчилгээ ба үнэ</h1>
        <div className="a-head-actions">
          <ModalLink
            key={stamp}
            className="a-btn a-btn-primary"
            href="/admin/services/new"
            title="Шинэ үйлчилгээ"
            content={<ServiceForm action={createService} form={{ active: 1, sort: '0' }} />}
          >
            + Үйлчилгээ нэмэх
          </ModalLink>
        </div>
      </div>

      <ScrollArea className="a-table-wrap">
        <table className="a-table">
          <thead>
            <tr>
              <th>Нэр</th>
              <th>Төрөл, хугацаа</th>
              <th>Үнэ</th>
              <th>Онлайн төлөх</th>
              <th>Төлөв</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {services.map((s) => (
              <tr key={s.id} className={s.active ? '' : 'is-muted'}>
                <td>
                  <strong>{s.name}</strong>
                </td>
                <td className="nowrap">
                  {s.kind === 'special' ? (
                    <>
                      <span className="badge badge-special">Тусгай</span> <small>зөвхөн өдөр</small>
                    </>
                  ) : (
                    `${s.duration_min} мин`
                  )}
                </td>
                <td>{formatPrice(s.price)}</td>
                <td>
                  {formatPrice(s.deposit ?? s.price)}
                  {s.deposit !== null && (
                    <>
                      {' '}
                      <small className="muted">(урьдчилгаа)</small>
                    </>
                  )}
                </td>
                <td>
                  <span className={`badge ${s.active ? 'badge-confirmed' : 'badge-muted'}`}>{s.active ? 'Идэвхтэй' : 'Нуусан'}</span>
                </td>
                <td>
                  <div className="row-actions">
                    <ModalLink
                      key={`view-${stamp}`}
                      className="a-btn a-btn-sm"
                      href={`/admin/services/${s.id}`}
                      title={s.name}
                      content={<ServiceView s={s} upcomingCount={upcoming[s.id] || 0} />}
                    >
                      Харах
                    </ModalLink>
                    <ModalLink
                      key={`edit-${stamp}`}
                      className="a-btn a-btn-sm"
                      href={`/admin/services/${s.id}`}
                      title="Үйлчилгээ засах"
                      content={<ServiceForm action={updateService.bind(null, s.id)} form={{ ...s, deposit: s.deposit ?? '' }} />}
                    >
                      Засах
                    </ModalLink>
                    <DeleteService s={s} upcomingCount={upcoming[s.id] || 0} />
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </ScrollArea>
      <p className="muted small">Устгасан үйлчилгээ сайтаас алга болох ч өмнөх захиалгууд хэвээр хадгалагдана. Түр нуух бол засах хэсгээс «Идэвхтэй»-н чагтыг авна.</p>
    </>
  );
}
