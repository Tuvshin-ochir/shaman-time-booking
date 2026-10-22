import { notFound } from 'next/navigation';
import * as bookings from '@/lib/bookings.js';
import { requireAdmin, adminMetadata } from '@/lib/admin.js';
import ServiceForm from '../ServiceForm.js';
import DeleteService from '../DeleteService.js';
import { upcomingCounts } from '../upcoming.js';
import { updateService } from '../actions.js';

export const dynamic = 'force-dynamic';

export async function generateMetadata({ params }) {
  const service = bookings.getService((await params).id, { activeOnly: false });
  return adminMetadata(service ? service.name : 'Олдсонгүй');
}

export default async function EditServicePage({ params }) {
  await requireAdmin();
  const service = bookings.getService((await params).id, { activeOnly: false });
  if (!service) notFound();
  const upcoming = upcomingCounts()[service.id] || 0;
  return (
    <>
      <p>
        <a href="/admin/services">← Үйлчилгээ</a>
      </p>
      <h1>Үйлчилгээ засах</h1>
      <ServiceForm action={updateService.bind(null, service.id)} form={{ ...service, deposit: service.deposit ?? '' }} />

      <section className="a-card narrow danger-zone">
        <h2>Үйлчилгээг устгах</h2>
        <p className="small muted">
          Сайтаас бүрмөсөн хасагдана. Өмнөх болон ирээдүйн захиалгууд хэвээр үлдэнэ.
          {upcoming > 0 && (
            <>
              {' '}
              Одоогоор <strong>{upcoming}</strong> ирээдүйн захиалгатай.
            </>
          )}
        </p>
        <DeleteService s={service} upcomingCount={upcoming} label="Үйлчилгээг устгах" />
      </section>
    </>
  );
}
