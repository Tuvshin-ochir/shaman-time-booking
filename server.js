const fs = require('node:fs');
const path = require('node:path');

const envFile = path.join(__dirname, '.env');
if (fs.existsSync(envFile)) process.loadEnvFile(envFile);

const config = require('./src/config');
const database = require('./src/db');

database.init(config.dataDir);
require('./src/seed').seed();
require('./src/lib/auth').ensureAdmin();

const { createApp } = require('./src/app');
const jobs = require('./src/jobs');

const server = createApp().listen(config.port, () => {
  console.log(`[server] ${config.baseUrl} (port ${config.port}, QPay: ${config.qpay.mode}, SMS: ${config.sms.provider})`);
});
jobs.start();

function shutdown(signal) {
  console.log(`[server] ${signal}, shutting down`);
  jobs.stop();
  server.close(() => {
    database.close();
    process.exit(0);
  });
  setTimeout(() => process.exit(1), 10000).unref();
}
process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));
