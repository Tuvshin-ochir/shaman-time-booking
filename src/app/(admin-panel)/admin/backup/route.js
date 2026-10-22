import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import * as backup from '@/lib/backup.js';
import { nowLocal, fromMin } from '@/lib/time.js';
import { currentAdmin } from '@/lib/admin.js';

// Downloads a consistent copy of the database.
export async function GET() {
  if (!(await currentAdmin())) return new Response(null, { status: 303, headers: { Location: '/admin/login?next=%2Fadmin%2Fsettings' } });
  const now = nowLocal();
  const name = `backup-${now.date}-${fromMin(now.minutes).replace(':', '')}.db`;
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'booking-'));
  const file = path.join(dir, name);
  try {
    await backup.createBackup(file);
    const data = await fs.promises.readFile(file);
    return new Response(data, {
      headers: {
        'Content-Type': 'application/octet-stream',
        'Content-Disposition': `attachment; filename="${name}"`,
        'Cache-Control': 'no-store',
      },
    });
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
}
