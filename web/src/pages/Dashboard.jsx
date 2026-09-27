import { useMemo, useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuestions } from '../contexts/QuestionsContext';
import { useProgress } from '../contexts/ProgressContext';
import { useAuth } from '../contexts/AuthContext';
import { isUnsure } from '../lib/confidence';

const SECTION_LABEL = { english: 'Reading and Writing', math: 'Math' };

function computeStats(questions, progress) {
  let answered = 0, correct = 0, incorrect = 0, flagged = 0, unsure = 0;
  const byDomain = {};
  questions.forEach((q) => {
    const d = q.domain;
    if (!byDomain[d]) byDomain[d] = { total: 0, answered: 0, correct: 0 };
    byDomain[d].total++;
    const p = progress[q.id];
    if (p && p.flagged) flagged++;
    if (isUnsure(p)) unsure++;
    if (p && p.checked) {
      answered++;
      byDomain[d].answered++;
      if (p.correct) { correct++; byDomain[d].correct++; }
      else incorrect++;
    }
  });
  return { total: questions.length, answered, correct, incorrect, flagged, unsure, byDomain };
}

function ProgressBar({ stats }) {
  const pctCorrect = stats.total ? (stats.correct / stats.total) * 100 : 0;
  const pctIncorrect = stats.total ? (stats.incorrect / stats.total) * 100 : 0;
  return (
    <div className="progress-bar-track">
      <div className="pb-correct" style={{ width: `${pctCorrect}%` }} />
      <div className="pb-incorrect" style={{ width: `${pctIncorrect}%` }} />
    </div>
  );
}

function DomainBreakdown({ stats }) {
  return (
    <div className="domain-breakdown">
      {Object.keys(stats.byDomain).sort().map((d) => {
        const info = stats.byDomain[d];
        const pctCorrect = info.total ? (info.correct / info.total) * 100 : 0;
        const pctIncorrect = info.total ? ((info.answered - info.correct) / info.total) * 100 : 0;
        return (
          <div className="domain-row" key={d}>
            <div className="dname">{d}</div>
            <div className="dbar-track">
              <div className="pb-correct" style={{ width: `${pctCorrect}%` }} />
              <div className="pb-incorrect" style={{ width: `${pctIncorrect}%` }} />
            </div>
            <div className="dcount">{info.answered}/{info.total}</div>
          </div>
        );
      })}
    </div>
  );
}

function SectionCard({ subject, questions, progress, activeDomains, onToggleDomain }) {
  const navigate = useNavigate();
  const stats = useMemo(() => computeStats(questions, progress), [questions, progress]);
  const domains = useMemo(() => Array.from(new Set(questions.map((q) => q.domain))).sort(), [questions]);

  function start(mode) {
    navigate(`/test/${subject}`, { state: { mode, domains: Array.from(activeDomains) } });
  }

  return (
    <div className="card" id={`card-${subject}`}>
      <h2>{SECTION_LABEL[subject]}</h2>
      <ProgressBar stats={stats} />
      <div className="stat-row">
        <div className="stat"><div className="num">{stats.answered}/{stats.total}</div><div className="lbl">Answered</div></div>
        <div className="stat correct"><div className="num">{stats.correct}</div><div className="lbl">Correct</div></div>
        <div className="stat incorrect"><div className="num">{stats.incorrect}</div><div className="lbl">Incorrect</div></div>
        <div className="stat flagged"><div className="num">{stats.flagged}</div><div className="lbl">Flagged</div></div>
        <div className="stat unsure"><div className="num">{stats.unsure}</div><div className="lbl">Unsure</div></div>
      </div>
      <DomainBreakdown stats={stats} />
      <div className="card-actions">
        <button className="btn" onClick={() => start('all')}>Start / Continue</button>
        <button className="btn secondary" onClick={() => start('incorrect')}>Review Incorrect</button>
        <button className="btn secondary" onClick={() => start('flagged')}>Review Flagged</button>
        <button className="btn secondary" onClick={() => start('unsure')}>Review Unsure</button>
      </div>
      <div className="filter-block">
        <h3>Filter by category</h3>
        <div className="chip-row">
          {domains.map((d) => {
            const count = questions.filter((q) => q.domain === d).length;
            return (
              <span
                key={d}
                className={`chip ${activeDomains.has(d) ? 'active' : ''}`}
                onClick={() => onToggleDomain(subject, d)}
              >
                {d} ({count})
              </span>
            );
          })}
        </div>
      </div>
    </div>
  );
}

const TEST_DATE_KEY = 'sat_test_date';

function readTestDate() {
  try { return localStorage.getItem(TEST_DATE_KEY) || ''; } catch { return ''; }
}

// Upcoming Saturday as YYYY-MM-DD — the fallback until a test date is picked.
function nextSaturdayIso() {
  const d = new Date();
  d.setDate(d.getDate() + ((6 - d.getDay() + 7) % 7));
  return toIso(d);
}

function toIso(d) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function formatTestDate(iso) {
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(y, m - 1, d).toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' });
}

function useCountdown(testDate) {
  const [text, setText] = useState('');
  useEffect(() => {
    function update() {
      const [y, m, d] = testDate.split('-').map(Number);
      const now = new Date();
      const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      const days = Math.round((new Date(y, m - 1, d) - today) / 86400000);
      if (days === 0) setText("🔥 Test day is today — you've got this.");
      else if (days < 0) setText(`✅ SAT was ${formatTestDate(testDate)} — set your next test date`);
      else setText(`⏳ ${days} day${days === 1 ? '' : 's'} until your SAT (${formatTestDate(testDate)})`);
    }
    update();
    const id = setInterval(update, 60000);
    return () => clearInterval(id);
  }, [testDate]);
  return text;
}

function Countdown() {
  const [testDate, setTestDate] = useState(() => readTestDate() || nextSaturdayIso());
  const [editing, setEditing] = useState(false);
  const text = useCountdown(testDate);

  function save(value) {
    if (!value) return;
    setTestDate(value);
    try { localStorage.setItem(TEST_DATE_KEY, value); } catch { /* per-device convenience only */ }
  }

  return (
    <div className="countdown">
      {editing ? (
        <label className="countdown-edit">
          SAT date:{' '}
          <input type="date" value={testDate} min={toIso(new Date())} onChange={(e) => save(e.target.value)} autoFocus />
          <button className="btn small" onClick={() => setEditing(false)}>Done</button>
        </label>
      ) : (
        <>
          {text}{' '}
          <button className="countdown-change" onClick={() => setEditing(true)}>Change date</button>
        </>
      )}
    </div>
  );
}

export default function Dashboard() {
  const { data } = useQuestions();
  const { progress, resetAllProgress } = useProgress();
  const { signOut } = useAuth();
  const navigate = useNavigate();
  const [filters, setFilters] = useState({ english: new Set(), math: new Set() });

  function toggleDomain(subject, domain) {
    setFilters((prev) => {
      const next = new Set(prev[subject]);
      if (next.has(domain)) next.delete(domain); else next.add(domain);
      return { ...prev, [subject]: next };
    });
  }

  function handleReset() {
    if (confirm('This will erase all saved progress, highlights, and notes. Continue?')) {
      resetAllProgress();
    }
  }

  return (
    <div id="view-home">
      <div className="dash-topbar">
        <h1>SAT Cram Dashboard</h1>
        <Countdown />
      </div>

      <div className="dash-content">
        <p className="home-sub">
          {data.english.length} Reading &amp; Writing questions · {data.math.length} Math questions.
          Progress is saved to your account.
        </p>

        <div className="home-links">
          <button className="btn secondary" onClick={() => navigate('/strategy')}>📘 1500+ Strategy Guide</button>
          <button className="btn secondary" onClick={() => navigate('/flashcards')}>🗂️ Flashcards</button>
          <button className="btn ghost" onClick={handleReset}>Reset all progress</button>
          <button className="btn ghost" onClick={signOut}>Sign out</button>
        </div>

        <div className="section-cards">
          <SectionCard subject="english" questions={data.english} progress={progress.english} activeDomains={filters.english} onToggleDomain={toggleDomain} />
          <SectionCard subject="math" questions={data.math} progress={progress.math} activeDomains={filters.math} onToggleDomain={toggleDomain} />
        </div>
      </div>
    </div>
  );
}
