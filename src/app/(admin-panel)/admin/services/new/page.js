import { requireAdmin, adminMetadata } from '@/lib/admin.js';
import ServiceForm from '../ServiceForm.js';
import { createService } from '../actions.js';

export const dynamic = 'force-dynamic';

export function generateMetadata() {
  return adminMetadata('Шинэ үйлчилгээ');
}

export default async function NewServicePage() {
  await requireAdmin();
  return (
    <>
      <p>
        <a href="/admin/services">← Үйлчилгээ</a>
      </p>
      <h1>Шинэ үйлчилгээ</h1>
      <ServiceForm action={createService} form={{ active: 1, sort: '0' }} />
    </>
  );
}
