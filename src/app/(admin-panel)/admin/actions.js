'use server';

import { redirect } from 'next/navigation';
import { clearSessionCookie } from '@/lib/admin.js';

export async function logout() {
  await clearSessionCookie();
  redirect('/admin/login');
}
