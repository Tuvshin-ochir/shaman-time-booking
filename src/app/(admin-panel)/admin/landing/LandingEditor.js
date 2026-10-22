'use client';

import { useEffect, useRef, useState, useTransition } from 'react';
import ScrollArea from '@/components/ScrollArea.js';
import { loadImage, encode } from '@/components/admin/image.js';
import { confirmDialog, alertDialog } from '@/components/admin/dialogs.js';
import { saveLanding, resetImage, deleteGalleryImage, moveGalleryImage, resetGallery } from './actions.js';

// ── Pieces ────────────────────────────────────────────────

// Hidden file input with the button that opens it.
function Upload({ onFile, children, buttonClass, ...data }) {
  const input = useRef(null);
  return (
    <>
      <button type="button" className={buttonClass} data-pick onClick={() => input.current.click()}>
        {children}
      </button>
      <input
        type="file"
        accept="image/*"
        hidden
        data-upload
        ref={input}
        {...data}
        onChange={(e) => {
          const file = e.target.files && e.target.files[0];
          e.target.value = '';
          if (file) onFile(file, e.target);
        }}
      />
    </>
  );
}

function ImageSlot({ slot, cfg, onUpload, onReset }) {
  const { img } = cfg;
  return (
    <div className="img-slot" data-image-slot>
      <div className={`img-preview${slot === 'og' ? ' is-wide' : ''}`}>
        <img src={img.small || img.src} alt="" loading="lazy" />
      </div>
      <div className="img-meta">
        <p className="img-title">
          <strong>{cfg.label}</strong>{' '}
          {cfg.custom ? <span className="badge badge-confirmed">Өөрийн зураг</span> : <span className="badge badge-muted">Анхны зураг</span>}
        </p>
        {cfg.hint && <p className="small muted">{cfg.hint}</p>}
        <p className="small muted">
          Одоогийн хэмжээ: {img.width}×{img.height}
        </p>
        <div className="img-actions">
          <Upload
            buttonClass="a-btn a-btn-sm a-btn-primary"
            data-slot={slot}
            data-large={cfg.large}
            data-small={cfg.small}
            data-crop={cfg.crop}
            onFile={(file, input) => onUpload(file, input)}
          >
            Зураг солих
          </Upload>
          {cfg.custom && (
            <button type="button" className="a-btn a-btn-sm" data-image-reset={slot} onClick={(e) => onReset(slot, e.currentTarget)}>
              Анхны зураг руу буцаах
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

function PolicyRow({ kind, id, item, tones, onMove, onRemove }) {
  const textField = kind === 'highlight' ? 'text' : 'body';
  return (
    <div className={`repeat-item is-${kind}`} data-repeat-item>
      <div className="repeat-fields">
        {kind === 'highlight' && (
          <label className="repeat-tone">
            <span>Өнгө</span>
            <select name={`highlight:${id}:tone`} defaultValue={item.tone}>
              {tones.map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
          </label>
        )}
        <label>
          <span>Гарчиг</span>
          <input name={`${kind}:${id}:title`} defaultValue={item.title_mn || ''} maxLength={120} />
        </label>
        <label className="is-wide">
          <span>{kind === 'highlight' ? 'Тайлбар' : 'Текст'}</span>
          <textarea name={`${kind}:${id}:${textField}`} rows={kind === 'highlight' ? 2 : 4} defaultValue={item[`${textField}_mn`] || ''}></textarea>
        </label>
      </div>
      <div className="repeat-tools">
        <button type="button" className="a-btn a-btn-sm" data-repeat-up aria-label="Дээш шилжүүлэх" onClick={() => onMove(-1)}>
          ↑
        </button>
        <button type="button" className="a-btn a-btn-sm" data-repeat-down aria-label="Доош шилжүүлэх" onClick={() => onMove(1)}>
          ↓
        </button>
        <button type="button" className="a-btn a-btn-sm a-btn-danger-ghost" data-repeat-remove onClick={onRemove}>
          Устгах
        </button>
      </div>
    </div>
  );
}

// Repeatable rows (policy rules and sections): add, remove, move. Row order on
// screen is the saved order.
function Repeat({ kind, items, max, tones, addLabel, newItem, markDirty }) {
  const [rows, setRows] = useState(() => items.map((item, i) => ({ id: String(i), item })));
  const focusId = useRef(null);
  const box = useRef(null);

  useEffect(() => {
    if (!focusId.current) return;
    const input = box.current.querySelector(`[name="${kind}:${focusId.current}:title"]`);
    if (input && input.offsetParent) input.focus();
    focusId.current = null;
  }, [rows, kind]);

  function add() {
    if (rows.length >= max) return alertDialog(`Хамгийн ихдээ ${max} байна.`);
    const id = `n${Date.now().toString(36)}`;
    focusId.current = id;
    setRows([...rows, { id, item: newItem }]);
    markDirty();
  }

  function move(index, step) {
    const target = index + step;
    if (target >= 0 && target < rows.length) {
      const next = [...rows];
      [next[index], next[target]] = [next[target], next[index]];
      setRows(next);
    }
    markDirty();
  }

  async function remove(index) {
    if (!(await confirmDialog('Энэ мөрийг устгах уу? (Хадгалах товч дарснаар хадгалагдана.)', { ok: 'Устгах', danger: true }))) return;
    setRows((current) => current.filter((_, i) => i !== index));
    markDirty();
  }

  return (
    <div className="repeat" data-repeat data-max={max} ref={box}>
      {rows.map((row, i) => (
        <PolicyRow key={row.id} kind={kind} id={row.id} item={row.item} tones={tones} onMove={(step) => move(i, step)} onRemove={() => remove(i)} />
      ))}
      <button type="button" className="a-btn a-btn-sm repeat-add" data-repeat-add onClick={add}>
        {addLabel}
      </button>
    </div>
  );
}

// ── Editor ────────────────────────────────────────────────

export default function LandingEditor({ sections, slots, gallery, gallerySizes, galleryMax, policy, policyTones, policyMax, csrf }) {
  const [dirty, setDirty] = useState(false);
  const [error, setError] = useState(null);
  const [toast, setToast] = useState(null);
  const [, startTransition] = useTransition();
  const dirtyRef = useRef(false);
  const toastTimer = useRef(null);

  const markDirty = () => {
    dirtyRef.current = true;
    setDirty(true);
  };

  useEffect(() => {
    const onLeave = (e) => {
      if (dirtyRef.current) {
        e.preventDefault();
        e.returnValue = '';
      }
    };
    window.addEventListener('beforeunload', onLeave);
    return () => window.removeEventListener('beforeunload', onLeave);
  }, []);

  function say(message, isError) {
    setToast({ message, isError: !!isError });
    clearTimeout(toastTimer.current);
    if (isError) toastTimer.current = setTimeout(() => setToast(null), 6000);
  }

  // Image actions reload the page, so unsaved text edits would be lost.
  async function okToLeave() {
    return !dirtyRef.current || confirmDialog('Хадгалаагүй текстийн өөрчлөлт алга болно. Үргэлжлүүлэх үү?', { ok: 'Үргэлжлүүлэх' });
  }

  // Image and gallery buttons: asks `question` (if any), then about unsaved text, then runs `action`.
  async function act(node, action, question) {
    if (question && !(await confirmDialog(question, { ok: 'Тийм', danger: true }))) return;
    if (await okToLeave()) run(node, action);
  }

  function reloadAt(node) {
    dirtyRef.current = false;
    const section = node.closest('.landing-section');
    window.location.href = `/admin/landing?ok=image${section ? `#${section.id}` : ''}`;
  }

  async function run(node, action) {
    const res = await action();
    if (res && res.error) say(res.error, true);
    else reloadAt(node);
  }

  async function upload(file, input) {
    if (!/^image\//.test(file.type)) return say('Зөвхөн зургийн файл сонгоно уу.', true);
    if (!(await okToLeave())) return undefined;
    say('Зургийг шахаж байна…');
    try {
      const img = await loadImage(file);
      const ratio = Number(input.dataset.crop) || null;
      const large = encode(img, Number(input.dataset.large), ratio);
      const small = input.dataset.small ? encode(img, Number(input.dataset.small), ratio) : null;
      const useSmall = small && small.width < large.width;
      say('Хуулж байна…');
      const res = await fetch('/admin/landing/image', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-CSRF-Token': csrf },
        body: JSON.stringify({
          slot: input.dataset.slot,
          index: input.dataset.index === undefined ? '' : input.dataset.index,
          large: large.dataUrl,
          width: large.width,
          height: large.height,
          small: useSmall ? small.dataUrl : undefined,
          smallWidth: useSmall ? small.width : undefined,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || `Алдаа гарлаа (${res.status})`);
      reloadAt(input);
    } catch (err) {
      say(err.message, true);
    }
    return undefined;
  }

  function onSubmit(e) {
    e.preventDefault();
    const data = new FormData(e.currentTarget);
    dirtyRef.current = false;
    startTransition(async () => {
      const res = await saveLanding(data);
      if (res && res.error) {
        setError(res.error);
        markDirty();
        window.scrollTo({ top: 0 });
      } else {
        window.location.href = '/admin/landing?ok=saved';
      }
    });
  }

  return (
    <>
      {error && (
        <div className="a-alert a-alert-err" role="alert">
          {error}
        </div>
      )}

      <ScrollArea as="nav" className="quick-filters landing-index" outerClassName="landing-index-wrap" aria-label="Хэсгүүд">
        {sections.map((s, i) => (
          <a key={s.id} href={`#sec-${s.id}`}>
            {i + 1}. {s.title}
          </a>
        ))}
      </ScrollArea>

      <form
        action={saveLanding}
        id="landing-form"
        className={`landing-form${dirty ? ' is-dirty' : ''}`}
        onSubmit={onSubmit}
        onInput={(e) => e.target.type !== 'file' && markDirty()}
      >
        {sections.map((s, i) => (
          <section key={s.id} className="a-card landing-section" id={`sec-${s.id}`}>
            <h2 className="landing-title">
              <span className="sec-num">{i + 1}</span>
              {s.title}
            </h2>
            {s.note && (
              <p className="landing-note">
                ℹ︎ <a href={s.note.href}>{s.note.text}</a>
              </p>
            )}

            {s.images && (
              <div className="img-slots">
                {s.images.map((slot) => (
                  <ImageSlot
                    key={slot}
                    slot={slot}
                    cfg={slots[slot]}
                    onUpload={upload}
                    onReset={(name, node) => act(node, () => resetImage(name))}
                  />
                ))}
              </div>
            )}

            {s.gallery && (
              <>
                <div className="gallery-admin">
                  {gallery.map((g, gi) => (
                    <div key={`${gi}-${g.src}`} className="g-item">
                      <div className="img-preview">
                        <img src={g.small || g.src} alt="" loading="lazy" />
                      </div>
                      <label>
                        Тайлбар <input name={`caption:${gi}`} defaultValue={g.caption_mn} maxLength={100} />
                      </label>
                      <div className="g-actions">
                        <Upload
                          buttonClass="a-btn a-btn-sm"
                          data-slot="gallery"
                          data-index={gi}
                          data-large={gallerySizes.large}
                          data-small={gallerySizes.small}
                          onFile={upload}
                        >
                          Солих
                        </Upload>
                        <button
                          type="button"
                          className="a-btn a-btn-sm"
                          data-gallery-move="up"
                          aria-label="Өмнө нь шилжүүлэх"
                          disabled={gi === 0}
                          onClick={(e) => act(e.currentTarget, () => moveGalleryImage(gi, 'up'))}
                        >
                          ←
                        </button>
                        <button
                          type="button"
                          className="a-btn a-btn-sm"
                          data-gallery-move="down"
                          aria-label="Дараа нь шилжүүлэх"
                          disabled={gi === gallery.length - 1}
                          onClick={(e) => act(e.currentTarget, () => moveGalleryImage(gi, 'down'))}
                        >
                          →
                        </button>
                        <button
                          type="button"
                          className="a-btn a-btn-sm a-btn-danger-ghost"
                          data-gallery-delete
                          onClick={(e) => act(e.currentTarget, () => deleteGalleryImage(gi), 'Энэ зургийг цомгоос устгах уу?')}
                        >
                          Устгах
                        </button>
                      </div>
                    </div>
                  ))}
                  {gallery.length < galleryMax && (
                    <div className="g-add">
                      <Upload buttonClass="g-add-btn" data-slot="gallery" data-large={gallerySizes.large} data-small={gallerySizes.small} onFile={upload}>
                        <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" aria-hidden="true">
                          <path d="M12 5v14M5 12h14" />
                        </svg>
                        Зураг нэмэх
                      </Upload>
                    </div>
                  )}
                </div>
                <p className="small muted">
                  Эхний зураг том харагдана. Сумтай товчоор дарааллыг өөрчилнө.{' '}
                  <button
                    type="button"
                    className="a-link"
                    data-gallery-reset
                    onClick={(e) => act(e.currentTarget, () => resetGallery(), 'Цомгийг анхны зургууд руу буцаах уу? Таны оруулсан зургууд устна.')}
                  >
                    Анхны зургууд руу буцаах
                  </button>
                </p>
              </>
            )}

            {s.policy && (
              <>
                <p className="landing-note">
                  ℹ︎ Сайтын{' '}
                  <a href="/policy" target="_blank" rel="noopener">
                    «Цуцлах нөхцөл» хуудсанд
                  </a>{' '}
                  харагдана. Захиалга хийхдээ үйлчлүүлэгч энэ нөхцөлийг зөвшөөрнө.
                  {policy.updated_at && (
                    <>
                      {' '}
                      Сүүлд шинэчилсэн: <strong>{policy.updated_at.replace(/-/g, '.')}</strong>
                    </>
                  )}
                </p>
                <div className="landing-fields">
                  <label className="is-wide">
                    <span>Танилцуулга</span>
                    <textarea name="policy:intro" rows={3} defaultValue={policy.intro_mn}></textarea>
                  </label>
                </div>

                <h3 className="repeat-heading">Гол дүрмүүд</h3>
                <p className="small muted">Хуудасны дээд хэсэгт өнгөт карт болж харагдана. Хамгийн ихдээ {policyMax.highlight}.</p>
                <Repeat
                  kind="highlight"
                  items={policy.highlights}
                  max={policyMax.highlight}
                  tones={policyTones}
                  addLabel="+ Дүрэм нэмэх"
                  newItem={{ tone: 'good' }}
                  markDirty={markDirty}
                />

                <h3 className="repeat-heading">Дэлгэрэнгүй хэсгүүд</h3>
                <p className="small muted">Дугаарласан гарчигтай хэсгүүд. Догол мөр тусгаарлахдаа хоосон мөр үлдээнэ.</p>
                <Repeat
                  kind="section"
                  items={policy.sections}
                  max={policyMax.section}
                  tones={policyTones}
                  addLabel="+ Хэсэг нэмэх"
                  newItem={{}}
                  markDirty={markDirty}
                />
              </>
            )}

            {s.fields.length > 0 && (
              <div className="landing-fields">
                {s.fields.map((f) => {
                  const name = `${f.store}:${f.key}`;
                  const wide = f.kind && f.kind !== 'line';
                  return (
                    <label key={name} className={wide ? 'is-wide' : undefined}>
                      <span>{f.label}</span>
                      {wide ? (
                        <textarea name={name} rows={f.kind === 'faq' ? 14 : f.kind === 'lines' ? 5 : 3} defaultValue={f.value}></textarea>
                      ) : (
                        <input name={name} defaultValue={f.value} maxLength={300} required={!!f.required} />
                      )}
                      {f.hint && <small>{f.hint}</small>}
                    </label>
                  );
                })}
              </div>
            )}
          </section>
        ))}

        <div className="save-bar">
          <span className="save-state" data-save-state>
            Хадгалаагүй өөрчлөлт байна
          </span>
          <a className="a-btn" href="/" target="_blank" rel="noopener">
            Сайтаас харах ↗
          </a>
          <button className="a-btn a-btn-primary" type="submit">
            Хадгалах
          </button>
        </div>
      </form>

      <div className={`a-toast${toast && toast.isError ? ' is-error' : ''}`} id="a-toast" role="status" aria-live="polite" hidden={!toast}>
        {toast ? toast.message : ''}
      </div>
    </>
  );
}
