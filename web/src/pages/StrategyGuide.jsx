import { useNavigate } from 'react-router-dom';
import RenderedContent from '../components/RenderedContent';

const STRATEGY_HTML = `
<h1>Your Plan to 1500+</h1>
<p>The digital SAT is scored out of 1600 (800 Reading &amp; Writing + 800 Math), and it's <b>multistage adaptive</b>: each section has two modules, and how you do on Module 1 determines the difficulty (and max possible score) of Module 2. <b>Accuracy early matters more than speed</b> — a strong Module 1 unlocks the harder, higher-value Module 2 questions.</p>

<h2>How to use this app for the next few days</h2>
<ol>
  <li>Use the <b>category filters</b> on the dashboard to drill your weakest domains first.</li>
  <li>Answer, check, and <b>read every rationale</b> — even for ones you get right, skim it once to confirm your reasoning was correct for the right reason.</li>
  <li>Flag anything shaky with 🔖, then run <b>"Review Flagged"</b> the next day.</li>
  <li>The night before, run <b>"Review Incorrect"</b> for both sections one last time.</li>
</ol>

<h2>Day-by-day cram plan</h2>
<div class="day-plan-card"><h4>Today – Diagnose</h4><p>Do 40–50 mixed Reading &amp; Writing questions and 30–40 Math questions across <i>all</i> categories at a brisk pace. Don't study yet — just find your weak spots. Note which domains have the most red (incorrect) on your dashboard.</p></div>
<div class="day-plan-card"><h4>Day 2 – Attack your weakest Math domain</h4><p>Filter Math to your lowest-scoring domain (often Geometry &amp; Trigonometry or Advanced Math). Work every question in it, reading the full rationale each time. Keep the Reference Sheet open — get fast at recognizing when to use it.</p></div>
<div class="day-plan-card"><h4>Day 3 – Attack your weakest Reading &amp; Writing domain</h4><p>Do the same for R&amp;W. Standard English Conventions and Expression of Ideas are the most learnable overnight — a handful of grammar rules covers most of these questions (see below).</p></div>
<div class="day-plan-card"><h4>Day 4 – Second weakest domain, both sections</h4><p>Split remaining time between your second-weakest Math and R&amp;W domains. Start timing yourself loosely: ~70 seconds/question for R&amp;W, ~95 seconds/question for Math.</p></div>
<div class="day-plan-card"><h4>Day 5 – Full review pass</h4><p>Run <b>Review Incorrect</b> and <b>Review Flagged</b> for both sections. Stop grinding new questions late in the day — switch to light review only. Get a full night's sleep; it affects your score more than one more hour of practice.</p></div>
<div class="day-plan-card"><h4>Test Day</h4><p>Bring a photo ID, your admission ticket, an approved calculator (even though Desmos is built in, a physical calculator is a good backup), and snacks/water for the break. Arrive early. On the test: answer every question (no guessing penalty), flag-and-skip anything that stalls you for more than ~90 seconds, and trust your prep.</p></div>

<h2>Reading &amp; Writing tactics by category</h2>
<h3>Information and Ideas</h3>
<ul>
  <li><b>Central Ideas &amp; Details / Inferences:</b> Read the passage once for the main point, then answer in your own words before looking at choices. Eliminate choices that are too broad, too narrow, or contradict the text.</li>
  <li><b>Command of Evidence:</b> Identify exactly what claim needs support, then find the choice that most directly and specifically backs it — not just a related fact.</li>
</ul>

<h3>Inferences: the 6 common types</h3>
<p><b>Quick way to identify the type</b></p>
<div class="table-scroll">
<table class="strategy-table">
  <thead><tr><th>If the passage has…</th><th>It's probably…</th></tr></thead>
  <tbody>
    <tr><td>A list of possible causes</td><td><b>1. Scorecard</b></td></tr>
    <tr><td>A problem + something that improved it</td><td><b>2. Problem → fix</b></td></tr>
    <tr><td>"If X, then we'd expect…"</td><td><b>3. Prediction vs. result</b></td></tr>
    <tr><td>"Long believed… however…"</td><td><b>4. Conventional vs. new</b></td></tr>
    <tr><td>Two groups with one difference</td><td><b>5. Isolating a variable</b></td></tr>
    <tr><td>"But the study only…"</td><td><b>6. Limitation</b></td></tr>
  </tbody>
</table>
</div>

<div class="day-plan-card"><h4>1. Scorecard (competing explanations)</h4><p>The passage lists possible causes ("may reflect X, Y, or Z"), then gives evidence.</p><p><b>Approach:</b> Grade each cause as supported, weak, or ruled out. The right answer matches your whole scorecard. <i>Example: the brown bear diet question (R&amp;W #8).</i></p></div>
<div class="day-plan-card"><h4>2. Problem → fix</h4><p>Something doesn't work well, researchers try a fix, and it improves.</p><p><b>Approach:</b> Find the bottleneck, then find the "since/because" clause about the fix. The answer links the fix's property to the bottleneck. <i>Example: the microbial fuel cell question (R&amp;W #11).</i></p></div>
<div class="day-plan-card"><h4>3. Prediction vs. result</h4><p>"If theory X were true, we'd expect Y. But researchers found Z."</p><p><b>Approach:</b> Ask whether the result matches the prediction. If it does, the answer says the theory is supported. If it doesn't, the answer says the theory is weakened or incomplete. Watch for answers that say the theory is "proven" or "disproven"; that's usually too strong.</p></div>
<div class="day-plan-card"><h4>4. Conventional view vs. new finding</h4><p>"Scholars have long believed X. However, recent evidence shows…"</p><p><b>Approach:</b> The answer almost always says the old view is wrong or incomplete in one specific way, not that everything is wrong. Look for the exact detail the new evidence challenges.</p></div>
<div class="day-plan-card"><h4>5. Isolating a variable</h4><p>"Group A got the treatment and Group B didn't. Otherwise they were identical, and A did better."</p><p><b>Approach:</b> The one difference between the groups is the cause. The answer credits that difference, not something both groups shared.</p></div>
<div class="day-plan-card"><h4>6. Limitation or flaw</h4><p>The passage describes a study or claim, then hints at a weakness ("however, the study only examined…" or "but these results were based on…").</p><p><b>Approach:</b> Name the gap: small or narrow sample, correlation instead of causation, or a missing group. The answer usually says the conclusion is premature, or that more research on that specific gap is needed.</p></div>

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

export default function StrategyGuide() {
  const navigate = useNavigate();
  return (
    <div id="view-strategy">
      <button className="btn ghost back-home-link" onClick={() => navigate('/')}>← Back to Dashboard</button>
      <RenderedContent className="strategy-wrap" html={STRATEGY_HTML} />
    </div>
  );
}
