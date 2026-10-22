'use client';

import { useEffect, useRef, useState } from 'react';
import { alertDialog, promptDialog } from './dialogs.js';

// Simple word-processor style editor for news: headings, bold, italic,
// underline, lists, quotes and links. The HTML goes to the form in a hidden
// input; the server cleans it (src/lib/rich-text.js) before saving.

const I = {
  ul: 'M9 6h11M9 12h11M9 18h11M4.5 6h.01M4.5 12h.01M4.5 18h.01',
  ol: 'M10 6h10M10 12h10M10 18h10M4 5l1.5-1v5M3.5 14.5a1.5 1.5 0 013 0c0 1.5-3 2.5-3 4.5h3',
  quote: 'M7 7h4v4c0 3-1.5 5-4 6M15 7h4v4c0 3-1.5 5-4 6',
  link: 'M10 14a4 4 0 005.7 0l3-3a4 4 0 00-5.7-5.7l-1 1M14 10a4 4 0 00-5.7 0l-3 3a4 4 0 005.7 5.7l1-1',
  unlink: 'M10 14a4 4 0 005.7 0l3-3a4 4 0 00-5.7-5.7l-1 1M14 10a4 4 0 00-5.7 0l-3 3a4 4 0 005.7 5.7l1-1M4 4l16 16',
  undo: 'M9 14L4 9l5-5M4 9h10a6 6 0 010 12h-3',
  redo: 'M15 14l5-5-5-5M20 9H10a6 6 0 000 12h3',
};

const svg = (d) => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d={d} />
  </svg>
);

// [key, title, content]
const TOOLS = [
  ['h2', 'Гарчиг', <span key="h">Гарчиг</span>],
  ['bold', 'Тод (Ctrl+B)', <b key="b">B</b>],
  ['italic', 'Налуу (Ctrl+I)', <i key="i">I</i>],
  ['underline', 'Доогуур зураас (Ctrl+U)', <u key="u">U</u>],
  ['ul', 'Жагсаалт', svg(I.ul)],
  ['ol', 'Дугаартай жагсаалт', svg(I.ol)],
  ['quote', 'Ишлэл', svg(I.quote)],
  ['link', 'Холбоос оруулах', svg(I.link)],
  ['unlink', 'Холбоос арилгах', svg(I.unlink)],
  ['undo', 'Буцаах (Ctrl+Z)', svg(I.undo)],
  ['redo', 'Дахин хийх', svg(I.redo)],
];

const escapeHtml = (text) => text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const block = () => String(document.queryCommandValue('formatBlock') || '').toLowerCase().replace(/[<>]/g, '');

export default function RichEditor({ name, defaultValue = '', label }) {
  const area = useRef(null);
  const field = useRef(null);
  const [initial] = useState(() => defaultValue || '<p><br></p>');
  const [html, setHtml] = useState(defaultValue);
  const [empty, setEmpty] = useState(!defaultValue);
  const [active, setActive] = useState({});

  // The hidden input is controlled: with only a defaultValue React would put
  // that back on every re-render (a hidden input's value is its attribute) and
  // the form would send an empty text. It is also written directly, so a save
  // right after typing, before React re-renders, has the text too.
  const sync = () => {
    const value = area.current.innerHTML;
    field.current.value = value;
    setHtml(value);
    setEmpty(!area.current.textContent.trim() && !area.current.querySelector('li'));
  };

  // Highlights the buttons that apply where the cursor is.
  useEffect(() => {
    const onSelection = () => {
      // `area.current` is already null while the editor is being removed (after a save).
      const sel = window.getSelection();
      if (!area.current || !sel || !sel.anchorNode || !area.current.contains(sel.anchorNode)) return;
      setActive({
        h2: block() === 'h2',
        quote: block() === 'blockquote',
        bold: document.queryCommandState('bold'),
        italic: document.queryCommandState('italic'),
        underline: document.queryCommandState('underline'),
        ul: document.queryCommandState('insertUnorderedList'),
        ol: document.queryCommandState('insertOrderedList'),
      });
    };
    document.addEventListener('selectionchange', onSelection);
    return () => document.removeEventListener('selectionchange', onSelection);
  }, []);

  function exec(command, value = null) {
    area.current.focus();
    document.execCommand(command, false, value);
    sync();
  }

  async function addLink() {
    const sel = window.getSelection();
    if (!sel || sel.isCollapsed || !area.current.contains(sel.anchorNode)) {
      await alertDialog('Эхлээд холбоос болгох үг, өгүүлбэрээ хулганаар сонгоно уу.');
      area.current.focus();
      return;
    }
    // The dialog takes the focus and the selection; put the selection back afterwards.
    const range = sel.getRangeAt(0).cloneRange();
    const url = ((await promptDialog('Холбоосын хаяг (жишээ: https://facebook.com/...):', 'https://')) || '').trim();
    area.current.focus();
    sel.removeAllRanges();
    sel.addRange(range);
    if (!url || url === 'https://') return;
    document.execCommand('createLink', false, /^(https?:|mailto:|tel:|\/)/i.test(url) ? url : `https://${url}`);
    sync();
  }

  function run(key) {
    if (key === 'h2') exec('formatBlock', active.h2 ? '<p>' : '<h2>');
    else if (key === 'quote') exec('formatBlock', active.quote ? '<p>' : '<blockquote>');
    else if (key === 'ul') exec('insertUnorderedList');
    else if (key === 'ol') exec('insertOrderedList');
    else if (key === 'link') addLink();
    else exec(key);
  }

  // Pasted text comes in plain (no fonts or colours from Word or websites);
  // blank lines start new paragraphs.
  function onPaste(e) {
    const text = e.clipboardData.getData('text/plain');
    if (!text) return;
    e.preventDefault();
    const parts = text.replace(/\r\n?/g, '\n').trim().split(/\n\s*\n/);
    if (parts.length === 1) document.execCommand('insertText', false, parts[0]);
    else document.execCommand('insertHTML', false, parts.map((p) => `<p>${escapeHtml(p).replace(/\n/g, '<br>')}</p>`).join(''));
    sync();
  }

  return (
    <div className="rte">
      <div className="rte-toolbar" role="toolbar" aria-label="Текст форматлах">
        {TOOLS.map(([key, title, content]) => (
          <button
            key={key}
            type="button"
            className={`rte-btn${active[key] ? ' is-active' : ''}${key === 'h2' ? ' rte-btn-text' : ''}`}
            title={title}
            aria-label={title}
            aria-pressed={key in active ? !!active[key] : undefined}
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => run(key)}
          >
            {content}
          </button>
        ))}
      </div>
      <div
        ref={area}
        className="rte-area"
        contentEditable
        suppressContentEditableWarning
        role="textbox"
        aria-multiline="true"
        aria-label={label}
        data-empty={empty ? 'true' : undefined}
        data-placeholder="Мэдээний текстээ энд бичнэ үү…"
        onFocus={() => document.execCommand('defaultParagraphSeparator', false, 'p')}
        onInput={sync}
        onPaste={onPaste}
        onDrop={(e) => e.dataTransfer.files.length && e.preventDefault()}
        dangerouslySetInnerHTML={{ __html: initial }}
      />
      <input type="hidden" name={name} value={html} ref={field} />
    </div>
  );
}
