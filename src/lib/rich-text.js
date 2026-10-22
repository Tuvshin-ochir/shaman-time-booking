// HTML from the news editor (components/admin/RichEditor.js). Whatever the
// browser sends is rebuilt from an allow-list: a few formatting tags, no
// attributes except a checked link address, all text escaped, every tag closed.
// So stored news can be put on the page as HTML without risk.

const ALLOWED = new Set(['p', 'h2', 'h3', 'ul', 'ol', 'li', 'blockquote', 'strong', 'em', 'u', 'a', 'br']);
const BLOCKS = new Set(['p', 'h2', 'h3', 'ul', 'ol', 'blockquote']);
const RENAME = { b: 'strong', i: 'em', div: 'p', h1: 'h2', h4: 'h3', h5: 'h3', h6: 'h3' };
// Dropped together with their content.
const DROP = /<(script|style|template|iframe|object|embed|svg|math|noscript|textarea|select|title|head)\b[\s\S]*?<\/\1\s*>/gi;
const ENTITY = /&(?!(?:[a-zA-Z][a-zA-Z0-9]{1,31}|#\d{1,7}|#x[0-9a-fA-F]{1,6});)/g;

const escapeText = (text) => text.replace(ENTITY, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const escapeAttr = (text) => text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

function decode(text) {
  return text
    .replace(/&nbsp;/g, ' ')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;/g, "'")
    .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(Number(n)))
    .replace(/&amp;/g, '&');
}

// http(s), mailto, tel or a path on this site; anything else is not a link.
function safeHref(attrs) {
  const m = /\bhref\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'>]+))/i.exec(attrs);
  if (!m) return null;
  const href = decode(m[1] ?? m[2] ?? m[3]).trim();
  if (/^\/(?!\/)/.test(href)) return href;
  try {
    return ['http:', 'https:', 'mailto:', 'tel:'].includes(new URL(href).protocol) ? href : null;
  } catch {
    return null;
  }
}

function sanitize(input) {
  const html = String(input || '')
    .replace(/<!--[\s\S]*?-->/g, '')
    .replace(DROP, '');
  const out = [];
  const open = [];
  for (const m of html.matchAll(/<(\/?)([a-zA-Z][a-zA-Z0-9]*)\b([^>]*)>|([^<]+)|</g)) {
    if (m[2] === undefined) {
      out.push(escapeText(m[4] ?? '<'));
      continue;
    }
    const name = RENAME[m[2].toLowerCase()] || m[2].toLowerCase();
    if (!ALLOWED.has(name)) continue;
    if (m[1]) {
      const at = open.lastIndexOf(name);
      if (at === -1) continue;
      while (open.length > at) out.push(`</${open.pop()}>`);
    } else if (name === 'br') {
      out.push('<br>');
    } else if (name === 'a') {
      const href = open.includes('a') ? null : safeHref(m[3]);
      if (!href) continue;
      const external = /^https?:/i.test(href);
      out.push(`<a href="${escapeAttr(href)}"${external ? ' target="_blank" rel="noopener noreferrer"' : ''}>`);
      open.push('a');
    } else {
      // A paragraph cannot hold a list or heading (browsers wrap lists in a div,
      // which becomes a p here): end it first, as the browser would.
      if (BLOCKS.has(name) && open.at(-1) === 'p') out.push(`</${open.pop()}>`);
      out.push(`<${name}>`);
      open.push(name);
    }
  }
  while (open.length) out.push(`</${open.pop()}>`);
  // Empty paragraphs (extra Enter presses, leftovers of the above).
  return out
    .join('')
    .replace(/<p>(?:\s|<br>|&nbsp;)*<\/p>/g, '')
    .trim();
}

// Plain text (for excerpts and page descriptions).
function toText(html) {
  return decode(
    String(html || '')
      .replace(/<br>|<\/(p|h2|h3|li|blockquote)>/g, ' ')
      .replace(/<[^>]*>/g, '')
  )
    .replace(/\s+/g, ' ')
    .trim();
}

export { sanitize, toText };
