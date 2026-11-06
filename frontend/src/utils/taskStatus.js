import { timeAgo } from './dates';

export const STATUSES = [
  { value: 'todo', label: 'To do', color: 'var(--status-todo)' },
  { value: 'in-progress', label: 'In progress', color: 'var(--status-progress)' },
  { value: 'done', label: 'Done', color: 'var(--status-done)' },
];

export const statusLabel = (value) => STATUSES.find((s) => s.value === value)?.label || value;

// The one obvious thing to do next with a task at each stage
export const NEXT_STEP = {
  todo: { status: 'in-progress', label: 'Start' },
  'in-progress': { status: 'done', label: 'Mark complete' },
  done: { status: 'in-progress', label: 'Reopen' },
};

const byWhom = (action, person) => (person?.name ? `${action} by ${person.name}` : action);

// "Started by Sam · 2 h ago" or "Completed by Alex · Nov 6". Empty for tasks with no
// record, such as those finished before the app kept one.
export function statusNote(t) {
  if (t.status === 'done' && t.completedAt) {
    const day = new Date(t.completedAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
    return `${byWhom('Completed', t.completedBy)} · ${day}`;
  }
  if (t.status === 'in-progress' && t.startedAt) {
    return `${byWhom('Started', t.startedBy)} · ${timeAgo(t.startedAt)}`;
  }
  return '';
}
