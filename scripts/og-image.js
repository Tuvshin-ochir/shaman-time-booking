// Usage: npm run og-image
// Renders public/img/og.jpg (1200x630, for Facebook link previews) plus the
// PNG icons with headless Chrome, using the business name from the database.
// Needs Google Chrome/Chromium (set CHROME_PATH if it is not found).
// You can also simply replace public/img/og.jpg with your own photo (1200x630, < 300 KB).
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { execFileSync } = require('node:child_process');

const envFile = path.join(__dirname, '..', '.env');
if (fs.existsSync(envFile)) process.loadEnvFile(envFile);

const ROOT = path.join(__dirname, '..');
const OUT = path.join(ROOT, 'public', 'img');

function findChrome() {
  const candidates = [
    process.env.CHROME_PATH,
    '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
    '/Applications/Chromium.app/Contents/MacOS/Chromium',
    '/usr/bin/google-chrome',
    '/usr/bin/chromium',
    '/usr/bin/chromium-browser',
  ].filter(Boolean);
  const found = candidates.find((p) => fs.existsSync(p));
  if (!found) throw new Error('Chrome олдсонгүй. CHROME_PATH тохируулна уу.');
  return found;
}

function businessInfo() {
  try {
    const config = require('../src/config');
    const database = require('../src/db');
    database.init(config.dataDir);
    const business = require('../src/lib/settings').get('business');
    database.close();
    return business;
  } catch {
    return require('../src/lib/settings').DEFAULTS.business;
  }
}

const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);

const LOGO = fs.readFileSync(path.join(ROOT, 'public', 'favicon.svg'), 'utf8');

const HERO_PHOTO = path.join(ROOT, 'public', 'img', 'photos', 'hero-1600.jpg');

function ogHtml(business) {
  const photo = fs.existsSync(HERO_PHOTO) ? `,url('file://${HERO_PHOTO}') center 60%/cover` : '';
  return `<!doctype html><html><head><meta charset="utf-8"><style>
  *{margin:0;box-sizing:border-box}
  body{width:1200px;height:630px;font-family:-apple-system,"Segoe UI",Roboto,Arial,sans-serif;color:#fff;
    background:linear-gradient(90deg,rgba(7,22,28,.82) 0%,rgba(7,22,28,.45) 60%,rgba(7,22,28,.25) 100%)${photo},#0b5f63;
    display:flex;flex-direction:column;justify-content:space-between;padding:72px 80px;overflow:hidden;position:relative}
  .top{display:flex;align-items:center;gap:22px;font-size:34px;font-weight:700;opacity:.95}
  .top svg{width:76px;height:76px}
  h1{font-size:84px;line-height:1.05;letter-spacing:-1.5px;max-width:900px}
  .sub{font-size:34px;color:#cdeae8;margin-top:22px;max-width:900px}
  .row{display:flex;gap:16px}
  .pill{font-size:28px;font-weight:600;padding:14px 28px;border-radius:999px;background:rgba(255,255,255,.12);border:2px solid rgba(255,255,255,.25)}
  .pill.cta{background:#f2a541;border-color:#f2a541;color:#3b2500}
  .card{position:absolute;right:80px;top:150px;width:250px;padding:26px;border-radius:28px;background:#fff;color:#12222b;box-shadow:0 30px 60px rgba(0,0,0,.25)}
  .card p{font-size:20px;color:#5a6a73;font-weight:600}
  .card strong{display:block;font-size:64px;color:#0b5f63;line-height:1.1;margin-top:6px}
  .card .ok{margin-top:14px;font-size:22px;color:#17804f;font-weight:700}
  </style></head><body>
  <div class="top">${LOGO}<span>${esc(business.name)}</span></div>
  <div class="card"><p>Сул цаг</p><strong>10:30</strong><div class="ok">✓ Баталгаажсан</div></div>
  <div><h1>Онлайн<br>цаг захиалга</h1><p class="sub">${esc(business.tagline || '')}</p></div>
  <div class="row"><span class="pill cta">Цаг захиалах</span><span class="pill">QPay</span><span class="pill">SMS баталгаажуулалт</span></div>
  </body></html>`;
}

function iconHtml(size) {
  return `<!doctype html><html><head><style>*{margin:0}body{width:${size}px;height:${size}px;background:#0b5f63}svg{width:${size}px;height:${size}px;display:block}</style></head><body>${LOGO.replace('rx="10"', 'rx="0"')}</body></html>`;
}

function render(chrome, html, width, height, outPng) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'og-'));
  const file = path.join(dir, 'page.html');
  fs.writeFileSync(file, html);
  execFileSync(chrome, [
    '--headless=new',
    '--disable-gpu',
    '--hide-scrollbars',
    '--force-device-scale-factor=1',
    `--window-size=${width},${height}`,
    `--screenshot=${outPng}`,
    `file://${file}`,
  ], { stdio: 'ignore' });
  fs.rmSync(dir, { recursive: true, force: true });
}

function toJpeg(png, jpg) {
  if (process.platform === 'darwin') {
    execFileSync('sips', ['-s', 'format', 'jpeg', '-s', 'formatOptions', '82', png, '--out', jpg], { stdio: 'ignore' });
    fs.unlinkSync(png);
  } else {
    // ImageMagick on Linux servers
    execFileSync('convert', [png, '-quality', '82', jpg], { stdio: 'ignore' });
    fs.unlinkSync(png);
  }
}

const chrome = findChrome();
fs.mkdirSync(OUT, { recursive: true });
const business = businessInfo();
const ogPng = path.join(OUT, 'og.png');
render(chrome, ogHtml(business), 1200, 630, ogPng);
toJpeg(ogPng, path.join(OUT, 'og.jpg'));
render(chrome, iconHtml(180), 180, 180, path.join(OUT, 'apple-touch-icon.png'));
render(chrome, iconHtml(32).replace('rx="0"', 'rx="7"').replace('background:#0b5f63', 'background:transparent'), 32, 32, path.join(OUT, 'favicon-32.png'));
for (const f of ['og.jpg', 'apple-touch-icon.png', 'favicon-32.png']) {
  console.log(`${f}: ${(fs.statSync(path.join(OUT, f)).size / 1024).toFixed(1)} KB`);
}
