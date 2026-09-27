// Ported from app/app.js buildTableHtml/buildContentHtml — figure/table marker
// substitution plus the KaTeX "\$" escaping workaround. Returns plain HTML with
// NO highlight marks spliced in (highlighting.js wraps marks after KaTeX runs).

export function escapeHtml(s) {
  return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

// Only wrap a cell in $...$ (KaTeX) when it actually looks like a number or a
// short algebraic token (e.g. "6.20", "-34", "t+23") — plain English words
// (table cells like "Canada" or "adults" in R&W command-of-evidence tables)
// must NOT go through KaTeX, which would render them as italicized math
// variables with no real word-spacing.
const MATHY_CELL = /^[-+]?[\d.]+%?$/;
const VAR_EXPR_CELL = /^[a-zA-Z](\s*[+\-]\s*[\d.]+)+$/;
function isMathyCell(c) {
  const s = String(c).trim();
  return MATHY_CELL.test(s) || VAR_EXPR_CELL.test(s);
}
function cellHtml(c) {
  return isMathyCell(c) ? `$${escapeHtml(c)}$` : escapeHtml(c);
}

export function buildTableHtml(table) {
  if (!table) return '';
  let html = '<table class="q-table">';
  if (table.title) html += `<caption>${escapeHtml(table.title)}</caption>`;
  html += '<thead><tr>';
  table.headers.forEach((h) => { html += `<th>${cellHtml(h)}</th>`; });
  html += '</tr></thead><tbody>';
  table.rows.forEach((row) => {
    html += '<tr>';
    // rows are stored as {cells: [...]} — Firestore disallows arrays nested
    // directly inside arrays, so a plain string[][] isn't representable.
    row.cells.forEach((c) => { html += `<td>${cellHtml(c)}</td>`; });
    html += '</tr>';
  });
  html += '</tbody></table>';
  return html;
}

// English question text has the passage and the actual prompt ("Which choice
// completes the text...") concatenated into one string with no machine-readable
// delimiter between them. Bluebook shows the passage on the left and only the
// prompt sentence on the right next to the choices, so split on the rightmost
// occurrence of a common SAT prompt-sentence starter. Not bulletproof for every
// possible phrasing, but covers the vast majority of real R&W prompts; anything
// unmatched just keeps the whole text as "passage" with no separate prompt line.
const PROMPT_STARTERS = ['Which ', 'What ', 'How ', 'According to ', 'Based on ', 'As used ', 'Taken together', 'Assuming ', 'Information in the text '];

export function splitPassageAndPrompt(text) {
  if (!text) return { passage: '', prompt: '' };
  let bestIdx = -1;
  for (const starter of PROMPT_STARTERS) {
    let idx = text.lastIndexOf(starter);
    while (idx > 0 && !/\s/.test(text[idx - 1])) idx = text.lastIndexOf(starter, idx - 1);
    if (idx > bestIdx) bestIdx = idx;
  }
  if (bestIdx === -1) return { passage: text, prompt: '' };
  return { passage: text.slice(0, bestIdx).trim(), prompt: text.slice(bestIdx).trim() };
}

export function buildContentHtml(text, table) {
  if (text == null) return '';
  // [[U]]...[[/U]] marks a sentence that's underlined in the original SAT
  // question (used by Command of Evidence prompts like "which choice best
  // supports the underlined claim?") — rendered as a real <u>, separate from
  // the user-highlighting system's own .hl-underline annotation class.
  const parts = String(text).split(/(\[\[(?:FIGURE:[^\]]+|TABLE|U|\/U)\]\])/g);
  // Figures/tables are pulled out and rendered above the question text as a
  // block, regardless of where the [[FIGURE:...]]/[[TABLE]] marker happens to
  // fall in the source string — matches Bluebook showing the image/table up
  // top rather than wherever it's referenced mid-paragraph.
  let mediaHtml = '';
  let bodyHtml = '';
  parts.forEach((part) => {
    const figMatch = part.match(/^\[\[FIGURE:([^\]]+)\]\]$/);
    if (figMatch) {
      mediaHtml += `<div class="figure-wrap"><img src="/assets/figs/${figMatch[1]}" alt="figure"></div>`;
    } else if (part === '[[TABLE]]') {
      mediaHtml += buildTableHtml(table);
    } else if (part === '[[U]]') {
      bodyHtml += '<u>';
    } else if (part === '[[/U]]') {
      bodyHtml += '</u>';
    } else {
      // KaTeX auto-render's $ delimiter doesn't reliably respect a backslash escape,
      // so swap literal "\$" (a real dollar amount) for a look-alike char it won't match,
      // then swap it back after auto-render has scanned the DOM (see renderMathIn).
      bodyHtml += escapeHtml(part).replace(/\\\$/g, '＄');
    }
  });
  return mediaHtml + bodyHtml;
}
