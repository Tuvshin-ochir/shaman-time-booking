'use server';

import * as news from '@/lib/news.js';
import { requireAdmin, field, checked, done } from '@/lib/admin.js';

function newsForm(formData) {
  const get = (name) => field(formData.get(name));
  return {
    title: get('title'),
    body: String(formData.get('body') || ''),
    date: get('date'),
    published: checked(formData.get('published')),
    removeImage: get('remove_image') === '1',
    image: get('image_large')
      ? {
          large: get('image_large'),
          width: get('image_width'),
          height: get('image_height'),
          ...(get('image_small') ? { small: get('image_small'), smallWidth: get('image_small_width') } : {}),
        }
      : null,
  };
}

export async function createNews(formData) {
  await requireAdmin();
  const result = news.save(null, newsForm(formData));
  if (result.errors) return { errors: result.errors };
  done('/admin/news?ok=news_saved');
}

export async function updateNews(id, formData) {
  await requireAdmin();
  const result = news.save(Number(id), newsForm(formData));
  if (result.errors) return { errors: result.errors };
  done('/admin/news?ok=news_saved');
}

export async function deleteNews(id) {
  await requireAdmin();
  news.remove(id);
  done('/admin/news?ok=news_deleted');
}
