// Demo content for scripts/seed.js (npm run seed). Fake people only.

export const DEMO_PROJECT = {
  name: 'Demo project',
  description: 'Sample data for the Jomnoub demo. Remove it with npm run seed:clear.',
};

// Task title -> [subtask title, note, done]
export const DEMO_SUBTASKS = {
  'Add dashboard charts': [
    ['Pick chart types', 'Donut for status, stacked bars for workload.', true],
    ['Connect to the stats API', '', true],
    ['Check colors in dark mode', 'Run the palette check again after any change.', false],
  ],
  'Prepare presentation slides': [
    ['Write the outline', 'Problem, architecture, demo, security.', true],
    ['Make the slides', '', false],
    ['Rehearse with the timer', 'Keep it under 8 minutes.', false],
  ],
};

// Task title -> teammate key: waits for the owner to accept or decline
export const DEMO_SUGGESTIONS = { 'Write the README': 'alex' };

// Chat history, oldest first: [author key, text]
export const DEMO_MESSAGES = [
  ['me', 'Hi everyone, welcome to the project! Please check your tasks on the board.'],
  ['alex', 'Thanks! I started on the task API today.'],
  ['sam', 'I will finish the unit tests once the API is stable.'],
  ['jordan', 'Wireframes are almost ready. Can someone review them tomorrow?'],
  ['me', 'Sure, send them over and I will take a look.'],
  ['alex', 'I suggested the README task for you, since you know the setup best.'],
];

// Become users with email <key>@example.invalid and isDemo: true
export const DEMO_TEAMMATES = [
  { key: 'alex', name: 'Alex Demo' },
  { key: 'sam', name: 'Sam Demo' },
  { key: 'jordan', name: 'Jordan Demo' },
];

// [title, status, assignee key ('me' = SEED_EMAIL user, null = unassigned),
//  deadline in days from today (null = none), creator key]
export const DEMO_TASKS = [
  ['Write project proposal', 'done', 'me', -10, 'me'],
  ['Set up GitHub repository', 'done', 'alex', -8, 'me'],
  ['Design the database schema', 'done', 'sam', -6, 'alex'],
  ['Build Google sign-in', 'done', 'me', -4, 'me'],
  ['Write API unit tests', 'todo', 'sam', -3, 'sam'],
  ['Create UI wireframes', 'in-progress', 'jordan', -2, 'jordan'],
  ['Implement the task API', 'in-progress', 'alex', -1, 'alex'],
  ['Add dashboard charts', 'in-progress', 'me', 1, 'me'],
  ['Test the invite flow', 'todo', 'jordan', 2, 'me'],
  ['Prepare presentation slides', 'todo', 'me', 4, 'me'],
  ['Accessibility review', 'todo', 'sam', 6, 'jordan'],
  ['Write the README', 'todo', null, null, 'alex'],
];
