/* ============================================================
   SAT Cram — core application logic
   ============================================================ */

const LS_KEY = 'sat_cram_progress_v2';

const DATA = {
  english: ENGLISH_QUESTIONS,
  math: MATH_QUESTIONS,
};

const SECTION_LABEL = {
  english: 'Reading and Writing',
  math: 'Math',
};

let PROGRESS = loadProgress();

let STATE = {
  section: null,        // 'english' | 'math'
  mode: 'all',           // 'all' | 'incorrect' | 'flagged'
  indices: [],           // filtered list of dataset indices for current session
  pos: 0,                // position within STATE.indices
  filters: { english: new Set(), math: new Set() }, // selected domains (empty = all)
};

/* ---------------- utils ---------------- */
function $(sel, root) { return (root || document).querySelector(sel); }
function $all(sel, root) { return Array.from((root || document).querySelectorAll(sel)); }
function escapeHtml(s) {
  return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}
function uid() { return Math.random().toString(36).slice(2, 10); }

function loadProgress() {
  try {
    const raw = localStorage.getItem(LS_KEY);
    if (raw) return JSON.parse(raw);
  } catch (e) { console.warn('progress load failed', e); }
  return { english: {}, math: {} };
}
function saveProgress() {
  try { localStorage.setItem(LS_KEY, JSON.stringify(PROGRESS)); }
  catch (e) { console.warn('progress save failed', e); }
}
function getProg(section, id) {
  if (!PROGRESS[section][id]) {
    PROGRESS[section][id] = {
      selected: null, sprInput: '', checked: false, correct: null,
      flagged: false, highlights: [],
    };
  }
  return PROGRESS[section][id];
}
function correctAnswerList(q) {
  return Array.isArray(q.correctAnswer) ? q.correctAnswer : [q.correctAnswer];
}
function parseNum(str) {
  str = String(str).trim();
  if (str === '') return NaN;
  const fracMatch = str.match(/^-?\d+(\.\d+)?\s*\/\s*-?\d+(\.\d+)?$/);
  if (fracMatch) {
    const parts = str.split('/');
    return parseFloat(parts[0]) / parseFloat(parts[1]);
  }
  return parseFloat(str.replace(/,/g, ''));
}
function sprCorrect(userInput, accepted) {
  const uv = parseNum(userInput);
  if (isNaN(uv)) return false;
  return accepted.some((a) => {
    const av = parseNum(a);
    if (isNaN(av)) return false;
    const tol = Math.max(0.005, Math.abs(av) * 0.005);
    return Math.abs(uv - av) <= tol;
  });
}

/* ---------------- content rendering (text -> HTML incl. figures/tables) ---------------- */
function buildTableHtml(table) {
  if (!table) return '';
  let html = '<table class="q-table"><thead><tr>';
  table.headers.forEach((h) => { html += `<th>$${escapeHtml(h)}$</th>`; });
  html += '</tr></thead><tbody>';
  table.rows.forEach((row) => {
    html += '<tr>';
    row.forEach((c) => { html += `<td>$${escapeHtml(c)}$</td>`; });
    html += '</tr>';
  });
  html += '</tbody></table>';
  return html;
}

function buildContentHtml(text, table) {
  if (text == null) return '';
  const parts = String(text).split(/(\[\[(?:FIGURE:[^\]]+|TABLE)\]\])/g);
  let html = '';
  parts.forEach((part) => {
    const figMatch = part.match(/^\[\[FIGURE:([^\]]+)\]\]$/);
    if (figMatch) {
      html += `<div class="figure-wrap"><img src="assets/figs/${figMatch[1]}" alt="figure"></div>`;
    } else if (part === '[[TABLE]]') {
      html += buildTableHtml(table);
    } else {
      // KaTeX auto-render's $ delimiter doesn't reliably respect a backslash escape,
      // so swap literal "\$" (a real dollar amount) for a look-alike char it won't match,
      // then swap it back after auto-render has scanned the DOM (see renderMathIn).
      html += escapeHtml(part).replace(/\\\$/g, '＄');
    }
  });
  return html;
}

function renderMathIn(el) {
  if (window.renderMathInElement) {
    renderMathInElement(el, {
      delimiters: [
        { left: '$$', right: '$$', display: true },
        { left: '\\[', right: '\\]', display: true },
        { left: '$', right: '$', display: false },
        { left: '\\(', right: '\\)', display: false },
      ],
      throwOnError: false,
    });
    // restore literal dollar amounts (see buildContentHtml) in whatever text KaTeX left alone
    const walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT, null);
    const textNodes = [];
    let tn;
    while ((tn = walker.nextNode())) textNodes.push(tn);
    textNodes.forEach((node) => {
      if (node.nodeValue.indexOf('＄') !== -1) node.nodeValue = node.nodeValue.replace(/＄/g, '$');
    });
  }
}

/* ---------------- stats / dashboard ---------------- */
function computeStats(section) {
  const data = DATA[section];
  const prog = PROGRESS[section];
  let answered = 0, correct = 0, incorrect = 0, flagged = 0;
  const byDomain = {};
  data.forEach((q) => {
    const d = q.domain;
    if (!byDomain[d]) byDomain[d] = { total: 0, answered: 0, correct: 0 };
    byDomain[d].total++;
    const p = prog[q.id];
    if (p && p.flagged) flagged++;
    if (p && p.checked) {
      answered++;
      byDomain[d].answered++;
      if (p.correct) { correct++; byDomain[d].correct++; }
      else incorrect++;
    }
  });
  return { total: data.length, answered, correct, incorrect, flagged, byDomain };
}

function domainColor(name) {
  return '#0d5fa8';
}

function renderProgressBar(container, stats) {
  const pctCorrect = stats.total ? (stats.correct / stats.total) * 100 : 0;
  const pctIncorrect = stats.total ? (stats.incorrect / stats.total) * 100 : 0;
  container.innerHTML = `<div class="pb-correct" style="width:${pctCorrect}%"></div><div class="pb-incorrect" style="width:${pctIncorrect}%"></div>`;
}

function renderDomainBreakdown(container, stats) {
  let html = '';
  Object.keys(stats.byDomain).sort().forEach((d) => {
    const info = stats.byDomain[d];
    const pctCorrect = info.total ? (info.correct / info.total) * 100 : 0;
    const pctIncorrect = info.total ? ((info.answered - info.correct) / info.total) * 100 : 0;
    html += `<div class="domain-row">
      <div class="dname">${escapeHtml(d)}</div>
      <div class="dbar-track"><div class="pb-correct" style="width:${pctCorrect}%"></div><div class="pb-incorrect" style="width:${pctIncorrect}%"></div></div>
      <div class="dcount">${info.answered}/${info.total}</div>
    </div>`;
  });
  container.innerHTML = html;
}

function renderDomainFilterChips(section) {
  const data = DATA[section];
  const domains = Array.from(new Set(data.map((q) => q.domain))).sort();
  const container = $(section === 'english' ? '#e-domain-filters' : '#m-domain-filters');
  const active = STATE.filters[section];
  container.innerHTML = domains.map((d) => {
    const count = data.filter((q) => q.domain === d).length;
    const isActive = active.has(d);
    return `<span class="chip ${isActive ? 'active' : ''}" data-section="${section}" data-domain="${escapeHtml(d)}">${escapeHtml(d)} (${count})</span>`;
  }).join('');
}

function renderHomeStats() {
  const es = computeStats('english');
  const ms = computeStats('math');
  $('#e-answered').textContent = `${es.answered}/${es.total}`;
  $('#e-correct').textContent = es.correct;
  $('#e-incorrect').textContent = es.incorrect;
  $('#e-flagged').textContent = es.flagged;
  renderProgressBar($('#pb-english'), es);
  renderDomainBreakdown($('#e-domains'), es);

  $('#m-answered').textContent = `${ms.answered}/${ms.total}`;
  $('#m-correct').textContent = ms.correct;
  $('#m-incorrect').textContent = ms.incorrect;
  $('#m-flagged').textContent = ms.flagged;
  renderProgressBar($('#pb-math'), ms);
  renderDomainBreakdown($('#m-domains'), ms);

  renderDomainFilterChips('english');
  renderDomainFilterChips('math');
}

function renderCountdown() {
  const el = $('#countdown-text');
  const now = new Date();
  const day = now.getDay(); // 0 Sun .. 6 Sat
  let daysUntilSat = (6 - day + 7) % 7;
  if (daysUntilSat === 0 && now.getHours() >= 20) daysUntilSat = 7;
  el.textContent = daysUntilSat === 0 ? '🔥 Test day is today — you\'ve got this.' : `⏳ ${daysUntilSat} day${daysUntilSat === 1 ? '' : 's'} until Saturday's SAT`;
}

/* ---------------- filtering / session start ---------------- */
function getFilteredIndices(section, mode) {
  const data = DATA[section];
  const prog = PROGRESS[section];
  const activeDomains = STATE.filters[section];
  const idxs = [];
  data.forEach((q, i) => {
    if (activeDomains.size && !activeDomains.has(q.domain)) return;
    const p = prog[q.id];
    if (mode === 'incorrect') {
      if (!(p && p.checked && !p.correct)) return;
    } else if (mode === 'flagged') {
      if (!(p && p.flagged)) return;
    }
    idxs.push(i);
  });
  return idxs;
}

function startSession(section, mode) {
  STATE.section = section;
  STATE.mode = mode;
  STATE.indices = getFilteredIndices(section, mode);
  if (!STATE.indices.length) {
    alert('No questions match this filter yet. Try a different filter or answer some questions first.');
    return;
  }
  // resume at first unchecked question, unless reviewing incorrect/flagged (show from start)
  let startPos = 0;
  if (mode === 'all') {
    const firstUnchecked = STATE.indices.findIndex((i) => !PROGRESS[section][DATA[section][i].id] || !PROGRESS[section][DATA[section][i].id].checked);
    if (firstUnchecked >= 0) startPos = firstUnchecked;
  }
  STATE.pos = startPos;
  showTest();
  renderQuestion();
}

/* ---------------- view switching ---------------- */
function showView(name) {
  ['home', 'test', 'strategy'].forEach((v) => {
    $('#view-' + v).classList.toggle('hidden', v !== name);
  });
}
function showTest() { showView('test'); }

/* ---------------- question rendering ---------------- */
function currentQuestion() {
  const idx = STATE.indices[STATE.pos];
  return DATA[STATE.section][idx];
}

function renderQuestion() {
  const section = STATE.section;
  const q = currentQuestion();
  const prog = getProg(section, q.id);

  $('#tb-title').textContent = SECTION_LABEL[section];
  $('#tb-sub').textContent = `${q.domain} · ${q.skill} · ${q.difficulty}`;
  $('#bb-qnum').textContent = STATE.pos + 1;
  $('#bb-qtotal').textContent = STATE.indices.length;
  $('#bb-progress').textContent = `${STATE.mode === 'all' ? 'Practice' : (STATE.mode === 'incorrect' ? 'Reviewing incorrect' : 'Reviewing flagged')} — ${SECTION_LABEL[section]}`;

  $('#btn-calc').classList.toggle('hidden', section !== 'math');

  const paneStem = $('#pane-stem');
  const paneQuestion = $('#pane-question');

  const isEnglish = section === 'english';
  paneStem.classList.toggle('hidden', !isEnglish);
  paneQuestion.classList.remove('full');
  if (!isEnglish) paneQuestion.classList.add('full');

  const flagBtnHtml = `<button class="flag-btn ${prog.flagged ? 'flagged' : ''}" id="btn-flag">🚩 ${prog.flagged ? 'Flagged' : 'Mark for Review'}</button>`;

  if (isEnglish) {
    paneStem.innerHTML = `
      <div class="q-meta-row">
        <span class="q-number-badge">Q${STATE.pos + 1}</span>
        <span class="q-tag">${escapeHtml(q.skill)}</span>
      </div>
      <div class="passage-text" data-hlkey="stem">${buildContentHtml(q.question, q.table)}</div>
    `;
  }

  let bodyHtml = '';
  if (!isEnglish) {
    bodyHtml += `
      <div class="q-meta-row">
        <span class="q-number-badge">Q${STATE.pos + 1}</span>
        <span class="q-tag">${escapeHtml(q.skill)}</span>
        ${flagBtnHtml}
      </div>
      <div class="question-text" data-hlkey="stem">${buildContentHtml(q.question, q.table)}</div>
    `;
  } else {
    bodyHtml += `<div class="q-meta-row"><span class="q-tag">Answer</span>${flagBtnHtml}</div>`;
  }

  bodyHtml += '<div class="choices">';
  if (q.choices) {
    const letters = ['A', 'B', 'C', 'D'];
    letters.forEach((L) => {
      if (!q.choices[L]) return;
      let cls = 'choice';
      if (prog.checked) {
        cls += ' disabled';
        if (correctAnswerList(q).includes(L)) cls += ' correct-answer';
        else if (prog.selected === L) cls += ' wrong-answer';
      } else if (prog.selected === L) {
        cls += ' selected';
      }
      bodyHtml += `<div class="${cls}" data-letter="${L}" data-hlkey="choice_${L}">
        <div class="letter">${L}</div>
        <div class="ctext">${buildContentHtml(q.choices[L])}</div>
      </div>`;
    });
  } else {
    // student-produced response
    bodyHtml += `<div class="spr-input-row">
      <input type="text" id="spr-input" placeholder="Enter your answer" value="${escapeHtml(prog.sprInput || '')}" ${prog.checked ? 'disabled' : ''}>
      <div class="spr-hint">Enter a whole number, decimal, or fraction (e.g. 3, 24.5, or 49/2).</div>
    </div>`;
  }
  bodyHtml += '</div>';

  if (!prog.checked) {
    bodyHtml += `<div class="check-row">
      <button class="btn" id="btn-check" ${(!prog.selected && !$('#spr-input')) ? '' : ''}>Check Answer</button>
    </div>`;
  } else {
    const isCorrect = prog.correct;
    bodyHtml += `<div class="feedback-box ${isCorrect ? 'correct' : 'incorrect'}">
      <div class="fb-title">${isCorrect ? '✓ Correct!' : '✗ Not quite — correct answer: ' + correctAnswerList(q).join(' or ')}</div>
      <div class="rationale-body">${buildContentHtml(q.rationale)}</div>
    </div>
    <div class="check-row">
      <button class="btn ghost small" id="btn-clear">Clear response &amp; try again</button>
    </div>`;
  }

  paneQuestion.innerHTML = bodyHtml;

  renderMathIn(paneStem);
  renderMathIn(paneQuestion);

  reapplyAllHighlights();
  updateCheckButtonState();

  $('#btn-prev').disabled = STATE.pos === 0;
  $('#btn-next').textContent = STATE.pos === STATE.indices.length - 1 ? 'Finish' : 'Next';
}

function updateCheckButtonState() {
  const btn = $('#btn-check');
  if (!btn) return;
  const section = STATE.section;
  const q = currentQuestion();
  const prog = getProg(section, q.id);
  let hasAnswer = false;
  if (q.choices) hasAnswer = !!prog.selected;
  else {
    const input = $('#spr-input');
    hasAnswer = input && input.value.trim() !== '';
  }
  btn.disabled = !hasAnswer;
}

/* ---------------- answering ---------------- */
function selectChoice(letter) {
  const section = STATE.section;
  const q = currentQuestion();
  const prog = getProg(section, q.id);
  if (prog.checked) return;
  prog.selected = letter;
  saveProgress();
  renderQuestion();
}

function checkAnswer() {
  const section = STATE.section;
  const q = currentQuestion();
  const prog = getProg(section, q.id);
  if (prog.checked) return;
  let isCorrect;
  if (q.choices) {
    if (!prog.selected) return;
    isCorrect = correctAnswerList(q).includes(prog.selected);
  } else {
    const input = $('#spr-input');
    const val = input ? input.value.trim() : '';
    if (!val) return;
    prog.sprInput = val;
    isCorrect = sprCorrect(val, correctAnswerList(q));
  }
  prog.checked = true;
  prog.correct = isCorrect;
  saveProgress();
  renderQuestion();
}

function clearResponse() {
  const section = STATE.section;
  const q = currentQuestion();
  const prog = getProg(section, q.id);
  prog.checked = false;
  prog.correct = null;
  prog.selected = null;
  prog.sprInput = '';
  saveProgress();
  renderQuestion();
}

function toggleFlag() {
  const section = STATE.section;
  const q = currentQuestion();
  const prog = getProg(section, q.id);
  prog.flagged = !prog.flagged;
  saveProgress();
  renderQuestion();
}

/* ---------------- navigation ---------------- */
function goNext() {
  if (STATE.pos < STATE.indices.length - 1) {
    STATE.pos++;
    renderQuestion();
  } else {
    goHome();
  }
}
function goPrev() {
  if (STATE.pos > 0) {
    STATE.pos--;
    renderQuestion();
  }
}
function goHome() {
  showView('home');
  renderHomeStats();
  renderCountdown();
}
function jumpTo(pos) {
  STATE.pos = pos;
  closeNavGrid();
  renderQuestion();
}

/* ---------------- nav grid overlay ---------------- */
function openNavGrid() {
  const section = STATE.section;
  const data = DATA[section];
  const prog = PROGRESS[section];
  let html = '';
  STATE.indices.forEach((idx, pos) => {
    const q = data[idx];
    const p = prog[q.id];
    let cls = 'nav-cell';
    if (pos === STATE.pos) cls += ' current';
    if (p && p.checked) cls += p.correct ? ' correct' : ' incorrect';
    else if (p && p.selected) cls += ' answered';
    if (p && p.flagged) cls += ' flagged';
    html += `<div class="${cls}" data-pos="${pos}">${pos + 1}</div>`;
  });
  $('#nav-grid').innerHTML = html;
  $('#nav-overlay').classList.remove('hidden');
}
function closeNavGrid() { $('#nav-overlay').classList.add('hidden'); }

/* ---------------- highlighting & notes ---------------- */
function getTextNodes(root) {
  const nodes = [];
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, null);
  let n;
  while ((n = walker.nextNode())) nodes.push(n);
  return nodes;
}
function rangeToOffsets(root, range) {
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
function wrapOffsets(root, start, end, hlId, hasNote) {
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
    mark.className = 'hl' + (hasNote ? ' has-note' : '');
    mark.dataset.hlid = hlId;
    mark.textContent = mid;
    const frag = document.createDocumentFragment();
    if (before) frag.appendChild(document.createTextNode(before));
    frag.appendChild(mark);
    if (after) frag.appendChild(document.createTextNode(after));
    parent.replaceChild(frag, node);
  }
}
function reapplyAllHighlights() {
  const section = STATE.section;
  const q = currentQuestion();
  const prog = getProg(section, q.id);
  if (!prog.highlights || !prog.highlights.length) return;
  const byKey = {};
  prog.highlights.forEach((h) => { (byKey[h.key] = byKey[h.key] || []).push(h); });
  Object.keys(byKey).forEach((key) => {
    const container = $(`[data-hlkey="${cssEscape(key)}"]`);
    if (!container) return;
    byKey[key].sort((a, b) => a.start - b.start).forEach((h) => {
      wrapOffsets(container, h.start, h.end, h.id, !!h.note);
    });
  });
}
function cssEscape(s) { return s.replace(/[^a-zA-Z0-9_-]/g, '_'); }

let pendingSelection = null; // {containerKey, start, end}

function handleMouseUpForHighlight(e) {
  const sel = window.getSelection();
  if (!sel || sel.isCollapsed || sel.rangeCount === 0) { hideHlPopup(); return; }
  const range = sel.getRangeAt(0);
  const container = e.target.closest('[data-hlkey]');
  if (!container) { hideHlPopup(); return; }
  if (!container.contains(range.startContainer) || !container.contains(range.endContainer)) { hideHlPopup(); return; }
  const offsets = rangeToOffsets(container, range);
  if (!offsets || offsets.end - offsets.start < 1) { hideHlPopup(); return; }
  pendingSelection = { key: container.dataset.hlkey, start: offsets.start, end: offsets.end };
  showHlPopup(e.clientX, e.clientY);
}

function showHlPopup(x, y) {
  let popup = $('#hl-popup');
  if (!popup) {
    popup = document.createElement('div');
    popup.id = 'hl-popup';
    popup.className = 'hl-popup';
    popup.innerHTML = `<button id="hl-do-highlight">🖊️ Highlight</button><button id="hl-do-note">💬 Note</button>`;
    document.body.appendChild(popup);
  }
  popup.style.left = Math.min(x, window.innerWidth - 180) + 'px';
  popup.style.top = Math.max(10, y - 44) + 'px';
  popup.classList.remove('hidden');
}
function hideHlPopup() {
  const popup = $('#hl-popup');
  if (popup) popup.classList.add('hidden');
}

function saveHighlight(note) {
  if (!pendingSelection) return null;
  const section = STATE.section;
  const q = currentQuestion();
  const prog = getProg(section, q.id);
  const h = { id: uid(), key: pendingSelection.key, start: pendingSelection.start, end: pendingSelection.end, note: note || null };
  prog.highlights.push(h);
  saveProgress();
  window.getSelection().removeAllRanges();
  pendingSelection = null;
  hideHlPopup();
  renderQuestion();
  return h;
}

function openNotePopoverForNew(x, y) {
  showNotePopover(x, y, '', (text) => { saveHighlight(text); });
}
function openNotePopoverForExisting(hlId, x, y) {
  const section = STATE.section;
  const q = currentQuestion();
  const prog = getProg(section, q.id);
  const h = prog.highlights.find((hh) => hh.id === hlId);
  if (!h) return;
  showNotePopover(x, y, h.note || '', (text) => {
    h.note = text || null;
    saveProgress();
    renderQuestion();
  }, () => {
    prog.highlights = prog.highlights.filter((hh) => hh.id !== hlId);
    saveProgress();
    renderQuestion();
  });
}
function showNotePopover(x, y, initialText, onSave, onDelete) {
  let pop = $('#note-popover');
  if (pop) pop.remove();
  pop = document.createElement('div');
  pop.id = 'note-popover';
  pop.className = 'note-popover';
  pop.innerHTML = `
    <textarea id="note-textarea" placeholder="Type a note about this highlight...">${escapeHtml(initialText)}</textarea>
    <div class="np-actions">
      ${onDelete ? '<button class="btn ghost small" id="note-delete">Remove</button>' : ''}
      <button class="btn ghost small" id="note-cancel">Cancel</button>
      <button class="btn small" id="note-save">Save</button>
    </div>`;
  document.body.appendChild(pop);
  const maxLeft = window.innerWidth - 280;
  pop.style.left = Math.min(x, maxLeft) + 'px';
  pop.style.top = Math.min(y, window.innerHeight - 180) + 'px';
  $('#note-cancel').onclick = () => { pop.remove(); pendingSelection = null; window.getSelection().removeAllRanges(); };
  $('#note-save').onclick = () => { const v = $('#note-textarea').value.trim(); pop.remove(); onSave(v); };
  if (onDelete) $('#note-delete').onclick = () => { pop.remove(); onDelete(); };
  $('#note-textarea').focus();
}

/* Notes panel (lists all highlights/notes for current question) */
function renderNotesPanel() {
  const panel = ensureFloatingPanel('notes-panel', 'Highlights &amp; Notes');
  const section = STATE.section;
  const q = currentQuestion();
  const prog = getProg(section, q.id);
  const body = $('.fp-body', panel);
  if (!prog.highlights.length) {
    body.innerHTML = '<div class="note-empty">Select any text in the question or answers, then choose Highlight or Note to save it here.</div>';
    return;
  }
  let html = '<div class="notes-list">';
  prog.highlights.forEach((h) => {
    html += `<div class="note-item" data-hlid="${h.id}">
      <div class="note-quote">"${escapeHtml(getHighlightText(h))}"</div>
      ${h.note ? `<div class="note-body">${escapeHtml(h.note)}</div>` : '<div class="note-body" style="color:var(--text-dim);font-style:italic;">(highlight only, no note)</div>'}
      <div class="np-actions" style="margin-top:6px;">
        <button class="btn ghost small hl-edit" data-hlid="${h.id}">Edit</button>
        <button class="btn ghost small hl-remove" data-hlid="${h.id}">Remove</button>
      </div>
    </div>`;
  });
  html += '</div>';
  body.innerHTML = html;
}
function getHighlightText(h) {
  const container = $(`[data-hlkey="${cssEscape(h.key)}"]`);
  if (!container) return '';
  const mark = container.querySelector(`mark[data-hlid="${h.id}"]`);
  return mark ? mark.textContent : '';
}

/* ---------------- floating panels (calculator, reference, notes) ---------------- */
function ensureFloatingPanel(id, title) {
  let panel = $('#' + id);
  if (panel) return panel;
  panel = document.createElement('div');
  panel.id = id;
  panel.className = 'floating-panel hidden';
  panel.innerHTML = `<div class="fp-header">${title}<button class="fp-close">✕</button></div><div class="fp-body"></div>`;
  document.body.appendChild(panel);
  makeDraggable(panel);
  $('.fp-close', panel).onclick = () => panel.classList.add('hidden');
  return panel;
}
function makeDraggable(panel) {
  const header = $('.fp-header', panel);
  let dragging = false, offX = 0, offY = 0;
  header.addEventListener('mousedown', (e) => {
    if (e.target.closest('.fp-close')) return;
    dragging = true;
    const rect = panel.getBoundingClientRect();
    offX = e.clientX - rect.left;
    offY = e.clientY - rect.top;
    e.preventDefault();
  });
  document.addEventListener('mousemove', (e) => {
    if (!dragging) return;
    panel.style.left = Math.max(0, e.clientX - offX) + 'px';
    panel.style.top = Math.max(0, e.clientY - offY) + 'px';
    panel.style.right = 'auto';
  });
  document.addEventListener('mouseup', () => { dragging = false; });
}

function toggleCalcPanel() {
  const panel = ensureFloatingPanel('calc-panel', '🖩 Desmos Calculator');
  if (panel.classList.contains('hidden')) {
    if (!panel.dataset.loaded) {
      $('.fp-body', panel).innerHTML = '<iframe src="https://www.desmos.com/calculator" title="Desmos calculator"></iframe>';
      panel.dataset.loaded = '1';
    }
    panel.classList.remove('hidden');
  } else {
    panel.classList.add('hidden');
  }
}

const REFERENCE_HTML = `
<div class="ref-content">
  <div class="ref-grid">
    <div class="ref-item"><div class="shape">▭</div>$A = \\ell w$<br><span style="color:var(--text-dim)">Rectangle area</span></div>
    <div class="ref-item"><div class="shape">△</div>$A = \\frac12 bh$<br><span style="color:var(--text-dim)">Triangle area</span></div>
    <div class="ref-item"><div class="shape">●</div>$A = \\pi r^2,\\ C = 2\\pi r$<br><span style="color:var(--text-dim)">Circle area &amp; circumference</span></div>
    <div class="ref-item"><div class="shape">▱</div>$V = \\ell w h$<br><span style="color:var(--text-dim)">Rectangular prism volume</span></div>
    <div class="ref-item"><div class="shape">🛢️</div>$V = \\pi r^2 h$<br><span style="color:var(--text-dim)">Cylinder volume</span></div>
    <div class="ref-item"><div class="shape">🔺</div>$V = \\frac13 \\pi r^2 h$<br><span style="color:var(--text-dim)">Cone volume</span></div>
    <div class="ref-item"><div class="shape">◆</div>$V = \\frac43 \\pi r^3$<br><span style="color:var(--text-dim)">Sphere volume</span></div>
    <div class="ref-item"><div class="shape">▲</div>$V = \\frac13 \\ell w h$<br><span style="color:var(--text-dim)">Pyramid volume</span></div>
  </div>
  <h4>Right triangles</h4>
  <p>Pythagorean theorem: $a^2+b^2=c^2$</p>
  <p><b>Special right triangles</b> — 30-60-90: sides in ratio $x : x\\sqrt3 : 2x$. &nbsp; 45-45-90: sides in ratio $x : x : x\\sqrt2$.</p>
  <h4>Angles &amp; circles</h4>
  <p>Sum of angle measures in a triangle $= 180°$. Sum of angle measures in a quadrilateral $= 360°$.</p>
  <p>A circle has $360°$, or $2\\pi$ radians, of arc.</p>
</div>`;

function toggleRefPanel() {
  const panel = ensureFloatingPanel('ref-panel', '📐 Reference Sheet');
  if (panel.classList.contains('hidden')) {
    $('.fp-body', panel).innerHTML = REFERENCE_HTML;
    renderMathIn($('.fp-body', panel));
    panel.classList.remove('hidden');
  } else {
    panel.classList.add('hidden');
  }
}

function toggleNotesPanel() {
  const panel = ensureFloatingPanel('notes-panel', '🖊️ Highlights &amp; Notes');
  if (panel.classList.contains('hidden')) {
    renderNotesPanel();
    panel.classList.remove('hidden');
  } else {
    panel.classList.add('hidden');
  }
}

function showDirections() {
  const panel = ensureFloatingPanel('directions-panel', 'ℹ️ Directions');
  panel.style.width = '420px';
  panel.style.top = '110px';
  panel.style.left = '50%';
  panel.style.marginLeft = '-210px';
  $('.fp-body', panel).innerHTML = `<div class="ref-content">
    <p>Answer each question using the choices given, or type your answer for fill-in questions.</p>
    <ul>
      <li>Select an answer, then click <b>Check Answer</b> to see if you're right and read the full explanation.</li>
      <li>Click <b>🚩 Mark for Review</b> to flag a question and revisit it later from the dashboard.</li>
      <li>Select any text to <b>Highlight</b> it or attach a <b>Note</b> — just like the official Bluebook app.</li>
      <li>Use the <b>Question navigator</b> at the bottom to jump between questions.</li>
      ${'<li>Open the on-screen <b>Calculator</b> (Desmos) for any math question.</li>'}
    </ul>
  </div>`;
  panel.classList.remove('hidden');
}

/* ---------------- strategy guide ---------------- */
function renderStrategy() {
  const el = $('#strategy-content');
  el.innerHTML = `
  <button class="btn ghost back-home-link" id="btn-strategy-back">← Back to Dashboard</button>
  <h1>Your Plan to 1500+</h1>
  <p>The digital SAT is scored out of 1600 (800 Reading &amp; Writing + 800 Math), and it's <b>multistage adaptive</b>: each section has two modules, and how you do on Module 1 determines the difficulty (and max possible score) of Module 2. <b>Accuracy early matters more than speed</b> — a strong Module 1 unlocks the harder, higher-value Module 2 questions.</p>

  <h2>How to use this app for the next few days</h2>
  <ol>
    <li>Use the <b>category filters</b> on the dashboard to drill your weakest domains first.</li>
    <li>Answer, check, and <b>read every rationale</b> — even for ones you get right, skim it once to confirm your reasoning was correct for the right reason.</li>
    <li>Flag anything shaky with 🚩, then run <b>"Review Flagged"</b> the next day.</li>
    <li>The night before, run <b>"Review Incorrect"</b> for both sections one last time.</li>
  </ol>

  <h2>Day-by-day cram plan</h2>
  <div class="day-plan-card">
    <h4>Today – Diagnose</h4>
    <p>Do 40–50 mixed Reading &amp; Writing questions and 30–40 Math questions across <i>all</i> categories at a brisk pace. Don't study yet — just find your weak spots. Note which domains have the most red (incorrect) on your dashboard.</p>
  </div>
  <div class="day-plan-card">
    <h4>Day 2 – Attack your weakest Math domain</h4>
    <p>Filter Math to your lowest-scoring domain (often Geometry &amp; Trigonometry or Advanced Math). Work every question in it, reading the full rationale each time. Keep the Reference Sheet open — get fast at recognizing when to use it.</p>
  </div>
  <div class="day-plan-card">
    <h4>Day 3 – Attack your weakest Reading &amp; Writing domain</h4>
    <p>Do the same for R&amp;W. Standard English Conventions and Expression of Ideas are the most learnable overnight — a handful of grammar rules covers most of these questions (see below).</p>
  </div>
  <div class="day-plan-card">
    <h4>Day 4 – Second weakest domain, both sections</h4>
    <p>Split remaining time between your second-weakest Math and R&amp;W domains. Start timing yourself loosely: ~70 seconds/question for R&amp;W, ~95 seconds/question for Math.</p>
  </div>
  <div class="day-plan-card">
    <h4>Day 5 – Full review pass</h4>
    <p>Run <b>Review Incorrect</b> and <b>Review Flagged</b> for both sections. Stop grinding new questions late in the day — switch to light review only. Get a full night's sleep; it affects your score more than one more hour of practice.</p>
  </div>
  <div class="day-plan-card">
    <h4>Test Day</h4>
    <p>Bring a photo ID, your admission ticket, an approved calculator (even though Desmos is built in, a physical calculator is a good backup), and snacks/water for the break. Arrive early. On the test: answer every question (no guessing penalty), flag-and-skip anything that stalls you for more than ~90 seconds, and trust your prep.</p>
  </div>

  <h2>Reading &amp; Writing tactics by category</h2>
  <h3>Information and Ideas</h3>
  <ul>
    <li><b>Central Ideas &amp; Details / Inferences:</b> Read the passage once for the main point, then answer in your own words before looking at choices. Eliminate choices that are too broad, too narrow, or contradict the text.</li>
    <li><b>Command of Evidence:</b> Identify exactly what claim needs support, then find the choice that most directly and specifically backs it — not just a related fact.</li>
  </ul>
  <h3>Craft and Structure</h3>
  <ul>
    <li><b>Words in Context:</b> Cover the answer choices, predict a simple word that fits, then match it to the closest choice. Watch for common traps: a choice that's a "normal" definition of the word but wrong in this specific context.</li>
    <li><b>Text Structure and Purpose:</b> Ask "why did the author write this sentence/paragraph?" — supporting, contrasting, qualifying, introducing, or concluding.</li>
    <li><b>Cross-Text Connections:</b> Find the point of agreement or disagreement between the two texts before reading the choices.</li>
  </ul>
  <h3>Expression of Ideas</h3>
  <ul>
    <li><b>Rhetorical Synthesis:</b> Reread the stated <i>goal</i> carefully — most wrong answers are true statements that just don't achieve the specific goal asked for.</li>
    <li><b>Transitions:</b> Determine the logical relationship between the two ideas first (continue, contrast, cause/effect, example) — then pick the transition word that matches.</li>
  </ul>
  <h3>Standard English Conventions — the rules that cover most questions</h3>
  <ul>
    <li><b>Commas:</b> Don't separate a subject from its verb with a single comma. Use commas around non-essential (extra) information; no commas around essential information.</li>
    <li><b>Semicolons/periods:</b> Use between two complete sentences (independent clauses) that are closely related; never before a dependent clause.</li>
    <li><b>Apostrophes:</b> "its" = possessive, "it's" = it is. Add 's for singular possessive ("the dog's"); add just an apostrophe after a plural ending in s ("the dogs'").</li>
    <li><b>Subject–verb agreement:</b> Find the true subject (ignore interrupting phrases) and match the verb to it, not to a nearby noun.</li>
    <li><b>Parallelism:</b> Items in a list or comparison must share the same grammatical form.</li>
    <li><b>Pronoun/verb tense consistency:</b> Pronouns must agree in number with their antecedent; verb tense should stay consistent unless the timeline clearly shifts.</li>
  </ul>

  <h2>Math tactics by category</h2>
  <h3>Algebra</h3>
  <ul>
    <li>For systems with "no solution," "one solution," or "infinitely many solutions," compare the coefficients: proportional coefficients + proportional constants = infinite solutions; proportional coefficients + non-proportional constants = no solution.</li>
    <li>If a question has variables in the answer choices, try <b>plugging in numbers</b> or plugging the answer choices back into the equation.</li>
    <li>Graph tricky equations directly in the built-in Desmos calculator rather than solving by hand.</li>
  </ul>
  <h3>Advanced Math</h3>
  <ul>
    <li>For quadratics, know when to factor vs. use the quadratic formula vs. complete the square (equations asking about the vertex or "no real solutions" hint at completing the square / discriminant).</li>
    <li>Exponential growth/decay: $y = a(b)^x$ — $a$ is the starting value, $b>1$ is growth, $0<b<1$ is decay.</li>
  </ul>
  <h3>Problem-Solving and Data Analysis</h3>
  <ul>
    <li>Percent change: new $=$ original $\\times(1\\pm\\text{rate})$. Watch for "percent of" vs. "percentage point" language.</li>
    <li>For two-way tables, always double-check whether you need a row total, column total, or grand total in the denominator.</li>
    <li>Larger sample size → smaller margin of error; this relationship is tested constantly and doesn't require calculation.</li>
  </ul>
  <h3>Geometry and Trigonometry</h3>
  <ul>
    <li>Memorize the special right triangles (30-60-90 and 45-45-90) — they appear constantly and the printed reference sheet uses the same ratios.</li>
    <li>For similar triangles/figures, side lengths scale by $k$ and area scales by $k^2$; volume scales by $k^3$.</li>
    <li>$\\sin\\theta = \\cos(90°-\\theta)$ for complementary angles — this shows up disguised in "right triangle inside a right triangle" problems.</li>
  </ul>

  <h2>General digital SAT tips</h2>
  <ul>
    <li><b>No guessing penalty</b> — never leave a question blank. If you're stuck, eliminate what you can and guess.</li>
    <li><b>Time budget:</b> ~64 minutes for 54 R&amp;W questions across two modules (~71 sec/question); ~70 minutes for 44 Math questions across two modules (~95 sec/question).</li>
    <li>Flag-and-move-on for anything taking too long — you can return to it before the module ends.</li>
    <li>Use the on-screen calculator for every math question — it's allowed on all of them.</li>
    <li>Read every answer choice before finalizing, even if you think you found it — the SAT writes convincing wrong answers on purpose.</li>
  </ul>
  `;
  renderMathIn(el);
  $('#btn-strategy-back').onclick = goHome;
}

/* ---------------- event wiring ---------------- */
function init() {
  renderHomeStats();
  renderCountdown();
  setInterval(renderCountdown, 60000);

  $('#btn-strategy').onclick = () => { showView('strategy'); renderStrategy(); };
  $('#btn-reset').onclick = () => {
    if (confirm('This will erase all saved progress, highlights, and notes. Continue?')) {
      PROGRESS = { english: {}, math: {} };
      saveProgress();
      renderHomeStats();
    }
  };

  $all('[data-start]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const [section, mode] = btn.dataset.start.split('-');
      startSession(section, mode);
    });
  });

  document.body.addEventListener('click', (e) => {
    const chip = e.target.closest('.chip');
    if (chip) {
      const section = chip.dataset.section;
      const domain = chip.dataset.domain;
      const set = STATE.filters[section];
      if (set.has(domain)) set.delete(domain); else set.add(domain);
      renderDomainFilterChips(section);
      return;
    }
    const choice = e.target.closest('.choice');
    if (choice && !choice.classList.contains('disabled')) {
      selectChoice(choice.dataset.letter);
      return;
    }
    if (e.target.id === 'btn-check') { checkAnswer(); return; }
    if (e.target.id === 'btn-clear') { clearResponse(); return; }
    if (e.target.id === 'btn-flag') { toggleFlag(); return; }
    if (e.target.id === 'hl-do-highlight') { saveHighlight(null); return; }
    if (e.target.id === 'hl-do-note') {
      const rect = { x: parseInt($('#hl-popup').style.left, 10), y: parseInt($('#hl-popup').style.top, 10) + 40 };
      openNotePopoverForNew(rect.x, rect.y);
      return;
    }
    const mark = e.target.closest('mark.hl');
    if (mark) {
      const rect = mark.getBoundingClientRect();
      openNotePopoverForExisting(mark.dataset.hlid, rect.left, rect.bottom + 6);
      return;
    }
    const editBtn = e.target.closest('.hl-edit');
    if (editBtn) {
      const panelRect = $('#notes-panel').getBoundingClientRect();
      openNotePopoverForExisting(editBtn.dataset.hlid, panelRect.left - 270, panelRect.top + 20);
      return;
    }
    const removeBtn = e.target.closest('.hl-remove');
    if (removeBtn) {
      const section = STATE.section;
      const q = currentQuestion();
      const prog = getProg(section, q.id);
      prog.highlights = prog.highlights.filter((h) => h.id !== removeBtn.dataset.hlid);
      saveProgress();
      renderQuestion();
      renderNotesPanel();
      return;
    }
    const navCell = e.target.closest('.nav-cell');
    if (navCell) { jumpTo(parseInt(navCell.dataset.pos, 10)); return; }
    if (e.target.id === 'nav-overlay') { closeNavGrid(); return; }
    if (!e.target.closest('#hl-popup') && !e.target.closest('[data-hlkey]')) hideHlPopup();
  });

  document.body.addEventListener('input', (e) => {
    if (e.target.id === 'spr-input') updateCheckButtonState();
  });

  $('#test-body').addEventListener('mouseup', handleMouseUpForHighlight);

  $('#btn-exit').onclick = goHome;
  $('#btn-prev').onclick = goPrev;
  $('#btn-next').onclick = goNext;
  $('#btn-navgrid').onclick = openNavGrid;
  $('#btn-calc').onclick = toggleCalcPanel;
  $('#btn-ref').onclick = toggleRefPanel;
  $('#btn-notes').onclick = toggleNotesPanel;
  $('#btn-directions').onclick = showDirections;

  document.addEventListener('keydown', (e) => {
    if ($('#view-test').classList.contains('hidden')) return;
    if (e.key === 'Escape') { closeNavGrid(); hideHlPopup(); }
  });
}

document.addEventListener('DOMContentLoaded', init);
