import fs from 'node:fs';
import path from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import config from './config.js';
import { shared } from './lib/shared.js';

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
  // Hours closed on one date (e.g. 14:00–16:00), next to whole-day holidays.
  `
  CREATE TABLE time_blocks (
    id         INTEGER PRIMARY KEY,
    date       TEXT NOT NULL,
    start_min  INTEGER NOT NULL,
    end_min    INTEGER NOT NULL,
    note       TEXT,
    created_at INTEGER NOT NULL
  );
  CREATE INDEX idx_time_blocks_date ON time_blocks(date);
  `,
  // News posts written in the admin; `body` is HTML cleaned by src/lib/rich-text.js.
  `
  CREATE TABLE news (
    id         INTEGER PRIMARY KEY,
    title      TEXT NOT NULL,
    body       TEXT NOT NULL,
    date       TEXT NOT NULL,           -- shown on the site, newest first
    image      TEXT,                    -- JSON { src, width, height, small, smallWidth } or NULL
    published  INTEGER NOT NULL DEFAULT 1,
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL
  );
  CREATE INDEX idx_news_date ON news(published, date);
  `,
  // Service type: 'regular' (customer picks a day and a time) or 'special'
  // (customer picks only a day; no duration). Bookings of special services are
  // day_only, with start_min = end_min = 0 so they never take up a time slot.
  `
  ALTER TABLE services ADD COLUMN kind TEXT NOT NULL DEFAULT 'regular';
  ALTER TABLE bookings ADD COLUMN day_only INTEGER NOT NULL DEFAULT 0;
  `,
];

// { db, path } of the open connection.
const conn = shared('db', () => ({ db: null, path: null }));

function migrate(database) {
  const current = database.prepare('PRAGMA user_version').get().user_version;
  for (let v = current; v < MIGRATIONS.length; v++) {
    database.exec('BEGIN');
    try {
      database.exec(MIGRATIONS[v]);
      database.exec(`PRAGMA user_version = ${v + 1}`);
      database.exec('COMMIT');
    } catch (err) {
      database.exec('ROLLBACK');
      throw err;
    }
  }
}

function init(dataDir = config.dataDir) {
  if (conn.db) return conn.db;
  fs.mkdirSync(dataDir, { recursive: true });
  const file = path.join(dataDir, 'app.db');
  const database = new DatabaseSync(file);
  database.exec('PRAGMA journal_mode = WAL');
  database.exec('PRAGMA foreign_keys = ON');
  database.exec('PRAGMA busy_timeout = 5000');
  migrate(database);
  conn.db = database;
  conn.path = file;
  return database;
}

// Opens the database on first use (DATA_DIR/app.db).
function db() {
  return conn.db || init();
}

// Runs fn inside BEGIN IMMEDIATE so concurrent writers (other processes too)
// are serialised. Nested calls join the outer transaction.
function tx(fn) {
  const database = db();
  if (database.isTransaction) return fn();
  database.exec('BEGIN IMMEDIATE');
  try {
    const result = fn();
    database.exec('COMMIT');
    return result;
  } catch (err) {
    if (database.isTransaction) database.exec('ROLLBACK');
    throw err;
  }
}

function close() {
  if (conn.db) conn.db.close();
  conn.db = null;
}

const dbPath = () => conn.path;

export { init, db, tx, close, dbPath };
