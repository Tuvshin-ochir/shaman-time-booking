import ActionForm from '@/components/admin/ActionForm.js';
import { deleteService } from './actions.js';

export default function DeleteService({ s, upcomingCount, label = 'Устгах' }) {
  const confirmText = upcomingCount
    ? `«${s.name}» үйлчилгээнд ирээдүйн ${upcomingCount} захиалга байна. Захиалгууд хэвээр үлдэх ч шинээр захиалах боломжгүй болно. Устгах уу?`
    : `«${s.name}» үйлчилгээг устгах уу?`;
  return (
    <ActionForm action={deleteService.bind(null, s.id)} className="inline-form" confirm={confirmText} confirmLabel="Устгах" confirmDanger>
      <button className="a-btn a-btn-sm a-btn-danger-ghost" type="submit">
        {label}
      </button>
    </ActionForm>
  );
}
