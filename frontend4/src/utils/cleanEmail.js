/**
 * utils/cleanEmail.js
 * Port of Streamlit's clean_for_display() function.
 */
export function cleanForDisplay(text) {
  if (!text) return '';

  // Strip style/script blocks
  text = text.replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '');
  text = text.replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '');

  // Block-level tags → newlines
  for (const tag of ['p', 'div', 'br', 'tr', 'li', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6']) {
    text = text.replace(new RegExp(`</?${tag}[^>]*>`, 'gi'), '\n');
  }

  // Strip remaining tags
  text = text.replace(/<[^>]+>/g, ' ');

  // Strip invisible Unicode
  text = text.replace(/[\u034f\u00ad\u200b\u200c\u200d\ufeff\u2060\u180e\u00a0]/g, ' ');

  // Process lines
  let lines = text.split('\n').map(l => l.trim());
  lines = lines.filter(l => !/^https?:\/\/\S+$/.test(l));
  lines = lines.filter(l => !(l.length > 80 && !l.includes(' ')));

  text = lines.join('\n');
  text = text.replace(/\n{3,}/g, '\n\n');
  text = text.replace(/[ \t]{2,}/g, ' ');

  return text.trim();
}
