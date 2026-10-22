'use client';

import { useRef, useState } from 'react';
import ActionForm from '@/components/admin/ActionForm.js';
import RichEditor from '@/components/admin/RichEditor.js';
import { loadImage, encode } from '@/components/admin/image.js';

// Add / edit a news post: title, date, optional picture, text, published.
// A picked picture is resized in the browser and sent with the form.
export default function NewsForm({ action, item = null, today, sizes }) {
  const file = useRef(null);
  const [upload, setUpload] = useState(null);
  const [removed, setRemoved] = useState(false);
  const [busy, setBusy] = useState(false);
  const [imageError, setImageError] = useState('');
  const current = item && item.image && !removed ? item.image.small || item.image.src : null;
  const preview = upload ? upload.large : current;

  async function pick(picked) {
    setBusy(true);
    setImageError('');
    try {
      const img = await loadImage(picked);
      const large = encode(img, sizes.large);
      const small = encode(img, sizes.small);
      setUpload({
        large: large.dataUrl,
        width: large.width,
        height: large.height,
        ...(small.width < large.width ? { small: small.dataUrl, smallWidth: small.width } : {}),
      });
    } catch (err) {
      setImageError(err.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <ActionForm action={action} className="a-card a-form news-form">
      <label>
        Гарчиг <input name="title" defaultValue={item ? item.title : ''} required maxLength={150} />
      </label>
      <div className="a-row">
        <label>
          Огноо <input type="date" name="date" defaultValue={item ? item.date : today} required />
        </label>
        <label className="a-check news-publish">
          <input type="checkbox" name="published" defaultChecked={item ? !!item.published : true} /> Сайтад нийтлэх
        </label>
      </div>

      <div className="news-image">
        <span className="news-label">Зураг (заавал биш)</span>
        <div className="news-image-row">
          <div className="news-image-preview">{preview ? <img src={preview} alt="" /> : <span>Зураггүй</span>}</div>
          <div className="img-actions">
            <button type="button" className="a-btn a-btn-sm" disabled={busy} onClick={() => file.current.click()}>
              {busy ? 'Боловсруулж байна…' : preview ? 'Зураг солих' : 'Зураг сонгох'}
            </button>
            {preview && (
              <button
                type="button"
                className="a-btn a-btn-sm a-btn-danger-ghost"
                onClick={() => {
                  setUpload(null);
                  setRemoved(true);
                }}
              >
                Зураг хасах
              </button>
            )}
          </div>
        </div>
        {imageError && <p className="a-alert a-alert-err">{imageError}</p>}
        <input
          type="file"
          accept="image/*"
          hidden
          ref={file}
          onChange={(e) => {
            const picked = e.target.files && e.target.files[0];
            e.target.value = '';
            if (picked) pick(picked);
          }}
        />
        {upload && (
          <>
            <input type="hidden" name="image_large" value={upload.large} />
            <input type="hidden" name="image_width" value={upload.width} />
            <input type="hidden" name="image_height" value={upload.height} />
            {upload.small && <input type="hidden" name="image_small" value={upload.small} />}
            {upload.small && <input type="hidden" name="image_small_width" value={upload.smallWidth} />}
          </>
        )}
        {removed && !upload && <input type="hidden" name="remove_image" value="1" />}
      </div>

      <div className="news-body">
        <span className="news-label">Текст</span>
        <RichEditor name="body" defaultValue={item ? item.body : ''} label="Мэдээний текст" />
      </div>

      <button className="a-btn a-btn-primary" type="submit" disabled={busy}>
        Хадгалах
      </button>
    </ActionForm>
  );
}
