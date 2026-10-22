// Usage: npm run admin:password -- <username> <password>
// Creates the admin user or resets its password.
const fs = require('node:fs');
const path = require('node:path');

const envFile = path.join(__dirname, '..', '.env');
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

const config = require('../src/config');
const database = require('../src/db');
database.init(config.dataDir);
require('../src/lib/auth').setPassword(username, password);
database.close();
console.log(`«${username}» админы нууц үгийг тохирууллаа.`);
