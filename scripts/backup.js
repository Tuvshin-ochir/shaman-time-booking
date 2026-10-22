// Usage: npm run backup [-- <target file>]
// Writes a consistent copy of the database (safe while the server is running).
const fs = require('node:fs');
const path = require('node:path');

const envFile = path.join(__dirname, '..', '.env');
if (fs.existsSync(envFile)) process.loadEnvFile(envFile);

const config = require('../src/config');
const database = require('../src/db');
const backup = require('../src/lib/backup');
const { nowLocal, fromMin } = require('../src/lib/time');

async function main() {
  database.init(config.dataDir);
  const now = nowLocal();
  const target =
    process.argv[2] ||
    path.join(backup.backupDir(), `manual-${now.date}-${fromMin(now.minutes).replace(':', '')}.db`);
  await backup.createBackup(path.resolve(target));
  database.close();
  console.log(`Нөөц хуулбар: ${path.resolve(target)}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
