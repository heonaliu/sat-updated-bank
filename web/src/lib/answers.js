// Ported verbatim from app/app.js — English's correctAnswer is a plain string,
// Math's is an array (sometimes multiple accepted equivalent forms for SPR).

export function correctAnswerList(q) {
  return Array.isArray(q.correctAnswer) ? q.correctAnswer : [q.correctAnswer];
}

export function parseNum(str) {
  str = String(str).trim();
  if (str === '') return NaN;
  const fracMatch = str.match(/^-?\d+(\.\d+)?\s*\/\s*-?\d+(\.\d+)?$/);
  if (fracMatch) {
    const parts = str.split('/');
    return parseFloat(parts[0]) / parseFloat(parts[1]);
  }
  return parseFloat(str.replace(/,/g, ''));
}

export function sprCorrect(userInput, accepted) {
  const uv = parseNum(userInput);
  if (isNaN(uv)) return false;
  return accepted.some((a) => {
    const av = parseNum(a);
    if (isNaN(av)) return false;
    const tol = Math.max(0.005, Math.abs(av) * 0.005);
    return Math.abs(uv - av) <= tol;
  });
}
