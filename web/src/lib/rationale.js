// Question rationales are written as "Choice X is the best answer/correct...
// Choice Y is incorrect... Choice Z is incorrect..." (English runs these
// together in one paragraph; Math separates them with blank lines) — split on
// each "Choice X is" boundary and bucket by whether that letter is the actual
// correct answer, so the UI can show the right-answer explanation distinctly
// from the wrong-answer ones. Free-response (SPR) rationales don't reference
// choices at all ("The correct answer is 210...") and are left as one block.
export function splitRationale(rationale, correctLetters) {
  if (!rationale) return { correct: '', others: [] };
  const parts = rationale
    .split(/(?=Choice [A-D] is )/g)
    .map((s) => s.trim())
    .filter(Boolean);

  if (parts.length <= 1) return { correct: rationale, others: [] };

  const correct = [];
  const others = [];
  parts.forEach((part) => {
    const m = part.match(/^Choice ([A-D]) is/);
    if (m && correctLetters.includes(m[1])) correct.push(part);
    else others.push(part);
  });

  // If nothing matched a correct letter (unexpected phrasing), fall back to
  // showing the whole thing as one block rather than mis-bucketing it.
  if (!correct.length) return { correct: rationale, others: [] };
  return { correct: correct.join('\n\n'), others };
}
