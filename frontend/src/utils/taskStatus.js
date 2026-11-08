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

// Everyone a task is for: its assignees, plus the owner while a suggestion waits for them
export function taskPeople(t, owner) {
  const people = [...(t.assignees || [])];
  if (t.suggestedBy && owner && !people.some((p) => p._id === owner._id)) people.push(owner);
  return people;
}

// "Alex", "Alex and Sam", "Alex, Sam and Jordan"
export function joinNames(people) {
  const names = people.map((p) => p.name);
  return names.length <= 1 ? names.join('') : `${names.slice(0, -1).join(', ')} and ${names[names.length - 1]}`;
}

// How the To do column groups tasks for the person looking at it
export function splitTodo(tasks, peopleOf, currentUserId) {
  const includesMe = (t) => peopleOf(t).some((p) => p._id === currentUserId);
  return {
    mine: tasks.filter(includesMe),
    open: tasks.filter((t) => peopleOf(t).length === 0),
    teammates: tasks.filter((t) => peopleOf(t).length > 0 && !includesMe(t)),
  };
}

// Teammates' tasks, one group per person, or per pair of people for a task they share,
// in name order
export function groupByPeople(tasks, peopleOf) {
  const groups = new Map();
  for (const t of tasks) {
    const people = [...peopleOf(t)].sort((a, b) => a.name.localeCompare(b.name));
    const key = people.map((p) => p._id).join('+');
    if (!groups.has(key)) groups.set(key, { key, people, tasks: [] });
    groups.get(key).tasks.push(t);
  }
  return [...groups.values()].sort((a, b) => joinNames(a.people).localeCompare(joinNames(b.people)));
}

// A click anywhere on a task's card opens it, unless it landed on one of the card's own
// controls or the person was selecting text to copy
export const opensCard = (e) =>
  !e.target.closest('button, a, input, select, textarea, label, .comment-box') && !window.getSelection()?.toString();

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
