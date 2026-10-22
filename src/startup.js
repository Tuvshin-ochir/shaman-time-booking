// Runs once when the Next.js server starts (see src/instrumentation.js):
// opens the database, seeds sample data, creates the first admin and starts
// the background jobs. SQLite in WAL mode needs no special shutdown.
import config from './config.js';
import * as database from './db.js';
import { seed } from './seed.js';
import { ensureAdmin } from './lib/auth.js';
import * as jobs from './jobs.js';

database.init(config.dataDir);
seed();
ensureAdmin();
jobs.start();
console.log(`[server] ${config.baseUrl} (QPay: ${config.qpay.mode}, SMS: ${config.sms.provider})`);

