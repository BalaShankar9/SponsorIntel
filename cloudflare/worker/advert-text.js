import { Parser } from 'htmlparser2';
import { decodeHTML } from 'entities';

const blocks = new Set(['p','div','li','h1','h2','h3','h4','h5','h6','section','article','header','footer','blockquote','ul','ol','dl','dt','dd','table','tr']);
const excluded = new Set(['script','style']);
const tidy = text => text.replace(/\u00a0/g, ' ').replace(/[ \t]+/g, ' ').replace(/\n\s*\n\s*\n/g, '\n\n').trim();

// Plain fields are already text. Parsing them again can erase comparisons or
// literal angle-bracket examples from an employer's requirements.
export const advertPlainText = value => tidy(String(value || ''));

// Text extraction only, never an HTML sanitizer. Callers render the returned
// string as escaped text. The parser handles > inside quoted attributes and
// entities without executing scripts or following any links.
export function advertHTMLText(value, encoded = false) {
  let html = String(value || '');
  // Greenhouse can return one HTML-encoded transport layer. Decode that layer
  // only when no literal tags are present; never recursively parse text nodes.
  if (encoded && !/<\/?[a-z][a-z0-9-]*[\s>]/i.test(html) && /&lt;\/?[a-z]/i.test(html)) html = decodeHTML(html);
  const parts = [];
  let suppressed = 0;
  const parser = new Parser({
    onopentag(name) {
      if (excluded.has(name)) suppressed++;
      if (!suppressed && (blocks.has(name) || name === 'br')) parts.push('\n');
    },
    ontext(text) { if (!suppressed) parts.push(text); },
    onclosetag(name) {
      if (excluded.has(name)) suppressed = Math.max(0, suppressed - 1);
      else if (!suppressed && blocks.has(name)) parts.push('\n');
    },
  }, { decodeEntities: true });
  parser.end(html);
  return tidy(parts.join(''));
}
