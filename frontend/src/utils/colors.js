// Stable colors derived from an id, so a project or person keeps the same color
// everywhere. All are dark enough for white text. Green comes first as the brand color.
const PROJECT_COLORS = [
  ['#137333', '#34a853'],
  ['#00695c', '#1e9e8a'],
  ['#1967d2', '#4285f4'],
  ['#6a1b9a', '#9c4dcc'],
  ['#b0500a', '#e37400'],
  ['#ad1457', '#d81b60'],
  ['#37474f', '#607d8b'],
];

const AVATAR_COLORS = ['#137333', '#00695c', '#1967d2', '#6a1b9a', '#b0500a', '#ad1457', '#37474f'];

function hash(value) {
  let h = 0;
  for (const ch of String(value ?? '')) h = (h * 31 + ch.codePointAt(0)) | 0;
  return Math.abs(h);
}

export function projectGradient(id) {
  const [from, to] = PROJECT_COLORS[hash(id) % PROJECT_COLORS.length];
  return `linear-gradient(135deg, ${from}, ${to})`;
}

export const avatarColor = (seed) => AVATAR_COLORS[hash(seed) % AVATAR_COLORS.length];

export const firstLetter = (text) => (String(text ?? '').trim()[0] || '?').toUpperCase();
