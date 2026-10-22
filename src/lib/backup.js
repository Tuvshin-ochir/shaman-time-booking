const fs = require('node:fs');
const path = require('node:path');
const { backup } = require('node:sqlite');
const config = require('../config');
const { db } = require('../db');
const { nowLocal } = require('./time');

const FILE_RE = /^app-\d{4}-\d{2}-\d{2}\.db$/;

function backupDir() {
  const dir = path.join(config.dataDir, 'backups');
  fs.mkdirSync(dir, { recursive: true });
  return dir;
}

// Consistent online copy of the live database (safe while the app is running).
async function createBackup(dest) {
  await backup(db(), dest);
  return dest;
}

function prune(dir, keep) {
  const files = fs
    .readdirSync(dir)
    .filter((f) => FILE_RE.test(f))
    .sort()
    .reverse();
  for (const old of files.slice(keep)) fs.unlinkSync(path.join(dir, old));
}

// One backup per local day, keeping the newest BACKUP_KEEP files.
async function dailyIfDue(now = Date.now()) {
  const dir = backupDir();
  const file = path.join(dir, `app-${nowLocal(now).date}.db`);
  if (fs.existsSync(file)) return null;
  const tmp = `${file}.tmp`;
  await createBackup(tmp);
  fs.renameSync(tmp, file);
  prune(dir, config.backupKeep);
  console.log(`[backup] ${file}`);
  return file;
}

module.exports = { createBackup, dailyIfDue, backupDir };
