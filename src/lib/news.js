// News posts: written in the admin (/admin/news), shown on the home page and
// under /news.
import fs from 'node:fs';
import path from 'node:path';
import { db } from '../db.js';
import * as landing from './landing.js';
import { sanitize, toText } from './rich-text.js';
import { isValidDate, nowLocal } from './time.js';

const IMAGE_SIZES = { large: 1200, small: 600 };
const TITLE_MAX = 150;
const BODY_MAX = 100000;

const fromRow = (row) => row && { ...row, image: row.image ? JSON.parse(row.image) : null };

// Newest first. `all` includes drafts (for the admin).
function list({ all = false, limit = 500 } = {}) {
  return db()
    .prepare(`SELECT * FROM news ${all ? '' : 'WHERE published = 1'} ORDER BY date DESC, id DESC LIMIT ?`)
    .all(limit)
    .map(fromRow);
}

function get(id, { all = false } = {}) {
  const row = db()
    .prepare(`SELECT * FROM news WHERE id = ? ${all ? '' : 'AND published = 1'}`)
    .get(Number(id) || 0);
  return fromRow(row) || null;
}

function excerpt(item, length = 150) {
  const text = toText(item.body);
  return text.length > length ? `${text.slice(0, length).replace(/\s+\S*$/, '')}…` : text;
}

// Deletes news-*.jpg files no post points to any more.
function removeOrphans() {
  const used = new Set();
  for (const { image } of db().prepare('SELECT image FROM news WHERE image IS NOT NULL').all()) {
    const img = JSON.parse(image);
    for (const url of [img.src, img.small]) if (url) used.add(path.basename(url));
  }
  let files = [];
  try {
    files = fs.readdirSync(landing.uploadDir());
  } catch {
    return;
  }
  for (const file of files) if (file.startsWith('news-') && !used.has(file)) fs.rmSync(path.join(landing.uploadDir(), file), { force: true });
}

// Creates (id = null) or updates a post from the admin form. Returns
// { errors } or { id }. `input.image` is a resized picture from the browser
// ({ large, small, width, height, smallWidth }); `input.removeImage` drops the current one.
function save(id, input) {
  const existing = id ? get(id, { all: true }) : null;
  if (id && !existing) return { errors: ['Мэдээ олдсонгүй.'] };
  const title = String(input.title || '').replace(/\s+/g, ' ').trim();
  const body = sanitize(input.body);
  const date = String(input.date || '') || nowLocal().date;
  const errors = [];
  if (title.length < 2) errors.push('Гарчиг оруулна уу.');
  if (title.length > TITLE_MAX) errors.push(`Гарчиг ${TITLE_MAX} тэмдэгтээс ихгүй байна.`);
  if (!toText(body)) errors.push('Мэдээний текст хоосон байна.');
  if (body.length > BODY_MAX) errors.push('Мэдээ хэт урт байна.');
  if (!isValidDate(date)) errors.push('Огноо буруу байна.');

  let image = input.removeImage ? null : existing ? existing.image : null;
  if (!errors.length && input.image && input.image.large) {
    try {
      image = landing.storeUpload('news', input.image);
    } catch (err) {
      if (!(err instanceof landing.LandingError)) throw err;
      errors.push(err.message);
    }
  }
  if (errors.length) return { errors };

  const now = Date.now();
  const values = [title, body, date, image ? JSON.stringify(image) : null, input.published ? 1 : 0];
  if (existing) {
    db().prepare('UPDATE news SET title = ?, body = ?, date = ?, image = ?, published = ?, updated_at = ? WHERE id = ?').run(...values, now, id);
  } else {
    id = Number(
      db()
        .prepare('INSERT INTO news (title, body, date, image, published, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)')
        .run(...values, now, now).lastInsertRowid
    );
  }
  removeOrphans();
  return { id };
}

function remove(id) {
  db().prepare('DELETE FROM news WHERE id = ?').run(Number(id) || 0);
  removeOrphans();
}

export { IMAGE_SIZES, list, get, excerpt, save, remove };
