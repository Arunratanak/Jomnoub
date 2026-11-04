import Activity from '../models/Activity.js';

const MAX_LENGTH = 200;

// Records an activity entry. Never throws: a failed log must not break the
// request that triggered it, so errors are logged (message only) and swallowed.
export async function logActivity(projectId, actorId, message) {
  try {
    let text = String(message);
    if (text.length > MAX_LENGTH) text = `${text.slice(0, MAX_LENGTH - 3)}...`;
    await Activity.create({ project: projectId, actor: actorId, message: text });
  } catch (err) {
    console.error('Activity log failed:', err.message);
  }
}

// Quote a task title for messages, keeping long titles short
export const quote = (title) => {
  const t = String(title ?? '');
  return `"${t.length > 60 ? `${t.slice(0, 57)}...` : t}"`;
};
