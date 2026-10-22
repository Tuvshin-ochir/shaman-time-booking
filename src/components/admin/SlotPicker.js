'use client';

import { useEffect, useRef, useState } from 'react';

// Date and time inputs with the free start times listed underneath; clicking
// one fills the time. Times come from /admin/api/slots for a service (the
// <select id={serviceSelect}> of the form) or for an existing booking.
// Special services (`dayOnlyServices`) and day-only bookings (`dayOnly`) take
// only a date: the time input is left out.
export default function SlotPicker({ date = '', time = '', bookingId, serviceSelect, dayOnly = false, dayOnlyServices = [] }) {
  const [day, setDay] = useState(date);
  const [chosen, setChosen] = useState(time);
  const [service, setService] = useState('');
  const [list, setList] = useState({ message: '', times: [] });
  const requestId = useRef(0);
  const wholeDay = dayOnly || dayOnlyServices.includes(service);

  useEffect(() => {
    if (!serviceSelect) return undefined;
    const select = document.getElementById(serviceSelect);
    const update = () => setService(select.value);
    update();
    select.addEventListener('change', update);
    return () => select.removeEventListener('change', update);
  }, [serviceSelect]);

  useEffect(() => {
    if (!day || (serviceSelect && !service)) {
      setList({ message: '', times: [] });
      return;
    }
    const params = new URLSearchParams({ date: day });
    if (bookingId) params.set('booking', bookingId);
    else if (service) params.set('service', service);
    const id = ++requestId.current;
    setList({ message: 'Сул цаг ачаалж байна…', times: [] });
    fetch(`/admin/api/slots?${params}`, { headers: { Accept: 'application/json' }, cache: 'no-store' })
      .then((res) => res.json())
      .then((data) => {
        if (id !== requestId.current) return;
        if (data.dayOnly && data.closed) setList({ message: 'Энэ өдөр амралтын өдөр (сайтаар захиалга авахгүй), гэхдээ эндээс бүртгэж болно.', times: [] });
        else if (data.dayOnly) setList({ message: 'Тусгай үйлчилгээ: зөвхөн өдөр сонгоно, цаг шаардлагагүй.', times: [] });
        else if (data.closed) setList({ message: 'Энэ өдөр амралтын өдөр. Шаардлагатай бол цагаа гараар оруулна уу.', times: [] });
        else if (!data.times.length) setList({ message: 'Энэ өдөр сул цаг алга. Шаардлагатай бол цагаа гараар оруулна уу.', times: [] });
        else setList({ message: 'Сул цагууд:', times: data.times });
      })
      .catch(() => id === requestId.current && setList({ message: '', times: [] }));
  }, [day, service, bookingId, serviceSelect]);

  return (
    <>
      <div className="a-row">
        <label>
          Өдөр <input type="date" name="date" value={day} onChange={(e) => setDay(e.target.value)} data-slot-date required />
        </label>
        {!wholeDay && (
          <label>
            Цаг <input type="time" name="time" value={chosen} onChange={(e) => setChosen(e.target.value)} data-slot-time required step="300" />
          </label>
        )}
      </div>
      <div className="slot-list" data-slot-list>
        {list.message && <p className="slot-hint">{list.message}</p>}
        {list.times.map((value) => (
          <button key={value} type="button" className={`slot${value === chosen ? ' is-selected' : ''}`} onClick={() => setChosen(value)}>
            {value}
          </button>
        ))}
      </div>
    </>
  );
}
