// Usage: npm run backup [-- <target file>]
// Writes a consistent copy of the database (safe while the server is running).
import fs from 'node:fs';
import path from 'node:path';

const envFile = path.join(import.meta.dirname, '..', '.env');
if (fs.existsSync(envFile)) process.loadEnvFile(envFile);

// Imported after .env is loaded: the config reads it when the module loads.
const { default: config } = await import('../src/config.js');
const database = await import('../src/db.js');
const backup = await import('../src/lib/backup.js');
const { nowLocal, fromMin } = await import('../src/lib/time.js');

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
