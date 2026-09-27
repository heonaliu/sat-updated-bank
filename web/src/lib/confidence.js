// How sure the user was on a question, picked after checking the answer.
// Everything except 'knew' counts as "unsure" for the Review Unsure filter.
export const CONFIDENCE_OPTIONS = [
  { id: 'knew', label: 'Knew it', cls: 'knew' },
  { id: 'two', label: 'Narrowed to 2', cls: 'two' },
  { id: 'guessed', label: 'Guessed', cls: 'guessed' },
  { id: 'no_idea', label: "Didn't know at all", cls: 'no-idea' },
];

export function isUnsure(p) {
  return !!(p && p.checked && p.confidence && p.confidence !== 'knew');
}
