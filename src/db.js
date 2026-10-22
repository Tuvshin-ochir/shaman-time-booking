const fs = require('node:fs');
const path = require('node:path');
const { DatabaseSync } = require('node:sqlite');

// Each entry runs once; PRAGMA user_version records how many have been applied.
const MIGRATIONS = [
  `
  CREATE TABLE services (
    id             INTEGER PRIMARY KEY,
    name           TEXT NOT NULL,
    name_en        TEXT,
    description    TEXT,
    description_en TEXT,
    price          INTEGER NOT NULL,           -- MNT, full price
    deposit        INTEGER,                    -- paid online; NULL = full price
    duration_min   INTEGER NOT NULL,
    active         INTEGER NOT NULL DEFAULT 1,
    sort           INTEGER NOT NULL DEFAULT 0,
    created_at     INTEGER NOT NULL
  );

  CREATE TABLE bookings (
    id              INTEGER PRIMARY KEY,
    code            TEXT NOT NULL UNIQUE,      -- short code customers can read out
    token           TEXT NOT NULL UNIQUE,      -- secret used in public URLs
    service_id      INTEGER NOT NULL REFERENCES services(id),
    service_name    TEXT NOT NULL,             -- snapshot at booking time
    price           INTEGER NOT NULL,
    amount_due      INTEGER NOT NULL,          -- what the customer pays online
    date            TEXT NOT NULL,             -- YYYY-MM-DD, Ulaanbaatar time
    start_min       INTEGER NOT NULL,          -- minutes after midnight
    end_min         INTEGER NOT NULL,
    customer_name   TEXT NOT NULL,
    phone           TEXT NOT NULL,
    note            TEXT,
    admin_note      TEXT,
    status          TEXT NOT NULL,             -- pending | confirmed | cancelled | expired
    source          TEXT NOT NULL DEFAULT 'web',
    hold_expires_at INTEGER,                   -- epoch ms, only meaningful while pending
    paid_amount     INTEGER NOT NULL DEFAULT 0,
    paid_at         INTEGER,
    confirmed_at    INTEGER,
    refund_status   TEXT,                      -- NULL | pending | done
    cancel_reason   TEXT,
    cancelled_at    INTEGER,
    reminder_sent_at INTEGER,
    lang            TEXT NOT NULL DEFAULT 'mn',
    ip              TEXT,
    created_at      INTEGER NOT NULL,
    updated_at      INTEGER NOT NULL
  );
  CREATE INDEX idx_bookings_date ON bookings(date, status);
  CREATE INDEX idx_bookings_phone ON bookings(phone, status);
  CREATE INDEX idx_bookings_status ON bookings(status, hold_expires_at);

  CREATE TABLE payments (
    id                  INTEGER PRIMARY KEY,
    booking_id          INTEGER NOT NULL REFERENCES bookings(id),
    provider            TEXT NOT NULL,         -- qpay | mock | manual
    invoice_id          TEXT,
    sender_invoice_no   TEXT UNIQUE,
    amount              INTEGER NOT NULL,
    status              TEXT NOT NULL,         -- created | paid | cancelled | failed
    provider_payment_id TEXT,
    qr_image            TEXT,
    qr_text             TEXT,
    short_url           TEXT,
    deeplinks           TEXT,                  -- JSON array from QPay
    raw                 TEXT,                  -- last provider response, JSON
    note                TEXT,
    created_at          INTEGER NOT NULL,
    paid_at             INTEGER,
    updated_at          INTEGER NOT NULL
  );
  CREATE INDEX idx_payments_booking ON payments(booking_id);
  CREATE INDEX idx_payments_invoice ON payments(invoice_id);

  CREATE TABLE holidays (
    date TEXT PRIMARY KEY,
    note TEXT
  );

  CREATE TABLE settings (
    key   TEXT PRIMARY KEY,
    value TEXT NOT NULL
  );

  CREATE TABLE sms_log (
    id                INTEGER PRIMARY KEY,
    booking_id        INTEGER,
    kind              TEXT NOT NULL,
    to_phone          TEXT NOT NULL,
    body              TEXT NOT NULL,
    status            TEXT NOT NULL,           -- sent | failed
    provider_response TEXT,
    created_at        INTEGER NOT NULL
  );
  CREATE INDEX idx_sms_booking ON sms_log(booking_id);

  CREATE TABLE booking_events (
    id         INTEGER PRIMARY KEY,
    booking_id INTEGER NOT NULL,
    type       TEXT NOT NULL,
    detail     TEXT,
    actor      TEXT,
    created_at INTEGER NOT NULL
  );
  CREATE INDEX idx_events_booking ON booking_events(booking_id);

  CREATE TABLE admins (
    id            INTEGER PRIMARY KEY,
    username      TEXT NOT NULL UNIQUE,
    password_hash TEXT NOT NULL,
    created_at    INTEGER NOT NULL,
    last_login_at INTEGER
  );
  `,
  // Services with past bookings are hidden instead of deleted so booking history stays intact.
  `ALTER TABLE services ADD COLUMN deleted_at INTEGER;`,
];

let instance = null;
let instancePath = null;

function migrate(db) {
  const current = db.prepare('PRAGMA user_version').get().user_version;
  for (let v = current; v < MIGRATIONS.length; v++) {
    db.exec('BEGIN');
    try {
      db.exec(MIGRATIONS[v]);
      db.exec(`PRAGMA user_version = ${v + 1}`);
      db.exec('COMMIT');
    } catch (err) {
      db.exec('ROLLBACK');
      throw err;
    }
  }
}

function init(dataDir) {
  if (instance) return instance;
  fs.mkdirSync(dataDir, { recursive: true });
  instancePath = path.join(dataDir, 'app.db');
  instance = new DatabaseSync(instancePath);
  instance.exec('PRAGMA journal_mode = WAL');
  instance.exec('PRAGMA foreign_keys = ON');
  instance.exec('PRAGMA busy_timeout = 5000');
  migrate(instance);
  return instance;
}

function db() {
  if (!instance) throw new Error('Database is not initialised');
  return instance;
}

// Runs fn inside BEGIN IMMEDIATE so concurrent writers (other processes too)
// are serialised. Nested calls join the outer transaction.
function tx(fn) {
  const conn = db();
  if (conn.isTransaction) return fn();
  conn.exec('BEGIN IMMEDIATE');
  try {
    const result = fn();
    conn.exec('COMMIT');
    return result;
  } catch (err) {
    if (conn.isTransaction) conn.exec('ROLLBACK');
    throw err;
  }
}

function close() {
  if (instance) instance.close();
  instance = null;
}

module.exports = { init, db, tx, close, dbPath: () => instancePath };
