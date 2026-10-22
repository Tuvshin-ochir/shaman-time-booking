// Test environment. Imported first, before any module from src/ reads it.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

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
