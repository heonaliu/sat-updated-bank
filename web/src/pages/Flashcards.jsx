import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { deleteField, doc, onSnapshot, setDoc } from 'firebase/firestore';
import { db } from '../firebase';
import { useAuth } from '../contexts/AuthContext';
import { FLASHCARD_TESTS } from '../lib/flashcards';

const ALL = 'All';
// Month label for user-added cards that aren't tied to a specific test.
const MY_CARDS = 'My cards';

// Self-ratings, saved per word (so a word that appeared on several tests shares
// one rating). "Don't know" and "not sure" both land in the Still learning pile.
const RATINGS = [
  { id: 'dont_know', label: "I don't know", cls: 'dont-know' },
  { id: 'not_sure', label: "I'm not sure", cls: 'not-sure' },
  { id: 'confident', label: 'Confident', cls: 'confident' },
];
const RATING_LABEL = Object.fromEntries(RATINGS.map((r) => [r.id, r.label]));

const PILES = [
  { id: ALL, label: 'All cards', test: () => true },
  { id: 'learning', label: 'Still learning', test: (r) => r === 'dont_know' || r === 'not_sure' },
  { id: 'confident', label: 'Confident', test: (r) => r === 'confident' },
  { id: 'unrated', label: 'Not rated yet', test: (r) => !r },
];

const BUILT_IN_MONTHS = FLASHCARD_TESTS.map((t) => t.month);
const BUILT_IN_CARDS = FLASHCARD_TESTS.flatMap((t) =>
  t.cards.map((c) => ({ ...c, month: t.month, key: `${t.month}:${c.word}` }))
);

function shuffledKeys(cards) {
  const a = cards.map((c) => c.key);
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

// Subscribes to one of the user's progress docs and returns [data, merge].
// `merge` writes a partial update both locally (optimistic) and to Firestore.
function useUserDoc(name) {
  const { user } = useAuth();
  const [data, setData] = useState({});

  useEffect(() => {
    if (!user) return undefined;
    return onSnapshot(doc(db, 'users', user.uid, 'progress', name), (snap) => {
      setData(snap.exists() ? snap.data() : {});
    });
  }, [user, name]);

  function merge(patch) {
    if (!user) return;
    setData((prev) => {
      const next = { ...prev, ...patch };
      Object.keys(patch).forEach((k) => { if (patch[k] === null) delete next[k]; });
      return next;
    });
    const firestorePatch = Object.fromEntries(
      Object.entries(patch).map(([k, v]) => [k, v === null ? deleteField() : v])
    );
    setDoc(doc(db, 'users', user.uid, 'progress', name), firestorePatch, { merge: true })
      .catch((err) => console.error(`Failed to save ${name}`, err));
  }

  return [data, merge];
}

const EMPTY_FORM = { word: '', definition: '', examples: '', month: '' };

function CardForm({ initial, months, onSave, onCancel }) {
  const [form, setForm] = useState(initial || EMPTY_FORM);
  const set = (field) => (e) => setForm((f) => ({ ...f, [field]: e.target.value }));

  function submit(e) {
    e.preventDefault();
    if (!form.word.trim() || !form.definition.trim()) return;
    onSave({
      word: form.word.trim(),
      definition: form.definition.trim(),
      examples: form.examples.split('\n').map((s) => s.trim()).filter(Boolean),
      // Capitalize so "october" and "October" land under the same chip.
      month: form.month.trim().replace(/^./, (ch) => ch.toUpperCase()),
    });
  }

  return (
    <form className="fc-form" onSubmit={submit}>
      <h3>{initial ? 'Edit flashcard' : 'Add a flashcard'}</h3>
      <label>
        Word or phrase
        <input value={form.word} onChange={set('word')} autoFocus required />
      </label>
      <label>
        Definition
        <textarea rows={2} value={form.definition} onChange={set('definition')} required />
      </label>
      <label>
        Example sentences <span className="fc-optional">optional, one per line</span>
        <textarea rows={3} value={form.examples} onChange={set('examples')} />
      </label>
      <label>
        SAT month <span className="fc-optional">optional — leave blank for “{MY_CARDS}”</span>
        <input value={form.month} onChange={set('month')} list="fc-month-options" placeholder="e.g. October" />
        <datalist id="fc-month-options">
          {months.map((m) => <option key={m} value={m} />)}
        </datalist>
      </label>
      <div className="fc-form-actions">
        <button type="button" className="btn ghost" onClick={onCancel}>Cancel</button>
        <button type="submit" className="btn">{initial ? 'Save changes' : 'Add card'}</button>
      </div>
    </form>
  );
}

export default function Flashcards() {
  const navigate = useNavigate();
  const [ratings, mergeRatings] = useUserDoc('flashcards');
  const [customById, mergeCustom] = useUserDoc('custom_flashcards');
  const [month, setMonth] = useState(ALL);
  const [pile, setPile] = useState(ALL);
  const [order, setOrder] = useState(null); // null = original order, else shuffled card keys
  const [idx, setIdx] = useState(0);
  const [flipped, setFlipped] = useState(false);
  const [editing, setEditing] = useState(null); // null | 'new' | custom card id
  const [jumpTo, setJumpTo] = useState(null); // card key to show once it's in the deck

  const customCards = useMemo(
    () => Object.entries(customById)
      .map(([id, c]) => ({ ...c, id, custom: true, month: c.month || MY_CARDS, key: `custom:${id}` }))
      .sort((a, b) => (a.createdAt || 0) - (b.createdAt || 0)),
    [customById]
  );
  const allCards = useMemo(() => [...BUILT_IN_CARDS, ...customCards], [customCards]);
  const months = useMemo(() => {
    const extra = [...new Set(customCards.map((c) => c.month))]
      .filter((m) => !BUILT_IN_MONTHS.includes(m) && m !== MY_CARDS);
    const hasMine = customCards.some((c) => c.month === MY_CARDS);
    return [...BUILT_IN_MONTHS, ...extra, ...(hasMine ? [MY_CARDS] : [])];
  }, [customCards]);
  // word -> every month it showed up on, so a card can call out repeat words.
  const monthsByWord = useMemo(() => allCards.reduce((acc, c) => {
    const k = c.word.toLowerCase();
    if (c.month !== MY_CARDS && !(acc[k] ||= []).includes(c.month)) acc[k].push(c.month);
    return acc;
  }, {}), [allCards]);

  // Editing/deleting a custom card can empty out the month being filtered on.
  const activeMonth = month === ALL || months.includes(month) ? month : ALL;
  const monthCards = useMemo(
    () => (activeMonth === ALL ? allCards : allCards.filter((c) => c.month === activeMonth)),
    [activeMonth, allCards]
  );
  const pileTest = PILES.find((p) => p.id === pile).test;
  const deck = useMemo(() => {
    const byKey = Object.fromEntries(monthCards.map((c) => [c.key, c]));
    // Cards added after shuffling go at the end of the shuffled order.
    const ordered = order
      ? [...order.map((k) => byKey[k]).filter(Boolean), ...monthCards.filter((c) => !order.includes(c.key))]
      : monthCards;
    return ordered.filter((c) => pileTest(ratings[c.word]));
  }, [monthCards, order, pileTest, ratings]);

  const pos = deck.length ? Math.min(idx, deck.length - 1) : 0;
  const card = deck[pos];

  useEffect(() => {
    if (!jumpTo) return;
    const i = deck.findIndex((c) => c.key === jumpTo);
    if (i !== -1) {
      setIdx(i);
      setJumpTo(null);
    }
  }, [deck, jumpTo]);

  function reset() {
    setIdx(0);
    setFlipped(false);
  }
  function selectMonth(m) {
    setMonth(m);
    setOrder(null);
    reset();
  }
  function selectPile(p) {
    setPile(p);
    reset();
  }
  function go(delta) {
    if (!deck.length) return;
    setIdx((pos + delta + deck.length) % deck.length);
    setFlipped(false);
  }
  function toggleShuffle() {
    setOrder(order ? null : shuffledKeys(monthCards));
    reset();
  }
  function handleRate(rating) {
    mergeRatings({ [card.word]: rating });
    setFlipped(false);
    // If the new rating moves the card out of the pile being studied, the next
    // card slides into this position on its own; otherwise step forward.
    if (pileTest(rating)) setIdx(pos + 1 < deck.length ? pos + 1 : 0);
    else setIdx(pos + 1 < deck.length ? pos : 0);
  }

  function saveCard(fields) {
    let id = editing;
    if (editing === 'new') {
      id = `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
      mergeCustom({ [id]: { ...fields, createdAt: Date.now() } });
    } else {
      mergeCustom({ [id]: { ...customById[id], ...fields } });
    }
    // Show the card that was just added/edited, under the month it now belongs to.
    setMonth(fields.month || MY_CARDS);
    setPile(ALL);
    setOrder(null);
    setJumpTo(`custom:${id}`);
    setFlipped(false);
    setEditing(null);
  }
  function deleteCard(c) {
    if (!window.confirm(`Delete your flashcard “${c.word}”?`)) return;
    mergeCustom({ [c.id]: null });
    setFlipped(false);
  }

  useEffect(() => {
    function onKey(e) {
      if (editing || e.target.closest('input, textarea')) return;
      if (e.key === 'ArrowRight') go(1);
      else if (e.key === 'ArrowLeft') go(-1);
      else if (e.key === ' ' || e.key === 'Enter') { e.preventDefault(); setFlipped((f) => !f); }
      else if (flipped && card && ['1', '2', '3'].includes(e.key)) handleRate(RATINGS[Number(e.key) - 1].id);
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });

  const otherMonths = card ? (monthsByWord[card.word.toLowerCase()] || []).filter((m) => m !== card.month) : [];
  const currentRating = card && ratings[card.word];
  const editingCard = editing && editing !== 'new' ? customById[editing] : null;

  return (
    <div id="view-flashcards">
      <button className="btn ghost back-home-link" onClick={() => navigate('/')}>← Back to Dashboard</button>
      <div className="fc-wrap">
        <div className="fc-header">
          <h1>Flashcards</h1>
          {!editing && <button className="btn" onClick={() => setEditing('new')}>+ Add flashcard</button>}
        </div>
        <p className="home-sub">Vocabulary from past SATs, labeled by the month of the test it appeared on.</p>

        {editing && (
          <CardForm
            key={editing}
            initial={editingCard && {
              word: editingCard.word,
              definition: editingCard.definition,
              examples: (editingCard.examples || []).join('\n'),
              month: editingCard.month || '',
            }}
            months={months.filter((m) => m !== MY_CARDS)}
            onSave={saveCard}
            onCancel={() => setEditing(null)}
          />
        )}

        <div className="fc-filter">
          <span className="fc-filter-label">Test</span>
          <div className="chip-row">
            {[ALL, ...months].map((m) => {
              const count = m === ALL ? allCards.length : allCards.filter((c) => c.month === m).length;
              const label = m === ALL ? 'All tests' : m === MY_CARDS ? MY_CARDS : `${m} SAT`;
              return (
                <span key={m} className={`chip ${activeMonth === m ? 'active' : ''}`} onClick={() => selectMonth(m)}>
                  {label} ({count})
                </span>
              );
            })}
          </div>
        </div>
        <div className="fc-filter">
          <span className="fc-filter-label">Pile</span>
          <div className="chip-row">
            {PILES.map((p) => (
              <span key={p.id} className={`chip ${pile === p.id ? 'active' : ''}`} onClick={() => selectPile(p.id)}>
                {p.label} ({monthCards.filter((c) => p.test(ratings[c.word])).length})
              </span>
            ))}
          </div>
        </div>

        {!card ? (
          <div className="fc-empty">No cards in this pile yet.</div>
        ) : (
          <>
            <div className={`fc-card ${flipped ? 'flipped' : ''}`} onClick={() => setFlipped((f) => !f)}>
              <div className="fc-tags">
                <span className="fc-month">{card.month === MY_CARDS ? MY_CARDS : `${card.month} SAT`}</span>
                {card.custom && <span className="fc-mine">Added by you</span>}
                {otherMonths.length > 0 && <span className="fc-repeat">Also on {otherMonths.join(' & ')}</span>}
                {currentRating && (
                  <span className={`fc-rating-tag ${RATINGS.find((r) => r.id === currentRating).cls}`}>
                    {RATING_LABEL[currentRating]}
                  </span>
                )}
              </div>
              {!flipped ? (
                <div className="fc-front">
                  <div className="fc-word">{card.word}</div>
                  <div className="fc-hint">Click or press Space to reveal</div>
                </div>
              ) : (
                <div className="fc-back">
                  <div className="fc-word small">{card.word}</div>
                  <p className="fc-def">{card.definition}</p>
                  {card.examples?.length > 0 && (
                    <ul className="fc-examples">
                      {card.examples.map((ex) => <li key={ex}>“{ex}”</li>)}
                    </ul>
                  )}
                  {card.note && <p className="fc-note">Note: {card.note}</p>}
                </div>
              )}
              {card.custom && (
                <div className="fc-card-actions" onClick={(e) => e.stopPropagation()}>
                  <button onClick={() => setEditing(card.id)}>Edit</button>
                  <button className="danger" onClick={() => deleteCard(card)}>Delete</button>
                </div>
              )}
            </div>

            {flipped && (
              <div className="fc-rate">
                <span className="fc-rate-prompt">How well did you know it?</span>
                <div className="fc-rate-btns">
                  {RATINGS.map((r, i) => (
                    <button
                      key={r.id}
                      className={`fc-rate-btn ${r.cls} ${currentRating === r.id ? 'current' : ''}`}
                      onClick={() => handleRate(r.id)}
                    >
                      {r.label} <kbd>{i + 1}</kbd>
                    </button>
                  ))}
                </div>
              </div>
            )}

            <div className="fc-controls">
              <button className="btn secondary" onClick={() => go(-1)}>← Prev</button>
              <span className="fc-count">{pos + 1} / {deck.length}</span>
              <button className="btn secondary" onClick={() => go(1)}>Next →</button>
              <button className={`btn ${order ? '' : 'ghost'}`} onClick={toggleShuffle}>
                {order ? 'Shuffled ✓' : 'Shuffle'}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
