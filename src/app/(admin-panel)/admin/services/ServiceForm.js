'use client';

import { useState } from 'react';
import ActionForm from '@/components/admin/ActionForm.js';

// [kind, title, explanation] — see slots.isSpecial()
const KINDS = [
  ['regular', 'Энгийн', 'Үйлчлүүлэгч өдөр, цагаа сонгоно. Үргэлжлэх хугацаагаар цаг эзэлнэ.'],
  ['special', 'Тусгай', 'Үйлчлүүлэгч зөвхөн өдрөө сонгоно, цаг сонгохгүй. Амралтын өдрөөс бусад ажлын өдөр бүрээс сонгож болно.'],
];

export default function ServiceForm({ action, form }) {
  const [kind, setKind] = useState(form.kind === 'special' ? 'special' : 'regular');
  return (
    <ActionForm action={action} className="a-card a-form narrow">
      <fieldset className="kind-picker">
        <legend>Төрөл</legend>
        {KINDS.map(([value, title, text]) => (
          <label key={value} className={`kind-option${kind === value ? ' is-selected' : ''}`}>
            <input type="radio" name="kind" value={value} checked={kind === value} onChange={() => setKind(value)} />
            <span>
              <strong>{title}</strong>
              <small>{text}</small>
            </span>
          </label>
        ))}
      </fieldset>
      {form.id && form.kind !== kind && (
        <p className="block-warn small">Төрөл солиход өмнө нь авсан захиалгууд хуучнаараа (цагтай эсвэл цаггүй) үлдэнэ.</p>
      )}
      <label>
        Нэр (монгол) <input name="name" defaultValue={form.name || ''} required maxLength={100} />
      </label>
      <label>
        Тайлбар (монгол) <textarea name="description" rows={3} maxLength={1000} defaultValue={form.description || ''}></textarea>
      </label>
      <div className="a-row">
        <label>
          Үнэ (₮) <input name="price" inputMode="numeric" defaultValue={form.price ?? ''} required />
        </label>
        <label>
          Онлайн урьдчилгаа (₮)
          <input name="deposit" inputMode="numeric" defaultValue={form.deposit ?? ''} placeholder="Хоосон = бүтэн үнэ" />
        </label>
      </div>
      <p className="muted small">Урьдчилгаа хоосон бол QPay-ээр бүтэн үнийг төлнө. 0 бол онлайн төлбөргүйгээр шууд баталгаажна.</p>
      <div className="a-row">
        {kind === 'regular' && (
          <label>
            Үргэлжлэх хугацаа (минут)
            <input type="number" name="duration_min" min="5" max="600" defaultValue={form.duration_min || 30} required />
          </label>
        )}
        <label>
          Эрэмбэ <input type="number" name="sort" defaultValue={form.sort ?? 0} />
        </label>
      </div>
      <label className="a-check">
        <input type="checkbox" name="active" defaultChecked={!!form.active} /> Идэвхтэй (сайтад харагдана)
      </label>
      <button className="a-btn a-btn-primary" type="submit">
        Хадгалах
      </button>
    </ActionForm>
  );
}
