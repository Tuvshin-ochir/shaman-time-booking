const { db } = require('./db');

// Example services so a fresh install has something to book. Edit or replace
// them from the admin panel (Үйлчилгээ).
const SAMPLE_SERVICES = [
  {
    name: 'Үзлэг',
    description: 'Хувь заяа, ажил амьдрал, гэр бүл, эрүүл мэндийн асуудлаар үзүүлж, зөвлөгөө авна.',
    price: 30000,
    deposit: null,
    duration_min: 30,
  },
  {
    name: 'Засал',
    description: 'Муу зүйлсээс ариусах, сэтгэл санааны тайвшрал авах засал.',
    price: 80000,
    deposit: 30000,
    duration_min: 60,
  },
  {
    name: 'Мялаалга',
    description: 'Шинэ гэр, унаа, ажил үйлсийг мялааж, ерөөл бэлэгдэл хийнэ.',
    price: 50000,
    deposit: 20000,
    duration_min: 60,
  },
];

// Runs once per database: a marker row stops the samples from coming back
// after the admin deletes them.
function seed() {
  if (db().prepare(`SELECT 1 FROM settings WHERE key = 'seeded'`).get()) return;
  if (db().prepare('SELECT COUNT(*) AS n FROM services').get().n === 0) {
    const insert = db().prepare(
      `INSERT INTO services (name, description, price, deposit, duration_min, active, sort, created_at)
       VALUES (?, ?, ?, ?, ?, 1, ?, ?)`
    );
    SAMPLE_SERVICES.forEach((s, i) =>
      insert.run(s.name, s.description, s.price, s.deposit, s.duration_min, i, Date.now())
    );
  }
  db().prepare(`INSERT INTO settings (key, value) VALUES ('seeded', 'true')`).run();
}

module.exports = { seed, SAMPLE_SERVICES };
