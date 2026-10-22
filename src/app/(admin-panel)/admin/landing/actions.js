'use server';

import { revalidatePath } from 'next/cache';
import * as landing from '@/lib/landing.js';
import * as policy from '@/lib/policy.js';
import * as i18n from '@/i18n/index.js';
import { requireAdmin } from '@/lib/admin.js';

// Texts, gallery captions and the cancellation policy, all from one form.
// The editor reloads the page afterwards, like after an image change.
export async function saveLanding(formData) {
  await requireAdmin();
  const body = Object.fromEntries(formData);
  try {
    landing.saveTexts(body, i18n.translator());
    policy.save(body);
  } catch (err) {
    if (!(err instanceof landing.LandingError)) throw err;
    return { error: err.message };
  }
  revalidatePath('/', 'layout');
  return { ok: true };
}

async function imageAction(fn) {
  await requireAdmin();
  try {
    fn();
  } catch (err) {
    if (!(err instanceof landing.LandingError)) throw err;
    return { error: err.message };
  }
  revalidatePath('/', 'layout');
  return { ok: true };
}

export async function resetImage(slot) {
  return imageAction(() => landing.resetImage(slot));
}

export async function deleteGalleryImage(index) {
  return imageAction(() => landing.deleteGalleryImage(index));
}

export async function moveGalleryImage(index, direction) {
  return imageAction(() => landing.moveGalleryImage(index, direction));
}

export async function resetGallery() {
  return imageAction(() => landing.resetGallery());
}
