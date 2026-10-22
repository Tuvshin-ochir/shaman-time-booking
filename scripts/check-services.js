// Usage: npm run check:services
// Runs before every Railway deploy (preDeployCommand in railway.json): checks
// that the settings are complete and that QPay and WeSend accept our keys.
// Sends no SMS and creates no invoice. Exits with 1 on any problem, which
// stops the deploy; the running version stays online.
import fs from 'node:fs';
import path from 'node:path';

const envFile = path.join(import.meta.dirname, '..', '.env');
if (fs.existsSync(envFile)) process.loadEnvFile(envFile);

// WeSend price of one SMS part (https://wesend.mn/pricing).
const SMS_CREDITS = 80;

const failed = [];
const line = (mark, name, detail) => console.log(`${mark} ${name}: ${detail}`);
const ok = (name, detail) => line('✓', name, detail);
const warn = (name, detail) => line('!', name, detail);
const fail = (name, detail) => {
  line('✗', name, detail);
  failed.push(name);
};

function finish() {
  if (failed.length) {
    console.error(`\nШалгалт амжилтгүй (${failed.join(', ')}). Deploy зогслоо.`);
    process.exit(1);
  }
  console.log('\nБүх шалгалт амжилттай.');
  process.exit(0);
}

// Imported after .env is loaded: the config reads it when the module loads,
// and throws on missing settings (SESSION_SECRET, QPay keys, ...).
let config;
try {
  ({ default: config } = await import('../src/config.js'));
  ok('Тохиргоо', 'бүрэн');
} catch (err) {
  fail('Тохиргоо', err.message);
  finish();
}
const qpay = await import('../src/lib/qpay.js');
const sms = await import('../src/lib/sms.js');

if (config.isProd) {
  if (config.qpay.mode === 'mock') fail('QPay горим', 'QPAY_MODE=mock бол хэн ч төлбөргүйгээр захиалга баталгаажуулж чадна. live болгоно уу.');
  if (!/^https:\/\//.test(config.baseUrl) || /localhost|127\.0\.0\.1/.test(config.baseUrl)) {
    fail('BASE_URL', `${config.baseUrl}: сайтын жинхэнэ https хаяг байх ёстой (QPay төлбөрийн мэдэгдэл энд ирнэ).`);
  } else {
    ok('BASE_URL', config.baseUrl);
  }
  if (!config.admin.password) warn('ADMIN_PASSWORD', 'хоосон: анхны deploy бол админ хэрэглэгч үүсэхгүй.');
}

try {
  const result = await qpay.checkAuth();
  if (result === 'mock') warn('QPay', 'mock горим, жинхэнэ QPay-г шалгаагүй');
  else ok('QPay', `${config.qpay.mode} горимд нэвтэрч чадлаа (${config.qpay.baseUrl})`);
} catch (err) {
  fail('QPay', `нэвтэрч чадсангүй. QPAY_CLIENT_ID, QPAY_CLIENT_SECRET-ийг шалгана уу. ${err.message}`);
}

try {
  const result = await sms.checkProvider();
  if (!result.ok) fail('SMS', result.detail);
  else if (config.isProd && config.sms.provider === 'console') fail('SMS', 'SMS_PROVIDER=console: үйлчлүүлэгчид SMS очихгүй. wesend болгоно уу.');
  // One SMS costs 80 credits. A low balance only warns: it must not block a fix from going out.
  else if (Number.isFinite(result.balance) && result.balance < SMS_CREDITS) {
    warn('SMS', `${result.detail}. Нэг ч SMS илгээх кредит алга! wesend.mn-ээс цэнэглэнэ үү.`);
  } else if (Number.isFinite(result.balance) && result.balance < 10 * SMS_CREDITS) {
    warn('SMS', `${result.detail} (~${Math.floor(result.balance / SMS_CREDITS)} SMS). Удахгүй дуусна, wesend.mn-ээс цэнэглэнэ үү.`);
  } else ok('SMS', result.detail);
} catch (err) {
  fail('SMS', `WeSend-тэй холбогдож чадсангүй: ${err.message}`);
}

finish();
