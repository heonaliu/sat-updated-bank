import { useState } from 'react';

const COLORS = ['yellow', 'blue', 'pink'];

// Floating toolbar shown on a text selection (fresh draft) or when clicking an
// existing annotation mark (edit mode). Matches the Bluebook annotation
// toolbar: 3 color swatches, an underline toggle, a delete button, and a
// sticky-note button that reveals a small textarea. All of these can apply to
// the same annotation (pick a color AND underline AND a note).
export default function HighlightToolbar({ x, y, activeAnnotation, onPickColor, onToggleUnderline, onSaveNote, onDelete }) {
  const [noteOpen, setNoteOpen] = useState(false);
  const [noteText, setNoteText] = useState(activeAnnotation?.note || '');

  const left = Math.min(x, window.innerWidth - 260);
  const top = Math.max(8, y - 56);

  return (
    <div className="hl-toolbar" style={{ left, top }} onMouseDown={(e) => e.stopPropagation()}>
      {!noteOpen ? (
        <>
          {COLORS.map((c) => (
            <button
              key={c}
              className={`hl-swatch hl-swatch-${c} ${activeAnnotation?.color === c ? 'active' : ''}`}
              title={`Highlight ${c}`}
              onClick={() => onPickColor(c)}
            />
          ))}
          <button
            className={`hl-underline-btn ${activeAnnotation?.underline ? 'active' : ''}`}
            title="Underline"
            onClick={onToggleUnderline}
          >
            <u>U</u>
          </button>
          {activeAnnotation && (
            <button className="hl-icon-btn" title="Delete" onClick={onDelete}>🗑️</button>
          )}
          <button
            className={`hl-icon-btn ${activeAnnotation?.note ? 'active' : ''}`}
            title="Note"
            onClick={() => { setNoteText(activeAnnotation?.note || ''); setNoteOpen(true); }}
          >
            📝
          </button>
        </>
      ) : (
        <div className="hl-note-editor">
          <textarea
            autoFocus
            placeholder="Type a note..."
            value={noteText}
            onChange={(e) => setNoteText(e.target.value)}
          />
          <div className="hl-note-actions">
            <button className="btn ghost small" onClick={() => setNoteOpen(false)}>Cancel</button>
            <button className="btn small" onClick={() => { onSaveNote(noteText.trim()); setNoteOpen(false); }}>Save</button>
          </div>
        </div>
      )}
    </div>
  );
}
