// Tactical tips shown after answering a question, keyed by the exact skill/
// domain strings used in the question data. Adapted from the same tactics in
// StrategyGuide.jsx, just re-organized for per-question lookup.

export const SKILL_TIPS = {
  'Inferences': 'Read the passage once for the main point, then answer in your own words before looking at choices. Eliminate choices that are too broad, too narrow, or contradict the text.',
  'Central Ideas and Details': 'Read the passage once for the main point, then answer in your own words before looking at choices. Eliminate choices that are too broad, too narrow, or contradict the text.',
  'Command of Evidence': 'Identify exactly what claim needs support, then find the choice that most directly and specifically backs it — not just a related fact.',
  'Words in Context': 'Cover the answer choices, predict a simple word that fits, then match it to the closest choice. Watch for a choice that’s a "normal" definition of the word but wrong in this specific context.',
  'Text Structure and Purpose': 'Ask "why did the author write this sentence/paragraph?" — supporting, contrasting, qualifying, introducing, or concluding.',
  'Cross-Text Connections': 'Find the point of agreement or disagreement between the two texts before reading the choices.',
  'Rhetorical Synthesis': 'Reread the stated goal carefully — most wrong answers are true statements that just don’t achieve the specific goal asked for.',
  'Transitions': 'Determine the logical relationship between the two ideas first (continue, contrast, cause/effect, example) — then pick the transition word that matches.',
  'Boundaries': 'Check for a complete sentence on each side of the punctuation mark. A comma alone can’t join two complete sentences; a period, semicolon, or colon can.',
  'Form, Structure, and Sense': 'Find the true subject of the verb (ignore interrupting phrases) and match number/tense to it, not to a nearby noun.',
};

export const DOMAIN_TIPS = {
  'Algebra': 'For systems with "no solution," "one solution," or "infinitely many solutions," compare the coefficients. If a question has variables in the answer choices, try plugging in numbers or plugging the answer choices back into the equation.',
  'Advanced Math': 'For quadratics, know when to factor vs. use the quadratic formula vs. complete the square (questions about the vertex or "no real solutions" hint at completing the square/discriminant).',
  'Problem-Solving and Data Analysis': 'Percent change: new = original × (1 ± rate) — watch for "percent of" vs. "percentage point" language. For two-way tables, double-check whether you need a row, column, or grand total in the denominator.',
  'Geometry and Trigonometry': 'Memorize the special right triangles (30-60-90 and 45-45-90) — they appear constantly. For similar figures, side lengths scale by k, area by k², volume by k³.',
};

export const PASSAGE_BREAKDOWN_TIPS = [
  'Read for the main idea first — don’t get stuck decoding every clause on the first pass.',
  'Break long sentences into chunks: strip out anything between commas, dashes, or parentheses to find the core subject-verb-object first.',
  'Track what each sentence is doing (introducing, giving evidence, contrasting, concluding), not just what it says.',
  'Underline the one claim being tested and the specific evidence for it — everything else is usually a detail the wrong answers are testing whether you got distracted by.',
];

export function getStrategyTip(subject, domain, skill) {
  if (subject === 'english') return SKILL_TIPS[skill] || DOMAIN_TIPS[domain] || null;
  return DOMAIN_TIPS[domain] || null;
}
