// Isolated environment for each test file (node --test runs files in separate processes).
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

process.env.NODE_ENV = 'test';
process.env.QPAY_MODE = 'mock';
process.env.SMS_PROVIDER = 'console';
process.env.ADMIN_USERNAME = 'admin';
process.env.ADMIN_PASSWORD = 'test-password-123';
process.env.DATA_DIR = fs.mkdtempSync(path.join(os.tmpdir(), 'booking-test-'));

// Keep test output readable.
const log = console.log;
console.log = (...args) => {
  if (typeof args[0] === 'string' && args[0].startsWith('[sms]')) return;
  log(...args);
};

const database = require('../src/db');
database.init(process.env.DATA_DIR);
require('../src/seed').seed();
require('../src/lib/auth').ensureAdmin();

module.exports = { database };
