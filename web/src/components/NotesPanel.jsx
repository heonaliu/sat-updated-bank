import { getAnnotationText } from '../lib/highlighting';

export default function NotesPanel({ annotations, onEdit, onRemove }) {
  if (!annotations.length) {
    return <div className="note-empty">Select any text in the question or answers, then choose a highlight color, underline, or note to save it here.</div>;
  }
  return (
    <div className="notes-list">
      {annotations.map((a) => (
        <div className="note-item" key={a.id}>
          <div className={`note-quote hl-${a.color || 'none'} ${a.underline ? 'hl-underline' : ''}`}>"{getAnnotationText(a.id)}"</div>
          {a.note
            ? <div className="note-body">{a.note}</div>
            : <div className="note-body note-empty-inline">(no note attached)</div>}
          <div className="np-actions">
            <button className="btn ghost small" onClick={() => onEdit(a)}>Edit</button>
            <button className="btn ghost small" onClick={() => onRemove(a.id)}>Remove</button>
          </div>
        </div>
      ))}
    </div>
  );
}
