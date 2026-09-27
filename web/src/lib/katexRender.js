import renderMathInElement from 'katex/contrib/auto-render';
import 'katex/dist/katex.min.css';

// Ported from app/app.js renderMathIn — must run BEFORE highlighting.js wraps
// any <mark>/<u> elements into the same container, otherwise a highlight
// boundary landing inside a $...$ span can split it across text nodes and
// silently break KaTeX's delimiter matching.
export function renderMathIn(el) {
  if (!el) return;
  renderMathInElement(el, {
    delimiters: [
      { left: '$$', right: '$$', display: true },
      { left: '\\[', right: '\\]', display: true },
      { left: '$', right: '$', display: false },
      { left: '\\(', right: '\\)', display: false },
    ],
    throwOnError: false,
  });
  // restore literal dollar amounts (see content.js buildContentHtml) in whatever
  // text KaTeX left alone
  const walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT, null);
  const textNodes = [];
  let tn;
  while ((tn = walker.nextNode())) textNodes.push(tn);
  textNodes.forEach((node) => {
    if (node.nodeValue.indexOf('＄') !== -1) node.nodeValue = node.nodeValue.replace(/＄/g, '$');
  });
}
