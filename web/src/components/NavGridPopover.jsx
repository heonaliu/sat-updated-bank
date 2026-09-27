// Popover-style question navigator anchored above the "Question X of Y" pill
// (triangle pointer, pin/dashed-box/bookmark-ribbon legend) matching the real
// Bluebook navigator. Unlike the proctored real app, this is a practice tool
// with immediate feedback, so cells also color-code correct/incorrect.
export default function NavGridPopover({ title, indices, questions, progressMap, currentPos, onJump, onClose }) {
  return (
    <div className="nav-popover">
      <div className="nav-popover-arrow" />
      <div className="nav-popover-panel">
        <div className="nav-popover-header">
          <h3>{title}</h3>
          <button className="nav-popover-close" onClick={onClose}>✕</button>
        </div>
        <div className="nav-legend">
          <span><span className="legend-pin">📍</span>Current</span>
          <span><span className="legend-dashed" />Unanswered</span>
          <span><span className="legend-ribbon">🔖</span>For Review</span>
        </div>
        <div className="nav-grid">
          {indices.map((dataIdx, pos) => {
            const q = questions[dataIdx];
            const p = progressMap[q.id];
            let cls = 'nav-cell';
            if (p && p.checked) cls += p.correct ? ' correct' : ' incorrect';
            else if (p && p.selected) cls += ' answered';
            const isCurrent = pos === currentPos;
            return (
              <div key={q.id} className="nav-cell-wrap">
                {isCurrent && <div className="nav-pin">📍</div>}
                <button className={cls + (isCurrent ? ' current' : '')} onClick={() => onJump(pos)}>
                  {pos + 1}
                  {p && p.flagged && <span className="nav-ribbon">🔖</span>}
                </button>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
