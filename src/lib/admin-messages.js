// Admin flash messages (?ok=... / ?err=...) and labels. No server imports, so
// client components can use them too.
export const MESSAGES = {
  saved: 'Хадгаллаа.',
  created: 'Захиалга нэмэгдлээ.',
  cancelled: 'Захиалгыг цуцаллаа.',
  rescheduled: 'Цагийг шилжүүллээ.',
  refunded: 'Буцаалт хийгдсэн гэж тэмдэглэлээ.',
  payment: 'Төлбөр бүртгэлээ.',
  note: 'Тэмдэглэл хадгаллаа.',
  sms: 'SMS илгээлээ. Үр дүнг доорх SMS түүхээс харна уу.',
  password: 'Нууц үг солигдлоо.',
  holiday: 'Амралтын өдөр нэмэгдлээ.',
  holiday_deleted: 'Амралтын өдрийг устгалаа.',
  block: 'Цаг хаагдлаа. Энэ хугацаанд онлайн захиалга авахгүй.',
  block_deleted: 'Хаасан цагийг нээлээ.',
  image: 'Зураг шинэчлэгдлээ. Сайт дээр шууд харагдана.',
  news_saved: 'Мэдээ хадгалагдлаа.',
  news_deleted: 'Мэдээг устгалаа.',
  service_deleted: 'Үйлчилгээг устгалаа. Өмнөх захиалгууд хэвээр хадгалагдана.',
};

export const ERRORS = {
  name: 'Нэрээ оруулна уу (2-оос дээш тэмдэгт).',
  phone: 'Утасны дугаар буруу байна (8 оронтой гар утас).',
  date: 'Огноо буруу байна.',
  time: 'Цаг буруу байна.',
  service: 'Үйлчилгээ олдсонгүй.',
  slot_taken: 'Энэ цаг өөр захиалгатай давхцаж байна. Өөр цаг сонгох эсвэл «Давхцлыг үл тоох»-г чагтална уу.',
  day_closed: 'Энэ өдөр захиалга авахгүй.',
  not_active: 'Энэ захиалга идэвхгүй (цуцлагдсан эсвэл хугацаа дууссан) байна.',
  not_found: 'Олдсонгүй.',
  amount: 'Дүн буруу байна.',
  sms_kind: 'SMS-ийн төрөл буруу.',
};

export const STATUS_LABELS = {
  pending: 'Төлбөр хүлээгдэж буй',
  confirmed: 'Баталгаажсан',
  cancelled: 'Цуцалсан',
  expired: 'Хугацаа дууссан',
};

export const EVENT_LABELS = {
  created: 'Үүссэн',
  invoice_created: 'Нэхэмжлэх үүссэн',
  invoice_failed: 'Нэхэмжлэх үүсгэж чадсангүй',
  confirmed: 'Баталгаажсан',
  expired: 'Хугацаа дууссан',
  cancelled: 'Цуцалсан',
  rescheduled: 'Цаг шилжүүлсэн',
  refund_needed: 'Буцаалт шаардлагатай',
  refunded: 'Буцаалт хийгдсэн',
  manual_payment: 'Гараар төлбөр бүртгэсэн',
  partial_payment: 'Дутуу төлбөр',
  note: 'Тэмдэглэл зассан',
};
