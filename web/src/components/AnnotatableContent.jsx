import { useLayoutEffect, useRef } from 'react';
import { renderMathIn } from '../lib/katexRender';
import { applyAnnotations } from '../lib/highlighting';

// Renders pre-built HTML (from lib/content.js) into a plain DOM node that React
// never reconciles children for, then imperatively — in this exact order —
// (1) runs KaTeX auto-render, (2) splices <mark>/<u> annotation wrappers into
// the now-rendered DOM by character offset. Doing it in the opposite order
// would let a highlight boundary split a "$...$" span across text nodes and
// silently break math rendering.
export default function AnnotatableContent({ hlKey, html, annotations, className }) {
  const ref = useRef(null);

  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.innerHTML = html;
    renderMathIn(el);
    const mine = annotations.filter((a) => a.key === hlKey);
    applyAnnotations(el, mine);
  }, [html, annotations, hlKey]);

  return <div ref={ref} className={className} data-hlkey={hlKey} />;
}
