// Small Markdown renderer for docs/ADMIN_GUIDE.md (shown at /admin/guide).
// Supports: # / ## / ### headings, paragraphs (single newlines become <br>),
// - and 1. lists (nested by indentation), > quotes, | tables |, **bold**,
// *italic*, `code` and bare http(s) links. Everything is HTML-escaped first.
const { escapeHtml } = require('./http');

function inline(text) {
  const codes = [];
  let out = escapeHtml(text).replace(/`([^`]+)`/g, (_, code) => `\u0000${codes.push(code) - 1}\u0000`);
  out = out
    .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
    .replace(/(^|[\s(«])\*([^*\s][^*]*)\*/g, '$1<em>$2</em>')
    .replace(/https?:\/\/[^\s<]*[^\s<.,;:!?)»]/g, (url) => `<a href="${url}" target="_blank" rel="noopener">${url}</a>`);
  return out.replace(/\u0000(\d+)\u0000/g, (_, i) => `<code>${codes[i]}</code>`);
}

const LIST_RE = /^(\s*)([-*]|\d+\.)\s+(.*)$/;
const isList = (line) => LIST_RE.test(line);
const startsBlock = (line) => /^#{1,3}\s/.test(line) || line.startsWith('>') || line.startsWith('|') || isList(line);

// items: [{ indent, ordered, text }] -> [html, next index]
function list(items, start, indent) {
  const tag = items[start].ordered ? 'ol' : 'ul';
  let out = `<${tag}>`;
  let i = start;
  while (i < items.length && items[i].indent >= indent) {
    // A "-" list followed directly by a "1." list at the same level starts a new list.
    if (items[i].indent === indent && items[i].ordered !== items[start].ordered) break;
    if (items[i].indent > indent) {
      const [nested, next] = list(items, i, items[i].indent);
      out = out.replace(/<\/li>$/, `${nested}</li>`);
      i = next;
    } else {
      out += `<li>${inline(items[i].text)}</li>`;
      i++;
    }
  }
  return [`${out}</${tag}>`, i];
}

// Returns { title, toc: [{ id, text }], html }. The # title is returned
// separately; ## headings get ids and make up the table of contents.
function render(markdown) {
  const lines = String(markdown).replace(/\r\n/g, '\n').split('\n');
  const html = [];
  const toc = [];
  let title = '';
  let i = 0;

  while (i < lines.length) {
    const line = lines[i];
    if (!line.trim()) {
      i++;
      continue;
    }

    const heading = /^(#{1,3})\s+(.*)$/.exec(line);
    if (heading) {
      const level = heading[1].length;
      if (level === 1) title = heading[2];
      else if (level === 2) {
        const id = `s${toc.length + 1}`;
        toc.push({ id, text: heading[2] });
        html.push(`<h2 id="${id}">${inline(heading[2])}</h2>`);
      } else html.push(`<h3>${inline(heading[2])}</h3>`);
      i++;
      continue;
    }

    if (line.startsWith('>')) {
      const quote = [];
      while (i < lines.length && lines[i].startsWith('>')) quote.push(lines[i++].replace(/^>\s?/, ''));
      html.push(`<blockquote>${quote.map((q) => `<p>${inline(q)}</p>`).join('')}</blockquote>`);
      continue;
    }

    if (line.startsWith('|')) {
      const rows = [];
      while (i < lines.length && lines[i].startsWith('|')) rows.push(lines[i++]);
      const cells = (row) => row.replace(/^\||\|$/g, '').split('|').map((c) => c.trim());
      const [head, , ...body] = rows;
      html.push(
        `<table><thead><tr>${cells(head).map((c) => `<th>${inline(c)}</th>`).join('')}</tr></thead><tbody>` +
          body.map((r) => `<tr>${cells(r).map((c) => `<td>${inline(c)}</td>`).join('')}</tr>`).join('') +
          '</tbody></table>'
      );
      continue;
    }

    if (isList(line)) {
      const items = [];
      while (i < lines.length && isList(lines[i])) {
        const [, spaces, marker, text] = LIST_RE.exec(lines[i++]);
        items.push({ indent: spaces.length, ordered: /\d/.test(marker), text });
      }
      for (let k = 0; k < items.length; ) {
        const [listHtml, next] = list(items, k, items[k].indent);
        html.push(listHtml);
        k = next;
      }
      continue;
    }

    const paragraph = [];
    while (i < lines.length && lines[i].trim() && !startsBlock(lines[i])) paragraph.push(lines[i++]);
    html.push(`<p>${paragraph.map(inline).join('<br>')}</p>`);
  }

  return { title, toc, html: html.join('\n') };
}

module.exports = { render, inline };
