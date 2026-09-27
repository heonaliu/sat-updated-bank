import { useRef, useState } from 'react';

// Ported from app/app.js ensureFloatingPanel/makeDraggable — a generic
// draggable overlay used for the Calculator, Reference sheet, Notes list, and
// Directions panels.
export default function FloatingPanel({ title, onClose, children, initialStyle, width }) {
  const panelRef = useRef(null);
  const [pos, setPos] = useState(null);
  const dragState = useRef(null);

  function onHeaderMouseDown(e) {
    const rect = panelRef.current.getBoundingClientRect();
    dragState.current = { offX: e.clientX - rect.left, offY: e.clientY - rect.top };
    function onMove(ev) {
      setPos({ left: Math.max(0, ev.clientX - dragState.current.offX), top: Math.max(0, ev.clientY - dragState.current.offY) });
    }
    function onUp() {
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
    }
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
  }

  const style = pos
    ? { left: pos.left, top: pos.top, right: 'auto', width }
    : { ...initialStyle, width };

  return (
    <div className="floating-panel" ref={panelRef} style={style}>
      <div className="fp-header" onMouseDown={onHeaderMouseDown}>
        {title}
        <button className="fp-close" onClick={onClose}>✕</button>
      </div>
      <div className="fp-body">{children}</div>
    </div>
  );
}
