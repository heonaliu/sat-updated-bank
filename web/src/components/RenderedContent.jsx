import { useLayoutEffect, useRef } from 'react';
import { renderMathIn } from '../lib/katexRender';

// Like AnnotatableContent but for text that was never highlightable in the
// original app (rationale, reference sheet, strategy guide) — KaTeX only, no
// data-hlkey / annotation wrapping.
export default function RenderedContent({ html, className }) {
  const ref = useRef(null);
  useLayoutEffect(() => {
    if (!ref.current) return;
    ref.current.innerHTML = html;
    renderMathIn(ref.current);
  }, [html]);
  return <div ref={ref} className={className} />;
}
