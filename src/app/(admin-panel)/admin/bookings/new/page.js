import { nowLocal, isValidDate } from '@/lib/time.js';
import { requireAdmin, adminMetadata, field } from '@/lib/admin.js';
import NewBookingForm from '../NewBookingForm.js';

export const dynamic = 'force-dynamic';

export function generateMetadata() {
  return adminMetadata('Захиалга нэмэх');
}

export default async function NewBookingPage({ searchParams }) {
  await requireAdmin();
  const query = await searchParams;
  const date = isValidDate(field(query.date)) ? field(query.date) : nowLocal().date;

  return (
    <>
      <p>
        <a href="/admin/bookings">← Захиалгын жагсаалт</a>
      </p>
      <h1>Гараар захиалга нэмэх</h1>
      <NewBookingForm date={date} />
    </>
  );
}
