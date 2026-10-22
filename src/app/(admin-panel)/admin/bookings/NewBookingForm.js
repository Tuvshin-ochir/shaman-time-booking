import { db } from '@/db.js';
import { formatPrice } from '@/i18n/index.js';
import ActionForm from '@/components/admin/ActionForm.js';
import SlotPicker from '@/components/admin/SlotPicker.js';
import { createBooking } from './actions.js';

// Manual booking form: on its own page (/admin/bookings/new) and in the
// "+ Захиалга нэмэх" dialog of the dashboard and the booking list.
export default function NewBookingForm({ date }) {
  const services = db().prepare('SELECT * FROM services WHERE deleted_at IS NULL ORDER BY active DESC, sort, id').all();
  return (
    <>
      <p className="muted">Утсаар болон биечлэн ирсэн захиалгыг энд бүртгэнэ. Ажлын цагаас гадуур цаг ч сонгож болно.</p>

      <ActionForm action={createBooking} className="a-card a-form narrow" data-slot-picker data-service-select="service_id">
        <label>
          Үйлчилгээ
          <select name="service_id" id="service_id" required>
            {services.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name} ({s.kind === 'special' ? 'тусгай, зөвхөн өдөр' : `${s.duration_min} мин`}, {formatPrice(s.price)}){s.active ? '' : ' — идэвхгүй'}
              </option>
            ))}
          </select>
        </label>
        <SlotPicker date={date} serviceSelect="service_id" dayOnlyServices={services.filter((s) => s.kind === 'special').map((s) => String(s.id))} />
        <div className="a-row">
          <label>
            Нэр <input name="name" required maxLength={80} />
          </label>
          <label>
            Утас <input name="phone" type="tel" inputMode="numeric" required maxLength={16} placeholder="99112233" />
          </label>
        </div>
        <label>
          Тайлбар <input name="note" maxLength={500} />
        </label>
        <label>
          Урьдчилж төлсөн дүн (₮, заавал биш) <input name="paid_amount" inputMode="numeric" placeholder="0" />
        </label>
        <label className="a-check">
          <input type="checkbox" name="force" /> Давхцлыг үл тоох (тухайн цагт өөр захиалга байсан ч нэмэх)
        </label>
        <label className="a-check">
          <input type="checkbox" name="notify" defaultChecked /> Үйлчлүүлэгч, бөө хоёуланд SMS илгээх
        </label>
        <button className="a-btn a-btn-primary" type="submit">
          Захиалга нэмэх
        </button>
      </ActionForm>
    </>
  );
}
