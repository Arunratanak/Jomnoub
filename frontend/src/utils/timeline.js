import { isOverdue } from './dates.js';

export const OVERDUE = 'overdue';
export const NO_DEADLINE = 'none';

// Deadlines are stored as UTC midnight, so the UTC date string is the task's calendar day
export const utcDay = (date) => new Date(date).toISOString().slice(0, 10);

// Groups tasks for the timeline: Overdue first (oldest first), then each
// deadline date ascending, then "No deadline" last. Returns [{ key, tasks }].
export function groupTasks(tasks) {
  const groups = new Map();
  const add = (key, t) => (groups.has(key) ? groups.get(key).push(t) : groups.set(key, [t]));
  for (const t of tasks) {
    if (isOverdue(t)) add(OVERDUE, t);
    else if (t.deadline) add(utcDay(t.deadline), t);
    else add(NO_DEADLINE, t);
  }
  const dateKeys = [...groups.keys()].filter((k) => k !== OVERDUE && k !== NO_DEADLINE).sort();
  const order = [
    ...(groups.has(OVERDUE) ? [OVERDUE] : []),
    ...dateKeys,
    ...(groups.has(NO_DEADLINE) ? [NO_DEADLINE] : []),
  ];
  return order.map((key) => ({
    key,
    tasks: key === OVERDUE
      ? groups.get(key).sort((a, b) => new Date(a.deadline) - new Date(b.deadline))
      : groups.get(key),
  }));
}
