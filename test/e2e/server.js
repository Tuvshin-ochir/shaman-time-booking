// Starts the built app (`next build` first) with its own empty database, the
// QPay mock and SMS written to the log. One server per test file.
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import net from 'node:net';
import os from 'node:os';
import path from 'node:path';

const ROOT = path.join(import.meta.dirname, '..', '..');

function freePort() {
  return new Promise((resolve) => {
    const srv = net.createServer().listen(0, '127.0.0.1', () => {
      const { port } = srv.address();
      srv.close(() => resolve(port));
    });
  });
}

export async function startServer() {
  const distDir = process.env.NEXT_DIST_DIR || '.next';
  if (!fs.existsSync(path.join(ROOT, distDir, 'BUILD_ID'))) throw new Error(`No build in ${distDir}: run \`npm run test:e2e\`.`);
  const port = await freePort();
  const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'booking-e2e-'));
  const base = `http://127.0.0.1:${port}`;
  const env = {
    ...process.env,
    NODE_ENV: 'production',
    DATA_DIR: dataDir,
    QPAY_MODE: 'mock',
    SMS_PROVIDER: 'console',
    ADMIN_USERNAME: 'admin',
    ADMIN_PASSWORD: 'test-password-123',
    SESSION_SECRET: 'e2e-session-secret',
    BASE_URL: base,
  };
  const child = spawn(process.execPath, [path.join(ROOT, 'node_modules', 'next', 'dist', 'bin', 'next'), 'start', '-p', String(port), '-H', '127.0.0.1'], {
    cwd: ROOT,
    env,
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  let output = '';
  child.stdout.on('data', (d) => (output += d));
  child.stderr.on('data', (d) => (output += d));
  for (let i = 0; i < 150; i++) {
    try {
      if ((await fetch(`${base}/healthz`)).ok) return { base, dataDir, output: () => output, stop: () => child.kill() };
    } catch {
      // not up yet
    }
    await new Promise((r) => setTimeout(r, 200));
  }
  child.kill();
  throw new Error(`Server did not start:\n${output}`);
}

const decode = (s) => s.replace(/&quot;/g, '"').replace(/&#x27;/g, "'").replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&');

// The hidden fields React renders into a server-action form, so a test can
// submit it the way a browser without JavaScript would. `marker` is any text
// inside the wanted <form>.
export function actionFields(html, marker) {
  const at = html.indexOf(marker);
  const start = html.lastIndexOf('<form', at);
  if (at < 0 || start < 0 || html.lastIndexOf('</form>', at) > start) throw new Error(`No form around: ${marker}`);
  const chunk = html.slice(start, html.indexOf('</form>', at));
  return [...chunk.matchAll(/<input type="hidden" name="(\$ACTION[^"]*)"(?: value="([^"]*)")?\/>/g)].map((m) => [m[1], decode(m[2] || '')]);
}

export function client(base) {
  let cookie = '';
  const headers = (extra = {}) => ({ ...(cookie ? { cookie } : {}), ...extra });
  return {
    base,
    setCookie(value) {
      cookie = value;
    },
    get: (p, opts = {}) => fetch(base + p, { redirect: 'manual', ...opts, headers: headers(opts.headers) }),
    // Loads `page`, then submits the form containing `marker` with `values`.
    async submit(page, marker, values = {}) {
      const html = await (await fetch(base + page, { headers: headers() })).text();
      const body = new FormData();
      for (const [name, value] of actionFields(html, marker)) body.append(name, value);
      for (const [name, value] of Object.entries(values)) body.append(name, value);
      const res = await fetch(base + page, { method: 'POST', body, redirect: 'manual', headers: headers({ Origin: base }) });
      const setCookie = res.headers.get('set-cookie');
      if (setCookie && setCookie.startsWith('adm=')) cookie = setCookie.split(';')[0];
      return res;
    },
  };
}
