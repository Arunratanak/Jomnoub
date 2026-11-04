// Lets pages tell the notification bell that tasks changed, so it refreshes
// right away instead of waiting for the next window focus. No polling.
export const TASKS_CHANGED = 'taskhub:tasks-changed';
export const notifyTasksChanged = () => window.dispatchEvent(new Event(TASKS_CHANGED));
