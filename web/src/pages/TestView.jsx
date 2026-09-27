import { useEffect, useMemo, useRef, useState } from 'react';
import { useParams, useLocation, useNavigate } from 'react-router-dom';
import { useQuestions } from '../contexts/QuestionsContext';
import { useProgress } from '../contexts/ProgressContext';
import { useAuth } from '../contexts/AuthContext';
import { buildContentHtml, splitPassageAndPrompt } from '../lib/content';
import { CONFIDENCE_OPTIONS, isUnsure } from '../lib/confidence';
import { correctAnswerList, sprCorrect } from '../lib/answers';
import { splitRationale } from '../lib/rationale';
import { getStrategyTip, PASSAGE_BREAKDOWN_TIPS } from '../lib/strategyTips';
import { uid, rangeToOffsets } from '../lib/highlighting';
import { useQuestionTimer, formatTime } from '../hooks/useQuestionTimer';
import AnnotatableContent from '../components/AnnotatableContent';
import RenderedContent from '../components/RenderedContent';
import HighlightToolbar from '../components/HighlightToolbar';
import FloatingPanel from '../components/FloatingPanel';
import NavGridPopover from '../components/NavGridPopover';
import NotesPanel from '../components/NotesPanel';

const SECTION_LABEL = { english: 'Reading and Writing', math: 'Math' };
const LETTERS = ['A', 'B', 'C', 'D'];

const REFERENCE_HTML = `
<div class="ref-content">
  <div class="ref-grid">
    <div class="ref-item"><div class="shape">▭</div>$A = \\ell w$<br><span class="dim">Rectangle area</span></div>
    <div class="ref-item"><div class="shape">△</div>$A = \\frac12 bh$<br><span class="dim">Triangle area</span></div>
    <div class="ref-item"><div class="shape">●</div>$A = \\pi r^2,\\ C = 2\\pi r$<br><span class="dim">Circle area &amp; circumference</span></div>
    <div class="ref-item"><div class="shape">▱</div>$V = \\ell w h$<br><span class="dim">Rectangular prism volume</span></div>
    <div class="ref-item"><div class="shape">🛢️</div>$V = \\pi r^2 h$<br><span class="dim">Cylinder volume</span></div>
    <div class="ref-item"><div class="shape">🔺</div>$V = \\frac13 \\pi r^2 h$<br><span class="dim">Cone volume</span></div>
    <div class="ref-item"><div class="shape">◆</div>$V = \\frac43 \\pi r^3$<br><span class="dim">Sphere volume</span></div>
    <div class="ref-item"><div class="shape">▲</div>$V = \\frac13 \\ell w h$<br><span class="dim">Pyramid volume</span></div>
  </div>
  <h4>Right triangles</h4>
  <p>Pythagorean theorem: $a^2+b^2=c^2$</p>
  <p><b>Special right triangles</b> — 30-60-90: sides in ratio $x : x\\sqrt3 : 2x$. &nbsp; 45-45-90: sides in ratio $x : x : x\\sqrt2$.</p>
  <h4>Angles &amp; circles</h4>
  <p>Sum of angle measures in a triangle $= 180°$. Sum of angle measures in a quadrilateral $= 360°$.</p>
  <p>A circle has $360°$, or $2\\pi$ radians, of arc.</p>
</div>`;

const DIRECTIONS_HTML = `
<div class="ref-content">
  <p>Answer each question using the choices given, or type your answer for fill-in questions.</p>
  <ul>
    <li>Select an answer, then click <b>Check Answer</b> to see if you're right and read the full explanation.</li>
    <li>Click <b>Mark for Review</b> to flag a question and revisit it later.</li>
    <li>Select any text to <b>highlight</b> it (3 colors), <b>underline</b> it, or attach a <b>note</b>.</li>
    <li>Use the <b>ABC</b> button to cross out answer choices you've eliminated.</li>
    <li>Use the question navigator at the bottom to jump between questions.</li>
  </ul>
</div>`;

function getFilteredIndices(questions, progress, mode, domains) {
  const activeDomains = new Set(domains);
  const idxs = [];
  questions.forEach((q, i) => {
    if (activeDomains.size && !activeDomains.has(q.domain)) return;
    const p = progress[q.id];
    if (mode === 'incorrect') { if (!(p && p.checked && !p.correct)) return; }
    else if (mode === 'flagged') { if (!(p && p.flagged)) return; }
    else if (mode === 'unsure') { if (!isUnsure(p)) return; }
    idxs.push(i);
  });
  return idxs;
}

function initialPos(indices, questions, progress, mode) {
  if (mode !== 'all') return 0;
  const firstUnchecked = indices.findIndex((i) => {
    const p = progress[questions[i].id];
    return !p || !p.checked;
  });
  return firstUnchecked >= 0 ? firstUnchecked : 0;
}

const FALLBACK_QUESTION = { id: '__none__', question: '', choices: null, table: null, correctAnswer: [], rationale: '', domain: '', skill: '', difficulty: '' };

export default function TestView() {
  const { subject } = useParams();
  const location = useLocation();
  const navigate = useNavigate();
  const { data } = useQuestions();
  const { progress, getProg, updateQuestionProgress } = useProgress();
  const { user, signOut } = useAuth();

  const mode = location.state?.mode || 'all';
  const domains = useMemo(() => location.state?.domains || [], [location.state]);
  const questions = data[subject];
  const subjectProgress = progress[subject];

  const [indices] = useState(() => getFilteredIndices(questions, subjectProgress, mode, domains));
  const [pos, setPos] = useState(() => initialPos(indices, questions, subjectProgress, mode));
  const [navOpen, setNavOpen] = useState(false);
  const [crossoutMode, setCrossoutMode] = useState(false);
  const [paneHidden, setPaneHidden] = useState(false);
  const [splitPct, setSplitPct] = useState(50);
  const [activePanel, setActivePanel] = useState(null); // 'calc' | 'ref' | 'notes' | 'directions'
  const [toolbar, setToolbar] = useState(null);
  const [sprDraft, setSprDraft] = useState('');
  const [moreOpen, setMoreOpen] = useState(false);
  const bodyRef = useRef(null);

  const hasQuestions = questions.length > 0 && indices.length > 0;
  const dataIdx = hasQuestions ? indices[pos] : 0;
  const q = hasQuestions ? questions[dataIdx] : FALLBACK_QUESTION;
  const prog = getProg(subject, q.id);
  const isEnglish = subject === 'english';

  useEffect(() => {
    setSprDraft(prog.sprInput || '');
    setToolbar(null);
  }, [q.id]); // eslint-disable-line react-hooks/exhaustive-deps

  const timerSec = useQuestionTimer(
    hasQuestions ? `${subject}:${q.id}` : null,
    prog.timeSpentSec || 0,
    (sec) => updateQuestionProgress(subject, q.id, { timeSpentSec: sec }),
    prog.checked
  );

  function patch(fields) {
    updateQuestionProgress(subject, q.id, fields);
  }

  function onChoiceBodyClick(letter) {
    if (prog.checked || prog.eliminated.includes(letter)) return;
    if (crossoutMode) toggleEliminate(letter);
    else patch({ selected: letter });
  }

  function toggleEliminate(letter) {
    if (prog.checked) return;
    const setElim = new Set(prog.eliminated);
    let nextSelected = prog.selected;
    if (setElim.has(letter)) setElim.delete(letter);
    else { setElim.add(letter); if (nextSelected === letter) nextSelected = null; }
    patch({ eliminated: Array.from(setElim), selected: nextSelected });
  }

  function checkAnswer() {
    if (prog.checked) return;
    if (q.choices) {
      if (!prog.selected) return;
      patch({ checked: true, correct: correctAnswerList(q).includes(prog.selected) });
    } else {
      const val = sprDraft.trim();
      if (!val) return;
      patch({ checked: true, correct: sprCorrect(val, correctAnswerList(q)), sprInput: val });
    }
  }

  function clearResponse() {
    patch({ checked: false, correct: null, selected: null, sprInput: '', confidence: null });
    setSprDraft('');
  }

  function toggleFlag() { patch({ flagged: !prog.flagged }); }

  function goNext() { if (pos < indices.length - 1) setPos(pos + 1); else navigate('/'); }
  function goPrev() { if (pos > 0) setPos(pos - 1); }
  function jumpTo(newPos) { setPos(newPos); setNavOpen(false); }

  function handleMouseUp(e) {
    const sel = window.getSelection();
    if (!sel || sel.isCollapsed || sel.rangeCount === 0) return;
    const range = sel.getRangeAt(0);
    const container = e.target.closest('[data-hlkey]');
    if (!container) return;
    if (!container.contains(range.startContainer) || !container.contains(range.endContainer)) return;
    const offsets = rangeToOffsets(container, range);
    if (!offsets || offsets.end - offsets.start < 1) return;
    setToolbar({ x: e.clientX, y: e.clientY, key: container.dataset.hlkey, start: offsets.start, end: offsets.end, annotationId: null });
  }

  function handleBodyClick(e) {
    const mark = e.target.closest('mark.hl');
    if (!mark) return;
    const ann = prog.annotations.find((a) => a.id === mark.dataset.annId);
    if (!ann) return;
    const rect = mark.getBoundingClientRect();
    setToolbar({ x: rect.left, y: rect.top, key: ann.key, start: ann.start, end: ann.end, annotationId: ann.id });
  }

  useEffect(() => {
    function onDocClick(e) {
      if (e.target.closest('.hl-toolbar')) return;
      // A plain click anywhere else dismisses the toolbar so it doesn't sit
      // there blocking the text underneath — but not while the click is part
      // of dragging out a fresh selection (that selection is still non-empty
      // at this point; handleMouseUp already opened the new toolbar for it).
      const sel = window.getSelection();
      if (sel && !sel.isCollapsed) return;
      setToolbar(null);
    }
    // Capture phase: a click on a toolbar button (e.g. "Note") can
    // synchronously swap the toolbar's children, detaching the clicked
    // button from the DOM before a bubble-phase listener would run —
    // e.target.closest() on a detached node fails and incorrectly closes
    // the toolbar. Running in capture phase (before the click reaches its
    // target and any state-driven DOM mutation happens) avoids that race.
    document.addEventListener('click', onDocClick, true);
    return () => document.removeEventListener('click', onDocClick, true);
  }, []);

  function commitAnnotationPatch(fields) {
    if (!toolbar) return;
    let list;
    if (toolbar.annotationId) {
      list = prog.annotations.map((a) => (a.id === toolbar.annotationId ? { ...a, ...fields } : a));
    } else {
      const newAnn = { id: uid(), key: toolbar.key, start: toolbar.start, end: toolbar.end, color: null, underline: false, note: null, ...fields };
      list = [...prog.annotations, newAnn];
      setToolbar((t) => ({ ...t, annotationId: newAnn.id }));
    }
    patch({ annotations: list });
  }

  const activeAnnotation = toolbar?.annotationId ? prog.annotations.find((a) => a.id === toolbar.annotationId) : null;

  function handlePickColor(color) {
    commitAnnotationPatch({ color: activeAnnotation?.color === color ? null : color });
    setToolbar(null);
  }
  function handleToggleUnderline() {
    commitAnnotationPatch({ underline: !(activeAnnotation && activeAnnotation.underline) });
    setToolbar(null);
  }
  function handleSaveNote(text) {
    commitAnnotationPatch({ note: text || null });
    setToolbar(null);
  }
  function handleDeleteAnnotation() {
    if (toolbar?.annotationId) patch({ annotations: prog.annotations.filter((a) => a.id !== toolbar.annotationId) });
    setToolbar(null);
  }

  function onDividerMouseDown(e) {
    e.preventDefault();
    function onMove(ev) {
      const rect = bodyRef.current.getBoundingClientRect();
      let pct = ((ev.clientX - rect.left) / rect.width) * 100;
      pct = Math.min(80, Math.max(20, pct));
      setSplitPct(pct);
    }
    function onUp() {
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
    }
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
  }

  function choiceClass(letter) {
    let cls = 'choice';
    if (prog.eliminated.includes(letter)) cls += ' eliminated';
    if (prog.checked) {
      cls += ' disabled';
      if (correctAnswerList(q).includes(letter)) cls += ' correct-answer';
      else if (prog.selected === letter) cls += ' wrong-answer';
    } else if (prog.selected === letter) {
      cls += ' selected';
    }
    return cls;
  }

  const { passage, prompt } = isEnglish ? splitPassageAndPrompt(q.question) : { passage: '', prompt: '' };
  const passageHtml = isEnglish ? buildContentHtml(passage, q.table) : '';
  const promptHtml = isEnglish ? buildContentHtml(prompt, q.table) : '';
  const stemHtml = buildContentHtml(q.question, q.table);
  const modeLabel = { all: 'Practice', incorrect: 'Reviewing incorrect', flagged: 'Reviewing flagged', unsure: 'Reviewing unsure' }[mode];
  const rationaleParts = prog.checked ? splitRationale(q.rationale, correctAnswerList(q)) : { correct: '', others: [] };
  const strategyTip = prog.checked ? getStrategyTip(subject, q.domain, q.skill) : null;

  if (!hasQuestions) {
    return (
      <div className="test-empty">
        <p>
          {questions.length === 0
            ? 'No questions have been loaded into the database yet.'
            : 'No questions match this filter yet. Try a different filter or answer some questions first.'}
        </p>
        <button className="btn" onClick={() => navigate('/')}>Back to Dashboard</button>
      </div>
    );
  }

  return (
    <div id="view-test">
      <div className="test-topbar">
        <div className="tb-left">
          <div className="tb-titleblock">
            <div className="tb-title">{SECTION_LABEL[subject]}</div>
            <div className="tb-sub">{q.domain} · {q.skill} · {q.difficulty}</div>
            <button className="tb-directions" onClick={() => setActivePanel(activePanel === 'directions' ? null : 'directions')}>
              Directions <span className="chev">⌄</span>
            </button>
          </div>
        </div>
        <div className="tb-right">
          {isEnglish && (
            <button className="hide-pane-btn" onClick={() => setPaneHidden((v) => !v)}>{paneHidden ? 'Show' : 'Hide'}</button>
          )}
          <button className="tb-iconbtn" onClick={() => setActivePanel(activePanel === 'notes' ? null : 'notes')}>
            <span className="tb-icon">🖊️📝</span>
            <span className="tb-icon-label">Highlights &amp; Notes</span>
          </button>
          <div className="more-menu-wrap">
            <button className="tb-iconbtn" onClick={() => setMoreOpen((o) => !o)}>
              <span className="tb-icon">⋮</span>
              <span className="tb-icon-label">More</span>
            </button>
            {moreOpen && (
              <div className="more-menu" onMouseLeave={() => setMoreOpen(false)}>
                <button onClick={() => navigate('/')}>← Exit to Dashboard</button>
                {subject === 'math' && <button onClick={() => { setActivePanel('calc'); setMoreOpen(false); }}>🖩 Calculator</button>}
                {subject === 'math' && <button onClick={() => { setActivePanel('ref'); setMoreOpen(false); }}>📐 Reference Sheet</button>}
                <button onClick={signOut}>Sign out</button>
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="practice-banner">THIS IS A PRACTICE TEST</div>

      <div className="test-body" ref={bodyRef} onMouseUp={handleMouseUp} onClick={handleBodyClick}>
        {isEnglish && !paneHidden && (
          <>
            <div className="pane left" style={{ flex: `0 0 ${splitPct}%` }}>
              <AnnotatableContent className="passage-text" hlKey="passage" html={passageHtml} annotations={prog.annotations} />
            </div>
            <div className="pane-divider" onMouseDown={onDividerMouseDown}>
              <div className="divider-handle">⬌</div>
            </div>
          </>
        )}

        <div className={`pane right ${!isEnglish || paneHidden ? 'full' : ''}`}>
          <div className="q-meta-row">
            <span className="q-number-badge">{pos + 1}</span>
            <button className={`flag-btn ${prog.flagged ? 'flagged' : ''}`} onClick={toggleFlag}>🔖 {prog.flagged ? 'Flagged' : 'Mark for Review'}</button>
            <span className="q-timer">⏱ {formatTime(timerSec)}</span>
            <button className={`abc-btn ${crossoutMode ? 'active' : ''}`} onClick={() => setCrossoutMode((v) => !v)} title="Answer Eliminator">ABC</button>
          </div>

          {isEnglish ? (
            prompt && <AnnotatableContent className="question-text" hlKey="prompt" html={promptHtml} annotations={prog.annotations} />
          ) : (
            <AnnotatableContent className="question-text" hlKey="stem" html={stemHtml} annotations={prog.annotations} />
          )}

          <div className="choices">
            {q.choices ? LETTERS.filter((L) => q.choices[L]).map((L) => (
              <div key={L} className={choiceClass(L)}>
                <div className="choice-main">
                  <div className="letter" onClick={() => onChoiceBodyClick(L)}>{L}</div>
                  <div className="ctext" onClick={() => onChoiceBodyClick(L)}>
                    <AnnotatableContent hlKey={`choice_${L}`} html={buildContentHtml(q.choices[L])} annotations={prog.annotations} />
                  </div>
                </div>
                {prog.eliminated.includes(L) && !prog.checked ? (
                  <span className="undo-link" onClick={() => toggleEliminate(L)}>Undo</span>
                ) : (
                  <div className="crossout-circle" onClick={() => toggleEliminate(L)} title="Cross out">{L}</div>
                )}
              </div>
            )) : (
              <div className="spr-input-row">
                <input
                  type="text"
                  placeholder="Enter your answer"
                  value={sprDraft}
                  disabled={prog.checked}
                  onChange={(e) => setSprDraft(e.target.value)}
                />
                <div className="spr-hint">Enter a whole number, decimal, or fraction (e.g. 3, 24.5, or 49/2).</div>
              </div>
            )}
          </div>

          {!prog.checked ? (
            <div className="check-row">
              <button className="btn" disabled={q.choices ? !prog.selected : !sprDraft.trim()} onClick={checkAnswer}>Check Answer</button>
            </div>
          ) : (
            <>
              <div className={`feedback-box ${prog.correct ? 'correct' : 'incorrect'}`}>
                <div className="fb-title">{prog.correct ? '✓ Correct!' : `✗ Not quite — correct answer: ${correctAnswerList(q).join(' or ')}`}</div>

                <div className="confidence-row">
                  <span className="confidence-prompt">How sure were you?</span>
                  <div className="confidence-btns">
                    {CONFIDENCE_OPTIONS.map((c) => (
                      <button
                        key={c.id}
                        className={`confidence-btn ${c.cls} ${prog.confidence === c.id ? 'selected' : ''}`}
                        onClick={() => patch({ confidence: prog.confidence === c.id ? null : c.id })}
                      >
                        {c.label}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="rationale-section rationale-correct">
                  <div className="rationale-heading">
                    ✓ Why {q.choices ? correctAnswerList(q).join(' or ') : 'this'} is correct
                  </div>
                  <RenderedContent className="rationale-body" html={buildContentHtml(rationaleParts.correct)} />
                </div>

                {rationaleParts.others.length > 0 && (
                  <div className="rationale-section rationale-others">
                    <div className="rationale-heading">✗ Why the other choices are wrong</div>
                    {rationaleParts.others.map((text, i) => (
                      <RenderedContent key={i} className="rationale-body rationale-other-item" html={buildContentHtml(text)} />
                    ))}
                  </div>
                )}

                {(strategyTip || isEnglish) && (
                  <div className="rationale-section strategy-box">
                    {strategyTip && (
                      <>
                        <div className="rationale-heading">💡 Strategy: {q.skill || q.domain}</div>
                        <p className="rationale-body">{strategyTip}</p>
                      </>
                    )}
                    {isEnglish && (
                      <>
                        <div className="rationale-heading">📖 Breaking down long passages</div>
                        <ul className="strategy-list">
                          {PASSAGE_BREAKDOWN_TIPS.map((tip, i) => <li key={i}>{tip}</li>)}
                        </ul>
                      </>
                    )}
                  </div>
                )}
              </div>
              <div className="check-row">
                <button className="btn ghost small" onClick={clearResponse}>Clear response &amp; try again</button>
              </div>
            </>
          )}
        </div>
      </div>

      <div className="test-bottombar">
        <div className="bb-left">{user?.displayName || user?.email}</div>
        <div className="bb-center">
          <div className="bb-nav-anchor">
            <button className="bb-navgrid-btn" onClick={() => setNavOpen((o) => !o)}>
              Question {pos + 1} of {indices.length} ▾
            </button>
            {navOpen && (
              <NavGridPopover
                title={`${SECTION_LABEL[subject]} — ${modeLabel}`}
                indices={indices}
                questions={questions}
                progressMap={subjectProgress}
                currentPos={pos}
                onJump={jumpTo}
                onClose={() => setNavOpen(false)}
              />
            )}
          </div>
        </div>
        <div className="bb-right">
          <button className="btn ghost" onClick={goPrev} disabled={pos === 0}>Back</button>
          <button className="btn" onClick={goNext}>{pos === indices.length - 1 ? 'Finish' : 'Next'}</button>
        </div>
      </div>

      {toolbar && (
        <HighlightToolbar
          x={toolbar.x}
          y={toolbar.y}
          activeAnnotation={activeAnnotation}
          onPickColor={handlePickColor}
          onToggleUnderline={handleToggleUnderline}
          onSaveNote={handleSaveNote}
          onDelete={handleDeleteAnnotation}
        />
      )}

      {activePanel === 'calc' && (
        <FloatingPanel title="🖩 Desmos Calculator" width={420} initialStyle={{ top: 100, right: 40 }} onClose={() => setActivePanel(null)}>
          <iframe src="https://www.desmos.com/calculator" title="Desmos calculator" />
        </FloatingPanel>
      )}
      {activePanel === 'ref' && (
        <FloatingPanel title="📐 Reference Sheet" width={480} initialStyle={{ top: 100, right: 40 }} onClose={() => setActivePanel(null)}>
          <RenderedContent html={REFERENCE_HTML} />
        </FloatingPanel>
      )}
      {activePanel === 'directions' && (
        <FloatingPanel title="ℹ️ Directions" width={420} initialStyle={{ top: 110, left: '50%', marginLeft: -210 }} onClose={() => setActivePanel(null)}>
          <RenderedContent html={DIRECTIONS_HTML} />
        </FloatingPanel>
      )}
      {activePanel === 'notes' && (
        <FloatingPanel title="🖊️ Highlights & Notes" width={320} initialStyle={{ top: 100, right: 40 }} onClose={() => setActivePanel(null)}>
          <NotesPanel
            annotations={prog.annotations}
            onEdit={(a) => setToolbar({ x: window.innerWidth - 360, y: 140, key: a.key, start: a.start, end: a.end, annotationId: a.id })}
            onRemove={(id) => patch({ annotations: prog.annotations.filter((a) => a.id !== id) })}
          />
        </FloatingPanel>
      )}
    </div>
  );
}
