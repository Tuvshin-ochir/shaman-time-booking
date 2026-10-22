// Usage: npm run admin:password -- <username> <password>
// Creates the admin user or resets its password.
import fs from 'node:fs';
import path from 'node:path';

const envFile = path.join(import.meta.dirname, '..', '.env');
if (fs.existsSync(envFile)) process.loadEnvFile(envFile);

const [username, password] = process.argv.slice(2);
if (!username || !password) {
  console.error('Хэрэглээ: npm run admin:password -- <нэвтрэх нэр> <нууц үг>');
  process.exit(1);
}
if (password.length < 10) {
  console.error('Нууц үг хамгийн багадаа 10 тэмдэгт байна.');
  process.exit(1);
}

// Imported after .env is loaded: the config reads it when the module loads.
const { default: config } = await import('../src/config.js');
const database = await import('../src/db.js');
const auth = await import('../src/lib/auth.js');
database.init(config.dataDir);
auth.setPassword(username, password);
database.close();
console.log(`«${username}» админы нууц үгийг тохирууллаа.`);
