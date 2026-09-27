// Ported from app/app.js's offset-based highlight system (getTextNodes/
// rangeToOffsets/wrapOffsets/reapplyAllHighlights), extended so one annotation
// can carry a color, an underline, and/or a note simultaneously (matching the
// Bluebook toolbar: color swatches + underline + sticky-note, all optional and
// combinable on the same selected range).
//
// Annotation shape: { id, key, start, end, color: 'yellow'|'blue'|'pink'|null,
//                      underline: boolean, note: string|null }

export function uid() {
  return Math.random().toString(36).slice(2, 10);
}

export function getTextNodes(root) {
  const nodes = [];
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, null);
  let n;
  while ((n = walker.nextNode())) nodes.push(n);
  return nodes;
}

export function rangeToOffsets(root, range) {
  const nodes = getTextNodes(root);
  let offset = 0, start = null, end = null;
  for (const node of nodes) {
    const len = node.nodeValue.length;
    if (node === range.startContainer) start = offset + range.startOffset;
    if (node === range.endContainer) end = offset + range.endOffset;
    offset += len;
  }
  if (start === null || end === null) return null;
  if (start > end) { const t = start; start = end; end = t; }
  return { start, end };
}

function annotationClass(ann) {
  const classes = ['hl'];
  if (ann.color) classes.push('hl-' + ann.color);
  if (ann.underline) classes.push('hl-underline');
  if (ann.note) classes.push('has-note');
  if (!ann.color && !ann.underline) classes.push('hl-note-only');
  return classes.join(' ');
}

export function wrapOffsets(root, ann) {
  const { start, end, id } = ann;
  if (end <= start) return;
  const nodes = getTextNodes(root);
  let offset = 0;
  for (const node of nodes) {
    const len = node.nodeValue.length;
    const nodeStart = offset, nodeEnd = offset + len;
    offset += len;
    if (nodeEnd <= start || nodeStart >= end) continue;
    if (node.parentNode && node.parentNode.classList && node.parentNode.classList.contains('hl')) continue;
    const localStart = Math.max(0, start - nodeStart);
    const localEnd = Math.min(len, end - nodeStart);
    if (localStart >= localEnd) continue;
    const parent = node.parentNode;
    if (!parent) continue;
    const text = node.nodeValue;
    const before = text.slice(0, localStart);
    const mid = text.slice(localStart, localEnd);
    const after = text.slice(localEnd);
    const mark = document.createElement('mark');
    mark.className = annotationClass(ann);
    mark.dataset.annId = id;
    mark.textContent = mid;
    const frag = document.createDocumentFragment();
    if (before) frag.appendChild(document.createTextNode(before));
    frag.appendChild(mark);
    if (after) frag.appendChild(document.createTextNode(after));
    parent.replaceChild(frag, node);
  }
}

// Wraps every annotation belonging to one container (already filtered to its
// hlKey by the caller) into that container's DOM. Must be called AFTER KaTeX
// has rendered the container (see components/AnnotatableContent.jsx) — wrapping
// first would risk splicing a <mark> inside a $...$ span and breaking KaTeX's
// delimiter matching.
export function applyAnnotations(container, annotationsForKey) {
  if (!annotationsForKey || !annotationsForKey.length) return;
  annotationsForKey.slice().sort((a, b) => a.start - b.start).forEach((a) => wrapOffsets(container, a));
}

// Looks up the live rendered text of an annotation by its (globally unique)
// id — used by the notes panel to quote what was highlighted. Annotation
// offsets are relative to post-KaTeX DOM text nodes, so re-deriving the quote
// from the currently-mounted <mark> is simpler than re-computing it.
export function getAnnotationText(id) {
  const mark = document.querySelector(`mark[data-ann-id="${id}"]`);
  return mark ? mark.textContent : '';
}
