// Lets pages tell shared UI that data changed, so it refreshes right away. No polling.
export const TASKS_CHANGED = 'jomnoub:tasks-changed'; // notification bell
export const PROJECTS_CHANGED = 'jomnoub:projects-changed'; // sidebar project list

export const notifyTasksChanged = () => window.dispatchEvent(new Event(TASKS_CHANGED));
export const notifyProjectsChanged = () => window.dispatchEvent(new Event(PROJECTS_CHANGED));
