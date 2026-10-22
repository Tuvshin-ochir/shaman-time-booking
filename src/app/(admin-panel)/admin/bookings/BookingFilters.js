'use client';

import { useState } from 'react';

const VIEWS = [
  ['today', 'Өнөөдөр'],
  ['upcoming', 'Өнөөдрөөс хойш'],
  ['past', 'Өнгөрсөн'],
  ['date', 'Тодорхой өдөр'],
  ['all', 'Бүх хугацаа'],
];
const STATUSES = [
  ['active', 'Идэвхтэй (баталгаажсан + хүлээгдэж буй)'],
  ['confirmed', 'Баталгаажсан'],
  ['paid', 'Төлсөн'],
  ['pending', 'Төлбөр хүлээгдэж буй'],
  ['cancelled', 'Цуцалсан'],
  ['expired', 'Хугацаа дууссан'],
  ['refund', 'Буцаалт хийх'],
  ['all', 'Бүгд'],
];

// The date field only shows for "Тодорхой өдөр".
export default function BookingFilters({ filters }) {
  const [view, setView] = useState(filters.view);
  return (
    <form className="filters" method="get" action="/admin/bookings">
      <label>
        Хугацаа
        <select name="view" data-toggle-date value={view} onChange={(e) => setView(e.target.value)}>
          {VIEWS.map(([v, l]) => (
            <option key={v} value={v}>
              {l}
            </option>
          ))}
        </select>
      </label>
      <label data-date-field hidden={view !== 'date'}>
        Өдөр
        <input type="date" name="date" defaultValue={filters.date} />
      </label>
      <label>
        Төлөв
        <select name="status" defaultValue={filters.status}>
          {STATUSES.map(([v, l]) => (
            <option key={v} value={v}>
              {l}
            </option>
          ))}
        </select>
      </label>
      <label className="grow">
        Хайх
        <input type="search" name="q" defaultValue={filters.q} placeholder="Нэр, утас, код" />
      </label>
      <button className="a-btn a-btn-primary" type="submit">
        Шүүх
      </button>
    </form>
  );
}
