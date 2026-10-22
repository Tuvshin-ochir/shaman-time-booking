import { Fragment } from 'react';

// Plain text with blank-line paragraphs -> <p> elements, single newlines -> <br>.
export default function Paragraphs({ text }) {
  return String(text || '')
    .split(/\n\s*\n/)
    .map((p) => p.trim())
    .filter(Boolean)
    .map((p, i) => (
      <p key={i}>
        {p.split('\n').map((line, j) => (
          <Fragment key={j}>
            {j > 0 && <br />}
            {line}
          </Fragment>
        ))}
      </p>
    ));
}
